from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status

from .audit import AuditMiddleware
from .config import Settings, get_settings
from .database import close_pool, connection, open_pool
from .schemas import CreateUserRequest, LoginRequest, ProfessionalResponse, TokenResponse
from .security import (
    Principal,
    create_access_token,
    create_offline_grant,
    current_principal,
    hash_password,
    hash_refresh_token,
    needs_rehash,
    new_refresh_token,
    require_roles,
    verify_password,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    open_pool()
    yield
    close_pool()


app = FastAPI(
    title="MedicalField - API de Autenticação",
    version="0.1.0",
    description="Identidade, JWT e autorização dos profissionais do MedicalField.",
    lifespan=lifespan,
)
app.add_middleware(AuditMiddleware)

REFRESH_COOKIE_PATH = "/api/auth"
REFRESH_COOKIE_NAMES = {
    "portal": "medicalfield_portal_refresh",
    "field": "medicalfield_field_refresh",
}


def _refresh_cookie_name(request: Request) -> str:
    """Mantém sessões independentes para o portal e o cliente de campo."""
    client = request.headers.get("x-medicalfield-client", "").strip().lower()
    return REFRESH_COOKIE_NAMES.get(client, "medicalfield_refresh")


def _refresh_cookie_secure(request: Request) -> bool:
    """Marca o cookie como Secure quando o acesso externo usa HTTPS."""
    forwarded_proto = request.headers.get("x-forwarded-proto")
    if forwarded_proto:
        return forwarded_proto.split(",", maxsplit=1)[0].strip().lower() == "https"
    return request.url.scheme == "https"


@app.get("/internal/health", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok", "service": "auth-service"}


def _load_principal(cur, user_id: UUID) -> tuple[Principal, dict]:
    cur.execute(
        """
        SELECT u.id AS user_id, p.id AS professional_id, p.display_name,
               p.license_type, p.license_number, p.email,
               COALESCE(array_agg(ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL), '{}') AS roles
        FROM identity.users u
        JOIN identity.professionals p ON p.id = u.professional_id
        LEFT JOIN identity.user_roles ur ON ur.user_id = u.id
        WHERE u.id = %s AND u.active AND p.active
        GROUP BY u.id, p.id
        """,
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Usuário inativo ou inexistente")
    principal = Principal(row["user_id"], row["professional_id"], tuple(row["roles"]), row["display_name"])
    return principal, row


@app.post("/auth/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    response: Response,
    request: Request,
    settings: Settings = Depends(get_settings),
) -> TokenResponse:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, password_hash, active, locked_until
            FROM identity.users WHERE username = %s
            """,
            (payload.username,),
        )
        user = cur.fetchone()
        now = datetime.now(UTC)
        if not user or not user["active"] or (user["locked_until"] and user["locked_until"] > now):
            raise HTTPException(status_code=401, detail="Credenciais inválidas")
        if not verify_password(payload.password, user["password_hash"]):
            cur.execute(
                """
                UPDATE identity.users
                   SET failed_attempts = failed_attempts + 1,
                       locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END,
                       updated_at = now()
                 WHERE id = %s
                """,
                (user["id"],),
            )
            raise HTTPException(status_code=401, detail="Credenciais inválidas")

        if needs_rehash(user["password_hash"]):
            cur.execute("UPDATE identity.users SET password_hash=%s WHERE id=%s", (hash_password(payload.password), user["id"]))
        cur.execute("UPDATE identity.users SET failed_attempts=0, locked_until=NULL, updated_at=now() WHERE id=%s", (user["id"],))
        principal, professional = _load_principal(cur, user["id"])
        request.state.principal = principal

        cur.execute(
            """
            INSERT INTO sync.devices (id, display_name, registered_to, last_seen_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (id) DO UPDATE SET display_name=EXCLUDED.display_name,
                registered_to=EXCLUDED.registered_to, active=TRUE, last_seen_at=now()
            """,
            (payload.device_id, payload.device_name, principal.professional_id),
        )

        access_token, expires_at = create_access_token(principal, settings)
        offline_grant, offline_expires = create_offline_grant(principal, payload.device_id, settings)
        session_id, raw_refresh, refresh_hash = new_refresh_token()
        refresh_expires = now + timedelta(hours=settings.refresh_token_hours)
        cur.execute(
            """
            INSERT INTO identity.refresh_sessions (id, user_id, device_id, token_hash, expires_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (session_id, principal.user_id, payload.device_id, refresh_hash, refresh_expires),
        )

    response.set_cookie(
        _refresh_cookie_name(request),
        raw_refresh,
        httponly=True,
        secure=_refresh_cookie_secure(request),
        samesite="strict",
        max_age=settings.refresh_token_hours * 3600,
        path=REFRESH_COOKIE_PATH,
    )
    return TokenResponse(
        access_token=access_token,
        expires_at=expires_at,
        offline_grant=offline_grant,
        offline_grant_expires_at=offline_expires,
        professional=ProfessionalResponse(
            id=professional["professional_id"],
            display_name=professional["display_name"],
            license_type=professional["license_type"],
            license_number=professional["license_number"],
            email=professional["email"],
            roles=list(principal.roles),
        ),
    )


@app.post("/auth/refresh")
def refresh(request: Request, settings: Settings = Depends(get_settings)) -> dict:
    raw_token = request.cookies.get(_refresh_cookie_name(request))
    if not raw_token:
        raise HTTPException(status_code=401, detail="Sessão de renovação ausente")
    digest = hash_refresh_token(raw_token)
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT user_id FROM identity.refresh_sessions
            WHERE token_hash=%s AND revoked_at IS NULL AND expires_at > now()
            FOR UPDATE
            """,
            (digest,),
        )
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=401, detail="Sessão expirada ou revogada")
        principal, _ = _load_principal(cur, session["user_id"])
        request.state.principal = principal
        cur.execute("UPDATE identity.refresh_sessions SET last_used_at=now() WHERE token_hash=%s", (digest,))
        token, expires_at = create_access_token(principal, settings)
    return {"access_token": token, "token_type": "bearer", "expires_at": expires_at}


@app.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, _: Principal = Depends(current_principal)) -> None:
    cookie_name = _refresh_cookie_name(request)
    raw_token = request.cookies.get(cookie_name)
    if raw_token:
        with connection() as conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE identity.refresh_sessions SET revoked_at=now() WHERE token_hash=%s AND revoked_at IS NULL",
                (hash_refresh_token(raw_token),),
            )
    response.delete_cookie(
        cookie_name,
        path=REFRESH_COOKIE_PATH,
        secure=_refresh_cookie_secure(request),
        httponly=True,
        samesite="strict",
    )


@app.get("/auth/me", response_model=ProfessionalResponse)
def me(principal: Principal = Depends(current_principal)) -> ProfessionalResponse:
    with connection() as conn, conn.cursor() as cur:
        _, row = _load_principal(cur, principal.user_id)
    return ProfessionalResponse(
        id=row["professional_id"],
        display_name=row["display_name"],
        license_type=row["license_type"],
        license_number=row["license_number"],
        email=row["email"],
        roles=list(principal.roles),
    )


@app.get("/professionals", response_model=list[ProfessionalResponse])
def list_professionals(_: Principal = Depends(require_roles("ADMIN", "MEDICO", "ENFERMEIRO"))):
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT p.*, COALESCE(array_agg(ur.role_code) FILTER (WHERE ur.role_code IS NOT NULL), '{}') AS roles
            FROM identity.professionals p
            LEFT JOIN identity.users u ON u.professional_id=p.id
            LEFT JOIN identity.user_roles ur ON ur.user_id=u.id
            WHERE p.active GROUP BY p.id ORDER BY p.display_name
            """
        )
        rows = cur.fetchall()
    return [ProfessionalResponse(**row) for row in rows]


@app.post("/users", status_code=201)
def create_user(payload: CreateUserRequest, _: Principal = Depends(require_roles("ADMIN"))) -> dict:
    with connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT code FROM identity.roles WHERE code = ANY(%s)", (payload.roles,))
        valid_roles = {row["code"] for row in cur.fetchall()}
        if valid_roles != set(payload.roles):
            raise HTTPException(status_code=422, detail="Um ou mais perfis são inválidos")
        try:
            cur.execute(
                """
                INSERT INTO identity.users (professional_id, username, password_hash)
                VALUES (%s, %s, %s) RETURNING id
                """,
                (payload.professional_id, payload.username, hash_password(payload.password)),
            )
            user_id = cur.fetchone()["id"]
            cur.executemany(
                "INSERT INTO identity.user_roles (user_id, role_code) VALUES (%s, %s)",
                [(user_id, role) for role in payload.roles],
            )
        except Exception as exc:
            raise HTTPException(status_code=409, detail="Não foi possível criar o usuário") from exc
    return {"id": user_id, "username": payload.username, "roles": payload.roles}

