BEGIN;

INSERT INTO identity.roles (code, description) VALUES
    ('ADMIN', 'Administrador do portal e da auditoria'),
    ('MEDICO', 'Profissional identificado por CRM'),
    ('ENFERMEIRO', 'Profissional identificado por COREN'),
    ('SOCORRISTA', 'Profissional de atendimento pré-hospitalar')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO identity.professionals
    (id, display_name, license_type, license_number, email)
VALUES
    ('10000000-0000-4000-8000-000000000001', 'Administrador de Demonstração', 'SOCORRISTA', 'ADMIN-DEMO', 'admin@medicalfield.local'),
    ('10000000-0000-4000-8000-000000000002', 'Dra. Ana Médica', 'CRM', 'CRM-RS-000001', 'ana@medicalfield.local'),
    ('10000000-0000-4000-8000-000000000003', 'Enf. Bruno Resgate', 'COREN', 'COREN-RS-000002', 'bruno@medicalfield.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO medication.medications
    (id, name, active_ingredient, pharmaceutical_form, concentration, unit, created_by, updated_by)
VALUES
    ('40000000-0000-4000-8000-000000000001', 'Dipirona', 'Metamizol sódico', 'Solução injetável', '500 mg/mL', 'mL', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
    ('40000000-0000-4000-8000-000000000002', 'Paracetamol', 'Paracetamol', 'Comprimido', '500 mg', 'comprimido', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO patient.patients
    (id, full_name, identification_status, document_type, document_number, birth_date,
     phone, emergency_contact_name, emergency_contact_phone, created_by, updated_by)
VALUES
    ('20000000-0000-4000-8000-000000000001', 'João da Silva', 'IDENTIFIED', 'CPF', '00000000191', '1985-04-12',
     '51999990001', 'Maria da Silva', '51999990002', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
    ('20000000-0000-4000-8000-000000000002', 'Carla Souza', 'IDENTIFIED', 'CPF', '00000000272', '1992-08-23',
     '51999990003', 'Paulo Souza', '51999990004', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO care.medical_records
    (id, patient_id, record_number, created_by, updated_by)
VALUES
    ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'MF-2026-DEMO0001', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
    ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'MF-2026-DEMO0002', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO care.encounters
    (id, medical_record_id, patient_id, responsible_professional_id, occurred_at,
     occurrence_type, description, general_observations, status)
VALUES
    ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
     '10000000-0000-4000-8000-000000000002', '2026-09-15T14:30:00-03:00', 'Queda', 'Queda da própria altura, sem perda de consciência.', 'Paciente entregue à unidade de referência.', 'COMPLETED')
ON CONFLICT (id) DO NOTHING;

-- Alimenta o feed inicial para que um Cliente vazio consiga baixar os cadastros.
INSERT INTO sync.change_feed (entity_type, entity_id, entity_version, action, payload)
SELECT 'PATIENT', p.id, p.version, 'UPSERT', jsonb_build_object(
    'id', p.id, 'fullName', p.full_name, 'identificationStatus', p.identification_status,
    'documentType', p.document_type, 'documentNumber', p.document_number,
    'birthDate', p.birth_date, 'phone', p.phone, 'emergencyContactName', p.emergency_contact_name,
    'emergencyContactPhone', p.emergency_contact_phone, 'notes', p.notes, 'active', p.active,
    'version', p.version, 'createdAt', p.created_at, 'updatedAt', p.updated_at)
FROM patient.patients p
WHERE NOT EXISTS (SELECT 1 FROM sync.change_feed c WHERE c.entity_type='PATIENT' AND c.entity_id=p.id AND c.entity_version=p.version);

INSERT INTO sync.change_feed (entity_type, entity_id, entity_version, action, payload)
SELECT 'MEDICAL_RECORD', r.id, r.version, 'UPSERT', jsonb_build_object(
    'id', r.id, 'patientId', r.patient_id, 'recordNumber', r.record_number, 'status', r.status,
    'version', r.version, 'createdAt', r.created_at, 'updatedAt', r.updated_at)
FROM care.medical_records r
WHERE NOT EXISTS (SELECT 1 FROM sync.change_feed c WHERE c.entity_type='MEDICAL_RECORD' AND c.entity_id=r.id AND c.entity_version=r.version);

INSERT INTO sync.change_feed (entity_type, entity_id, entity_version, action, payload)
SELECT 'ENCOUNTER', e.id, e.version, 'UPSERT', jsonb_build_object(
    'id', e.id, 'medicalRecordId', e.medical_record_id, 'patientId', e.patient_id,
    'responsibleProfessionalId', e.responsible_professional_id, 'occurredAt', e.occurred_at,
    'occurrenceType', e.occurrence_type, 'description', e.description,
    'generalObservations', e.general_observations, 'status', e.status, 'version', e.version,
    'vitalSigns', '[]'::jsonb, 'assessments', '[]'::jsonb, 'medications', '[]'::jsonb,
    'procedures', '[]'::jsonb, 'createdAt', e.created_at, 'updatedAt', e.updated_at)
FROM care.encounters e
WHERE NOT EXISTS (SELECT 1 FROM sync.change_feed c WHERE c.entity_type='ENCOUNTER' AND c.entity_id=e.id AND c.entity_version=e.version);

INSERT INTO sync.change_feed (entity_type, entity_id, entity_version, action, payload)
SELECT 'MEDICATION', m.id, m.version, 'UPSERT', jsonb_build_object(
    'id', m.id, 'name', m.name, 'activeIngredient', m.active_ingredient,
    'pharmaceuticalForm', m.pharmaceutical_form, 'concentration', m.concentration,
    'unit', m.unit, 'active', m.active, 'version', m.version,
    'createdAt', m.created_at, 'updatedAt', m.updated_at)
FROM medication.medications m
WHERE NOT EXISTS (SELECT 1 FROM sync.change_feed c WHERE c.entity_type='MEDICATION' AND c.entity_id=m.id AND c.entity_version=m.version);

COMMIT;

