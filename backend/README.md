# Backend

Modular monolith FastAPI service for the Progress Tracker SaaS.

Bootstrap instructions: see [`specs/001-project-structure/quickstart.md`](../specs/001-project-structure/quickstart.md).

Run locally:

```bash
uv sync
uv run uvicorn app.main:app --reload
```

Module layer contract: [`app/modules/README.md`](app/modules/README.md).
