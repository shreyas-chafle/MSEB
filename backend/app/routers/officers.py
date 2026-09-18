from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import datetime
from uuid import uuid4

from app.database import get_database
from app.schemas.officer import OfficerCreate, OfficerUpdate, OfficerResponse
from app.utils.security import get_password_hash
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/api/officers", tags=["Field Officers"])

@router.get("", response_model=List[OfficerResponse])
async def list_officers(
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    officers_docs = await db.officers.find().to_list(100)

    results = []
    for off in officers_docs:
        u = await db.users.find_one({"_id": off.get("user_id")}) if isinstance(off.get("user_id"), str) else None
        if not u:
            # Try ObjectId string lookup
            u = await db.users.find_one({"email": off.get("email")})

        # Count assigned customers
        cus_count = await db.customers.count_documents({"assigned_officer_id": off.get("officer_id")})
        
        # Calculate total collections
        payments = await db.payments.find({"officer_id": off.get("officer_id")}).to_list(1000)
        total_collected = sum(float(p.get("amount", 0.0)) for p in payments)

        results.append(
            OfficerResponse(
                id=str(off["_id"]),
                officer_id=off.get("officer_id"),
                user_id=str(off.get("user_id")),
                full_name=off.get("full_name"),
                email=off.get("email"),
                phone=off.get("phone"),
                assigned_area=off.get("assigned_area", ""),
                assigned_customers_count=cus_count,
                total_collected_amount=total_collected,
                target_collections_count=off.get("target_collections_count", 15),
                target_collection_amount=float(off.get("target_collection_amount", 25000.0)),
                current_latitude=off.get("current_latitude"),
                current_longitude=off.get("current_longitude"),
                last_active=off.get("last_active"),
                is_active=off.get("is_active", True)
            )
        )
    return results

@router.post("", response_model=OfficerResponse)
async def create_officer(
    request: OfficerCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    existing_user = await db.users.find_one({"email": request.email.lower()})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    
    # 1. Create User Document
    user_doc = {
        "email": request.email.lower(),
        "password_hash": get_password_hash(request.password),
        "full_name": request.full_name,
        "role": "field_officer",
        "phone": request.phone,
        "is_active": True,
        "created_at": now_str
    }
    user_res = await db.users.insert_one(user_doc)
    user_id = str(user_res.inserted_id)

    # 2. Create Officer Profile Document
    officer_id = f"OFF-{uuid4().hex[:6].upper()}"
    officer_doc = {
        "officer_id": officer_id,
        "user_id": user_id,
        "full_name": request.full_name,
        "email": request.email.lower(),
        "phone": request.phone,
        "assigned_area": request.assigned_area,
        "target_collections_count": request.target_collections_count,
        "target_collection_amount": request.target_collection_amount,
        "is_active": True,
        "created_at": now_str
    }
    off_res = await db.officers.insert_one(officer_doc)

    return OfficerResponse(
        id=str(off_res.inserted_id),
        officer_id=officer_id,
        user_id=user_id,
        full_name=request.full_name,
        email=request.email.lower(),
        phone=request.phone,
        assigned_area=request.assigned_area,
        target_collections_count=request.target_collections_count,
        target_collection_amount=request.target_collection_amount,
        is_active=True
    )
