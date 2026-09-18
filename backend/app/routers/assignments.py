from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from app.database import get_database
from app.schemas.officer import CustomerAssignmentRequest, MeterAssignmentRequest
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/assignments", tags=["Assignments"])

@router.post("")
async def assign_customers(
    request: CustomerAssignmentRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    officer = await db.officers.find_one({"officer_id": request.officer_id})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    # Update assigned officer ID on customers
    result = await db.customers.update_many(
        {"customer_id": {"$in": request.customer_ids}},
        {"$set": {"assigned_officer_id": request.officer_id, "updated_at": now_str}}
    )

    # Sync assigned officer ID on associated meters
    await db.meters.update_many(
        {"customer_id": {"$in": request.customer_ids}},
        {"$set": {"assigned_officer_id": request.officer_id, "updated_at": now_str}}
    )

    # Update assigned officer ID on associated pending bills
    await db.bills.update_many(
        {"customer_id": {"$in": request.customer_ids}},
        {"$set": {"assigned_officer_id": request.officer_id, "updated_at": now_str}}
    )

    # Record assignment event
    await db.assignments.insert_one({
        "officer_id": request.officer_id,
        "customer_ids": request.customer_ids,
        "type": "customer",
        "assigned_by": str(current_user["_id"]),
        "created_at": now_str
    })

    return {
        "message": f"Successfully assigned {result.modified_count} customers (and associated meters) to officer '{officer.get('full_name')}'",
        "officer_id": request.officer_id,
        "count": result.modified_count
    }


@router.post("/meters")
async def assign_meters(
    request: MeterAssignmentRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    officer = await db.officers.find_one({"officer_id": request.officer_id})
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    # Update assigned officer ID on specific meters
    result = await db.meters.update_many(
        {"$or": [{"meter_id": {"$in": request.meter_ids}}, {"meter_number": {"$in": request.meter_ids}}]},
        {"$set": {"assigned_officer_id": request.officer_id, "updated_at": now_str}}
    )

    # Find affected customer IDs from assigned meters
    meters = await db.meters.find(
        {"$or": [{"meter_id": {"$in": request.meter_ids}}, {"meter_number": {"$in": request.meter_ids}}]}
    ).to_list(1000)
    customer_ids = list(set([m.get("customer_id") for m in meters if m.get("customer_id")]))

    if customer_ids:
        # Sync assigned officer ID on customers and bills
        await db.customers.update_many(
            {"customer_id": {"$in": customer_ids}},
            {"$set": {"assigned_officer_id": request.officer_id, "updated_at": now_str}}
        )
        await db.bills.update_many(
            {"customer_id": {"$in": customer_ids}},
            {"$set": {"assigned_officer_id": request.officer_id, "updated_at": now_str}}
        )

    # Record assignment event
    await db.assignments.insert_one({
        "officer_id": request.officer_id,
        "meter_ids": request.meter_ids,
        "customer_ids": customer_ids,
        "type": "meter",
        "assigned_by": str(current_user["_id"]),
        "created_at": now_str
    })

    return {
        "message": f"Successfully assigned {result.modified_count} meters to officer '{officer.get('full_name')}'",
        "officer_id": request.officer_id,
        "count": result.modified_count
    }

