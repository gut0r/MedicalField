package br.edu.univates.medicalfield.sync.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Documenta upload, download, deduplicacao e auditoria offline. */
@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI syncOpenApi() {
        return new OpenAPI()
                .info(new Info().title("MedicalField - Sincronizacao API").version("0.1.0")
                        .description("Coordenacao Offline-First com outbox, versoes e conflitos rastreaveis."))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }
}
