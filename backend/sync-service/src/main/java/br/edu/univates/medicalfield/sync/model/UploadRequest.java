package br.edu.univates.medicalfield.sync.model;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UploadRequest(
        @NotNull UUID deviceId,
        @NotEmpty @Size(max = 200) List<@Valid SyncOperation> operations
) {}

