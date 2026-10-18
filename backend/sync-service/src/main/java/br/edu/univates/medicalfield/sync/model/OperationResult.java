package br.edu.univates.medicalfield.sync.model;

import java.util.Map;
import java.util.UUID;

public record OperationResult(UUID operationId, UUID entityId, String status, Integer httpStatus,
                              Map<String, Object> result, String error) {
    public static OperationResult success(SyncOperation operation, int status, Map<String, Object> result) {
        return new OperationResult(operation.operationId(), operation.entityId(), "CONFIRMED", status, result, null);
    }
    public static OperationResult duplicate(SyncOperation operation, Map<String, Object> result) {
        return new OperationResult(operation.operationId(), operation.entityId(), "ALREADY_PROCESSED", 200, result, null);
    }
    public static OperationResult failed(SyncOperation operation, int status, String error) {
        return new OperationResult(operation.operationId(), operation.entityId(), status == 409 ? "CONFLICT" : "FAILED",
                status, Map.of(), error);
    }
}

