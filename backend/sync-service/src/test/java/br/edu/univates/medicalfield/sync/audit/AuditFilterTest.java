package br.edu.univates.medicalfield.sync.audit;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletRequest;

class AuditFilterTest {
    private final AuditFilter filter = new AuditFilter(mock(JdbcClient.class));

    @Test
    void doesNotRecreateLogWhenHistoryIsCleared() {
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/audit/logs");

        assertTrue(filter.shouldNotFilter(request));
    }

    @Test
    void keepsAuditingOtherRequests() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/audit/logs");

        assertFalse(filter.shouldNotFilter(request));
    }
}
