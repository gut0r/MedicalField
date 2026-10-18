import logging
import time
from uuid import uuid4

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from .config import get_settings
from .database import connection


logger = logging.getLogger(__name__)


class AuditMiddleware(BaseHTTPMiddleware):
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
            try:
                principal = getattr(request.state, "principal", None)
                route = request.scope.get("route")
                with connection() as conn, conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO audit.http_request_logs
                            (service_name, request_id, client_ip, professional_id,
                             http_method, route, status_code, processing_ms)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        (
                            get_settings().service_name,
                            request_id,
                            request.client.host if request.client else None,
                            str(principal.professional_id) if principal else None,
                            request.method,
                            route.path if route else request.url.path,
                            status_code,
                            max(0, round((time.perf_counter() - started) * 1000)),
                        ),
                    )
            except Exception:
                logger.exception("Falha ao registrar auditoria request_id=%s", request_id)
            if response is not None:
                response.headers["X-Request-ID"] = request_id

