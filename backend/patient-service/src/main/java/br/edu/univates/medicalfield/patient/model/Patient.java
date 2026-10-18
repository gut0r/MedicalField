package br.edu.univates.medicalfield.patient.model;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record Patient(
        UUID id,
        String fullName,
        String identificationStatus,
        String documentType,
        String documentNumber,
        LocalDate birthDate,
        String sexAtBirth,
        String phone,
        String emergencyContactName,
        String emergencyContactPhone,
        String notes,
        boolean active,
        long version,
        UUID createdBy,
        UUID updatedBy,
        Instant createdAt,
        Instant updatedAt
) {}

