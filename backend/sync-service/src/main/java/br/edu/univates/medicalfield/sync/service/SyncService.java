package br.edu.univates.medicalfield.sync.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import br.edu.univates.medicalfield.sync.model.OperationResult;
import br.edu.univates.medicalfield.sync.model.SyncOperation;
import br.edu.univates.medicalfield.sync.model.UploadRequest;
import br.edu.univates.medicalfield.sync.strategy.ConflictDecision;
import br.edu.univates.medicalfield.sync.strategy.ConflictStrategy;

@Service
public class SyncService {
    private final JdbcClient jdbc;
    private final ObjectMapper mapper;
    private final OwnerApiClient ownerApi;
    private final List<ConflictStrategy> strategies;

    public SyncService(JdbcClient jdbc, ObjectMapper mapper, OwnerApiClient ownerApi,
                       List<ConflictStrategy> strategies) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.ownerApi = ownerApi;
        this.strategies = strategies;
    }

    public Map<String, Object> upload(UploadRequest request, UUID professionalId, String authorization) {
        UUID batchId = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO sync.sync_batches (id,device_id,professional_id,direction,status)
                VALUES (:id,:device,:professional,'UPLOAD','PROCESSING')
                """).param("id", batchId).param("device", request.deviceId())
                .param("professional", professionalId).update();

        List<OperationResult> results = new ArrayList<>();
        for (SyncOperation operation : request.operations()) {
            results.add(processOperation(batchId, request.deviceId(), professionalId, operation, authorization));
        }
        long failures = results.stream().filter(result -> !List.of("CONFIRMED", "ALREADY_PROCESSED").contains(result.status())).count();
        String status = failures == 0 ? "COMPLETED" : failures == results.size() ? "FAILED" : "PARTIAL";
        jdbc.sql("""
                UPDATE sync.sync_batches SET status=:status, finished_at=now(), summary=CAST(:summary AS jsonb)
                WHERE id=:id
                """).param("status", status).param("summary", json(Map.of("total", results.size(), "failures", failures)))
                .param("id", batchId).update();
        return Map.of("batchId", batchId, "status", status, "results", results);
    }

    public Map<String, Object> download(long cursor, int limit) {
        List<Map<String, Object>> items = jdbc.sql("""
                SELECT sequence_id AS "sequenceId", entity_type AS "entityType", entity_id AS "entityId",
                       entity_version AS "entityVersion", action, payload, occurred_at AS "occurredAt"
                FROM sync.change_feed WHERE sequence_id > :cursor ORDER BY sequence_id LIMIT :limit
                """).param("cursor", cursor).param("limit", Math.clamp(limit, 1, 500))
                .query((rs, row) -> Map.<String, Object>of(
                        "sequenceId", rs.getLong("sequenceId"),
                        "entityType", rs.getString("entityType"),
                        "entityId", rs.getObject("entityId", UUID.class),
                        "entityVersion", rs.getLong("entityVersion"),
                        "action", rs.getString("action"),
                        "payload", parseMap(rs.getString("payload")),
                        "occurredAt", rs.getTimestamp("occurredAt").toInstant()))
                .list();
        long nextCursor = items.isEmpty() ? cursor : ((Number) items.getLast().get("sequenceId")).longValue();
        return Map.of("items", items, "nextCursor", nextCursor, "hasMore", items.size() == Math.clamp(limit, 1, 500));
    }

    private OperationResult processOperation(UUID batchId, UUID deviceId, UUID professionalId,
                                             SyncOperation operation, String authorization) {
        String payloadHash = sha256(json(operation.payload()));
        Optional<Map<String, Object>> existing = jdbc.sql("""
                SELECT payload_hash, result FROM sync.processed_operations
                WHERE device_id=:device AND operation_id=:operation
                """).param("device", deviceId).param("operation", operation.operationId())
                .query((rs, row) -> Map.of("payloadHash", rs.getString("payload_hash"), "result", parseMap(rs.getString("result"))))
                .optional();
        if (existing.isPresent()) {
            if (!payloadHash.equals(existing.get().get("payloadHash"))) {
                return OperationResult.failed(operation, 409, "operationId reutilizado com conteúdo diferente");
            }
            @SuppressWarnings("unchecked") Map<String, Object> result = (Map<String, Object>) existing.get().get("result");
            return OperationResult.duplicate(operation, result);
        }

        if ("OFFLINE_AUDIT".equals(operation.entityType())) {
            Map<String, Object> result = insertOfflineAudit(deviceId, professionalId, operation);
            saveProcessed(deviceId, operation, payloadHash, result);
            return OperationResult.success(operation, 201, result);
        }

        OwnerApiClient.ApiResult remote = ownerApi.execute(operation, authorization);
        if (remote.successful()) {
            saveProcessed(deviceId, operation, payloadHash, remote.body());
            return OperationResult.success(operation, remote.status(), remote.body());
        }
        if (remote.status() == 409) recordConflict(batchId, deviceId, operation, remote.error());
        return OperationResult.failed(operation, remote.status(), remote.error());
    }

    private Map<String, Object> insertOfflineAudit(UUID deviceId, UUID professionalId, SyncOperation operation) {
        jdbc.sql("""
                INSERT INTO audit.offline_events
                  (id,device_id,professional_id,event_type,entity_type,entity_id,occurred_at,metadata)
                VALUES (:id,:device,:professional,:eventType,:entityType,:entityId,:occurredAt,CAST(:metadata AS jsonb))
                ON CONFLICT (id) DO NOTHING
                """).param("id", operation.entityId()).param("device", deviceId).param("professional", professionalId)
                .param("eventType", String.valueOf(operation.payload().getOrDefault("eventType", "OFFLINE_ACTION")))
                .param("entityType", operation.payload().get("entityType"))
                .param("entityId", operation.payload().get("entityId") == null ? null : UUID.fromString(operation.payload().get("entityId").toString()))
                .param("occurredAt", databaseTimestamp(operation.occurredAt()))
                .param("metadata", json(operation.payload())).update();
        return Map.of("id", operation.entityId(), "accepted", true);
    }

    static OffsetDateTime databaseTimestamp(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }

    private void saveProcessed(UUID deviceId, SyncOperation operation, String hash, Map<String, Object> result) {
        jdbc.sql("""
                INSERT INTO sync.processed_operations
                  (operation_id,device_id,entity_type,entity_id,payload_hash,result)
                VALUES (:operation,:device,:type,:entity,:hash,CAST(:result AS jsonb))
                """).param("operation", operation.operationId()).param("device", deviceId)
                .param("type", operation.entityType()).param("entity", operation.entityId())
                .param("hash", hash).param("result", json(result)).update();
    }

    private void recordConflict(UUID batchId, UUID deviceId, SyncOperation operation, String serverResponse) {
        ConflictDecision decision = strategies.stream().filter(strategy -> strategy.supports(operation)).findFirst()
                .map(strategy -> strategy.decide(operation, serverResponse))
                .orElse(new ConflictDecision("MANUAL_REVIEW", true, "Conflito sem estratégia específica"));
        jdbc.sql("""
                INSERT INTO sync.conflicts
                  (batch_id,device_id,entity_type,entity_id,base_version,client_payload,server_payload,strategy)
                VALUES (:batch,:device,:type,:entity,:baseVersion,CAST(:client AS jsonb),CAST(:server AS jsonb),:strategy)
                """).param("batch", batchId).param("device", deviceId).param("type", operation.entityType())
                .param("entity", operation.entityId()).param("baseVersion", operation.baseVersion())
                .param("client", json(operation.payload()))
                .param("server", json(Map.of("rawResponse", serverResponse == null ? "" : serverResponse,
                        "explanation", decision.explanation())))
                .param("strategy", decision.strategy()).update();
    }

    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException exception) { throw new IllegalArgumentException("Payload JSON inválido", exception); }
    }
    private Map<String, Object> parseMap(String value) {
        try { return mapper.readValue(value, new TypeReference<>() {}); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("JSON persistido inválido", exception); }
    }
    private static String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}

