from datetime import UTC, datetime
from uuid import uuid4

from psycopg.types.json import Jsonb

from app.main import _publish_change


class RecordingCursor:
    def __init__(self) -> None:
        self.params = None

    def execute(self, _query: str, params: tuple) -> None:
        self.params = params


def test_change_feed_adapts_payload_to_jsonb() -> None:
    now = datetime.now(UTC)
    row = {
        "id": uuid4(),
        "name": "Medicamento de teste",
        "active_ingredient": "Substância de demonstração",
        "pharmaceutical_form": "Solução",
        "concentration": "10 mg/mL",
        "unit": "mL",
        "active": True,
        "version": 1,
        "created_at": now,
        "updated_at": now,
    }
    cursor = RecordingCursor()

    _publish_change(cursor, row)

    assert cursor.params is not None
    assert isinstance(cursor.params[-1], Jsonb)
