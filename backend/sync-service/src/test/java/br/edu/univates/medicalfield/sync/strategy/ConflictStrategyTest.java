package br.edu.univates.medicalfield.sync.strategy;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import br.edu.univates.medicalfield.sync.model.SyncOperation;

class ConflictStrategyTest {
    @Test
    void clinicalDataRequiresManualReview() {
        var operation = new SyncOperation(UUID.randomUUID(), UUID.randomUUID(), "ENCOUNTER", "CREATE",
                null, Instant.now(), Map.of());
        var decision = new AppendOnlyConflictStrategy().decide(operation, "conflict");
        assertThat(decision.requiresManualReview()).isTrue();
    }
}

