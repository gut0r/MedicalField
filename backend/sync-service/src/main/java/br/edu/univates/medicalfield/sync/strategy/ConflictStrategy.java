package br.edu.univates.medicalfield.sync.strategy;

import br.edu.univates.medicalfield.sync.model.SyncOperation;

/** Strategy Pattern: cada tipo de dado decide conflitos sem um if central crescente. */
public interface ConflictStrategy {
    boolean supports(SyncOperation operation);
    ConflictDecision decide(SyncOperation operation, String serverResponse);
}

