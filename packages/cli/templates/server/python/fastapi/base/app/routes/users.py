from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User

router = APIRouter()


class CreateUserIn(BaseModel):
    name: str
    email: EmailStr


def serialize(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "createdAt": user.created_at.isoformat(),
    }


@router.get("")
async def list_users(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).order_by(User.id))
    return [serialize(user) for user in result.scalars()]


@router.post("", status_code=201)
async def create_user(body: CreateUserIn, session: AsyncSession = Depends(get_session)):
    user = User(name=body.name, email=body.email)
    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Email already in use")
    await session.refresh(user)
    return serialize(user)


@router.delete("/{user_id}")
async def delete_user(user_id: int, session: AsyncSession = Depends(get_session)):
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    await session.delete(user)
    await session.commit()
    return serialize(user)
