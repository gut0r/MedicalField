package br.edu.univates.medicalfield.sync.model;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record SyncOperation(
        @NotNull UUID operationId,
        @NotNull UUID entityId,
        @NotBlank @Pattern(regexp = "PATIENT|MEDICAL_RECORD|ENCOUNTER|OFFLINE_AUDIT") String entityType,
        @NotBlank @Pattern(regexp = "CREATE|UPDATE|INACTIVATE") String action,
        Long baseVersion,
        @NotNull Instant occurredAt,
        @NotNull Map<String, Object> payload
) {}

