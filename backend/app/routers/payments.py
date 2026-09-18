from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from app.database import get_database
from app.schemas.payment import PaymentCollectRequest, PaymentResponse, ReceiptData
from app.services.payment_service import PaymentService
from app.utils.dependencies import get_current_user, require_officer

router = APIRouter(prefix="/api/payments", tags=["Payments"])

@router.post("/collect", response_model=PaymentResponse)
async def collect_payment(
    request: PaymentCollectRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(require_officer)
):
    return await PaymentService.collect_payment(db=db, request=request, officer=current_user)

@router.get("", response_model=List[PaymentResponse])
async def list_payments(
    customer_id: Optional[str] = Query(None),
    officer_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if customer_id:
        query["customer_id"] = customer_id

    if officer_id:
        query["officer_id"] = officer_id

    payments_docs = await db.payments.find(query).sort("created_at", -1).limit(limit).to_list(limit)

    results = []
    for p in payments_docs:
        results.append(
            PaymentResponse(
                id=str(p["_id"]),
                receipt_number=p.get("receipt_number", ""),
                payment_id=p.get("payment_id", ""),
                bill_id=p.get("bill_id", ""),
                customer_id=p.get("customer_id", ""),
                customer_name=p.get("customer_name"),
                meter_id=p.get("meter_id"),
                meter_number=p.get("meter_number"),
                officer_id=p.get("officer_id", ""),
                officer_name=p.get("officer_name"),
                amount=float(p.get("amount", 0.0)),
                payment_method=p.get("payment_method", "cash"),
                transaction_reference=p.get("transaction_reference"),
                remarks=p.get("remarks"),
                collection_latitude=p.get("collection_latitude"),
                collection_longitude=p.get("collection_longitude"),
                previous_pending_amount=float(p.get("previous_pending_amount", 0.0)),
                remaining_pending_amount=float(p.get("remaining_pending_amount", 0.0)),
                bill_status=p.get("bill_status", "paid"),
                created_at=p.get("created_at", "")
            )
        )
    return results

@router.get("/{payment_id}/receipt", response_model=ReceiptData)
async def get_receipt(
    payment_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    p = await db.payments.find_one({"$or": [{"payment_id": payment_id}, {"receipt_number": payment_id}]})
    if not p:
        raise HTTPException(status_code=404, detail="Payment record not found")

    cus = await db.customers.find_one({"customer_id": p.get("customer_id")})
    address = cus.get("address", "") if cus else ""

    return ReceiptData(
        organization_name="State Electricity Department - Field Collection Portal",
        receipt_number=p.get("receipt_number", ""),
        date_time=p.get("created_at", ""),
        customer_name=p.get("customer_name", "Valued Consumer"),
        customer_id=p.get("customer_id", ""),
        meter_number=p.get("meter_number", "N/A"),
        address=address,
        collected_amount=float(p.get("amount", 0.0)),
        payment_method=p.get("payment_method", "").upper(),
        transaction_reference=p.get("transaction_reference") or "N/A (Cash)",
        field_officer_name=p.get("officer_name", "Field Officer"),
        field_officer_id=p.get("officer_id", ""),
        previous_pending=float(p.get("previous_pending_amount", 0.0)),
        remaining_balance=float(p.get("remaining_pending_amount", 0.0)),
        status=p.get("bill_status", "paid").upper()
    )
