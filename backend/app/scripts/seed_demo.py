"""
Demo data seed — USA-based salon dummy data.
Adds customers, services, staff, and appointments to the demo salon.
Run with:  python -m app.scripts.seed_demo
Safe to run multiple times (skips if demo data already exists).
"""
import asyncio
import random
from datetime import date, time, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_engine
from app.core.security import hash_password
from app.models.salon import Salon, Branch
from app.models.customer import Customer
from app.models.service import ServiceCategory, Service
from app.models.staff import Staff
from app.models.user import User, Role
from app.models.appointment import Appointment


CUSTOMERS = [
    # (first, last, gender, phone, email, dob)
    ("Ashley",    "Johnson",   "Female", "+1-310-555-1001", "ashley.johnson@gmail.com",    date(1992, 3, 15)),
    ("Brittany",  "Williams",  "Female", "+1-310-555-1002", "brittany.williams@gmail.com", date(1988, 7, 22)),
    ("Chelsea",   "Davis",     "Female", "+1-310-555-1003", "chelsea.davis@gmail.com",     date(1995, 11, 8)),
    ("Danielle",  "Martinez",  "Female", "+1-310-555-1004", "danielle.martinez@gmail.com", date(1990, 5, 30)),
    ("Emily",     "Anderson",  "Female", "+1-310-555-1005", "emily.anderson@gmail.com",    date(1998, 2, 14)),
    ("Fiona",     "Thompson",  "Female", "+1-323-555-1006", "fiona.thompson@gmail.com",    date(1994, 9, 3)),
    ("Grace",     "Garcia",    "Female", "+1-323-555-1007", "grace.garcia@gmail.com",      date(1987, 12, 19)),
    ("Hannah",    "Rodriguez", "Female", "+1-323-555-1008", "hannah.rodriguez@gmail.com",  date(1996, 6, 7)),
    ("Isabella",  "Wilson",    "Female", "+1-424-555-1009", "isabella.wilson@gmail.com",   date(1993, 4, 25)),
    ("Jennifer",  "Lee",       "Female", "+1-424-555-1010", "jennifer.lee@gmail.com",      date(1985, 8, 11)),
    ("Katherine", "Harris",    "Female", "+1-424-555-1011", "katherine.harris@gmail.com",  date(1997, 1, 28)),
    ("Lauren",    "Clark",     "Female", "+1-818-555-1012", "lauren.clark@gmail.com",      date(1989, 10, 16)),
    ("Megan",     "Lewis",     "Female", "+1-818-555-1013", "megan.lewis@gmail.com",       date(2000, 3, 2)),
    ("Nicole",    "Robinson",  "Female", "+1-818-555-1014", "nicole.robinson@gmail.com",   date(1991, 7, 9)),
    ("Olivia",    "Walker",    "Female", "+1-213-555-1015", "olivia.walker@gmail.com",     date(1999, 5, 21)),
    ("Rachel",    "Hall",      "Female", "+1-213-555-1016", "rachel.hall@gmail.com",       date(1993, 12, 4)),
    ("Samantha",  "Allen",     "Female", "+1-213-555-1017", "samantha.allen@gmail.com",    date(1986, 8, 18)),
    ("Taylor",    "Young",     "Female", "+1-562-555-1018", "taylor.young@gmail.com",      date(1994, 4, 11)),
    ("Victoria",  "King",      "Female", "+1-562-555-1019", "victoria.king@gmail.com",     date(1990, 1, 29)),
    ("Zoe",       "Wright",    "Female", "+1-562-555-1020", "zoe.wright@gmail.com",        date(1997, 9, 7)),
    ("Michael",   "Scott",     "Male",   "+1-310-555-2001", "michael.scott@gmail.com",     date(1983, 6, 14)),
    ("James",     "Brown",     "Male",   "+1-323-555-2002", "james.brown@gmail.com",       date(1989, 11, 2)),
]

CATEGORIES = [
    ("Hair Services",   "#6C3FC5"),
    ("Skin & Facial",   "#FF6B6B"),
    ("Nail Care",       "#FF9800"),
    ("Waxing",          "#4CAF50"),
    ("Spa & Massage",   "#2196F3"),
    ("Makeup",          "#E91E63"),
]

