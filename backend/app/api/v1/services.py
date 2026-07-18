from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, ManagerOrAbove
from app.models.service import ServiceCategory, Service, ServiceAddon, ServicePackage, PackageService
from app.models.user import User

router = APIRouter(prefix="/services", tags=["Services"])


class CategoryCreate(BaseModel):
    category_name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    color_code: Optional[str] = None
    sort_order: int = 0


class ServiceCreate(BaseModel):
    category_id: int
    service_name: str
    description: Optional[str] = None
    duration: int
    price: Decimal
    tax_percent: Decimal = 0
    gender_type: str = "Unisex"
    image_url: Optional[str] = None
    color_code: Optional[str] = None
    sort_order: int = 0
    addons: Optional[List[dict]] = None


class ServiceUpdate(BaseModel):
    service_name: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[int] = None
    price: Optional[Decimal] = None
    tax_percent: Optional[Decimal] = None
    gender_type: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class PackageCreate(BaseModel):
    package_name: str
    description: Optional[str] = None
    original_price: Decimal
    package_price: Decimal
    validity_days: int = 30
    service_ids: List[int]


@router.get("/categories")
async def list_categories(
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ServiceCategory)
        .where(ServiceCategory.SalonID == salon_id, ServiceCategory.IsActive == True)
        .order_by(ServiceCategory.SortOrder)
    )
    categories = result.scalars().all()
    return [
        {
            "category_id": c.CategoryID,
            "category_name": c.CategoryName,
            "description": c.Description,
            "icon_url": c.IconURL,
            "color_code": c.ColorCode,
            "sort_order": c.SortOrder,
        }
        for c in categories
    ]


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    data: CategoryCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    category = ServiceCategory(
        SalonID=salon_id,
        CategoryName=data.category_name,
        Description=data.description,
        IconURL=data.icon_url,
        ColorCode=data.color_code,
        SortOrder=data.sort_order,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return {"category_id": category.CategoryID, "category_name": category.CategoryName}


@router.put("/categories/{category_id}", status_code=status.HTTP_200_OK)
async def update_category(
    category_id: int,
    data: CategoryCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    cat = (await db.execute(
        select(ServiceCategory).where(ServiceCategory.CategoryID == category_id, ServiceCategory.SalonID == salon_id)
    )).scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    cat.CategoryName = data.category_name
    if data.description is not None:
        cat.Description = data.description
    if data.color_code is not None:
        cat.ColorCode = data.color_code
    if data.sort_order is not None:
        cat.SortOrder = data.sort_order
    await db.commit()
    return {"category_id": cat.CategoryID, "category_name": cat.CategoryName}


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    cat = (await db.execute(
        select(ServiceCategory).where(ServiceCategory.CategoryID == category_id, ServiceCategory.SalonID == salon_id)
    )).scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    cat.IsActive = False
    await db.commit()


@router.get("")
async def list_services(
    salon_id: int = Depends(get_salon_id),
    category_id: Optional[int] = Query(None),
    gender_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(True),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(Service).where(Service.SalonID == salon_id)
    if category_id:
        query = query.where(Service.CategoryID == category_id)
    if gender_type:
        query = query.where((Service.GenderType == gender_type) | (Service.GenderType == "Unisex"))
    if is_active is not None:
        query = query.where(Service.IsActive == is_active)

    result = await db.execute(query.order_by(Service.SortOrder, Service.ServiceName))
    services = result.scalars().all()

    svc_list = []
    for s in services:
        addons_result = await db.execute(select(ServiceAddon).where(ServiceAddon.ServiceID == s.ServiceID, ServiceAddon.IsActive == True))
        addons = addons_result.scalars().all()
        svc_list.append({
            "service_id": s.ServiceID,
            "category_id": s.CategoryID,
            "service_name": s.ServiceName,
            "description": s.Description,
            "duration": s.Duration,
            "price": float(s.Price),
            "tax_percent": float(s.TaxPercent),
            "gender_type": s.GenderType,
            "image_url": s.ImageURL,
            "color_code": s.ColorCode,
            "is_active": s.IsActive,
            "addons": [
                {"addon_id": a.AddonID, "addon_name": a.AddonName, "price": float(a.Price), "duration": a.Duration}
                for a in addons
            ],
        })
    return svc_list


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_service(
    data: ServiceCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    service = Service(
        SalonID=salon_id,
        CategoryID=data.category_id,
        ServiceName=data.service_name,
        Description=data.description,
        Duration=data.duration,
        Price=data.price,
        TaxPercent=data.tax_percent,
        GenderType=data.gender_type,
        ImageURL=data.image_url,
        ColorCode=data.color_code,
        SortOrder=data.sort_order,
    )
    db.add(service)
    await db.flush()

    if data.addons:
        for addon in data.addons:
            db.add(ServiceAddon(
                ServiceID=service.ServiceID,
                AddonName=addon["addon_name"],
                Price=addon["price"],
                Duration=addon.get("duration", 0),
            ))

    await db.commit()
    await db.refresh(service)
    return {"service_id": service.ServiceID, "service_name": service.ServiceName}


@router.put("/{service_id}")
async def update_service(
    service_id: int,
    data: ServiceUpdate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    service = (await db.execute(
        select(Service).where(Service.ServiceID == service_id, Service.SalonID == salon_id)
    )).scalar_one_or_none()
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    fields = {
        "service_name": "ServiceName", "description": "Description",
        "duration": "Duration", "price": "Price", "tax_percent": "TaxPercent",
        "gender_type": "GenderType", "is_active": "IsActive", "sort_order": "SortOrder",
    }
    for k, v in data.model_dump(exclude_none=True).items():
        if k in fields:
            setattr(service, fields[k], v)

    await db.commit()
    return {"message": "Service updated"}


@router.get("/packages")
async def list_packages(
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ServicePackage).where(ServicePackage.SalonID == salon_id, ServicePackage.IsActive == True)
    )
    return result.scalars().all()


@router.post("/packages", status_code=status.HTTP_201_CREATED)
async def create_package(
    data: PackageCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    package = ServicePackage(
        SalonID=salon_id,
        PackageName=data.package_name,
        Description=data.description,
        OriginalPrice=data.original_price,
        PackagePrice=data.package_price,
        ValidityDays=data.validity_days,
    )
    db.add(package)
    await db.flush()

    for service_id in data.service_ids:
        db.add(PackageService(PackageID=package.PackageID, ServiceID=service_id))

    await db.commit()
    return {"package_id": package.PackageID, "package_name": package.PackageName}
