"""
Seed script — inserts default roles, subscription plans, demo salon, and super admin user.
Run with:  python -m app.scripts.seed
Or called automatically by init_db() when the Users table is empty.
"""
import asyncio
from datetime import datetime, timedelta
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_engine, Base
from app.core.security import hash_password
from app.core.config import settings
from app.models.user import Role, Permission, RolePermission, User
from app.models.salon import SubscriptionPlan, Salon, Branch


ROLES = [
    {"RoleName": "Super Admin",      "RoleCode": "super_admin",      "Description": "Full platform access",           "IsSystem": True},
    {"RoleName": "Salon Owner",      "RoleCode": "salon_owner",      "Description": "Manages own salon",              "IsSystem": True},
    {"RoleName": "Branch Manager",   "RoleCode": "branch_manager",   "Description": "Manages a branch",               "IsSystem": True},
    {"RoleName": "Receptionist",     "RoleCode": "receptionist",     "Description": "Front desk operations",          "IsSystem": True},
    {"RoleName": "Staff",            "RoleCode": "staff",            "Description": "Service provider",               "IsSystem": True},
    {"RoleName": "Customer",         "RoleCode": "customer",         "Description": "Customer portal access",         "IsSystem": True},
]

SUBSCRIPTION_PLANS = [
    {"PlanName": "Free Trial",    "Price": 0,    "BillingCycle": "Monthly", "MaxBranches": 1,  "MaxStaff": 5,   "MaxCustomers": 100,   "Features": "basic"},
    {"PlanName": "Starter",       "Price": 29,   "BillingCycle": "Monthly", "MaxBranches": 1,  "MaxStaff": 10,  "MaxCustomers": 1000,  "Features": "basic,reports"},
    {"PlanName": "Professional",  "Price": 79,   "BillingCycle": "Monthly", "MaxBranches": 3,  "MaxStaff": 30,  "MaxCustomers": 5000,  "Features": "basic,reports,marketing,inventory"},
    {"PlanName": "Enterprise",    "Price": 199,  "BillingCycle": "Monthly", "MaxBranches": 10, "MaxStaff": 100, "MaxCustomers": 50000, "Features": "all"},
]

PERMISSIONS = [
    {"PermissionName": "view_dashboard",       "Module": "dashboard",    "Action": "view"},
    {"PermissionName": "manage_customers",     "Module": "customers",    "Action": "manage"},
    {"PermissionName": "view_customers",       "Module": "customers",    "Action": "view"},
    {"PermissionName": "manage_appointments",  "Module": "appointments", "Action": "manage"},
    {"PermissionName": "view_appointments",    "Module": "appointments", "Action": "view"},
    {"PermissionName": "manage_staff",         "Module": "staff",        "Action": "manage"},
    {"PermissionName": "view_staff",           "Module": "staff",        "Action": "view"},
    {"PermissionName": "manage_billing",       "Module": "billing",      "Action": "manage"},
    {"PermissionName": "view_billing",         "Module": "billing",      "Action": "view"},
    {"PermissionName": "manage_inventory",     "Module": "inventory",    "Action": "manage"},
    {"PermissionName": "view_inventory",       "Module": "inventory",    "Action": "view"},
    {"PermissionName": "manage_services",      "Module": "services",     "Action": "manage"},
    {"PermissionName": "view_reports",         "Module": "reports",      "Action": "view"},
    {"PermissionName": "manage_marketing",     "Module": "marketing",    "Action": "manage"},
    {"PermissionName": "manage_settings",      "Module": "settings",     "Action": "manage"},
    {"PermissionName": "manage_salons",        "Module": "super_admin",  "Action": "manage"},
    {"PermissionName": "manage_subscriptions", "Module": "super_admin",  "Action": "manage"},
    {"PermissionName": "checkin_queue",        "Module": "checkin",      "Action": "manage"},
]


