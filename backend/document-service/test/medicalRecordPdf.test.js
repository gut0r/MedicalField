import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMedicalRecordPdf } from '../src/pdf/medicalRecordPdf.js';

test('gera PDF consolidado do prontuário com seus atendimentos', async () => {
  const pdf = await buildMedicalRecordPdf({
    record: {
      id: '10000000-0000-4000-8000-000000000001',
      recordNumber: 'MF-2026-TESTE001',
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-10-27T10:00:00Z',
      updatedAt: '2026-10-27T11:00:00Z'
    },
    patient: {
      fullName: 'Paciente de Teste',
      documentType: 'CPF',
      documentNumber: '000.000.000-00',
      birthDate: '1990-01-01',
      sexAtBirth: 'F'
    },
    encounters: [{
      id: '20000000-0000-4000-8000-000000000001',
      occurredAt: '2026-10-27T10:30:00Z',
      occurrenceType: 'Queda',
      description: 'Atendimento usado no teste automatizado.',
      status: 'COMPLETED',
      vitalSigns: [{
        measured_at: '2026-10-27T10:31:00Z',
        systolic_pressure: 120,
        diastolic_pressure: 80,
        heart_rate: 72,
        respiratory_rate: 18,
        oxygen_saturation: 98,
        temperature_celsius: 36.5,
        consciousness_level: 'Alerta e orientado'
      }],
      assessments: [],
      medications: [],
      procedures: []
    }],
    issuer: { displayName: 'Administrador de Teste', licenseNumber: 'TESTE-001' }
  });

  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 1000);
});
