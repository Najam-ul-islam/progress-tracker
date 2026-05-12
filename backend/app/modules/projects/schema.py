"""Projects module: Pydantic v2 request/response schemas. No tables, no business logic.

Per data-model.md §"Schemas". All schemas are closed (`extra="forbid"`) so
server-set fields (id, status on create, company_share, developer_share,
created_at, updated_at, is_active) are rejected if supplied — FR-018.
Decimal fields serialise as JSON strings on the wire (R10).
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ProjectStatus = Literal["pending", "active", "completed"]
ModuleStatus = Literal["pending", "in_progress", "completed"]


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    client_id: int = Field(gt=0)
    total_amount: Decimal = Field(
        gt=Decimal("0"), max_digits=12, decimal_places=2
    )
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def _date_range(self) -> "ProjectCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    total_amount: Decimal | None = Field(
        default=None, gt=Decimal("0"), max_digits=12, decimal_places=2
    )
    start_date: date | None = None
    end_date: date | None = None
    status: Literal["active"] | None = None  # only the manual transition

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "ProjectUpdate":
        if all(
            v is None
            for v in (
                self.name,
                self.description,
                self.total_amount,
                self.start_date,
                self.end_date,
                self.status,
            )
        ):
            raise ValueError(
                "at least one of name/description/total_amount/start_date/end_date/status must be provided"
            )
        return self


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    client_id: int
    total_amount: Decimal
    company_share: Decimal
    developer_share: Decimal
    start_date: date
    end_date: date
    status: ProjectStatus
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ModuleCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    assigned_developer_id: int = Field(gt=0)
    share_percentage: Decimal = Field(
        gt=Decimal("0"),
        le=Decimal("70"),
        max_digits=5,
        decimal_places=2,
    )


class ModuleUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    assigned_developer_id: int | None = Field(default=None, gt=0)
    share_percentage: Decimal | None = Field(
        default=None,
        gt=Decimal("0"),
        le=Decimal("70"),
        max_digits=5,
        decimal_places=2,
    )

    @model_validator(mode="after")
    def _at_least_one_field(self) -> "ModuleUpdate":
        if all(
            v is None
            for v in (
                self.name,
                self.description,
                self.assigned_developer_id,
                self.share_percentage,
            )
        ):
            raise ValueError(
                "at least one of name/description/assigned_developer_id/share_percentage must be provided"
            )
        return self


class ModuleProgressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    progress: int = Field(ge=0, le=100)


class ModuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    name: str
    description: str | None
    assigned_developer_id: int
    progress: int
    status: ModuleStatus
    share_percentage: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ModuleProgressSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    progress: int
    share_percentage: Decimal


class ProjectProgressResponse(BaseModel):
    project_id: int
    progress: float
    modules: list[ModuleProgressSummary]


ProjectListResponse = list[ProjectRead]
ModuleListResponse = list[ModuleRead]
