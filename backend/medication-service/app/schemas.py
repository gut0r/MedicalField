from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MedicationInput(BaseModel):
    id: UUID | None = None
    name: str = Field(min_length=2, max_length=180)
    active_ingredient: str | None = Field(default=None, max_length=180)
    pharmaceutical_form: str | None = Field(default=None, max_length=100)
    concentration: str | None = Field(default=None, max_length=100)
    unit: str | None = Field(default=None, max_length=30)


class MedicationUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    active_ingredient: str | None = Field(default=None, max_length=180)
    pharmaceutical_form: str | None = Field(default=None, max_length=100)
    concentration: str | None = Field(default=None, max_length=100)
    unit: str | None = Field(default=None, max_length=30)
    base_version: int = Field(ge=1)


class MedicationResponse(BaseModel):
    id: UUID
    name: str
    active_ingredient: str | None
    pharmaceutical_form: str | None
    concentration: str | None
    unit: str | None
    active: bool
    version: int
    created_at: datetime
    updated_at: datetime


class ChangePage(BaseModel):
    items: list[MedicationResponse]
    next_cursor: int

