"""FastAPI application entry point.

Run with: ``uv run uvicorn app.main:app --reload``

This module wires every domain module's ``router`` under a deterministic URL
prefix derived from the module package name (underscores → hyphens). Adding
a new module = appending one tuple to ``MODULE_REGISTRY``.
"""

from __future__ import annotations

import importlib

from fastapi import FastAPI

from app.core.config import get_settings

MODULE_REGISTRY: tuple[tuple[str, str], ...] = (
    ("auth", "/auth"),
    ("users", "/users"),
    ("clients", "/clients"),
    ("projects", "/projects"),
    ("modules_tasks", "/modules-tasks"),
    ("developers", "/developers"),
    ("payments", "/payments"),
    ("reporting", "/reporting"),
    ("notifications", "/notifications"),
)


def register_modules(application: FastAPI) -> None:
    """Import each module's routes and include its router under its prefix."""
    for package_name, url_prefix in MODULE_REGISTRY:
        routes_module = importlib.import_module(
            f"app.modules.{package_name}.routes"
        )
        application.include_router(routes_module.router, prefix=url_prefix)


get_settings()  # FR-010 / R5: fail fast if JWT_SECRET_KEY (or other required vars) is missing.

app = FastAPI(title="Progress Tracker Backend")
register_modules(app)
