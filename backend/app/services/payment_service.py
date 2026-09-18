from datetime import datetime, timezone
from uuid import uuid4
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import Dict, Any
from app.schemas.payment import PaymentCollectRequest, PaymentResponse, ReceiptData

class PaymentService:

    @staticmethod
    async def collect_payment(
        db: AsyncIOMotorDatabase,
        request: PaymentCollectRequest,
        officer: Dict[str, Any]
    ) -> PaymentResponse:
        # 1. Fetch Target Customer
        customer = await db.customers.find_one({"customer_id": request.customer_id})
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID '{request.customer_id}' not found."
            )

        current_pending = float(customer.get("pending_amount", 0.0))
        if current_pending <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This customer has no pending balance."
            )

        collected_amount = float(request.amount)
        if collected_amount > current_pending:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Collected amount (₹{collected_amount}) cannot exceed current pending balance (₹{current_pending})."
            )

        # 2. Calculate remaining pending balance
        new_pending = current_pending - collected_amount
        new_status = "paid" if new_pending <= 0.01 else "partially_paid"

        now_str = datetime.now(timezone.utc).isoformat()
        today_date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        
        # 3. Create Payment Transaction Record
        payment_id = f"PAY-{uuid4().hex[:8].upper()}"
        receipt_number = f"REC-{today_date_str}-{uuid4().hex[:6].upper()}"

        customer_name = customer.get("name", "Unknown Customer")
        meter_number = customer.get("meter_number", "")

        officer_name = officer.get("full_name", "Field Officer")
        officer_id = officer.get("officer_id", str(officer.get("_id")))

        payment_doc = {
            "payment_id": payment_id,
            "receipt_number": receipt_number,
            "bill_id": request.bill_id,
            "customer_id": request.customer_id,
            "customer_name": customer_name,
            "meter_id": request.meter_id,
            "meter_number": meter_number,
            "officer_id": officer_id,
            "officer_name": officer_name,
            "amount": collected_amount,
            "payment_method": request.payment_method.lower(),
            "transaction_reference": request.transaction_reference,
            "remarks": request.remarks,
            "collection_latitude": request.collection_latitude,
            "collection_longitude": request.collection_longitude,
            "previous_pending_amount": current_pending,
            "remaining_pending_amount": max(0.0, new_pending),
            "bill_status": new_status,
            "created_at": now_str
        }

        await db.payments.insert_one(payment_doc)

        # 4. Update Customer aggregated balance & status
        await db.customers.update_one(
            {"customer_id": request.customer_id},
            {
                "$set": {
                    "pending_amount": max(0.0, new_pending),
                    "status": new_status,
                    "updated_at": now_str
                }
            }
        )

        # 5. Record Audit Log
        audit_doc = {
            "action": "PAYMENT_COLLECTED",
            "user_id": str(officer.get("_id")),
            "officer_id": officer_id,
            "details": f"Collected ₹{collected_amount} via {request.payment_method} for Customer {request.customer_id} (Receipt: {receipt_number})",
            "timestamp": now_str
        }
        await db.audit_logs.insert_one(audit_doc)

        return PaymentResponse(
            id=str(payment_doc.get("_id", payment_id)),
            receipt_number=receipt_number,
            payment_id=payment_id,
            bill_id=request.bill_id,
            customer_id=request.customer_id,
            customer_name=customer_name,
            meter_id=request.meter_id,
            meter_number=meter_number,
            officer_id=officer_id,
            officer_name=officer_name,
            amount=collected_amount,
            payment_method=request.payment_method,
            transaction_reference=request.transaction_reference,
            remarks=request.remarks,
            collection_latitude=request.collection_latitude,
            collection_longitude=request.collection_longitude,
            previous_pending_amount=current_pending,
            remaining_pending_amount=max(0.0, new_pending),
            bill_status=new_status,
            created_at=now_str
        )

