"""Account and social-profile endpoints for the signed-in user."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.errors import AppError
from app.models import Follow, User
from app.routers.users import decode_follow_cursor, encode_follow_cursor, summaries
from app.schemas import ProfilePatch, UserOut, UserPatch, UserSummaryListOut

router = APIRouter(prefix="/me", tags=["profile"])


@router.get("", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.patch("", response_model=UserOut)
def patch_me(body: UserPatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is not None or field == "display_name":
            setattr(user, field, value)
    db.add(user)
    db.commit()
    return user


@router.patch("/profile", response_model=UserOut)
def patch_profile(body: ProfilePatch, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Edit the public profile. Going public needs a handle; nothing is public by default."""
    changes = body.model_dump(exclude_unset=True)

    new_handle = changes.get("handle", user.handle)
    if changes.get("is_public", user.is_public) and new_handle is None:
        raise AppError(422, "handle_required", "Choose a handle before making your profile public")

    if "handle" in changes and changes["handle"] != user.handle:
        taken = db.scalar(select(User.id).where(User.handle == changes["handle"], User.id != user.id))
        if taken is not None:
            raise AppError(409, "handle_taken", "This handle is already taken")

    for field, value in changes.items():
        setattr(user, field, value)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # lost a race for the same handle
        raise AppError(409, "handle_taken", "This handle is already taken")
    return user


def _follow_page(db: Session, viewer: User, mine_is_follower: bool, limit: int, cursor: str | None):
    """Page through the people I follow (mine_is_follower) or who follow me, newest first."""
    me_col, other_col = (Follow.follower_id, Follow.followed_id) if mine_is_follower else (Follow.followed_id, Follow.follower_id)
    stmt = (
        select(Follow, User)
        .join(User, User.id == other_col)
        .where(me_col == viewer.id, User.status == "active", User.is_public.is_(True), User.handle.is_not(None))
    )
    if cursor:
        c_ts, c_id = decode_follow_cursor(cursor)
        stmt = stmt.where(or_(Follow.created_at < c_ts, and_(Follow.created_at == c_ts, User.id < c_id)))
    pairs = list(db.execute(stmt.order_by(Follow.created_at.desc(), User.id.desc()).limit(limit + 1)).all())
    has_more = len(pairs) > limit
    pairs = pairs[:limit]
    next_cursor = encode_follow_cursor(pairs[-1][0].created_at, pairs[-1][1].id) if has_more else None
    return UserSummaryListOut(items=summaries(db, viewer, [u for _, u in pairs]), next_cursor=next_cursor)


@router.get("/following", response_model=UserSummaryListOut)
def my_following(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _follow_page(db, user, True, limit, cursor)


@router.get("/followers", response_model=UserSummaryListOut)
def my_followers(
    limit: int = Query(20, ge=1, le=100),
    cursor: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _follow_page(db, user, False, limit, cursor)
