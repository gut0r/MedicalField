import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import { discardInvalidOperation, saveEncounter, savePatient } from '../repositories/localRepository';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Outbox local', () => {
  it('grava paciente e operação pendente na mesma transação', async () => {
    const id = crypto.randomUUID();
    await savePatient({ id, fullName: 'Paciente Offline', identificationStatus: 'PROVISIONAL', active: true, version: 0, createdAt: '', updatedAt: '' });
    expect(await db.patients.get(id)).toBeDefined();
    expect(await db.outbox.where('entityId').equals(id).count()).toBe(1);
  });

  it('descarta somente um atendimento local que já falhou na validação', async () => {
    const id = crypto.randomUUID();
    await saveEncounter({ id, medicalRecordId: crypto.randomUUID(), patientId: crypto.randomUUID(), occurredAt: new Date().toISOString(), occurrenceType: 'Teste', description: 'Inválido', vitalSigns: [], assessments: [], medications: [], procedures: [] });
    const operation = (await db.outbox.where('entityId').equals(id).first())!;
    await db.outbox.update(operation.operationId, { status: 'ERROR' });

    expect(await discardInvalidOperation(operation.operationId)).toBe(true);
    expect(await db.encounters.get(id)).toBeUndefined();
    expect(await db.outbox.get(operation.operationId)).toBeUndefined();
  });

  it('descarta um paciente local recusado sem apagar outros pacientes', async () => {
    const invalidId = crypto.randomUUID();
    const validId = crypto.randomUUID();
    await savePatient({ id: invalidId, fullName: 'Paciente Inválido', identificationStatus: 'IDENTIFIED' });
    await savePatient({ id: validId, fullName: 'Paciente Válido', identificationStatus: 'PROVISIONAL' });
    const operation = (await db.outbox.where('entityId').equals(invalidId).first())!;
    await db.outbox.update(operation.operationId, { status: 'ERROR' });

    expect(await discardInvalidOperation(operation.operationId)).toBe(true);
    expect(await db.patients.get(invalidId)).toBeUndefined();
    expect(await db.patients.get(validId)).toBeDefined();
  });
});
