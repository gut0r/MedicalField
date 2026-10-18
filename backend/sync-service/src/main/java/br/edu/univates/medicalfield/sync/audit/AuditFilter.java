package br.edu.univates.medicalfield.sync.audit;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerMapping;

@Component
public class AuditFilter extends OncePerRequestFilter {
    private final JdbcClient jdbc;
    public AuditFilter(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // A requisição que limpa a tabela não deve recriar um log logo após o DELETE.
        return "DELETE".equals(request.getMethod()) && "/audit/logs".equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Instant started = Instant.now();
        UUID requestId = requestId(request.getHeader("X-Request-ID"));
        response.setHeader("X-Request-ID", requestId.toString());
        try { chain.doFilter(request, response); }
        finally {
            try {
                var auth = SecurityContextHolder.getContext().getAuthentication();
                UUID professional = auth != null && auth.getPrincipal() instanceof Jwt jwt
                        ? UUID.fromString(jwt.getClaimAsString("professional_id")) : null;
                Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
                jdbc.sql("""
                    INSERT INTO audit.http_request_logs
                      (service_name,request_id,client_ip,professional_id,http_method,route,status_code,processing_ms)
                    VALUES ('sync-service',:requestId,CAST(:ip AS inet),:professional,:method,:route,:status,:elapsed)
                    """)
                    .param("requestId", requestId).param("ip", clientIp(request)).param("professional", professional)
                    .param("method", request.getMethod()).param("route", pattern == null ? request.getRequestURI() : pattern.toString())
                    .param("status", response.getStatus())
                    .param("elapsed", Math.toIntExact(Duration.between(started, Instant.now()).toMillis())).update();
            } catch (RuntimeException exception) {
                logger.error("Falha ao registrar auditoria requestId=" + requestId, exception);
            }
        }
    }

    private static UUID requestId(String value) {
        try { return value == null ? UUID.randomUUID() : UUID.fromString(value); }
        catch (IllegalArgumentException ignored) { return UUID.randomUUID(); }
    }
    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null ? request.getRemoteAddr() : forwarded.split(",")[0].trim();
    }
}