async def seed_database():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(async_engine, expire_on_commit=False) as session:
        result = await session.execute(select(User))
        if result.scalars().first():
            print("[OK] Database already seeded - skipping.")
            return

        print("Seeding database...")

        # ── Roles ─────────────────────────────────────────────────────────────
        role_map: dict[str, Role] = {}
        for r in ROLES:
            role = Role(**r)
            session.add(role)
            role_map[r["RoleCode"]] = role
        await session.flush()
        print(f"  [OK] {len(ROLES)} roles created")

        # ── Permissions ───────────────────────────────────────────────────────
        perm_map: dict[str, Permission] = {}
        for p in PERMISSIONS:
            perm = Permission(**p)
            session.add(perm)
            perm_map[p["PermissionName"]] = perm
        await session.flush()
        print(f"  [OK] {len(PERMISSIONS)} permissions created")

        for perm in perm_map.values():
            session.add(RolePermission(
                RoleID=role_map["super_admin"].RoleID,
                PermissionID=perm.PermissionID,
            ))

        # ── Subscription Plans ────────────────────────────────────────────────
        for plan_data in SUBSCRIPTION_PLANS:
            session.add(SubscriptionPlan(**plan_data))
        await session.flush()
        print(f"  [OK] {len(SUBSCRIPTION_PLANS)} subscription plans created")

        # ── Demo Salon (USA) ──────────────────────────────────────────────────
        demo_salon = Salon(
            SalonName="Luxe Beauty Lounge",
            OwnerName="Jessica Williams",
            Email="hello@luxebeautylounge.com",
            Phone="+1-310-555-0100",
            Address="8420 Sunset Blvd, West Hollywood, CA 90069",
            Currency="USD",
            Timezone="America/Los_Angeles",
            SubscriptionStatus="Active",
            IsActive=True,
        )
        session.add(demo_salon)
        await session.flush()
        print("  [OK] Demo salon created")

        # ── Demo Branch ───────────────────────────────────────────────────────
        demo_branch = Branch(
            SalonID=demo_salon.SalonID,
            BranchName="West Hollywood",
            BranchCode="BR0001",
            Phone="+1-310-555-0101",
            Email="westhollywood@luxebeautylounge.com",
            Address="8420 Sunset Blvd",
            City="West Hollywood",
            State="CA",
            Country="USA",
            IsActive=True,
        )
        session.add(demo_branch)
        await session.flush()
        print("  [OK] Demo branch created")

        # ── Super Admin ───────────────────────────────────────────────────────
        admin_user = User(
            SalonID=None,
            BranchID=None,
            RoleID=role_map["super_admin"].RoleID,
            FirstName="Super",
            LastName="Admin",
            Email=settings.SUPER_ADMIN_EMAIL,
            Phone="+1-800-555-0000",
            PasswordHash=hash_password(settings.SUPER_ADMIN_PASSWORD),
            IsActive=True,
            IsEmailVerified=True,
        )
        session.add(admin_user)

        # ── Salon Owner ───────────────────────────────────────────────────────
        owner_user = User(
            SalonID=demo_salon.SalonID,
            BranchID=demo_branch.BranchID,
            RoleID=role_map["salon_owner"].RoleID,
            FirstName="Jessica",
            LastName="Williams",
            Email="owner@luxebeautylounge.com",
            Phone="+1-310-555-0102",
            PasswordHash=hash_password("Owner@12345"),
            IsActive=True,
            IsEmailVerified=True,
        )
        session.add(owner_user)

        await session.commit()
        print("  [OK] Super admin user created")
        print("  [OK] Salon owner created")
        print()
        print("=" * 55)
        print("Seed complete! Login credentials:")
        print(f"  Super Admin  -> {settings.SUPER_ADMIN_EMAIL}  /  {settings.SUPER_ADMIN_PASSWORD}")
        print("  Salon Owner  -> owner@luxebeautylounge.com  /  Owner@12345")
        print("=" * 55)


if __name__ == "__main__":
    asyncio.run(seed_database())
