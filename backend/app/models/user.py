from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Role(Base):
    __tablename__ = "Roles"

    RoleID = Column(Integer, primary_key=True, index=True)
    RoleName = Column(String(50), nullable=False, unique=True)
    RoleCode = Column(String(30), nullable=False, unique=True)
    Description = Column(String(200))
    IsSystem = Column(Boolean, nullable=False, default=False)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    users = relationship("User", back_populates="role")
    permissions = relationship("RolePermission", back_populates="role")


class Permission(Base):
    __tablename__ = "Permissions"

    PermissionID = Column(Integer, primary_key=True, index=True)
    PermissionName = Column(String(100), nullable=False, unique=True)
    Module = Column(String(50), nullable=False)
    Action = Column(String(50), nullable=False)
    Description = Column(String(200))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    roles = relationship("RolePermission", back_populates="permission")


class RolePermission(Base):
    __tablename__ = "RolePermissions"

    RoleID = Column(Integer, ForeignKey("Roles.RoleID"), primary_key=True)
    PermissionID = Column(Integer, ForeignKey("Permissions.PermissionID"), primary_key=True)

    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission", back_populates="roles")


class User(Base):
    __tablename__ = "Users"

    UserID = Column(Integer, primary_key=True, index=True)
    SalonID = Column(Integer, ForeignKey("Salons.SalonID"), nullable=True, index=True)
    BranchID = Column(Integer, ForeignKey("Branches.BranchID"), nullable=True, index=True)
    RoleID = Column(Integer, ForeignKey("Roles.RoleID"), nullable=False)
    FirstName = Column(String(100), nullable=False)
    LastName = Column(String(100), nullable=False)
    Email = Column(String(200), nullable=False, unique=True, index=True)
    Phone = Column(String(20))
    PasswordHash = Column(String(255), nullable=False)
    ProfilePictureURL = Column(String(500))
    IsActive = Column(Boolean, nullable=False, default=True)
    IsEmailVerified = Column(Boolean, nullable=False, default=False)
    EmailVerificationToken = Column(String(255))
    EmailTokenExpiry = Column(DateTime)
    ResetPasswordToken = Column(String(255))
    ResetPasswordExpiry = Column(DateTime)
    OTPCode = Column(String(10))
    OTPExpiry = Column(DateTime)
    LastLoginAt = Column(DateTime)
    FailedLoginAttempts = Column(Integer, nullable=False, default=0)
    LockedUntil = Column(DateTime)
    CreatedAt = Column(DateTime, nullable=False, default=func.now())
    UpdatedAt = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    role = relationship("Role", back_populates="users")
    salon = relationship("Salon", back_populates="users", foreign_keys=[SalonID])
    branch = relationship("Branch", back_populates="users", foreign_keys=[BranchID])
    refresh_tokens = relationship("RefreshToken", back_populates="user")
    staff_profile = relationship("Staff", back_populates="user", uselist=False)

    @property
    def full_name(self) -> str:
        return f"{self.FirstName} {self.LastName}"

    @property
    def role_code(self) -> str:
        return self.role.RoleCode if self.role else ""


class RefreshToken(Base):
    __tablename__ = "RefreshTokens"

    TokenID = Column(Integer, primary_key=True, index=True)
    UserID = Column(Integer, ForeignKey("Users.UserID", ondelete="CASCADE"), nullable=False)
    Token = Column(String(500), nullable=False)
    ExpiresAt = Column(DateTime, nullable=False)
    IsRevoked = Column(Boolean, nullable=False, default=False)
    DeviceInfo = Column(String(500))
    IPAddress = Column(String(50))
    CreatedAt = Column(DateTime, nullable=False, default=func.now())

    user = relationship("User", back_populates="refresh_tokens")