# (name, category_idx, duration_min, price_usd, tax_pct)
# Tax ~8.5% (California sales tax on services varies; some services exempt)
SERVICES = [
    # Hair Services
    ("Haircut & Style",         0, 45,  65,   0),
    ("Blowout",                 0, 30,  45,   0),
    ("Balayage / Highlights",   0, 120, 185,  0),
    ("Full Color",              0, 90,  120,  0),
    ("Keratin Treatment",       0, 120, 250,  0),
    ("Deep Conditioning",       0, 30,  45,   0),
    # Skin & Facial
    ("Classic Facial",          1, 60,  85,   0),
    ("HydraFacial",             1, 75,  150,  0),
    ("Chemical Peel",           1, 45,  110,  0),
    ("Microdermabrasion",       1, 60,  95,   0),
    # Nail Care
    ("Manicure",                2, 30,  35,   0),
    ("Pedicure",                2, 45,  50,   0),
    ("Gel Manicure",            2, 45,  50,   0),
    ("Acrylic Full Set",        2, 75,  65,   0),
    ("Nail Art",                2, 30,  25,   0),
    # Waxing
    ("Eyebrow Wax & Shape",     3, 15,  22,   0),
    ("Full Leg Wax",            3, 45,  65,   0),
    ("Brazilian Wax",           3, 30,  60,   0),
    ("Full Body Wax",           3, 90,  150,  0),
    # Spa & Massage
    ("Swedish Massage 60 min",  4, 60,  95,   0),
    ("Deep Tissue Massage",     4, 60,  110,  0),
    ("Hot Stone Massage",       4, 75,  130,  0),
    # Makeup
    ("Bridal Makeup",           5, 90,  250,  0),
    ("Event / Party Makeup",    5, 60,  120,  0),
    ("Airbrush Makeup",         5, 75,  150,  0),
]

STAFF_DATA = [
    # (first, last, role_code, code, job_title)
    ("Madison",  "Turner",  "receptionist", "STF001", "Front Desk Receptionist"),
    ("Sophia",   "Evans",   "staff",        "STF002", "Senior Hair Stylist"),
    ("Ava",      "Collins", "staff",        "STF003", "Color Specialist"),
    ("Emma",     "Parker",  "staff",        "STF004", "Esthetician"),
    ("Chloe",    "Reed",    "staff",        "STF005", "Nail Technician"),
]

STATUSES = ["Completed", "Completed", "Completed", "Completed", "Cancelled", "Scheduled"]
SOURCES  = ["Walk-In", "Online", "Phone", "Walk-In", "Online", "App"]


