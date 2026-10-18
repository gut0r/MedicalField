package br.edu.univates.medicalfield.sync.strategy;

import org.springframework.stereotype.Component;

import br.edu.univates.medicalfield.sync.model.SyncOperation;

@Component
public class AppendOnlyConflictStrategy implements ConflictStrategy {
    @Override public boolean supports(SyncOperation operation) {
        return "ENCOUNTER".equals(operation.entityType()) || "MEDICAL_RECORD".equals(operation.entityType());
    }
    @Override public ConflictDecision decide(SyncOperation operation, String serverResponse) {
        return new ConflictDecision("APPEND_ONLY_MANUAL", true,
                "Registros clínicos não são sobrescritos; a divergência exige correção auditável.");
    }
}

