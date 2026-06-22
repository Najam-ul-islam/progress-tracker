"""Single source of SQLModel metadata.

Imports all models to register them with SQLModel.metadata for Alembic.
Models import SQLModel from `app.db.model` to avoid circular imports.
"""

from __future__ import annotations

# Import all models to register with metadata
from app.modules.clients.model import Client  # noqa
from app.modules.notifications.model import Notification  # noqa
from app.modules.payments.model import Payment, DeveloperPayment  # noqa
from app.modules.projects.model import Project, ProjectModule  # noqa
from app.modules.users.model import User  # noqa

from app.db.model import SQLModel

metadata = SQLModel.metadata

__all__ = ["SQLModel", "metadata"]
