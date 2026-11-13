"""Profile endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import UserOut, UserPatch

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
