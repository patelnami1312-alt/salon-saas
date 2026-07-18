from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from datetime import datetime, timedelta, timezone
from typing import Optional
import asyncio

from app.core.database import get_async_db
from app.core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, generate_otp,
    generate_secure_token, generate_referral_code, validate_password_strength,
)
from app.core.dependencies import get_current_active_user
from app.core.redis_client import store_otp, verify_otp, blacklist_token, check_rate_limit
from app.core.config import settings
from app.models.user import User, Role, RefreshToken
from app.schemas.auth import (
    LoginRequest, SignupRequest, OTPVerifyRequest, ForgotPasswordRequest,
    ResetPasswordRequest, RefreshTokenRequest, ChangePasswordRequest,
    TokenResponse, UserResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_token_response(user: User, db_session) -> dict:
    payload = {
        "sub": str(user.UserID),
        "salon_id": user.SalonID,
        "branch_id": user.BranchID,
        "role": user.role.RoleCode if user.role else "",
    }
    access_token = create_access_token(payload)
    refresh_token = create_refresh_token(payload)
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "user_id": user.UserID,
            "salon_id": user.SalonID,
            "branch_id": user.BranchID,
            "role_code": user.role.RoleCode if user.role else "",
            "role_name": user.role.RoleName if user.role else "",
            "first_name": user.FirstName,
            "last_name": user.LastName,
            "email": user.Email,
            "phone": user.Phone,
            "profile_picture_url": user.ProfilePictureURL,
            "is_email_verified": user.IsEmailVerified,
        },
    }


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_async_db),
):
    ip = request.client.host
    rate_key = f"login:{ip}"
    if not await check_rate_limit(rate_key, limit=10, window=300):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many login attempts")

    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.Email == data.email, User.IsActive == True)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.LockedUntil and user.LockedUntil > datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account locked. Try again after {user.LockedUntil.isoformat()}",
        )

    # Run bcrypt in a thread pool so it doesn't block the async event loop
    loop = asyncio.get_event_loop()
    password_valid = await loop.run_in_executor(None, verify_password, data.password, user.PasswordHash)
    if not password_valid:
        user.FailedLoginAttempts += 1
        if user.FailedLoginAttempts >= 5:
            user.LockedUntil = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.FailedLoginAttempts = 0
    user.LockedUntil = None
    user.LastLoginAt = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()

    token_data = _build_token_response(user, db)

    # Store refresh token in DB
    db_token = RefreshToken(
        UserID=user.UserID,
        Token=token_data["refresh_token"],
        ExpiresAt=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        IPAddress=ip,
    )
    db.add(db_token)
    await db.commit()

    return token_data


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: RefreshTokenRequest, db: AsyncSession = Depends(get_async_db)):
    payload = decode_token(data.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.Token == data.refresh_token,
            RefreshToken.IsRevoked == False,
        )
    )
    db_token = result.scalar_one_or_none()

    if not db_token or db_token.ExpiresAt < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user_id = int(payload.get("sub"))
    result = await db.execute(
        select(User).options(selectinload(User.role)).where(User.UserID == user_id, User.IsActive == True)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    db_token.IsRevoked = True
    await db.commit()

    token_data = _build_token_response(user, db)
    new_token = RefreshToken(
        UserID=user.UserID,
        Token=token_data["refresh_token"],
        ExpiresAt=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_token)
    await db.commit()
    return token_data


@router.post("/logout")
async def logout(
    data: RefreshTokenRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db),
):
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.Token == data.refresh_token,
            RefreshToken.UserID == current_user.UserID,
        )
    )
    db_token = result.scalar_one_or_none()
    if db_token:
        db_token.IsRevoked = True
        await db.commit()
    return {"message": "Logged out successfully"}


@router.post("/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
):
    result = await db.execute(select(User).where(User.Email == data.email))
    user = result.scalar_one_or_none()

    if not user:
        return {"message": "If the email exists, a reset link has been sent"}

    token = generate_secure_token()
    user.ResetPasswordToken = token
    user.ResetPasswordExpiry = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)
    await db.commit()

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    background_tasks.add_task(
        NotificationService.send_email,
        to=user.Email,
        subject="Reset Your Password - SalonSaaS",
        body=f"Click the link to reset your password: {reset_url}\n\nThis link expires in 1 hour.",
    )

    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_async_db)):
    result = await db.execute(
        select(User).where(
            User.ResetPasswordToken == data.token,
            User.ResetPasswordExpiry > datetime.now(timezone.utc).replace(tzinfo=None),
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    if not validate_password_strength(data.new_password):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be 8+ chars with uppercase, lowercase, digit, and special char",
        )

    user.PasswordHash = hash_password(data.new_password)
    user.ResetPasswordToken = None
    user.ResetPasswordExpiry = None
    user.FailedLoginAttempts = 0
    user.LockedUntil = None
    await db.commit()

    return {"message": "Password reset successfully"}


@router.post("/send-otp")
async def send_otp(
    data: OTPVerifyRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
):
    identifier = data.email or data.mobile
    if not identifier:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email or mobile required")

    otp = generate_otp()
    await store_otp(identifier, otp, ttl=600)

    if data.email:
        background_tasks.add_task(
            NotificationService.send_email,
            to=data.email,
            subject="Your OTP - SalonSaaS",
            body=f"Your OTP is: {otp}\n\nValid for 10 minutes.",
        )
    else:
        background_tasks.add_task(
            NotificationService.send_sms,
            to=data.mobile,
            message=f"Your SalonSaaS OTP is: {otp}. Valid for 10 minutes.",
        )

    return {"message": "OTP sent successfully"}


@router.post("/verify-otp")
async def verify_otp_endpoint(data: OTPVerifyRequest, db: AsyncSession = Depends(get_async_db)):
    identifier = data.email or data.mobile
    if not identifier:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email or mobile required")

    is_valid = await verify_otp(identifier, data.otp)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")

    if data.email:
        result = await db.execute(select(User).where(User.Email == data.email))
        user = result.scalar_one_or_none()
        if user:
            user.IsEmailVerified = True
            await db.commit()

    return {"message": "OTP verified successfully", "verified": True}


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_async_db),
):
    if not verify_password(data.current_password, current_user.PasswordHash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

    if not validate_password_strength(data.new_password):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password too weak")

    current_user.PasswordHash = hash_password(data.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_active_user)):
    return {
        "user_id": current_user.UserID,
        "salon_id": current_user.SalonID,
        "branch_id": current_user.BranchID,
        "role_code": current_user.role.RoleCode if current_user.role else "",
        "role_name": current_user.role.RoleName if current_user.role else "",
        "first_name": current_user.FirstName,
        "last_name": current_user.LastName,
        "email": current_user.Email,
        "phone": current_user.Phone,
        "profile_picture_url": current_user.ProfilePictureURL,
        "is_email_verified": current_user.IsEmailVerified,
    }
