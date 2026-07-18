from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional
from decimal import Decimal

from app.core.database import get_async_db
from app.core.dependencies import get_salon_id, ManagerOrAbove
from app.models.service import ServicePackage, PackageService, Service
from app.models.user import User

router = APIRouter(prefix="/packages", tags=["packages"])
_manager = ManagerOrAbove()


def _package_dict(pkg: ServicePackage) -> dict:
    discount_pct = 0.0
    if pkg.OriginalPrice and float(pkg.OriginalPrice) > 0:
        discount_pct = round((1 - float(pkg.PackagePrice) / float(pkg.OriginalPrice)) * 100, 1)
    return {
        "package_id": pkg.PackageID,
        "package_name": pkg.PackageName,
        "description": pkg.Description,
        "original_price": float(pkg.OriginalPrice),
        "package_price": float(pkg.PackagePrice),
        "discount_pct": discount_pct,
        "validity_days": pkg.ValidityDays,
        "is_active": pkg.IsActive,
        "created_at": pkg.CreatedAt.isoformat() if pkg.CreatedAt else None,
        "services": [
            {
                "service_id": ps.ServiceID,
                "service_name": ps.service.ServiceName if ps.service else None,
                "duration": ps.service.Duration if ps.service else None,
                "price": float(ps.service.Price) if ps.service else None,
                "quantity": ps.Quantity,
            }
            for ps in (pkg.package_services or [])
        ],
    }


@router.get("")
async def list_packages(
    search: Optional[str] = Query(None),
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    salon_id: int = Depends(get_salon_id),
):
    q = (
        select(ServicePackage)
        .options(
            selectinload(ServicePackage.package_services).selectinload(PackageService.service)
        )
        .where(ServicePackage.SalonID == salon_id)
    )
    if active_only:
        q = q.where(ServicePackage.IsActive == True)
    if search:
        q = q.where(ServicePackage.PackageName.ilike(f"%{search}%"))

    total_r = await db.execute(select(func.count()).select_from(q.subquery()))
    total = total_r.scalar() or 0

    q = q.offset((page - 1) * page_size).limit(page_size).order_by(ServicePackage.PackageName)
    result = await db.execute(q)
    pkgs = result.scalars().all()

    return {"total": total, "page": page, "page_size": page_size, "items": [_package_dict(p) for p in pkgs]}


@router.get("/{package_id}")
async def get_package(
    package_id: int,
    db: AsyncSession = Depends(get_async_db),
    salon_id: int = Depends(get_salon_id),
):
    result = await db.execute(
        select(ServicePackage)
        .options(selectinload(ServicePackage.package_services).selectinload(PackageService.service))
        .where(ServicePackage.PackageID == package_id, ServicePackage.SalonID == salon_id)
    )
    pkg = result.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    return _package_dict(pkg)


@router.post("", status_code=201)
async def create_package(
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    salon_id: int = Depends(get_salon_id),
    _: User = Depends(_manager),
):
    service_ids = [s["service_id"] for s in body.get("services", [])]

    # Calculate original price from services
    original_price = Decimal("0")
    if service_ids:
        svc_r = await db.execute(select(Service).where(Service.ServiceID.in_(service_ids)))
        services = {s.ServiceID: s for s in svc_r.scalars().all()}
        for s in body.get("services", []):
            svc = services.get(s["service_id"])
            if svc:
                original_price += svc.Price * s.get("quantity", 1)

    pkg = ServicePackage(
        SalonID=salon_id,
        PackageName=body["package_name"],
        Description=body.get("description"),
        OriginalPrice=original_price,
        PackagePrice=Decimal(str(body["package_price"])),
        ValidityDays=body.get("validity_days", 30),
        IsActive=True,
    )
    db.add(pkg)
    await db.flush()

    for s in body.get("services", []):
        ps = PackageService(
            PackageID=pkg.PackageID,
            ServiceID=s["service_id"],
            Quantity=s.get("quantity", 1),
        )
        db.add(ps)

    await db.commit()
    await db.refresh(pkg)

    result = await db.execute(
        select(ServicePackage)
        .options(selectinload(ServicePackage.package_services).selectinload(PackageService.service))
        .where(ServicePackage.PackageID == pkg.PackageID)
    )
    return _package_dict(result.scalar_one())


@router.put("/{package_id}")
async def update_package(
    package_id: int,
    body: dict,
    db: AsyncSession = Depends(get_async_db),
    salon_id: int = Depends(get_salon_id),
    _: User = Depends(_manager),
):
    result = await db.execute(
        select(ServicePackage)
        .options(selectinload(ServicePackage.package_services))
        .where(ServicePackage.PackageID == package_id, ServicePackage.SalonID == salon_id)
    )
    pkg = result.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")

    for field, col in [
        ("package_name", "PackageName"), ("description", "Description"),
        ("validity_days", "ValidityDays"), ("is_active", "IsActive"),
    ]:
        if field in body:
            setattr(pkg, col, body[field])

    if "package_price" in body:
        pkg.PackagePrice = Decimal(str(body["package_price"]))

    if "services" in body:
        # Remove existing services
        for ps in pkg.package_services:
            await db.delete(ps)
        await db.flush()

        service_ids = [s["service_id"] for s in body["services"]]
        svc_r = await db.execute(select(Service).where(Service.ServiceID.in_(service_ids)))
        services = {s.ServiceID: s for s in svc_r.scalars().all()}

        original_price = Decimal("0")
        for s in body["services"]:
            svc = services.get(s["service_id"])
            if svc:
                original_price += svc.Price * s.get("quantity", 1)
            ps = PackageService(PackageID=pkg.PackageID, ServiceID=s["service_id"], Quantity=s.get("quantity", 1))
            db.add(ps)
        pkg.OriginalPrice = original_price

    await db.commit()

    result2 = await db.execute(
        select(ServicePackage)
        .options(selectinload(ServicePackage.package_services).selectinload(PackageService.service))
        .where(ServicePackage.PackageID == package_id)
    )
    return _package_dict(result2.scalar_one())


@router.delete("/{package_id}")
async def delete_package(
    package_id: int,
    db: AsyncSession = Depends(get_async_db),
    salon_id: int = Depends(get_salon_id),
    _: User = Depends(_manager),
):
    result = await db.execute(
        select(ServicePackage).where(ServicePackage.PackageID == package_id, ServicePackage.SalonID == salon_id)
    )
    pkg = result.scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    pkg.IsActive = False
    await db.commit()
    return {"message": "Package deactivated"}
