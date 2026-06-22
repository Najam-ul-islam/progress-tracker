"""Defines the base SQLModel class.

Separated from `base.py` to prevent circular imports during model registration.
"""
from sqlmodel import SQLModel as _SQLModel

class SQLModel(_SQLModel):
    class Config:
        arbitrary_types_allowed = True
