import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAttendancePdf } from '../src/pdf/attendancePdf.js';

test('gera um PDF real com dados do atendimento', async () => {
  const pdf = await buildAttendancePdf({
    issuer: 'Profissional de Teste',
    patient: { fullName: 'Paciente Teste', documentType: 'CPF', documentNumber: '000', birthDate: '2000-01-01' },
    encounter: {
      id: '30000000-0000-4000-8000-000000000001', patientId: '20000000-0000-4000-8000-000000000001',
      occurredAt: '2026-10-13T20:00:00Z', occurrenceType: 'Queda', description: 'Queda da própria altura',
      responsibleProfessionalId: '10000000-0000-4000-8000-000000000002', vitalSigns: [], assessments: [], medications: [], procedures: [],
    },
  });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 1000);
});

