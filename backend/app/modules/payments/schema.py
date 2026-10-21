"""Payments module: Pydantic v2 request/response schemas. No tables, no business logic.

Per data-model.md and contracts/openapi.yaml. All request schemas are closed
(`extra="forbid"`) so server-set fields (id, status, derived amounts,
created_at) are rejected if supplied — FR-018.

Decimal fields serialise as JSON strings on the wire (R10).
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


PaymentStatus = Literal["pending", "partial", "paid"]
DeveloperPaymentStatus = Literal["pending", "paid"]


class PaymentGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_amount: Decimal = Field(
        gt=Decimal("0"), max_digits=12, decimal_places=2
    )


class PaymentStatusPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    developer_payment_id: int | None = Field(default=None, gt=0)
    target: Literal["all"] | None = None

    @model_validator(mode="after")
    def _exactly_one(self) -> "PaymentStatusPatch":
        if self.developer_payment_id is None and self.target is None:
            raise ValueError(
                "must specify either developer_payment_id or target"
            )
        if self.developer_payment_id is not None and self.target is not None:
            raise ValueError(
                "developer_payment_id and target are mutually exclusive"
            )
        return self


class DeveloperPaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_id: int
    developer_id: int
    module_id: int
    share_percentage: Decimal
    amount: Decimal
    status: DeveloperPaymentStatus
    created_at: datetime


class DeveloperPaymentMineRead(BaseModel):
    """Developer self-service shape: child row + denormalised project_id."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    payment_id: int
    developer_id: int
    module_id: int
    project_id: int
    share_percentage: Decimal
    amount: Decimal
    status: DeveloperPaymentStatus
    created_at: datetime


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    total_amount: Decimal
    company_amount: Decimal
    developer_amount: Decimal
    status: PaymentStatus
    created_at: datetime


class PaymentDetailRead(PaymentRead):
    developer_breakdown: list[DeveloperPaymentRead]


class PaymentSummaryBucket(BaseModel):
    count: int
    sum: Decimal


class PaymentSummaryRead(BaseModel):
    total_billed: Decimal
    total_company_reserve: Decimal
    total_developer_disbursed: Decimal
    by_status: dict[PaymentStatus, PaymentSummaryBucket]
