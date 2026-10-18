package br.edu.univates.medicalfield.sync.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;

import br.edu.univates.medicalfield.sync.model.SyncOperation;

@Component
public class OwnerApiClient {
    private static final Logger LOGGER = LoggerFactory.getLogger(OwnerApiClient.class);
    private final RestClient client;
    private final String patientUrl;
    private final String recordUrl;

    public OwnerApiClient(RestClient.Builder builder,
                          @Value("${medicalfield.services.patients}") String patientUrl,
                          @Value("${medicalfield.services.records}") String recordUrl) {
        this.client = builder.build();
        this.patientUrl = patientUrl;
        this.recordUrl = recordUrl;
    }

    @SuppressWarnings("unchecked")
    public ApiResult execute(SyncOperation operation, String authorization) {
        String url = switch (operation.entityType()) {
            case "PATIENT" -> patientUrl + "/patients" + ("CREATE".equals(operation.action()) ? "" : "/" + operation.entityId());
            case "MEDICAL_RECORD" -> recordUrl + "/medical-records";
            case "ENCOUNTER" -> recordUrl + "/encounters";
            default -> throw new IllegalArgumentException("Entidade sem API proprietária: " + operation.entityType());
        };
        HttpMethod method = switch (operation.action()) {
            case "CREATE" -> HttpMethod.POST;
            case "UPDATE" -> HttpMethod.PUT;
            case "INACTIVATE" -> HttpMethod.DELETE;
            default -> throw new IllegalArgumentException("Ação desconhecida");
        };
        try {
            var request = client.method(method).uri(url).header("Authorization", authorization);
            if (method != HttpMethod.DELETE) request.contentType(MediaType.APPLICATION_JSON).body(operation.payload());
            Map<String, Object> body = request.retrieve().body(Map.class);
            return new ApiResult(200, body == null ? Map.of() : body, null);
        } catch (HttpStatusCodeException exception) {
            String response = exception.getResponseBodyAsString();
            LOGGER.warn("Owner API rejected operation operationId={} entityType={} entityId={} status={} response={}",
                    operation.operationId(), operation.entityType(), operation.entityId(),
                    exception.getStatusCode().value(), abbreviate(response));
            return new ApiResult(exception.getStatusCode().value(), Map.of(), response);
        }
    }

    private static String abbreviate(String value) {
        if (value == null || value.length() <= 2_000) return value;
        return value.substring(0, 2_000) + "...";
    }

    public record ApiResult(int status, Map<String, Object> body, String error) {
        public boolean successful() { return status >= 200 && status < 300; }
    }
}

