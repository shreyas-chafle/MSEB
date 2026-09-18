from pydantic import BaseModel
from typing import List, Optional
from app.schemas.customer import NearbyCustomerResponse

class OfficerDashboardMetrics(BaseModel):
    total_assigned_customers: int
    total_pending_amount: float
    number_of_pending_bills: int
    number_of_completed_collections: int
    todays_collection_target: float
    todays_collected_amount: float
    remaining_collections_count: int
    remaining_collections_amount: float
    nearby_pending_customers: List[NearbyCustomerResponse] = []

