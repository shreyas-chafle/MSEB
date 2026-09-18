from pydantic import BaseModel
from typing import Optional, List

class OfficerCreate(BaseModel):
    full_name: str
    email: str
    password: str
    phone: str
    assigned_area: str
    target_collections_count: int = 15
    target_collection_amount: float = 25000.0

class OfficerUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    assigned_area: Optional[str] = None
    target_collections_count: Optional[int] = None
    target_collection_amount: Optional[float] = None
    is_active: Optional[bool] = None

class OfficerResponse(BaseModel):
    id: str
    officer_id: str
    user_id: str
    full_name: str
    email: str
    phone: str
    assigned_area: str
    assigned_customers_count: int = 0
    total_collected_amount: float = 0.0
    today_collected_amount: float = 0.0
    today_collections_count: int = 0
    target_collections_count: int = 15
    target_collection_amount: float = 25000.0
    current_latitude: Optional[float] = None
    current_longitude: Optional[float] = None
    last_active: Optional[str] = None
    is_active: bool = True

class CustomerAssignmentRequest(BaseModel):
    officer_id: str
    customer_ids: List[str]

class MeterAssignmentRequest(BaseModel):
    officer_id: str
    meter_ids: List[str]

