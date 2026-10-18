from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings


bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    professional_id: UUID
    roles: tuple[str, ...]

    def has_role(self, *roles: str) -> bool:
        return bool(set(self.roles).intersection(roles))


def current_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> Principal:
    if not credentials:
        raise HTTPException(status_code=401, detail="Token de acesso obrigatório")
    try:
        key = settings.jwt_public_key_path.read_text(encoding="utf-8")
        payload = jwt.decode(
            credentials.credentials,
            key,
            algorithms=["RS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "professional_id", "exp", "iat", "jti"]},
        )
        if payload.get("token_type") != "access":
            raise jwt.InvalidTokenError()
        principal = Principal(UUID(payload["professional_id"]), tuple(payload.get("roles", [])))
        request.state.principal = principal
        return principal
    except (OSError, jwt.PyJWTError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado") from exc


def require_admin(principal: Principal = Depends(current_principal)) -> Principal:
    if not principal.has_role("ADMIN"):
        raise HTTPException(status_code=403, detail="Operação restrita a administradores")
    return principal

