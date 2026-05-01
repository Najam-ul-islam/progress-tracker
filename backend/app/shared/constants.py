"""Project-wide constants. Domain-specific constants belong inside their owning module."""

from __future__ import annotations

from decimal import Decimal

COMPANY_SHARE: Decimal = Decimal("0.30")
DEVELOPER_SHARE: Decimal = Decimal("0.70")

DECIMAL_QUANTIZE = Decimal("0.01")
