package br.edu.univates.medicalfield.patient.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import br.edu.univates.medicalfield.patient.model.Patient;
import br.edu.univates.medicalfield.patient.model.PatientRequest;

/**
 * Repository Pattern: a regra de pacientes não conhece SQL nem detalhes do PostgreSQL.
 */
@Repository
public class PatientRepository {
    private final JdbcClient jdbc;

    public PatientRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Patient> search(String query, boolean includeInactive, int limit, int offset) {
        return jdbc.sql("""
                SELECT * FROM patient.patients
                WHERE (:includeInactive OR active)
                  AND (:query = '' OR full_name ILIKE '%' || :query || '%'
                       OR document_number ILIKE '%' || :query || '%')
                ORDER BY full_name LIMIT :limit OFFSET :offset
                """)
                .param("includeInactive", includeInactive)
                .param("query", query == null ? "" : query.trim())
                .param("limit", limit)
                .param("offset", offset)
                .query(mapper).list();
    }

    public Optional<Patient> findById(UUID id) {
        return jdbc.sql("SELECT * FROM patient.patients WHERE id=:id")
                .param("id", id).query(mapper).optional();
    }

    public Patient insert(UUID id, PatientRequest request, UUID actor) {
        return jdbc.sql("""
                INSERT INTO patient.patients
                  (id, full_name, identification_status, document_type, document_number,
                   birth_date, sex_at_birth, phone, emergency_contact_name,
                   emergency_contact_phone, notes, created_by, updated_by)
                VALUES (:id,:name,:identificationStatus,:documentType,:documentNumber,
                        :birthDate,:sexAtBirth,:phone,:contactName,:contactPhone,:notes,:actor,:actor)
                RETURNING *
                """)
                .param("id", id)
                .param("name", request.fullName())
                .param("identificationStatus", request.identificationStatus())
                .param("documentType", request.documentType())
                .param("documentNumber", request.documentNumber())
                .param("birthDate", request.birthDate())
                .param("sexAtBirth", request.sexAtBirth())
                .param("phone", request.phone())
                .param("contactName", request.emergencyContactName())
                .param("contactPhone", request.emergencyContactPhone())
                .param("notes", request.notes())
                .param("actor", actor)
                .query(mapper).single();
    }

    public Optional<Patient> update(UUID id, PatientRequest request, UUID actor) {
        return jdbc.sql("""
                UPDATE patient.patients SET
                  full_name=:name, identification_status=:identificationStatus,
                  document_type=:documentType, document_number=:documentNumber,
                  birth_date=:birthDate, sex_at_birth=:sexAtBirth, phone=:phone,
                  emergency_contact_name=:contactName, emergency_contact_phone=:contactPhone,
                  notes=:notes, version=version+1, updated_by=:actor, updated_at=now()
                WHERE id=:id AND version=:baseVersion RETURNING *
                """)
                .param("id", id)
                .param("name", request.fullName())
                .param("identificationStatus", request.identificationStatus())
                .param("documentType", request.documentType())
                .param("documentNumber", request.documentNumber())
                .param("birthDate", request.birthDate())
                .param("sexAtBirth", request.sexAtBirth())
                .param("phone", request.phone())
                .param("contactName", request.emergencyContactName())
                .param("contactPhone", request.emergencyContactPhone())
                .param("notes", request.notes())
                .param("actor", actor)
                .param("baseVersion", request.baseVersion())
                .query(mapper).optional();
    }

    public Optional<Patient> inactivate(UUID id, UUID actor) {
        return jdbc.sql("""
                UPDATE patient.patients SET active=FALSE, deleted_at=now(), version=version+1,
                  updated_by=:actor, updated_at=now() WHERE id=:id AND active RETURNING *
                """).param("id", id).param("actor", actor).query(mapper).optional();
    }

    private static final RowMapper<Patient> mapper = (rs, rowNum) -> map(rs);

    private static Patient map(ResultSet rs) throws SQLException {
        return new Patient(
                rs.getObject("id", UUID.class), rs.getString("full_name"),
                rs.getString("identification_status"), rs.getString("document_type"),
                rs.getString("document_number"), rs.getObject("birth_date", java.time.LocalDate.class),
                rs.getString("sex_at_birth"), rs.getString("phone"),
                rs.getString("emergency_contact_name"), rs.getString("emergency_contact_phone"),
                rs.getString("notes"), rs.getBoolean("active"), rs.getLong("version"),
                rs.getObject("created_by", UUID.class), rs.getObject("updated_by", UUID.class),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }
}