async def seed_demo():
    random.seed(42)

    async with AsyncSession(async_engine, expire_on_commit=False) as session:

        result = await session.execute(select(Customer).limit(1))
        if result.scalars().first():
            print("[OK] Demo data already seeded — skipping.")
            return

        print("Seeding USA demo data…")

        salon = (await session.execute(select(Salon).limit(1))).scalars().first()
        if not salon:
            print("ERROR: Run seed.py first.")
            return

        branch = (await session.execute(
            select(Branch).where(Branch.SalonID == salon.SalonID).limit(1)
        )).scalars().first()

        roles = {
            r.RoleCode: r
            for r in (await session.execute(select(Role))).scalars().all()
        }

        # ── Customers ─────────────────────────────────────────────────────────
        customers = []
        for fn, ln, gender, mobile, email, dob in CUSTOMERS:
            visits = random.randint(2, 35)
            spent  = round(random.uniform(120, 4500), 2)
            c = Customer(
                SalonID=salon.SalonID,
                FirstName=fn, LastName=ln, Gender=gender,
                Mobile=mobile, Email=email, DateOfBirth=dob,
                LoyaltyPoints=int(spent // 10),
                WalletBalance=round(random.uniform(0, 150), 2),
                TotalVisits=visits, TotalSpent=spent,
                LastVisitDate=date.today() - timedelta(days=random.randint(1, 60)),
                IsActive=True,
            )
            session.add(c)
            customers.append(c)
        await session.flush()
        print(f"  [OK] {len(customers)} customers")

        # ── Service Categories ────────────────────────────────────────────────
        categories = []
        for idx, (name, color) in enumerate(CATEGORIES):
            cat = ServiceCategory(
                SalonID=salon.SalonID, CategoryName=name,
                ColorCode=color, SortOrder=idx, IsActive=True,
            )
            session.add(cat)
            categories.append(cat)
        await session.flush()
        print(f"  [OK] {len(categories)} service categories")

        # ── Services ──────────────────────────────────────────────────────────
        services = []
        for idx, (name, cat_idx, duration, price, tax) in enumerate(SERVICES):
            svc = Service(
                SalonID=salon.SalonID,
                CategoryID=categories[cat_idx].CategoryID,
                ServiceName=name, Duration=duration,
                Price=price, TaxPercent=tax,
                GenderType="Unisex", SortOrder=idx, IsActive=True,
            )
            session.add(svc)
            services.append(svc)
        await session.flush()
        print(f"  [OK] {len(services)} services")

        # ── Staff ─────────────────────────────────────────────────────────────
        staff_profiles = []
        for fn, ln, role_code, code, title in STAFF_DATA:
            email = f"{fn.lower()}.{ln.lower()}@luxebeautylounge.com"
            u = User(
                SalonID=salon.SalonID, BranchID=branch.BranchID,
                RoleID=roles[role_code].RoleID,
                FirstName=fn, LastName=ln, Email=email,
                Phone=f"+1-310-555-{random.randint(2000, 2999)}",
                PasswordHash=hash_password("Staff@12345"),
                IsActive=True, IsEmailVerified=True,
            )
            session.add(u)
            await session.flush()

            sp = Staff(
                UserID=u.UserID,
                BranchID=branch.BranchID, SalonID=salon.SalonID,
                StaffCode=code, JobTitle=title,
                Experience=random.randint(1, 12),
                Salary=round(random.uniform(2500, 5500), 2),
                CommissionPercent=15,
                JoiningDate=date.today() - timedelta(days=random.randint(90, 1200)),
                Gender="Female", IsActive=True,
                AverageRating=round(random.uniform(4.0, 5.0), 2),
                TotalServiced=random.randint(60, 500),
            )
            session.add(sp)
            await session.flush()
            staff_profiles.append(sp)
        print(f"  [OK] {len(staff_profiles)} staff members")

        # ── Appointments (last 60 days) ────────────────────────────────────────
        apt_count = 0
        service_staff = staff_profiles[1:]  # exclude receptionist
        for days_ago in range(60, -1, -1):
            apt_date = date.today() - timedelta(days=days_ago)
            num = random.randint(3, 10) if days_ago > 0 else random.randint(1, 4)
            for _ in range(num):
                svc      = random.choice(services)
                hour     = random.randint(9, 18)
                end_hour = hour + svc.Duration // 60
                end_min  = svc.Duration % 60
                if end_hour > 20:
                    end_hour, end_min = 20, 0

                if days_ago == 0:
                    status = random.choice(["Scheduled", "CheckedIn", "Scheduled"])
                elif days_ago <= 7:
                    status = random.choice(STATUSES)
                else:
                    status = random.choice(["Completed", "Completed", "Completed", "Cancelled"])

                apt = Appointment(
                    SalonID=salon.SalonID, BranchID=branch.BranchID,
                    CustomerID=random.choice(customers).CustomerID,
                    StaffID=random.choice(service_staff).StaffID,
                    ServiceID=svc.ServiceID,
                    AppointmentDate=apt_date,
                    StartTime=time(hour, 0),
                    EndTime=time(end_hour, end_min),
                    Status=status,
                    BookingSource=random.choice(SOURCES),
                    ServiceAmount=svc.Price,
                )
                session.add(apt)
                apt_count += 1

        await session.commit()
        print(f"  [OK] {apt_count} appointments (last 60 days)")
        print()
        print("=" * 55)
        print("Demo seed complete!")
        print(f"  Salon : {salon.SalonName}  |  {salon.Address}")
        print("  Staff login -> madison.turner@luxebeautylounge.com / Staff@12345")
        print("=" * 55)


if __name__ == "__main__":
    asyncio.run(seed_demo())
