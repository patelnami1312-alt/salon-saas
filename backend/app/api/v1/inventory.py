from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal
import math

from app.core.database import get_async_db
from app.core.dependencies import get_current_active_user, get_salon_id, ManagerOrAbove, ReceptionistOrAbove
from app.models.inventory import (
    Supplier, ProductCategory, Product, Inventory,
    PurchaseOrder, PurchaseOrderItem, StockTransaction,
)
from app.models.user import User
from datetime import datetime, date

router = APIRouter(prefix="/inventory", tags=["Inventory"])


class SupplierCreate(BaseModel):
    supplier_name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    payment_terms: Optional[str] = None


class ProductCreate(BaseModel):
    category_id: int
    supplier_id: Optional[int] = None
    product_name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    description: Optional[str] = None
    cost_price: Decimal = 0
    sale_price: Decimal = 0
    tax_percent: Decimal = 0
    unit: Optional[str] = None
    is_for_sale: bool = True
    is_for_use: bool = True


class StockAdjustment(BaseModel):
    product_id: int
    branch_id: int
    quantity: float
    transaction_type: str = "Adjustment"  # Adjustment, Return, Transfer
    notes: Optional[str] = None


class PurchaseOrderCreate(BaseModel):
    branch_id: int
    supplier_id: int
    expected_date: Optional[date] = None
    notes: Optional[str] = None
    items: List[dict]  # [{product_id, quantity, unit_price, tax_percent}]


class ReceiveStockRequest(BaseModel):
    items: List[dict]  # [{po_item_id, received_quantity}]


