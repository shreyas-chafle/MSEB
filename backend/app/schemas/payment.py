from pydantic import BaseModel, Field, model_validator
from typing import Optional

class PaymentCollectRequest(BaseModel):
    bill_id: Optional[str] = None
    customer_id: str
    meter_id: Optional[str] = None
    amount: float = Field(..., gt=0, description="Amount collected must be greater than zero")
    payment_method: str = Field(..., description="cash, upi, online, cheque, or other")
    transaction_reference: Optional[str] = None
    remarks: Optional[str] = None
    collection_latitude: Optional[float] = None
    collection_longitude: Optional[float] = None

class PaymentResponse(BaseModel):
    id: str
    receipt_number: str
    payment_id: str
    bill_id: Optional[str] = None
    customer_id: str
    customer_name: Optional[str] = None
    meter_id: Optional[str] = None
    meter_number: Optional[str] = None
    officer_id: str
    officer_name: Optional[str] = None
    amount: float
    payment_method: str
    transaction_reference: Optional[str] = None
    remarks: Optional[str] = None
    collection_latitude: Optional[float] = None
    collection_longitude: Optional[float] = None
    previous_pending_amount: float
    remaining_pending_amount: float
    bill_status: str  # paid, partially_paid
    created_at: str

class ReceiptData(BaseModel):
    organization_name: str = "Electricity Department - Govt. Utility Services"
    receipt_number: str
    date_time: str
    customer_name: str
    customer_id: str
    meter_number: str
    address: str
    collected_amount: float
    payment_method: str
    transaction_reference: str
    field_officer_name: str
    field_officer_id: str
    previous_pending: float
    remaining_balance: float
    status: str
