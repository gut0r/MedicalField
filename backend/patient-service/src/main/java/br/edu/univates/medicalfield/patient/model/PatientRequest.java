package br.edu.univates.medicalfield.patient.model;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PatientRequest(
        UUID id,
        @NotBlank @Size(max = 180) String fullName,
        @NotBlank @Pattern(regexp = "IDENTIFIED|PROVISIONAL|UNKNOWN") String identificationStatus,
        @Size(max = 30) String documentType,
        @Size(max = 80) String documentNumber,
        LocalDate birthDate,
        @Size(max = 20) String sexAtBirth,
        @Size(max = 40) String phone,
        @Size(max = 180) String emergencyContactName,
        @Size(max = 40) String emergencyContactPhone,
        @Size(max = 2000) String notes,
        Long baseVersion
) {}

