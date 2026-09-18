from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
import re

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=100)

    @field_validator("email")
    @classmethod
    def sanitize_email(cls, v: str) -> str:
        return v.strip().lower()

class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    assigned_area: Optional[str] = Field(None, max_length=100)

    @field_validator("full_name", "assigned_area", "phone")
    @classmethod
    def sanitize_inputs(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        # Strip potential HTML/script/SQL control characters & extra whitespace against injection
        cleaned = re.sub(r'[<>\'"]', '', v).strip()
        return cleaned

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str = "field_officer"
    phone: Optional[str] = None
    officer_id: Optional[str] = None
    is_active: bool = True

TokenResponse.model_rebuild()
