package br.edu.univates.medicalfield.patient.security;

import java.util.UUID;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;

public final class CurrentProfessional {
    private CurrentProfessional() {}

    public static UUID id(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            throw new IllegalStateException("Profissional autenticado não encontrado");
        }
        return UUID.fromString(jwt.getClaimAsString("professional_id"));
    }
}

