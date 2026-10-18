package br.edu.univates.medicalfield.patient.service;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import br.edu.univates.medicalfield.patient.model.Patient;
import br.edu.univates.medicalfield.patient.model.PatientRequest;
import br.edu.univates.medicalfield.patient.repository.PatientRepository;

@Service
public class PatientService {
    private final PatientRepository repository;
    private final JdbcClient jdbc;
    private final ObjectMapper objectMapper;

    public PatientService(PatientRepository repository, JdbcClient jdbc, ObjectMapper objectMapper) {
        this.repository = repository;
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    public List<Patient> search(String query, boolean includeInactive, int page, int size) {
        return repository.search(query, includeInactive, size, page * size);
    }

    public Patient get(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Paciente não encontrado"));
    }

    @Transactional
    public Patient create(PatientRequest request, UUID actor) {
        validateIdentification(request);
        // UUIDs sao criados no dispositivo. Se a resposta da primeira tentativa
        // se perder, o reenvio devolve o mesmo recurso em vez de duplicar dados.
        if (request.id() != null) {
            Optional<Patient> existing = repository.findById(request.id());
            if (existing.isPresent()) {
                if (sameCreatePayload(existing.get(), request)) return existing.get();
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Identificador ja utilizado por outro conteudo");
            }
        }
        try {
            Patient patient = repository.insert(request.id() == null ? UUID.randomUUID() : request.id(), request, actor);
            publish(patient, "UPSERT");
            return patient;
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Documento ou identificador já cadastrado", exception);
        }
    }

    @Transactional
    public Patient update(UUID id, PatientRequest request, UUID actor) {
        validateIdentification(request);
        if (request.baseVersion() == null) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "baseVersion é obrigatório");
        }
        Patient updated = repository.update(id, request, actor).orElseGet(() -> {
            Patient current = get(id);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Conflito de versão; versão atual=" + current.version());
        });
        publish(updated, "UPSERT");
        return updated;
    }

    @Transactional
    public void inactivate(UUID id, UUID actor) {
        Patient patient = repository.inactivate(id, actor)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Paciente ativo não encontrado"));
        publish(patient, "INACTIVATE");
    }

    private void validateIdentification(PatientRequest request) {
        if ("IDENTIFIED".equals(request.identificationStatus())
                && (request.documentNumber() == null || request.documentNumber().isBlank())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Paciente identificado precisa possuir documento");
        }
    }

    private static boolean sameCreatePayload(Patient patient, PatientRequest request) {
        return Objects.equals(patient.fullName(), request.fullName())
                && Objects.equals(patient.identificationStatus(), request.identificationStatus())
                && Objects.equals(patient.documentType(), request.documentType())
                && Objects.equals(patient.documentNumber(), request.documentNumber())
                && Objects.equals(patient.birthDate(), request.birthDate())
                && Objects.equals(patient.sexAtBirth(), request.sexAtBirth())
                && Objects.equals(patient.phone(), request.phone())
                && Objects.equals(patient.emergencyContactName(), request.emergencyContactName())
                && Objects.equals(patient.emergencyContactPhone(), request.emergencyContactPhone())
                && Objects.equals(patient.notes(), request.notes());
    }

    private void publish(Patient patient, String action) {
        try {
            String payload = objectMapper.writeValueAsString(patient);
            jdbc.sql("""
                    INSERT INTO sync.change_feed (entity_type, entity_id, entity_version, action, payload)
                    VALUES ('PATIENT', :id, :version, :action, CAST(:payload AS jsonb))
                    """)
                    .param("id", patient.id()).param("version", patient.version())
                    .param("action", action).param("payload", payload).update();
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Falha ao publicar alteração de paciente", exception);
        }
    }
}

