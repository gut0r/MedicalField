import { describe, expect, it } from 'vitest';
import { createPatientDemo } from './patientDemo';

describe('exemplo de paciente', () => {
  it('gera um cadastro identificado completo e válido para a demonstração', () => {
    const example = createPatientDemo(() => 0.5, 1_797_000_123_456);

    expect(example.fullName).toBeTruthy();
    expect(example.documentType).toBe('CPF');
    expect(example.documentNumber).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    expect(example.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(example.phone).toMatch(/^\(51\) 99999-\d{4}$/);
  });
});
