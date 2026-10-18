import { describe, expect, it } from 'vitest';
import { createEncounterDemo } from './encounterDemo';

describe('exemplo de atendimento', () => {
  it('gera valores fictícios válidos e completos para a demonstração', () => {
    const example = createEncounterDemo(['patient-1'], [{ id: 'medication-1', unit: 'mL' }], () => 0.5);

    expect(example.patientId).toBe('patient-1');
    expect(Number(example.systolic)).toBeGreaterThanOrEqual(110);
    expect(Number(example.diastolic)).toBeGreaterThanOrEqual(70);
    expect(Number(example.temperature)).toBeGreaterThanOrEqual(36);
    expect(example.eyeScore).toMatch(/^[34]$/);
    expect(example.medicationId).toBe('medication-1');
    expect(example.procedureCode).toBe('IMOB-01');
  });

  it('exige que os pacientes tenham sido baixados', () => {
    expect(() => createEncounterDemo([], [], () => 0.5)).toThrow('Baixe os pacientes');
  });
});
