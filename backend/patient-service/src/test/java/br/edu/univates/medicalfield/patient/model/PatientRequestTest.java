package br.edu.univates.medicalfield.patient.model;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

class PatientRequestTest {
    private final jakarta.validation.Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsBlankName() {
        PatientRequest request = new PatientRequest(null, "", "PROVISIONAL", null, null,
                null, null, null, null, null, null, null);
        assertThat(validator.validate(request)).isNotEmpty();
    }
}