@router.get("/products")
async def list_products(
    salon_id: int = Depends(get_salon_id),
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(Product).where(Product.SalonID == salon_id)
    if category_id:
        query = query.where(Product.CategoryID == category_id)
    if is_active is not None:
        query = query.where(Product.IsActive == is_active)
    if search:
        query = query.where(
            Product.ProductName.ilike(f"%{search}%") |
            Product.SKU.ilike(f"%{search}%") |
            Product.Barcode.ilike(f"%{search}%")
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    query = query.offset((page - 1) * page_size).limit(page_size).order_by(Product.ProductName)
    result = await db.execute(query)
    products = result.scalars().all()

    return {
        "items": [
            {
                "product_id": p.ProductID,
                "product_name": p.ProductName,
                "sku": p.SKU,
                "barcode": p.Barcode,
                "cost_price": float(p.CostPrice),
                "sale_price": float(p.SalePrice),
                "tax_percent": float(p.TaxPercent),
                "unit": p.Unit,
                "is_for_sale": p.IsForSale,
                "is_for_use": p.IsForUse,
                "is_active": p.IsActive,
                "image_url": p.ImageURL,
            }
            for p in products
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size),
    }


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(
    data: ProductCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    product = Product(
        SalonID=salon_id,
        CategoryID=data.category_id,
        SupplierID=data.supplier_id,
        ProductName=data.product_name,
        SKU=data.sku,
        Barcode=data.barcode,
        Description=data.description,
        CostPrice=data.cost_price,
        SalePrice=data.sale_price,
        TaxPercent=data.tax_percent,
        Unit=data.unit,
        IsForSale=data.is_for_sale,
        IsForUse=data.is_for_use,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return {"product_id": product.ProductID, "product_name": product.ProductName}


@router.get("/stock")
async def get_stock_levels(
    salon_id: int = Depends(get_salon_id),
    branch_id: int = Query(...),
    low_stock_only: bool = Query(False),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    query = select(Inventory, Product).join(Product, Product.ProductID == Inventory.ProductID)\
        .where(Product.SalonID == salon_id, Inventory.BranchID == branch_id, Product.IsActive == True)

    if low_stock_only:
        query = query.where(Inventory.CurrentStock <= Inventory.MinStockLevel)

    result = await db.execute(query)
    rows = result.all()

    return {
        "branch_id": branch_id,
        "items": [
            {
                "inventory_id": inv.InventoryID,
                "product_id": prod.ProductID,
                "product_name": prod.ProductName,
                "sku": prod.SKU,
                "current_stock": float(inv.CurrentStock),
                "min_stock": float(inv.MinStockLevel),
                "reorder_point": float(inv.ReorderPoint),
                "is_low_stock": float(inv.CurrentStock) <= float(inv.MinStockLevel),
                "stock_value": float(inv.CurrentStock) * float(prod.CostPrice),
            }
            for inv, prod in rows
        ],
        "total": len(rows),
        "low_stock_count": sum(1 for inv, _ in rows if float(inv.CurrentStock) <= float(inv.MinStockLevel)),
    }


@router.post("/stock/adjust")
async def adjust_stock(
    data: StockAdjustment,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    inv = (await db.execute(
        select(Inventory).where(
            Inventory.ProductID == data.product_id,
            Inventory.BranchID == data.branch_id,
        )
    )).scalar_one_or_none()

    if not inv:
        inv = Inventory(
            ProductID=data.product_id,
            BranchID=data.branch_id,
            CurrentStock=0,
            MinStockLevel=0,
        )
        db.add(inv)
        await db.flush()

    balance_before = float(inv.CurrentStock)
    inv.CurrentStock += data.quantity
    balance_after = float(inv.CurrentStock)

    txn = StockTransaction(
        InventoryID=inv.InventoryID,
        TransactionType=data.transaction_type,
        Quantity=data.quantity,
        BalanceBefore=balance_before,
        BalanceAfter=balance_after,
        Notes=data.notes,
        CreatedByUserID=current_user.UserID,
    )
    db.add(txn)
    await db.commit()
    return {"message": "Stock adjusted", "new_balance": balance_after}


@router.get("/purchase-orders")
async def list_purchase_orders(
    salon_id: int = Depends(get_salon_id),
    branch_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    query = select(PurchaseOrder).where(PurchaseOrder.SalonID == salon_id)
    if branch_id:
        query = query.where(PurchaseOrder.BranchID == branch_id)
    if status_filter:
        query = query.where(PurchaseOrder.Status == status_filter)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar()
    result = await db.execute(
        query.offset((page - 1) * page_size).limit(page_size).order_by(PurchaseOrder.CreatedAt.desc())
    )
    orders = result.scalars().all()

    return {
        "items": [
            {
                "po_id": po.POID,
                "po_number": po.PONumber,
                "supplier_id": po.SupplierID,
                "order_date": po.OrderDate,
                "expected_date": po.ExpectedDate,
                "total_amount": float(po.TotalAmount),
                "status": po.Status,
            }
            for po in orders
        ],
        "total": total,
        "page": page,
        "total_pages": math.ceil(total / page_size),
    }


@router.post("/purchase-orders", status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    data: PurchaseOrderCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    po_count = (await db.execute(select(func.count()).where(PurchaseOrder.SalonID == salon_id))).scalar() or 0
    po_number = f"PO-{salon_id:04d}-{po_count + 1:05d}"

    po = PurchaseOrder(
        PONumber=po_number,
        SalonID=salon_id,
        BranchID=data.branch_id,
        SupplierID=data.supplier_id,
        OrderDate=date.today(),
        ExpectedDate=data.expected_date,
        Notes=data.notes,
        CreatedByUserID=current_user.UserID,
    )
    db.add(po)
    await db.flush()

    total = 0
    for item in data.items:
        total_price = float(item["quantity"]) * float(item["unit_price"])
        tax = total_price * float(item.get("tax_percent", 0)) / 100
        po_item = PurchaseOrderItem(
            POID=po.POID,
            ProductID=item["product_id"],
            OrderedQuantity=item["quantity"],
            UnitPrice=item["unit_price"],
            TaxPercent=item.get("tax_percent", 0),
            TotalPrice=total_price + tax,
        )
        db.add(po_item)
        total += total_price + tax

    po.TotalAmount = total
    po.Status = "Ordered"

    await db.commit()
    return {"po_id": po.POID, "po_number": po_number, "total_amount": total}


@router.post("/purchase-orders/{po_id}/receive")
async def receive_stock(
    po_id: int,
    data: ReceiveStockRequest,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    po = (await db.execute(select(PurchaseOrder).where(PurchaseOrder.POID == po_id))).scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")

    for item_data in data.items:
        po_item = (await db.execute(
            select(PurchaseOrderItem).where(PurchaseOrderItem.ItemID == item_data["po_item_id"])
        )).scalar_one_or_none()
        if not po_item:
            continue

        po_item.ReceivedQuantity += item_data["received_quantity"]

        inv = (await db.execute(
            select(Inventory).where(
                Inventory.ProductID == po_item.ProductID,
                Inventory.BranchID == po.BranchID,
            )
        )).scalar_one_or_none()

        if not inv:
            inv = Inventory(ProductID=po_item.ProductID, BranchID=po.BranchID, CurrentStock=0)
            db.add(inv)
            await db.flush()

        balance_before = float(inv.CurrentStock)
        inv.CurrentStock += item_data["received_quantity"]
        inv.LastRestockedAt = datetime.now()

        db.add(StockTransaction(
            InventoryID=inv.InventoryID,
            TransactionType="Purchase",
            Quantity=item_data["received_quantity"],
            BalanceBefore=balance_before,
            BalanceAfter=float(inv.CurrentStock),
            POID=po_id,
            CreatedByUserID=current_user.UserID,
        ))

    po.Status = "Received"
    po.ReceivedDate = date.today()
    await db.commit()
    return {"message": "Stock received", "po_number": po.PONumber}


@router.get("/suppliers")
async def list_suppliers(
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Supplier).where(Supplier.SalonID == salon_id, Supplier.IsActive == True))
    suppliers = result.scalars().all()
    return [
        {
            "supplier_id": s.SupplierID,
            "supplier_name": s.SupplierName,
            "contact_person": s.ContactPerson,
            "email": s.Email,
            "phone": s.Phone,
        }
        for s in suppliers
    ]


@router.post("/suppliers", status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierCreate,
    salon_id: int = Depends(get_salon_id),
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(ManagerOrAbove()),
):
    supplier = Supplier(
        SalonID=salon_id,
        SupplierName=data.supplier_name,
        ContactPerson=data.contact_person,
        Email=data.email,
        Phone=data.phone,
        Address=data.address,
        GSTIN=data.gstin,
        PaymentTerms=data.payment_terms,
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return {"supplier_id": supplier.SupplierID, "supplier_name": supplier.SupplierName}
