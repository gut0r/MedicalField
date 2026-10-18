import test from 'node:test';
import assert from 'node:assert/strict';
import { createTriageAssessment } from '../src/domain/triageFactory.js';

test('Factory calcula Glasgow apenas quando os três componentes são testáveis', () => {
  const assessment = createTriageAssessment({
    protocol: 'GLASGOW', assessedAt: '2026-10-13T20:00:00Z',
    eyeScore: 4, verbalScore: 5, motorScore: 6,
  });
  assert.equal(assessment.totalScore, 15);
});

test('Factory preserva componente Glasgow não testável sem inventar escore', () => {
  const assessment = createTriageAssessment({
    protocol: 'GLASGOW', assessedAt: '2026-10-13T20:00:00Z',
    eyeScore: 4, verbalScore: null, verbalNotTestableReason: 'Paciente intubado', motorScore: 6,
  });
  assert.equal(assessment.totalScore, null);
});

