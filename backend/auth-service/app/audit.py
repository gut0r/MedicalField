import logging
import time
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from .config import get_settings
from .database import connection


logger = logging.getLogger(__name__)


class AuditMiddleware(BaseHTTPMiddleware):
    """Registra metadados HTTP sem gravar corpos, senhas ou tokens."""

    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        request_id = request.headers.get("x-request-id") or str(uuid4())
        status_code = 500
        response = None
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        finally:
            elapsed = max(0, round((time.perf_counter() - started) * 1000))
            principal = getattr(request.state, "principal", None)
            try:
                with connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO audit.http_request_logs
                            (service_name, request_id, client_ip, professional_id,
                             http_method, route, status_code, processing_ms)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            get_settings().service_name,
                            request_id,
                            request.client.host if request.client else None,
                            str(principal.professional_id) if principal else None,
                            request.method,
                            request.scope.get("route").path if request.scope.get("route") else request.url.path,
                            status_code,
                            elapsed,
                        ),
                    )
            except Exception:
                # Auditoria não pode esconder a resposta de negócio. A falha ainda fica
                # no journal do systemd para investigação operacional.
                logger.exception("Falha ao persistir log de auditoria request_id=%s", request_id)
            if response is not None:
                response.headers["X-Request-ID"] = request_id

