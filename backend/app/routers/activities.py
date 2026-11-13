"""Activity sync and history endpoints."""

import base64
import hashlib
import json
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import and_, insert, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.db import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models import Activity, ActivityPoint, User
from app.schemas import ActivityDetailOut, ActivityListOut, ActivityOut, ActivitySyncIn, PointOut, VisibilityIn
from app.services.metrics import ALGORITHM_VERSION, Point, compute_metrics

router = APIRouter(prefix="/activities", tags=["activities"])


def _payload_hash(body: ActivitySyncIn) -> str:
    canonical = json.dumps(body.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


def _find_by_client_id(db: Session, user_id: uuid.UUID, client_id: str) -> Activity | None:
    return db.scalar(select(Activity).where(Activity.user_id == user_id, Activity.client_activity_id == client_id))


def _existing_response(existing: Activity, input_hash: str, response: Response) -> Activity:
    if existing.input_hash != input_hash:
        # Never overwrite silently: the client must decide what to do.
        raise AppError(
            409,
            "activity_conflict",
            "An activity with this client_activity_id already exists with different content",
        )
    response.status_code = 200
    return existing


@router.post("/sync", response_model=ActivityOut, status_code=201)
def sync_activity(
    body: ActivitySyncIn,
    response: Response,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Idempotent upload of a finished activity.

    201 = created, 200 = identical activity already stored, 409 = same id, different content.
    """
    if len(body.points) > get_settings().max_points_per_activity:
        raise AppError(413, "too_many_points", "Too many GPS points for one activity")

    input_hash = _payload_hash(body)
    existing = _find_by_client_id(db, user.id, body.client_activity_id)
    if existing:
        return _existing_response(existing, input_hash, response)

    started_ms = int(body.started_at.timestamp() * 1000)
    ended_ms = int(body.ended_at.timestamp() * 1000)
    metrics = compute_metrics(
        [Point(p.timestamp, p.latitude, p.longitude, p.altitude, p.accuracy, p.speed) for p in body.points],
        started_ms,
        ended_ms,
    )

    activity = Activity(
        user_id=user.id,
        client_activity_id=body.client_activity_id,
        name=body.name.strip(),
        status="finished",
        started_at=body.started_at,
        ended_at=body.ended_at,
        duration_s=metrics.duration_s,
        moving_time_s=metrics.moving_time_s,
        distance_m=metrics.distance_m,
        elevation_gain_m=metrics.elevation_gain_m,
        avg_pace_s_per_km=metrics.avg_pace_s_per_km,
        avg_speed_kmh=metrics.avg_speed_kmh,
        algorithm_version=ALGORITHM_VERSION,
        quality=metrics.quality,
        client_metrics=body.client_metrics.model_dump(exclude_none=True) if body.client_metrics else None,
        input_hash=input_hash,
    )
    db.add(activity)
    try:
        db.flush()
        db.execute(
            insert(ActivityPoint),
            [
                {
                    "activity_id": activity.id,
                    "seq": i,
                    "ts_ms": p.timestamp,
                    "latitude": p.latitude,
                    "longitude": p.longitude,
                    "altitude": p.altitude,
                    "accuracy": p.accuracy,
                    "speed": p.speed,
                }
                for i, p in enumerate(body.points)
            ],
        )
        db.commit()
    except IntegrityError:
        # A concurrent request with the same client_activity_id won the race.
        db.rollback()
        existing = _find_by_client_id(db, user.id, body.client_activity_id)
        if existing is None:
            raise
        return _existing_response(existing, input_hash, response)
    return activity


def _encode_cursor(a: Activity) -> str:
    return base64.urlsafe_b64encode(f"{a.started_at.isoformat()}|{a.id}".encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        ts, aid = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        return datetime.fromisoformat(ts), uuid.UUID(aid)
    except Exception:
        raise AppError(422, "invalid_cursor", "Invalid pagination cursor")


@router.get("", response_model=ActivityListOut)
def list_activities(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Activity).where(Activity.user_id == user.id)
    if cursor:
        c_ts, c_id = _decode_cursor(cursor)
        stmt = stmt.where(or_(Activity.started_at < c_ts, and_(Activity.started_at == c_ts, Activity.id < c_id)))
    rows = list(db.scalars(stmt.order_by(Activity.started_at.desc(), Activity.id.desc()).limit(limit + 1)))
    has_more = len(rows) > limit
    rows = rows[:limit]
    return ActivityListOut(items=rows, next_cursor=_encode_cursor(rows[-1]) if has_more else None)


def _owned(db: Session, user: User, activity_id: uuid.UUID, with_points: bool = False) -> Activity:
    stmt = select(Activity).where(Activity.id == activity_id, Activity.user_id == user.id)
    if with_points:
        stmt = stmt.options(selectinload(Activity.points))
    activity = db.scalar(stmt)
    if activity is None:
        # Same answer for "missing" and "belongs to someone else".
        raise AppError(404, "not_found", "Activity not found")
    return activity


@router.get("/{activity_id}", response_model=ActivityDetailOut)
def get_activity(
    activity_id: uuid.UUID,
    include_points: bool = False,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activity = _owned(db, user, activity_id, with_points=include_points)
    base = ActivityOut.model_validate(activity).model_dump()
    points = None
    if include_points:
        points = [
            PointOut(
                seq=p.seq,
                timestamp=p.ts_ms,
                latitude=p.latitude,
                longitude=p.longitude,
                altitude=p.altitude,
                accuracy=p.accuracy,
                speed=p.speed,
            )
            for p in activity.points
        ]
    return ActivityDetailOut(**base, points=points)


@router.patch("/{activity_id}/visibility", response_model=ActivityOut)
def set_visibility(
    activity_id: uuid.UUID,
    body: VisibilityIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Owner only. Sharing needs a public profile: otherwise nobody could see the activity anyway."""
    activity = _owned(db, user, activity_id)
    if body.visibility != "private" and not user.is_public:
        raise AppError(409, "profile_not_public", "Make your profile public before sharing activities")
    activity.visibility = body.visibility
    db.commit()
    return activity


@router.delete("/{activity_id}", status_code=204)
def delete_activity(activity_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    activity = _owned(db, user, activity_id)
    db.delete(activity)
    db.commit()
    return Response(status_code=204)
