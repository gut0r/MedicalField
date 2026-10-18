import { HttpError } from '../errors.js';
import { MedicalRecordRepository } from '../repositories/medicalRecordRepository.js';
import { EncounterRepository } from '../repositories/encounterRepository.js';

export class MedicalRecordService {
  constructor(db) {
    this.db = db;
    this.records = new MedicalRecordRepository(db);
    this.encounters = new EncounterRepository(db);
  }

  async createRecord(input, actorId) {
    if (input.id) {
      const byId = await this.records.get(input.id);
      if (byId) {
        if (byId.patientId === input.patientId) return byId;
        throw new HttpError(409, 'Identificador de prontuario ja utilizado por outro conteudo');
      }
    }
    const existing = await this.records.list({ patientId: input.patientId, limit: 1 });
    if (existing.some((record) => record.status === 'ACTIVE')) {
      throw new HttpError(409, 'O paciente já possui prontuário ativo', { recordId: existing[0].id });
    }
    const record = await this.records.create({ ...input, actorId });
    await this.#publish('MEDICAL_RECORD', record.id, record.version, record);
    return record;
  }

  async createEncounter(input, actorId) {
    if (input.id) {
      const byId = await this.encounters.get(input.id);
      if (byId) {
        const samePayload = byId.medicalRecordId === input.medicalRecordId
          && byId.patientId === input.patientId
          && byId.occurrenceType === input.occurrenceType
          && byId.description === input.description;
        if (samePayload) return byId;
        throw new HttpError(409, 'Identificador de atendimento ja utilizado por outro conteudo');
      }
    }
    const record = await this.records.get(input.medicalRecordId);
    if (!record) throw new HttpError(404, 'Prontuário não encontrado');
    if (record.patientId !== input.patientId) throw new HttpError(422, 'O prontuário não pertence ao paciente informado');
    const encounter = await this.encounters.create(input, actorId);
    const complete = await this.encounters.get(encounter.id);
    await this.#publish('ENCOUNTER', encounter.id, encounter.version, complete);
    return complete;
  }

  async #publish(entityType, entityId, version, payload) {
    await this.db.query(
      `INSERT INTO sync.change_feed (entity_type,entity_id,entity_version,action,payload)
       VALUES ($1,$2,$3,'UPSERT',$4::jsonb)`,
      [entityType, entityId, version, JSON.stringify(payload)],
    );
  }
}

