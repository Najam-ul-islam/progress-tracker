# Internal Contract — Role Guard Dependencies

**Module**: `app/modules/auth/dependencies.py`
**Consumed by**: every other module that needs an authenticated principal or role check.

This is an **internal Python contract**, not an HTTP contract. It is captured here because every
other module in the system will import these symbols, so changing the signatures is a
cross-cutting concern that belongs in the design artifacts.

---

## 1. The principal dependency

```python
def get_current_user(
    token: str = Depends(oauth2_scheme),         # OAuth2PasswordBearer(tokenUrl="/auth/login")
    session: Session = Depends(get_session),     # from app.db.session
) -> User: ...
```

- Decodes `token` via `app.core.security.decode_access_token`.
- Reads `sub` from the payload, casts it to `int`.
- Looks the user up via `app.modules.users.repository.get_user_by_id`.
- Returns the live `User` SQLModel row.
- **Raises** `HTTPException(401, "Could not validate credentials")` for ANY failure
  (missing/expired/invalid token, missing user). Single generic shape (FR-015).

`User` is the SQLModel class re-exported from `app.modules.users.model`. Other modules MUST
import `get_current_user` from `app.modules.auth.dependencies` — they MUST NOT decode the JWT
themselves (FR-013, FR-017).

---

## 2. The role-guard factory

```python
def require_roles(*allowed: str) -> Callable[..., User]:
    def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(403, "Forbidden")
        return user
    return _checker
```

### 2.1 Pre-built convenience guards

```python
require_admin     = require_roles("admin")
require_manager   = require_roles("manager")
require_developer = require_roles("developer")
require_any       = require_roles            # alias — same factory, multi-role usage
```

### 2.2 Usage from another module

```python
from fastapi import APIRouter, Depends
from app.modules.auth.dependencies import require_admin, require_any
from app.modules.users.model import User

router = APIRouter()

@router.delete("/clients/{client_id}")
def delete_client(
    client_id: int,
    user: User = Depends(require_admin),
):
    ...

@router.post("/projects/")
def create_project(
    user: User = Depends(require_any("admin", "manager")),
):
    ...
```

### 2.3 Behaviour

- Returns the `User` row (so the route handler sees a fully-typed principal).
- Raises HTTP 403 with body `{"detail": "Forbidden"}` if the role doesn't match.
- Raises HTTP 401 (from the wrapped `get_current_user`) if the token itself is invalid.

---

## 3. Stability guarantees

- The names `get_current_user`, `require_admin`, `require_manager`, `require_developer`, and
  `require_any` MUST remain stable across this feature's lifetime. Other modules will import
  them by name.
- The return type is always `User` (the SQLModel from `app.modules.users.model`).
- The exception types are always `fastapi.HTTPException` with status codes 401 or 403.
