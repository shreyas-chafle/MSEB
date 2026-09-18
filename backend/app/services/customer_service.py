from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Dict, Any, Optional
from collections import defaultdict
from app.schemas.customer import NearbyCustomerResponse, CustomerResponse, MeterSchema
from app.services.maps_service import haversine_distance

class CustomerService:

    @staticmethod
    async def get_nearby_customers(
        db: AsyncIOMotorDatabase,
        latitude: float,
        longitude: float,
        radius_meters: float = 5000.0,
        status_filter: Optional[str] = None,
        officer_id: Optional[str] = None,
    ) -> List[NearbyCustomerResponse]:
        query: Dict[str, Any] = {}
        if status_filter:
            query["status"] = status_filter
        else:
            # By default exclude fully paid customers for field officer collections
            query["status"] = {"$ne": "paid"}

        if officer_id:
            query["$or"] = [
                {"assigned_officer_id": officer_id},
                {"uploaded_by_officer_id": officer_id}
            ]

        # Fetch candidate customers
        customers = await db.customers.find(query).to_list(1000)
        if not customers:
            return []

        # Batch fetch meters for all candidate customers
        customer_ids = [cus.get("customer_id") for cus in customers if cus.get("customer_id")]
        all_meters_docs = await db.meters.find({"customer_id": {"$in": customer_ids}}).to_list(5000)

        # Collect all officer IDs (from customers AND meters)
        all_officer_ids = set()
        for cus in customers:
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



        nearby_list = []
        for cus in customers:
            c_lat = float(cus.get("latitude", 0.0))
            c_lng = float(cus.get("longitude", 0.0))
            cid = cus.get("customer_id")
            meters = meters_by_customer.get(cid, [])

            # If customer coordinates are 0 or missing, fallback to first valid meter location
            if (c_lat == 0.0 or c_lng == 0.0) and meters:
                for m in meters:
                    if m.latitude != 0.0 and m.longitude != 0.0:
                        c_lat, c_lng = m.latitude, m.longitude
                        break

            dist = haversine_distance(latitude, longitude, c_lat, c_lng)
            if dist <= radius_meters:
                # Calculate duration (riding speed ~25km/h => 6.94 m/s + 1.35 urban detour factor)
                dur_mins = round((dist * 1.35 / 6.94) / 60.0, 1)
                officer_name = officer_names_map.get(cus.get("assigned_officer_id"))

                nearby_item = NearbyCustomerResponse(
                    id=str(cus.get("_id")),
                    customer_id=cid,
                    name=cus.get("name"),
                    meter_number=cus.get("meter_number", ""),
                    dtc_code=cus.get("dtc_code"),
                    phone=cus.get("phone", ""),
                    email=cus.get("email"),
                    address=cus.get("address", ""),
                    area=cus.get("area", ""),
                    latitude=c_lat,
                    longitude=c_lng,
                    pending_amount=float(cus.get("pending_amount", 0.0)),
                    due_date=cus.get("due_date"),
                    status=cus.get("status", "pending"),
                    priority=cus.get("priority", "normal"),
                    assigned_officer_id=cus.get("assigned_officer_id"),
                    assigned_officer_name=officer_name,
                    uploaded_by_officer_id=cus.get("uploaded_by_officer_id"),
                    meters=meters,

                    created_at=str(cus.get("created_at", "")),
                    updated_at=str(cus.get("updated_at", "")),
                    distance_meters=round(dist, 1),
                    estimated_duration_mins=max(1.0, dur_mins)
                )
                nearby_list.append(nearby_item)

        # Sort by distance primarily
        nearby_list.sort(key=lambda x: x.distance_meters)
        return nearby_list

