"""Projects module: HTTP routing only. Delegates to services."""

from fastapi import APIRouter

router = APIRouter(tags=["projects"])
