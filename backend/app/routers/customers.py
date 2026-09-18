from fastapi import APIRouter, Depends, HTTPException, Query, status, File, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional, Dict, Any
from collections import defaultdict
from datetime import datetime
from uuid import uuid4

from app.database import get_database
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse, NearbyCustomerResponse, MeterSchema
from app.services.customer_service import CustomerService
from app.services.customer_import_service import CustomerImportService
from app.utils.dependencies import get_current_user


router = APIRouter(prefix="/api/customers", tags=["Customers"])

@router.get("/nearby", response_model=List[NearbyCustomerResponse])
async def get_nearby_customers(
    latitude: float = Query(..., description="Current latitude of officer"),
    longitude: float = Query(..., description="Current longitude of officer"),
    radius: float = Query(5000.0, description="Search radius in meters"),
    status: Optional[str] = Query(None, description="Status filter (pending, overdue, paid)"),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    officer_id = None
    if current_user.get("role") == "field_officer":
        officer = await db.officers.find_one({"user_id": current_user["_id"]})
        if officer:
            officer_id = officer.get("officer_id")

    return await CustomerService.get_nearby_customers(
        db=db,
        latitude=latitude,
        longitude=longitude,
        radius_meters=radius,
        status_filter=status,
        officer_id=officer_id
    )

@router.get("", response_model=List[CustomerResponse])
async def list_customers(
    area: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    assigned_officer_id: Optional[str] = Query(None),
    all_officers: Optional[bool] = Query(False),
    dtc_code: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=1000),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    query: Dict[str, Any] = {}

    if assigned_officer_id:
        query["$or"] = [
            {"assigned_officer_id": assigned_officer_id},
            {"uploaded_by_officer_id": assigned_officer_id}
        ]
    elif not all_officers:
        officer_doc = await db.officers.find_one({
            "$or": [
                {"user_id": current_user["_id"]},
                {"email": current_user.get("email")}
            ]
        })
        if officer_doc:
            off_id = officer_doc.get("officer_id")
            query["$or"] = [
                {"assigned_officer_id": off_id},
                {"uploaded_by_officer_id": off_id}
            ]

    if area:
        query["area"] = area

    if status:
        query["status"] = status

    if dtc_code:
        query["dtc_code"] = dtc_code

    if min_amount is not None or max_amount is not None:
        amt_query = {}
        if min_amount is not None:
            amt_query["$gte"] = min_amount
        if max_amount is not None:
            amt_query["$lte"] = max_amount
        query["pending_amount"] = amt_query

    if search:
        search_or = [
            {"name": {"$regex": search, "$options": "i"}},
            {"customer_id": {"$regex": search, "$options": "i"}},
            {"meter_number": {"$regex": search, "$options": "i"}},
            {"address": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
        if "$or" in query:
            query["$and"] = [{"$or": query.pop("$or")}, {"$or": search_or}]
        else:
            query["$or"] = search_or

    customers_docs = await db.customers.find(query).skip(skip).limit(limit).to_list(limit)

    if not customers_docs:
        return []

    # Batch fetch meters
    customer_ids = [cus.get("customer_id") for cus in customers_docs if cus.get("customer_id")]
    all_meters_docs = await db.meters.find({"customer_id": {"$in": customer_ids}}).to_list(5000)

    # Collect all officer IDs (from customers AND meters)
    all_officer_ids = set()
    for cus in customers_docs:
        if cus.get("assigned_officer_id"):
            all_officer_ids.add(cus.get("assigned_officer_id"))
        if cus.get("uploaded_by_officer_id"):
            all_officer_ids.add(cus.get("uploaded_by_officer_id"))
    for m in all_meters_docs:
        if m.get("assigned_officer_id"):
            all_officer_ids.add(m.get("assigned_officer_id"))
        if m.get("uploaded_by_officer_id"):
            all_officer_ids.add(m.get("uploaded_by_officer_id"))

    officer_names_map = {}
    if all_officer_ids:
        officers_docs = await db.officers.find({"officer_id": {"$in": list(all_officer_ids)}}).to_list(1000)
        officer_names_map = {o.get("officer_id"): o.get("full_name") for o in officers_docs if o.get("officer_id")}

    meters_by_customer = defaultdict(list)
    for m in all_meters_docs:
        cid = m.get("customer_id")
        m_off_id = m.get("assigned_officer_id")
        if cid:
            meters_by_customer[cid].append(
                MeterSchema(
                    meter_id=m.get("meter_id", ""),
                    meter_number=m.get("meter_number", ""),
                    customer_id=m.get("customer_id", ""),
                    latitude=float(m.get("latitude", 0.0)),
                    longitude=float(m.get("longitude", 0.0)),
                    assigned_officer_id=m_off_id,
                    assigned_officer_name=officer_names_map.get(m_off_id) if m_off_id else None,
                    uploaded_by_officer_id=m.get("uploaded_by_officer_id")
                )
            )


    results = []
    for cus in customers_docs:
        cid = cus.get("customer_id")
        meters = meters_by_customer.get(cid, [])
        officer_name = officer_names_map.get(cus.get("assigned_officer_id"))

        results.append(
            CustomerResponse(
                id=str(cus["_id"]),
                customer_id=cid,
                name=cus.get("name"),
                meter_number=cus.get("meter_number", ""),
                dtc_code=cus.get("dtc_code"),
                phone=cus.get("phone", ""),
                email=cus.get("email"),
                address=cus.get("address", ""),
                area=cus.get("area", ""),
                latitude=float(cus.get("latitude", 0.0)),
                longitude=float(cus.get("longitude", 0.0)),
                pending_amount=float(cus.get("pending_amount", 0.0)),
                due_date=cus.get("due_date"),
                status=cus.get("status", "pending"),
                priority=cus.get("priority", "normal"),
                assigned_officer_id=cus.get("assigned_officer_id"),
                assigned_officer_name=officer_name,
                uploaded_by_officer_id=cus.get("uploaded_by_officer_id"),
                meters=meters,
                created_at=str(cus.get("created_at", "")),
                updated_at=str(cus.get("updated_at", ""))
            )
        )

    return results

@router.post("", response_model=CustomerResponse)
async def create_customer(
    request: CustomerCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    existing = await db.customers.find_one({"customer_id": request.customer_id})
    if existing:
        raise HTTPException(status_code=400, detail=f"Customer ID '{request.customer_id}' already exists.")

    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    location = {
        "type": "Point",
        "coordinates": [request.longitude, request.latitude]
    }

    assigned_officer_id = request.assigned_officer_id
    if not assigned_officer_id:
        off_doc = await db.officers.find_one({
            "$or": [
                {"user_id": current_user["_id"]},
                {"email": current_user.get("email")}
            ]
        })
        if off_doc:
            assigned_officer_id = off_doc.get("officer_id")

    customer_doc = {
        "customer_id": request.customer_id,
        "name": request.name,
        "phone": request.phone,
        "email": request.email,
        "address": request.address,
        "area": request.area,
        "latitude": request.latitude,
        "longitude": request.longitude,
        "location": location,
        "meter_number": request.meter_number,
        "dtc_code": request.dtc_code,
        "pending_amount": float(request.pending_amount) if request.pending_amount is not None else 0.0,
        "due_date": request.due_date,
        "status": request.status or ("overdue" if (request.pending_amount or 0) > 3000 else ("pending" if (request.pending_amount or 0) > 0 else "paid")),
        "priority": request.priority or ("high" if (request.pending_amount or 0) > 5000 else "normal"),
        "assigned_officer_id": assigned_officer_id,
        "uploaded_by_officer_id": request.uploaded_by_officer_id or assigned_officer_id,
        "created_at": now_str,
        "updated_at": now_str
    }

    result = await db.customers.insert_one(customer_doc)

    # Create associated primary Meter document
    meter_id = f"MTR-{uuid4().hex[:6].upper()}"
    meter_doc = {
        "meter_id": meter_id,
        "meter_number": request.meter_number,
        "customer_id": request.customer_id,
        "latitude": request.latitude,
        "longitude": request.longitude,
        "assigned_officer_id": assigned_officer_id,
        "uploaded_by_officer_id": customer_doc["uploaded_by_officer_id"]
    }
    await db.meters.insert_one(meter_doc)

    officer_name = None
    if assigned_officer_id:
        off_doc = await db.officers.find_one({"officer_id": assigned_officer_id})
        if off_doc:
            officer_name = off_doc.get("full_name")

    return CustomerResponse(
        id=str(result.inserted_id),
        customer_id=request.customer_id,
        name=request.name,
        meter_number=request.meter_number,
        dtc_code=customer_doc.get("dtc_code"),
        phone=request.phone,
        email=request.email,
        address=request.address,
        area=request.area,
        latitude=request.latitude,
        longitude=request.longitude,
        pending_amount=customer_doc["pending_amount"],
        due_date=customer_doc["due_date"],
        status=customer_doc["status"],
        priority=customer_doc["priority"],
        assigned_officer_id=assigned_officer_id,
        assigned_officer_name=officer_name,
        uploaded_by_officer_id=customer_doc["uploaded_by_officer_id"],
        meters=[
            MeterSchema(
                meter_id=meter_id,
                meter_number=request.meter_number,
                customer_id=request.customer_id,
                latitude=request.latitude,
                longitude=request.longitude,
                assigned_officer_id=assigned_officer_id,
                assigned_officer_name=officer_name,
                uploaded_by_officer_id=customer_doc["uploaded_by_officer_id"]
            )
        ],
        created_at=now_str,
        updated_at=now_str
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(
    customer_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    cus = await db.customers.find_one({"customer_id": customer_id})
    if not cus:
        raise HTTPException(status_code=404, detail="Customer not found")

    meters_docs = await db.meters.find({"customer_id": customer_id}).to_list(10)
    
    # Collect all officer IDs from customer and meters
    officer_ids = set()
    if cus.get("assigned_officer_id"):
        officer_ids.add(cus.get("assigned_officer_id"))
    for m in meters_docs:
        if m.get("assigned_officer_id"):
            officer_ids.add(m.get("assigned_officer_id"))

    officer_names_map = {}
    if officer_ids:
        officers = await db.officers.find({"officer_id": {"$in": list(officer_ids)}}).to_list(100)
        officer_names_map = {o.get("officer_id"): o.get("full_name") for o in officers if o.get("officer_id")}

    meters = []
    for m in meters_docs:
        m_off_id = m.get("assigned_officer_id")
        meters.append(
            MeterSchema(
                meter_id=m.get("meter_id", ""),
                meter_number=m.get("meter_number", ""),
                customer_id=m.get("customer_id", ""),
                latitude=float(m.get("latitude", 0.0)),
                longitude=float(m.get("longitude", 0.0)),
                assigned_officer_id=m_off_id,
                assigned_officer_name=officer_names_map.get(m_off_id) if m_off_id else None,
                uploaded_by_officer_id=m.get("uploaded_by_officer_id")
            )
        )

    officer_name = officer_names_map.get(cus.get("assigned_officer_id"))


    return CustomerResponse(
        id=str(cus["_id"]),
        customer_id=cus.get("customer_id"),
        name=cus.get("name"),
        meter_number=cus.get("meter_number", ""),
        dtc_code=cus.get("dtc_code"),
        phone=cus.get("phone", ""),
        email=cus.get("email"),
        address=cus.get("address", ""),
        area=cus.get("area", ""),
        latitude=float(cus.get("latitude", 0.0)),
        longitude=float(cus.get("longitude", 0.0)),
        pending_amount=float(cus.get("pending_amount", 0.0)),
        due_date=cus.get("due_date"),
        status=cus.get("status", "pending"),
        priority=cus.get("priority", "normal"),
        assigned_officer_id=cus.get("assigned_officer_id"),
        assigned_officer_name=officer_name,
        uploaded_by_officer_id=cus.get("uploaded_by_officer_id"),
        meters=meters,
        created_at=str(cus.get("created_at", "")),
        updated_at=str(cus.get("updated_at", ""))
    )


@router.post("/upload")
async def upload_customers_bulk(
    file: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    """Bulk import customer records from CSV or XLSX files."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    user_id_str = str(current_user["_id"])
    officer_id = None
    officer_doc = await db.officers.find_one({
        "$or": [
            {"user_id": current_user["_id"]},
            {"user_id": user_id_str},
            {"email": current_user.get("email")}
        ]
    })
    if officer_doc:
        officer_id = officer_doc.get("officer_id")

    return await CustomerImportService.import_customers(
        file=file,
        db=db,
        uploader_officer_id=officer_id,
        user_id_str=user_id_str
    )


