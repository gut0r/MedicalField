package br.edu.univates.medicalfield.sync.web;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/audit/logs")
@PreAuthorize("hasRole('ADMIN')")
public class AuditController {
    private final JdbcClient jdbc;
    public AuditController(JdbcClient jdbc) { this.jdbc = jdbc; }

    @DeleteMapping
    public Map<String, Object> deleteAll() {
        int deleted = jdbc.sql("DELETE FROM audit.http_request_logs").update();
        return Map.of("deleted", deleted);
    }

    @GetMapping
    public Map<String, Object> list(
            @RequestParam(required = false) String service,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false) UUID professionalId,
            @RequestParam(required = false) String route,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        int safeSize = Math.clamp(size, 1, 200);
        OffsetDateTime fromDate = from == null ? null : OffsetDateTime.ofInstant(from, ZoneOffset.UTC);
        OffsetDateTime toDate = to == null ? null : OffsetDateTime.ofInstant(to, ZoneOffset.UTC);
        List<Map<String, Object>> items = jdbc.sql("""
                SELECT id, occurred_at AS "occurredAt", service_name AS service, request_id AS "requestId",
                       host(client_ip) AS "clientIp", professional_id AS "professionalId", http_method AS method,
                       route, status_code AS status, processing_ms AS "processingMs", error_code AS "errorCode"
                FROM audit.http_request_logs
                WHERE (CAST(:service AS text) IS NULL OR service_name=:service)
                  AND (CAST(:status AS integer) IS NULL OR status_code=:status)
                  AND (CAST(:fromDate AS timestamptz) IS NULL OR occurred_at>=:fromDate)
                  AND (CAST(:toDate AS timestamptz) IS NULL OR occurred_at<=:toDate)
                  AND (CAST(:professionalId AS uuid) IS NULL OR professional_id=:professionalId)
                  AND (CAST(:route AS text) IS NULL OR route ILIKE '%' || :route || '%')
                ORDER BY occurred_at DESC LIMIT :size OFFSET :offset
                """).param("service", service).param("status", status).param("fromDate", fromDate).param("toDate", toDate)
                .param("professionalId", professionalId).param("route", route == null || route.isBlank() ? null : route.trim())
                .param("size", safeSize).param("offset", Math.max(0, page) * safeSize)
                .query((rs, row) -> Map.<String, Object>ofEntries(
                        Map.entry("id", rs.getLong("id")), Map.entry("occurredAt", rs.getTimestamp("occurredAt").toInstant()),
                        Map.entry("service", rs.getString("service")), Map.entry("requestId", rs.getObject("requestId")),
                        Map.entry("clientIp", rs.getString("clientIp") == null ? "" : rs.getString("clientIp")),
                        Map.entry("professionalId", rs.getObject("professionalId") == null ? "" : rs.getObject("professionalId")),
                        Map.entry("method", rs.getString("method")), Map.entry("route", rs.getString("route")),
                        Map.entry("status", rs.getInt("status")), Map.entry("processingMs", rs.getInt("processingMs")),
                        Map.entry("errorCode", rs.getString("errorCode") == null ? "" : rs.getString("errorCode"))))
                .list();
        Long total = jdbc.sql("""
                SELECT count(*) FROM audit.http_request_logs
                WHERE (CAST(:service AS text) IS NULL OR service_name=:service)
                  AND (CAST(:status AS integer) IS NULL OR status_code=:status)
                  AND (CAST(:fromDate AS timestamptz) IS NULL OR occurred_at>=:fromDate)
                  AND (CAST(:toDate AS timestamptz) IS NULL OR occurred_at<=:toDate)
                  AND (CAST(:professionalId AS uuid) IS NULL OR professional_id=:professionalId)
                  AND (CAST(:route AS text) IS NULL OR route ILIKE '%' || :route || '%')
                """).param("service", service).param("status", status).param("fromDate", fromDate).param("toDate", toDate)
                .param("professionalId", professionalId).param("route", route == null || route.isBlank() ? null : route.trim())
                .query(Long.class).single();
        return Map.of("items", items, "page", Math.max(0, page), "size", safeSize, "total", total);
    }
}

