package br.edu.univates.medicalfield.patient.audit;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

@Component
public class AuditFilter extends OncePerRequestFilter {
    private final JdbcClient jdbc;

    public AuditFilter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Instant started = Instant.now();
        UUID requestId = parseRequestId(request.getHeader("X-Request-ID"));
        MDC.put("requestId", requestId.toString());
        response.setHeader("X-Request-ID", requestId.toString());
        try {
            chain.doFilter(request, response);
        } finally {
            try {
                Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
                UUID professionalId = professionalId();
                jdbc.sql("""
                        INSERT INTO audit.http_request_logs
                          (service_name, request_id, client_ip, professional_id, http_method, route, status_code, processing_ms)
                        VALUES ('patient-service', :requestId, CAST(:ip AS inet), :professionalId,
                                :method, :route, :status, :elapsed)
                        """)
                    .param("requestId", requestId)
                    .param("ip", clientIp(request))
                    .param("professionalId", professionalId)
                    .param("method", request.getMethod())
                    .param("route", pattern == null ? request.getRequestURI() : pattern.toString())
                    .param("status", response.getStatus())
                    .param("elapsed", Math.toIntExact(Duration.between(started, Instant.now()).toMillis()))
                    .update();
            } catch (RuntimeException ignored) {
                // O erro continua visível no log operacional, sem substituir a resposta de negócio.
                logger.error("Falha ao persistir auditoria requestId=" + requestId, ignored);
            } finally {
                MDC.remove("requestId");
            }
        }
    }

    private static UUID parseRequestId(String value) {
        try { return value == null ? UUID.randomUUID() : UUID.fromString(value); }
        catch (IllegalArgumentException ignored) { return UUID.randomUUID(); }
    }

    private static UUID professionalId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            try { return UUID.fromString(jwt.getClaimAsString("professional_id")); }
            catch (RuntimeException ignored) { return null; }
        }
        return null;
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null ? request.getRemoteAddr() : forwarded.split(",")[0].trim();
    }
}

