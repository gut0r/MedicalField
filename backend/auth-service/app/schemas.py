from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=8, max_length=200)
    device_id: UUID
    device_name: str = Field(min_length=2, max_length=120)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    offline_grant: str
    offline_grant_expires_at: datetime
    professional: "ProfessionalResponse"


class ProfessionalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_name: str
    license_type: str
    license_number: str
    email: str | None
    roles: list[str] = []


class CreateUserRequest(BaseModel):
    professional_id: UUID
    username: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=12, max_length=200)
    roles: list[str] = Field(min_length=1)

