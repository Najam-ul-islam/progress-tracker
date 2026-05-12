"""Auth module: HTTP routing only. Delegates to services.

No business logic, no DB access, no cryptography. Endpoints translate
service-level exceptions into the canonical HTTP responses defined in
`contracts/openapi.yaml`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.db.session import get_session
from app.modules.auth import service as auth_service
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.schema import (
    AuthError,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserRead,
)
from app.modules.users.model import User


router = APIRouter(tags=["auth"])

_GENERIC_AUTH_ERROR = "Could not validate credentials"


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"model": AuthError, "description": "Email already registered"},
    },
)
def register(
    payload: UserCreate,
    session: Session = Depends(get_session),
) -> User:
    try:
        return auth_service.register_user(session, payload)
    except auth_service.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        401: {"model": AuthError, "description": "Invalid credentials"},
    },
)
def login(
    payload: UserLogin,
    session: Session = Depends(get_session),
) -> TokenResponse:
    try:
        return auth_service.login_user(session, payload)
    except auth_service.InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_GENERIC_AUTH_ERROR,
        )


@router.get(
    "/me",
    response_model=UserRead,
    responses={
        401: {"model": AuthError, "description": "Missing or invalid token"},
    },
)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
