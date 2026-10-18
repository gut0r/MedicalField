import crypto from 'node:crypto';
import { createTriageAssessment } from '../domain/triageFactory.js';

export class EncounterRepository {
  constructor(db) { this.db = db; }

  async list({ patientId, medicalRecordId, limit = 200 }) {
    const result = await this.db.query(
      `SELECT id, medical_record_id AS "medicalRecordId", patient_id AS "patientId",
              responsible_professional_id AS "responsibleProfessionalId", occurred_at AS "occurredAt",
              occurrence_type AS "occurrenceType", description, general_observations AS "generalObservations",
              status, version, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM care.encounters
        WHERE ($1::uuid IS NULL OR patient_id=$1) AND ($2::uuid IS NULL OR medical_record_id=$2)
        ORDER BY occurred_at DESC LIMIT $3`,
      [patientId ?? null, medicalRecordId ?? null, limit],
    );
    return result.rows;
  }

  async get(id) {
    const encounter = (await this.db.query(
      `SELECT id, medical_record_id AS "medicalRecordId", patient_id AS "patientId",
              responsible_professional_id AS "responsibleProfessionalId", occurred_at AS "occurredAt",
              occurrence_type AS "occurrenceType", description, general_observations AS "generalObservations",
              status, version, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM care.encounters WHERE id=$1`, [id],
    )).rows[0];
    if (!encounter) return null;
    const [vitals, glasgow, manchester, start, medications, procedures] = await Promise.all([
      this.db.query('SELECT * FROM care.vital_sign_measurements WHERE encounter_id=$1 ORDER BY measured_at', [id]),
      this.db.query('SELECT * FROM care.glasgow_assessments WHERE encounter_id=$1 ORDER BY assessed_at', [id]),
      this.db.query('SELECT * FROM care.manchester_assessments WHERE encounter_id=$1 ORDER BY assessed_at', [id]),
      this.db.query('SELECT * FROM care.start_assessments WHERE encounter_id=$1 ORDER BY assessed_at', [id]),
      this.db.query('SELECT * FROM care.administered_medications WHERE encounter_id=$1 ORDER BY administered_at', [id]),
      this.db.query('SELECT * FROM care.performed_procedures WHERE encounter_id=$1 ORDER BY performed_at', [id]),
    ]);
    return { ...encounter, vitalSigns: vitals.rows, assessments: [...glasgow.rows, ...manchester.rows, ...start.rows], medications: medications.rows, procedures: procedures.rows };
  }

  async create(input, actorId) {
    const id = input.id ?? crypto.randomUUID();
    const result = await this.db.query(
      `INSERT INTO care.encounters
         (id,medical_record_id,patient_id,responsible_professional_id,occurred_at,
          occurrence_type,description,general_observations)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, medical_record_id AS "medicalRecordId", patient_id AS "patientId",
                 responsible_professional_id AS "responsibleProfessionalId", occurred_at AS "occurredAt",
                 occurrence_type AS "occurrenceType", description, general_observations AS "generalObservations",
                 status, version, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, input.medicalRecordId, input.patientId, actorId, input.occurredAt, input.occurrenceType, input.description, input.generalObservations ?? null],
    );
    for (const vital of input.vitalSigns) await this.#insertVital(id, vital, actorId);
    for (const raw of input.assessments) await this.#insertAssessment(id, createTriageAssessment(raw), actorId);
    for (const medication of input.medications) await this.#insertMedication(id, medication, actorId);
    for (const procedure of input.procedures) await this.#insertProcedure(id, procedure, actorId);
    return result.rows[0];
  }

  async #insertVital(encounterId, value, actorId) {
    await this.db.query(
      `INSERT INTO care.vital_sign_measurements
        (id,encounter_id,measured_at,systolic_pressure,diastolic_pressure,heart_rate,
         respiratory_rate,oxygen_saturation,temperature_celsius,consciousness_level,recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [value.id ?? crypto.randomUUID(), encounterId, value.measuredAt, value.systolicPressure ?? null,
        value.diastolicPressure ?? null, value.heartRate ?? null, value.respiratoryRate ?? null,
        value.oxygenSaturation ?? null, value.temperatureCelsius ?? null, value.consciousnessLevel ?? null, actorId],
    );
  }

  async #insertAssessment(encounterId, value, actorId) {
    const id = value.id ?? crypto.randomUUID();
    if (value.protocol === 'GLASGOW') {
      await this.db.query(
        `INSERT INTO care.glasgow_assessments
          (id,encounter_id,assessed_at,eye_score,verbal_score,motor_score,
           eye_not_testable_reason,verbal_not_testable_reason,motor_not_testable_reason,total_score,assessed_by,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id, encounterId, value.assessedAt, value.eyeScore, value.verbalScore, value.motorScore,
          value.eyeNotTestableReason ?? null, value.verbalNotTestableReason ?? null,
          value.motorNotTestableReason ?? null, value.totalScore, actorId, value.notes ?? null],
      );
    } else if (value.protocol === 'MANCHESTER') {
      await this.db.query(
        `INSERT INTO care.manchester_assessments
          (id,encounter_id,assessed_at,presentation,discriminator,priority_level,color,target_minutes,assessed_by,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [id, encounterId, value.assessedAt, value.presentation, value.discriminator ?? null,
          value.priorityLevel, value.color, value.targetMinutes, actorId, value.notes ?? null],
      );
    } else {
      await this.db.query(
        `INSERT INTO care.start_assessments
          (id,encounter_id,assessed_at,can_walk,spontaneous_breathing,breathing_after_airway_opening,
           respiratory_rate,radial_pulse_present,capillary_refill_seconds,follows_simple_commands,category,assessed_by,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [id, encounterId, value.assessedAt, value.canWalk ?? null, value.spontaneousBreathing ?? null,
          value.breathingAfterAirwayOpening ?? null, value.respiratoryRate ?? null,
          value.radialPulsePresent ?? null, value.capillaryRefillSeconds ?? null,
          value.followsSimpleCommands ?? null, value.category, actorId, value.notes ?? null],
      );
    }
  }

  async #insertMedication(encounterId, value, actorId) {
    await this.db.query(
      `INSERT INTO care.administered_medications
        (id,encounter_id,medication_id,medication_name_snapshot,concentration_snapshot,
         dose,dose_unit,route,administered_at,administered_by,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [value.id ?? crypto.randomUUID(), encounterId, value.medicationId, value.medicationName,
        value.concentration ?? null, value.dose, value.doseUnit, value.route ?? null,
        value.administeredAt, actorId, value.notes ?? null],
    );
  }

  async #insertProcedure(encounterId, value, actorId) {
    await this.db.query(
      `INSERT INTO care.performed_procedures
        (id,encounter_id,procedure_code,description,performed_at,performed_by,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [value.id ?? crypto.randomUUID(), encounterId, value.code ?? null, value.description,
        value.performedAt, actorId, value.notes ?? null],
    );
  }
}

