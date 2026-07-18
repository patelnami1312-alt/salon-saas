from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional

from app.core.database import get_async_db
from app.core.security import decode_token
from app.models.user import User, Role
from app.models.salon import Salon

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_async_db),
) -> User:
    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id: int = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.UserID == int(user_id), User.IsActive == True)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.IsActive:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return current_user


def require_roles(*roles: str):
    async def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        result_role = await _get_role_code(current_user)
        if result_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(roles)}",
            )
        return current_user
    return role_checker


async def _get_role_code(user: User) -> str:
    return user.role_code if hasattr(user, "role_code") else ""


async def get_salon_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db),
) -> int:
    if current_user.SalonID:
        return current_user.SalonID
    # Super admin with no assigned salon → use the first available salon
    if current_user.role_code == "super_admin":
        result = await db.execute(select(Salon).where(Salon.IsActive == True).limit(1))
        salon = result.scalars().first()
        if salon:
            return salon.SalonID
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No salon associated")


async def get_branch_id(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db),
) -> Optional[int]:
    if current_user.BranchID:
        return current_user.BranchID
    from app.models.salon import Branch
    salon_id = await get_salon_id(current_user, db)
    result = await db.execute(select(Branch).where(Branch.SalonID == salon_id, Branch.IsActive == True).limit(1))
    branch = result.scalars().first()
    return branch.BranchID if branch else None


class SuperAdminOnly:
    async def __call__(self, current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role_code != "super_admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Super admin access required")
        return current_user


class SalonOwnerOrAbove:
    ALLOWED = {"super_admin", "salon_owner"}

    async def __call__(self, current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role_code not in self.ALLOWED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user


OwnerOrAbove = SalonOwnerOrAbove


class ManagerOrAbove:
    ALLOWED = {"super_admin", "salon_owner", "branch_manager"}

    async def __call__(self, current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role_code not in self.ALLOWED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager or above required")
        return current_user


class ReceptionistOrAbove:
    ALLOWED = {"super_admin", "salon_owner", "branch_manager", "receptionist"}

    async def __call__(self, current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.role_code not in self.ALLOWED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Receptionist or above required")
        return current_user
