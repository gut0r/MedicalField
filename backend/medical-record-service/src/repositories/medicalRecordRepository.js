import crypto from 'node:crypto';

/** Repository Pattern: concentra o SQL de prontuários longe das regras HTTP. */
export class MedicalRecordRepository {
  constructor(db) { this.db = db; }

  async list({ patientId, limit = 200 }) {
    const result = await this.db.query(
      `SELECT id, patient_id AS "patientId", record_number AS "recordNumber", status,
              version, created_by AS "createdBy", updated_by AS "updatedBy",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM care.medical_records
        WHERE ($1::uuid IS NULL OR patient_id=$1) ORDER BY updated_at DESC LIMIT $2`,
      [patientId ?? null, limit],
    );
    return result.rows;
  }

  async get(id) {
    const result = await this.db.query(
      `SELECT id, patient_id AS "patientId", record_number AS "recordNumber", status,
              version, created_by AS "createdBy", updated_by AS "updatedBy",
              created_at AS "createdAt", updated_at AS "updatedAt"
         FROM care.medical_records WHERE id=$1`, [id],
    );
    return result.rows[0] ?? null;
  }

  async create({ id = crypto.randomUUID(), patientId, actorId }) {
    const recordNumber = `MF-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`;
    const result = await this.db.query(
      `INSERT INTO care.medical_records
         (id,patient_id,record_number,created_by,updated_by)
       VALUES ($1,$2,$3,$4,$4)
       RETURNING id, patient_id AS "patientId", record_number AS "recordNumber", status,
                 version, created_by AS "createdBy", updated_by AS "updatedBy",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, patientId, recordNumber, actorId],
    );
    return result.rows[0];
  }
}

