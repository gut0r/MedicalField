package br.edu.univates.medicalfield.patient.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Metadados centrais da documentacao. O esquema bearer informa ao Swagger que
 * as operacoes de negocio exigem o mesmo JWT emitido pelo auth-service.
 */
@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI patientOpenApi() {
        return new OpenAPI()
                .info(new Info().title("MedicalField - Pacientes API").version("0.1.0")
                        .description("Cadastro, pesquisa, versionamento e inativacao de pacientes."))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }
}
