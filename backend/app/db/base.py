"""Single source of SQLModel metadata. Every module's model.py imports SQLModel from here."""

from __future__ import annotations

from sqlmodel import SQLModel

metadata = SQLModel.metadata

__all__ = ["SQLModel", "metadata"]
