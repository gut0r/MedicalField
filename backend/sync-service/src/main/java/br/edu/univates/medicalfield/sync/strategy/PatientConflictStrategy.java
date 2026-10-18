package br.edu.univates.medicalfield.sync.strategy;

import org.springframework.stereotype.Component;

import br.edu.univates.medicalfield.sync.model.SyncOperation;

@Component
public class PatientConflictStrategy implements ConflictStrategy {
    @Override public boolean supports(SyncOperation operation) { return "PATIENT".equals(operation.entityType()); }
    @Override public ConflictDecision decide(SyncOperation operation, String serverResponse) {
        return new ConflictDecision("PATIENT_FIELD_REVIEW", true,
                "Campos demográficos concorrentes devem ser comparados e aprovados por um profissional.");
    }
}

