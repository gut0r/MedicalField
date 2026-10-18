from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas import MedicationInput, MedicationUpdate


def test_medication_input_accepts_catalog_data():
    item = MedicationInput(id=uuid4(), name="Dipirona", concentration="500 mg/mL", unit="mL")
    assert item.name == "Dipirona"


def test_update_rejects_invalid_version():
    with pytest.raises(ValidationError):
        MedicationUpdate(name="Dipirona", base_version=0)

