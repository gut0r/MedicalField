import crypto from 'node:crypto';
import express from 'express';
import { pool, withTransaction } from './db.js';
import { medicalRecordInput, encounterInput, correctionInput } from './schemas.js';
import { HttpError } from './errors.js';
import { MedicalRecordRepository } from './repositories/medicalRecordRepository.js';
import { EncounterRepository } from './repositories/encounterRepository.js';
import { MedicalRecordService } from './services/medicalRecordService.js';

export const router = express.Router();

router.get('/medical-records', async (req, res) => {
  const repository = new MedicalRecordRepository(pool);
  res.json(await repository.list({ patientId: req.query.patientId, limit: Math.min(Number(req.query.limit ?? 200), 500) }));
});

router.get('/medical-records/:id', async (req, res) => {
  const item = await new MedicalRecordRepository(pool).get(req.params.id);
  if (!item) throw new HttpError(404, 'Prontuário não encontrado');
  res.json(item);
});

router.post('/medical-records', async (req, res) => {
  const input = medicalRecordInput.parse(req.body);
  const result = await withTransaction(async (client) => new MedicalRecordService(client).createRecord(input, req.principal.professionalId));
  res.status(201).json(result);
});

router.get('/encounters', async (req, res) => {
  const repository = new EncounterRepository(pool);
  res.json(await repository.list({
    patientId: req.query.patientId,
    medicalRecordId: req.query.medicalRecordId,
    limit: Math.min(Number(req.query.limit ?? 200), 500),
  }));
});

router.get('/encounters/:id', async (req, res) => {
  const item = await new EncounterRepository(pool).get(req.params.id);
  if (!item) throw new HttpError(404, 'Atendimento não encontrado');
  res.json(item);
});

router.post('/encounters', async (req, res) => {
  const input = encounterInput.parse(req.body);
  const result = await withTransaction(async (client) => new MedicalRecordService(client).createEncounter(input, req.principal.professionalId));
  res.status(201).json(result);
});

router.post('/encounters/:id/corrections', async (req, res) => {
  const input = correctionInput.parse(req.body);
  if (input.entityType === 'ENCOUNTER' && input.entityId !== req.params.id) {
    throw new HttpError(422, 'A correção não corresponde ao atendimento da rota');
  }
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO care.clinical_corrections
      (id,entity_type,entity_id,reason,previous_value,corrected_value,corrected_by)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
    [id, input.entityType, input.entityId, input.reason, JSON.stringify(input.previousValue),
      JSON.stringify(input.correctedValue), req.principal.professionalId],
  );
  res.status(201).json({ id, ...input, correctedBy: req.principal.professionalId });
});

