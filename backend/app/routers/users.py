"""Public runner profiles, search, follow / unfollow and what a viewer may see of someone's activities."""

import base64
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models import Activity, Follow, User
from app.routers.activities import _decode_cursor, _encode_cursor
from app.schemas import (
    FollowStateOut,
    PointOut,
    PublicActivityDetailOut,
    PublicActivityListOut,
    PublicActivityOut,
    PublicProfileOut,
    UserSummaryListOut,
    UserSummaryOut,
)

router = APIRouter(prefix="/users", tags=["users"])


# ---- shared helpers (also used by /me/following and /me/followers) ----------


def following_ids(db: Session, viewer_id: uuid.UUID, candidate_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    if not candidate_ids:
        return set()
    return set(
        db.scalars(select(Follow.followed_id).where(Follow.follower_id == viewer_id, Follow.followed_id.in_(candidate_ids)))
    )


def summaries(db: Session, viewer: User, users: list[User]) -> list[UserSummaryOut]:
    followed = following_ids(db, viewer.id, [u.id for u in users])
    return [
        UserSummaryOut(
            id=u.id,
            handle=u.handle,
            display_name=u.display_name,
            city=u.city,
            level=u.level,
            avatar_url=u.avatar_url,
            is_following=u.id in followed,
        )
        for u in users
    ]


def _discoverable(user: User | None) -> bool:
    return user is not None and user.status == "active" and user.is_public and user.handle is not None


def _by_handle(db: Session, viewer: User, handle: str) -> User:
    user = db.scalar(select(User).where(User.handle == handle.strip().lstrip("@").lower()))
    # A private profile looks exactly like a missing one, except to its owner.
    if user is None or user.status != "active" or (user.id != viewer.id and not _discoverable(user)):
        raise AppError(404, "not_found", "Runner not found")
    return user


def _allowed_visibilities(viewer: User, owner: User, is_follower: bool) -> list[str]:
    if viewer.id == owner.id:
        return ["private", "followers", "public"]
    if not _discoverable(owner):
        return []
    return ["public", "followers"] if is_follower else ["public"]


def _is_follower(db: Session, viewer: User, owner: User) -> bool:
    return viewer.id != owner.id and owner.id in following_ids(db, viewer.id, [owner.id])


# ---- search and profile ---------------------------------------------------


def _like_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("", response_model=UserSummaryListOut)
def search_runners(
    q: str = Query("", max_length=50),
    city: str | None = Query(None, max_length=80),
    limit: int = Query(20, ge=1, le=50),
    cursor: str | None = None,
    viewer: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Public runners, by handle / name prefix and optionally by city. Ordered by handle."""
    stmt = select(User).where(
        User.is_public.is_(True), User.status == "active", User.handle.is_not(None), User.id != viewer.id
    )
    q = q.strip().lstrip("@").lower()
    if q:
        pattern = f"{_like_escape(q)}%"
        stmt = stmt.where(
            or_(User.handle.like(pattern, escape="\\"), func.lower(User.display_name).like(pattern, escape="\\"))
        )
    if city and city.strip():
        stmt = stmt.where(func.lower(User.city) == city.strip().lower())
    if cursor:
        try:
            last = base64.urlsafe_b64decode(cursor.encode()).decode()
        except Exception:
            raise AppError(422, "invalid_cursor", "Invalid pagination cursor")
        stmt = stmt.where(User.handle > last)
    rows = list(db.scalars(stmt.order_by(User.handle).limit(limit + 1)))
    has_more = len(rows) > limit
    rows = rows[:limit]
    next_cursor = base64.urlsafe_b64encode(rows[-1].handle.encode()).decode() if has_more else None
    return UserSummaryListOut(items=summaries(db, viewer, rows), next_cursor=next_cursor)


@router.get("/{handle}", response_model=PublicProfileOut)
def get_profile(handle: str, viewer: User = Depends(get_current_user), db: Session = Depends(get_db)):
    owner = _by_handle(db, viewer, handle)
    is_follower = _is_follower(db, viewer, owner)
    visible = _allowed_visibilities(viewer, owner, is_follower)

    followers_count = db.scalar(select(func.count()).select_from(Follow).where(Follow.followed_id == owner.id)) or 0
    following_count = db.scalar(select(func.count()).select_from(Follow).where(Follow.follower_id == owner.id)) or 0
    count, distance = db.execute(
        select(func.count(Activity.id), func.coalesce(func.sum(Activity.distance_m), 0.0)).where(
            Activity.user_id == owner.id, Activity.visibility.in_(visible)
        )
    ).one()

    return PublicProfileOut(
        id=owner.id,
        handle=owner.handle,
        display_name=owner.display_name,
        city=owner.city,
        level=owner.level,
        avatar_url=owner.avatar_url,
        is_following=is_follower,
        bio=owner.bio,
        followers_count=followers_count,
        following_count=following_count,
        activities_count=count,
        total_distance_m=float(distance),
        is_me=viewer.id == owner.id,
        created_at=owner.created_at,
    )


# ---- what a viewer may see of someone's activities --------------------------


@router.get("/{handle}/activities", response_model=PublicActivityListOut)
def list_runner_activities(
    handle: str,
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    viewer: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owner = _by_handle(db, viewer, handle)
    visible = _allowed_visibilities(viewer, owner, _is_follower(db, viewer, owner))
    stmt = select(Activity).where(Activity.user_id == owner.id, Activity.visibility.in_(visible))
    if cursor:
        c_ts, c_id = _decode_cursor(cursor)
        stmt = stmt.where(or_(Activity.started_at < c_ts, and_(Activity.started_at == c_ts, Activity.id < c_id)))
    rows = list(db.scalars(stmt.order_by(Activity.started_at.desc(), Activity.id.desc()).limit(limit + 1)))
    has_more = len(rows) > limit
    rows = rows[:limit]
    return PublicActivityListOut(
        items=[PublicActivityOut.model_validate(a) for a in rows],
        next_cursor=_encode_cursor(rows[-1]) if has_more else None,
    )


@router.get("/{handle}/activities/{activity_id}", response_model=PublicActivityDetailOut)
def get_runner_activity(
    handle: str,
    activity_id: uuid.UUID,
    include_points: bool = False,
    viewer: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """An activity as others see it (the owner can use this to preview what is shared)."""
    owner = _by_handle(db, viewer, handle)
    visible = _allowed_visibilities(viewer, owner, _is_follower(db, viewer, owner))
    stmt = select(Activity).where(
        Activity.id == activity_id, Activity.user_id == owner.id, Activity.visibility.in_(visible)
    )
    if include_points:
        stmt = stmt.options(selectinload(Activity.points))
    activity = db.scalar(stmt)
    if activity is None:
        # Same answer whether it is missing, private, or followers-only.
        raise AppError(404, "not_found", "Activity not found")

    # Build from the public fields only: validating the ORM object directly would read `activity.points`.
    out = PublicActivityDetailOut(**PublicActivityOut.model_validate(activity).model_dump(), points=None)
    if include_points:
        out.points = [
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
    return out


# ---- follow / unfollow ----------------------------------------------------


def _followers_count(db: Session, user_id: uuid.UUID) -> int:
    return db.scalar(select(func.count()).select_from(Follow).where(Follow.followed_id == user_id)) or 0


@router.post("/{user_id}/follow", response_model=FollowStateOut, status_code=201)
def follow(
    user_id: uuid.UUID,
    response: Response,
    viewer: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """201 = now following, 200 = already following."""
    if user_id == viewer.id:
        raise AppError(422, "cannot_follow_self", "You cannot follow yourself")
    target = db.get(User, user_id)
    if not _discoverable(target):
        raise AppError(404, "not_found", "Runner not found")

    if db.get(Follow, (viewer.id, target.id)) is None:
        db.add(Follow(follower_id=viewer.id, followed_id=target.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # a concurrent identical request won the race
            response.status_code = 200
        else:
            return FollowStateOut(is_following=True, followers_count=_followers_count(db, target.id))
    else:
        response.status_code = 200
    return FollowStateOut(is_following=True, followers_count=_followers_count(db, target.id))


@router.delete("/{user_id}/follow", status_code=204)
def unfollow(user_id: uuid.UUID, viewer: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Idempotent. Allowed even if the other profile has since gone private."""
    existing = db.get(Follow, (viewer.id, user_id))
    if existing is not None:
        db.delete(existing)
        db.commit()
    return Response(status_code=204)


def encode_follow_cursor(created_at: datetime, other_id: uuid.UUID) -> str:
    return base64.urlsafe_b64encode(f"{created_at.isoformat()}|{other_id}".encode()).decode()


def decode_follow_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        ts, uid = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        return datetime.fromisoformat(ts), uuid.UUID(uid)
    except Exception:
        raise AppError(422, "invalid_cursor", "Invalid pagination cursor")
