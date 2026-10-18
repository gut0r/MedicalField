from contextlib import asynccontextmanager
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, status
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from .audit import AuditMiddleware
from .database import close_pool, connection, open_pool
from .schemas import MedicationInput, MedicationResponse, MedicationUpdate
from .security import Principal, current_principal, require_admin


@asynccontextmanager
async def lifespan(_: FastAPI):
    open_pool()
    yield
    close_pool()


app = FastAPI(
    title="MedicalField - API de Medicamentos",
    version="0.1.0",
    description="Catálogo central de medicamentos. Não fornece recomendações de dose ou tratamento.",
    lifespan=lifespan,
)
app.add_middleware(AuditMiddleware)


@app.get("/internal/health", include_in_schema=False)
def health():
    return {"status": "ok", "service": "medication-service"}


def _publish_change(cur, row: dict, action: str = "UPSERT") -> None:
    payload = {
        "id": str(row["id"]),
        "name": row["name"],
        "activeIngredient": row["active_ingredient"],
        "pharmaceuticalForm": row["pharmaceutical_form"],
        "concentration": row["concentration"],
        "unit": row["unit"],
        "active": row["active"],
        "version": row["version"],
        "createdAt": row["created_at"].isoformat(),
        "updatedAt": row["updated_at"].isoformat(),
    }
    cur.execute(
        """
        INSERT INTO sync.change_feed (entity_type, entity_id, entity_version, action, payload)
        VALUES ('MEDICATION', %s, %s, %s, %s)
        """,
        (row["id"], row["version"], action, Jsonb(payload)),
    )


@app.get("/medications", response_model=list[MedicationResponse])
def list_medications(
    include_inactive: bool = False,
    search: str | None = Query(default=None, max_length=100),
    _: Principal = Depends(current_principal),
):
    clauses = ["(%s OR active)"]
    params: list = [include_inactive]
    if search:
        clauses.append("(name ILIKE %s OR active_ingredient ILIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            f"SELECT * FROM medication.medications WHERE {' AND '.join(clauses)} ORDER BY name LIMIT 500",
            params,
        )
        return cur.fetchall()


@app.get("/medications/{medication_id}", response_model=MedicationResponse)
def get_medication(medication_id: UUID, _: Principal = Depends(current_principal)):
    with connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM medication.medications WHERE id=%s", (medication_id,))
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Medicamento não encontrado")
    return row


@app.post("/medications", response_model=MedicationResponse, status_code=status.HTTP_201_CREATED)
def create_medication(payload: MedicationInput, principal: Principal = Depends(require_admin)):
    medication_id = payload.id or uuid4()
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO medication.medications
                    (id,name,active_ingredient,pharmaceutical_form,concentration,unit,created_by,updated_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
                """,
                (
                    medication_id,
                    payload.name,
                    payload.active_ingredient,
                    payload.pharmaceutical_form,
                    payload.concentration,
                    payload.unit,
                    principal.professional_id,
                    principal.professional_id,
                ),
            )
            row = cur.fetchone()
            _publish_change(cur, row)
        return row
    except UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="Medicamento duplicado") from exc


@app.put("/medications/{medication_id}", response_model=MedicationResponse)
def update_medication(
    medication_id: UUID,
    payload: MedicationUpdate,
    principal: Principal = Depends(require_admin),
):
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE medication.medications
               SET name=%s, active_ingredient=%s, pharmaceutical_form=%s,
                   concentration=%s, unit=%s, version=version+1,
                   updated_by=%s, updated_at=now()
             WHERE id=%s AND version=%s
             RETURNING *
            """,
            (
                payload.name,
                payload.active_ingredient,
                payload.pharmaceutical_form,
                payload.concentration,
                payload.unit,
                principal.professional_id,
                medication_id,
                payload.base_version,
            ),
        )
        row = cur.fetchone()
        if not row:
            cur.execute("SELECT version FROM medication.medications WHERE id=%s", (medication_id,))
            current = cur.fetchone()
            if not current:
                raise HTTPException(status_code=404, detail="Medicamento não encontrado")
            raise HTTPException(status_code=409, detail={"code": "VERSION_CONFLICT", "serverVersion": current["version"]})
        _publish_change(cur, row)
    return row


@app.delete("/medications/{medication_id}", status_code=status.HTTP_204_NO_CONTENT)
def inactivate_medication(medication_id: UUID, principal: Principal = Depends(require_admin)) -> None:
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            UPDATE medication.medications SET active=FALSE, version=version+1,
                   updated_by=%s, updated_at=now()
             WHERE id=%s AND active RETURNING *
            """,
            (principal.professional_id, medication_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Medicamento ativo não encontrado")
        _publish_change(cur, row, "INACTIVATE")


@app.get("/medication-changes")
def medication_changes(
    cursor: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    _: Principal = Depends(current_principal),
):
    with connection() as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT sequence_id, action, payload FROM sync.change_feed
             WHERE entity_type='MEDICATION' AND sequence_id > %s
             ORDER BY sequence_id LIMIT %s
            """,
            (cursor, limit),
        )
        rows = cur.fetchall()
    return {"items": rows, "nextCursor": rows[-1]["sequence_id"] if rows else cursor}

