BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS patient;
CREATE SCHEMA IF NOT EXISTS care;
CREATE SCHEMA IF NOT EXISTS medication;
CREATE SCHEMA IF NOT EXISTS sync;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS identity.professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(160) NOT NULL,
    license_type VARCHAR(20) NOT NULL CHECK (license_type IN ('CRM', 'COREN', 'SOCORRISTA')),
    license_number VARCHAR(60) NOT NULL,
    email CITEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (license_type, license_number)
);

CREATE TABLE IF NOT EXISTS identity.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professional_id UUID NOT NULL REFERENCES identity.professionals(id),
    username CITEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
    locked_until TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS identity.roles (
    code VARCHAR(30) PRIMARY KEY,
    description VARCHAR(160) NOT NULL
);

CREATE TABLE IF NOT EXISTS identity.user_roles (
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    role_code VARCHAR(30) NOT NULL REFERENCES identity.roles(code),
    PRIMARY KEY (user_id, role_code)
);

CREATE TABLE IF NOT EXISTS identity.refresh_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    device_id UUID,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS patient.patients (
    id UUID PRIMARY KEY,
    full_name VARCHAR(180) NOT NULL,
    identification_status VARCHAR(20) NOT NULL DEFAULT 'IDENTIFIED'
        CHECK (identification_status IN ('IDENTIFIED', 'PROVISIONAL', 'UNKNOWN')),
    document_type VARCHAR(30),
    document_number VARCHAR(80),
    birth_date DATE,
    sex_at_birth VARCHAR(20),
    phone VARCHAR(40),
    emergency_contact_name VARCHAR(180),
    emergency_contact_phone VARCHAR(40),
    notes TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 1,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    CHECK (identification_status <> 'IDENTIFIED' OR document_number IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_patient_document
    ON patient.patients (document_type, document_number)
    WHERE document_number IS NOT NULL AND active;
CREATE INDEX IF NOT EXISTS ix_patient_name ON patient.patients (lower(full_name));
CREATE INDEX IF NOT EXISTS ix_patient_updated ON patient.patients (updated_at, id);

CREATE TABLE IF NOT EXISTS care.medical_records (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL,
    record_number VARCHAR(40) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    version BIGINT NOT NULL DEFAULT 1,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_active_record_patient
    ON care.medical_records (patient_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS care.encounters (
    id UUID PRIMARY KEY,
    medical_record_id UUID NOT NULL REFERENCES care.medical_records(id),
    patient_id UUID NOT NULL,
    responsible_professional_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    occurrence_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    general_observations TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'COMPLETED', 'CANCELLED', 'CORRECTED')),
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_encounter_patient ON care.encounters (patient_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_encounter_record ON care.encounters (medical_record_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS care.vital_sign_measurements (
    id UUID PRIMARY KEY,
    encounter_id UUID NOT NULL REFERENCES care.encounters(id),
    measured_at TIMESTAMPTZ NOT NULL,
    systolic_pressure SMALLINT CHECK (systolic_pressure BETWEEN 20 AND 350),
    diastolic_pressure SMALLINT CHECK (diastolic_pressure BETWEEN 10 AND 250),
    heart_rate SMALLINT CHECK (heart_rate BETWEEN 0 AND 300),
    respiratory_rate SMALLINT CHECK (respiratory_rate BETWEEN 0 AND 150),
    oxygen_saturation NUMERIC(5,2) CHECK (oxygen_saturation BETWEEN 0 AND 100),
    temperature_celsius NUMERIC(4,1) CHECK (temperature_celsius BETWEEN 20 AND 50),
    consciousness_level VARCHAR(100),
    recorded_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.glasgow_assessments (
    id UUID PRIMARY KEY,
    encounter_id UUID NOT NULL REFERENCES care.encounters(id),
    assessed_at TIMESTAMPTZ NOT NULL,
    eye_score SMALLINT CHECK (eye_score BETWEEN 1 AND 4),
    verbal_score SMALLINT CHECK (verbal_score BETWEEN 1 AND 5),
    motor_score SMALLINT CHECK (motor_score BETWEEN 1 AND 6),
    eye_not_testable_reason TEXT,
    verbal_not_testable_reason TEXT,
    motor_not_testable_reason TEXT,
    total_score SMALLINT CHECK (total_score BETWEEN 3 AND 15),
    assessed_by UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (eye_score IS NOT NULL OR eye_not_testable_reason IS NOT NULL),
    CHECK (verbal_score IS NOT NULL OR verbal_not_testable_reason IS NOT NULL),
    CHECK (motor_score IS NOT NULL OR motor_not_testable_reason IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS care.manchester_assessments (
    id UUID PRIMARY KEY,
    encounter_id UUID NOT NULL REFERENCES care.encounters(id),
    assessed_at TIMESTAMPTZ NOT NULL,
    presentation VARCHAR(180) NOT NULL,
    discriminator VARCHAR(180),
    priority_level SMALLINT NOT NULL CHECK (priority_level BETWEEN 1 AND 5),
    color VARCHAR(10) NOT NULL CHECK (color IN ('RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE')),
    target_minutes SMALLINT NOT NULL CHECK (target_minutes IN (0, 10, 60, 120, 240)),
    assessed_by UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.start_assessments (
    id UUID PRIMARY KEY,
    encounter_id UUID NOT NULL REFERENCES care.encounters(id),
    assessed_at TIMESTAMPTZ NOT NULL,
    can_walk BOOLEAN,
    spontaneous_breathing BOOLEAN,
    breathing_after_airway_opening BOOLEAN,
    respiratory_rate SMALLINT CHECK (respiratory_rate BETWEEN 0 AND 150),
    radial_pulse_present BOOLEAN,
    capillary_refill_seconds NUMERIC(4,1) CHECK (capillary_refill_seconds BETWEEN 0 AND 30),
    follows_simple_commands BOOLEAN,
    category VARCHAR(10) NOT NULL CHECK (category IN ('GREEN', 'YELLOW', 'RED', 'BLACK')),
    assessed_by UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medication.medications (
    id UUID PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    active_ingredient VARCHAR(180),
    pharmaceutical_form VARCHAR(100),
    concentration VARCHAR(100),
    unit VARCHAR(30),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 1,
    created_by UUID NOT NULL,
    updated_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, pharmaceutical_form, concentration)
);
CREATE INDEX IF NOT EXISTS ix_medication_updated ON medication.medications (updated_at, id);

CREATE TABLE IF NOT EXISTS care.administered_medications (
    id UUID PRIMARY KEY,
    encounter_id UUID NOT NULL REFERENCES care.encounters(id),
    medication_id UUID NOT NULL,
    medication_name_snapshot VARCHAR(180) NOT NULL,
    concentration_snapshot VARCHAR(100),
    dose NUMERIC(12,3) NOT NULL CHECK (dose > 0),
    dose_unit VARCHAR(30) NOT NULL,
    route VARCHAR(60),
    administered_at TIMESTAMPTZ NOT NULL,
    administered_by UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.performed_procedures (
    id UUID PRIMARY KEY,
    encounter_id UUID NOT NULL REFERENCES care.encounters(id),
    procedure_code VARCHAR(60),
    description TEXT NOT NULL,
    performed_at TIMESTAMPTZ NOT NULL,
    performed_by UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care.clinical_corrections (
    id UUID PRIMARY KEY,
    entity_type VARCHAR(60) NOT NULL,
    entity_id UUID NOT NULL,
    reason TEXT NOT NULL,
    previous_value JSONB NOT NULL,
    corrected_value JSONB NOT NULL,
    corrected_by UUID NOT NULL,
    corrected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync.devices (
    id UUID PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL,
    registered_to UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sync.sync_batches (
    id UUID PRIMARY KEY,
    device_id UUID NOT NULL,
    professional_id UUID NOT NULL,
    direction VARCHAR(12) NOT NULL CHECK (direction IN ('UPLOAD', 'DOWNLOAD', 'BOTH')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sync.processed_operations (
    operation_id UUID NOT NULL,
    device_id UUID NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id UUID NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    result JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (device_id, operation_id)
);

CREATE TABLE IF NOT EXISTS sync.change_feed (
    sequence_id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(60) NOT NULL,
    entity_id UUID NOT NULL,
    entity_version BIGINT NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('UPSERT', 'INACTIVATE')),
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_change_feed_entity ON sync.change_feed (entity_type, sequence_id);

CREATE TABLE IF NOT EXISTS sync.conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES sync.sync_batches(id),
    device_id UUID NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id UUID NOT NULL,
    base_version BIGINT,
    server_version BIGINT,
    client_payload JSONB NOT NULL,
    server_payload JSONB NOT NULL,
    strategy VARCHAR(60),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    resolution JSONB,
    resolved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit.http_request_logs (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    service_name VARCHAR(60) NOT NULL,
    request_id UUID NOT NULL,
    client_ip INET,
    professional_id UUID,
    http_method VARCHAR(10) NOT NULL,
    route VARCHAR(300) NOT NULL,
    status_code SMALLINT NOT NULL,
    processing_ms INTEGER NOT NULL CHECK (processing_ms >= 0),
    error_code VARCHAR(80)
);
CREATE INDEX IF NOT EXISTS ix_http_log_time ON audit.http_request_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_http_log_filters
    ON audit.http_request_logs (service_name, professional_id, status_code, occurred_at DESC);

CREATE TABLE IF NOT EXISTS audit.offline_events (
    id UUID PRIMARY KEY,
    device_id UUID NOT NULL,
    professional_id UUID NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    entity_type VARCHAR(60),
    entity_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS audit.document_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL,
    professional_id UUID NOT NULL,
    action VARCHAR(30) NOT NULL CHECK (action IN ('GENERATED', 'DOWNLOADED', 'EMAIL_ACCEPTED', 'EMAIL_REJECTED')),
    recipient_hash CHAR(64),
    provider_message_id VARCHAR(255),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

