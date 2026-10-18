package br.edu.univates.medicalfield.sync.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;

class SyncServiceTest {

    @Test
    void convertsOfflineEventInstantToPostgresSupportedTimestamp() {
        Instant occurredAt = Instant.parse("2026-10-17T00:02:46.704Z");

        OffsetDateTime timestamp = SyncService.databaseTimestamp(occurredAt);

        assertThat(timestamp).isEqualTo(OffsetDateTime.ofInstant(occurredAt, ZoneOffset.UTC));
        assertThat(timestamp.getOffset()).isEqualTo(ZoneOffset.UTC);
    }
}
