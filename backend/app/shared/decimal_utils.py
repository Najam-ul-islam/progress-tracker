"""Sole legal home for financial decimal helpers. Modules MUST NOT use float for money."""

from __future__ import annotations

from decimal import ROUND_HALF_EVEN, Decimal

from app.shared.constants import COMPANY_SHARE, DECIMAL_QUANTIZE, DEVELOPER_SHARE


def quantize_money(value: Decimal) -> Decimal:
    return value.quantize(DECIMAL_QUANTIZE, rounding=ROUND_HALF_EVEN)


def split_company_developer(amount: Decimal) -> tuple[Decimal, Decimal]:
    company = quantize_money(amount * COMPANY_SHARE)
    developer = quantize_money(amount * DEVELOPER_SHARE)
    return company, developer
