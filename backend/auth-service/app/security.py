import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings


password_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)
bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: UUID
    professional_id: UUID
    roles: tuple[str, ...]
    display_name: str

    def has_role(self, *roles: str) -> bool:
        return bool(set(self.roles).intersection(roles))


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return password_hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def _read_key(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"Chave JWT não encontrada em {path}") from exc


def create_access_token(principal: Principal, settings: Settings) -> tuple[str, datetime]:
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=settings.access_token_minutes)
    payload: dict[str, Any] = {
        "sub": str(principal.user_id),
        "professional_id": str(principal.professional_id),
        "name": principal.display_name,
        "roles": list(principal.roles),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": now,
        "exp": expires_at,
        "jti": str(uuid4()),
        "token_type": "access",
    }
    token = jwt.encode(payload, _read_key(settings.jwt_private_key_path), algorithm="RS256")
    return token, expires_at


def create_offline_grant(principal: Principal, device_id: UUID, settings: Settings) -> tuple[str, datetime]:
    """Cria permissão local assinada; ela nunca é aceita como token de API."""
    now = datetime.now(UTC)
    expires_at = now + timedelta(hours=settings.offline_grant_hours)
    payload = {
        "sub": str(principal.user_id),
        "professional_id": str(principal.professional_id),
        "name": principal.display_name,
        "roles": list(principal.roles),
        "device_id": str(device_id),
        "iss": settings.jwt_issuer,
        "aud": "medicalfield-offline",
        "iat": now,
        "exp": expires_at,
        "jti": str(uuid4()),
        "token_type": "offline_grant",
    }
    return jwt.encode(payload, _read_key(settings.jwt_private_key_path), algorithm="RS256"), expires_at


def new_refresh_token() -> tuple[UUID, str, str]:
    session_id = uuid4()
    raw_token = f"{session_id}.{secrets.token_urlsafe(48)}"
    digest = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return session_id, raw_token, digest


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def decode_access_token(token: str, settings: Settings) -> Principal:
    try:
        payload = jwt.decode(
            token,
            _read_key(settings.jwt_public_key_path),
            algorithms=["RS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "professional_id", "exp", "iat", "jti"]},
        )
        if payload.get("token_type") != "access":
            raise jwt.InvalidTokenError("Tipo de token incorreto")
        return Principal(
            user_id=UUID(payload["sub"]),
            professional_id=UUID(payload["professional_id"]),
            roles=tuple(payload.get("roles", [])),
            display_name=payload.get("name", ""),
        )
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def current_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> Principal:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso obrigatório",
            headers={"WWW-Authenticate": "Bearer"},
        )
    principal = decode_access_token(credentials.credentials, settings)
    request.state.principal = principal
    return principal


def require_roles(*allowed_roles: str):
    def dependency(principal: Principal = Depends(current_principal)) -> Principal:
        if not principal.has_role(*allowed_roles):
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        return principal

    return dependency

