import { describe, expect, it } from 'vitest';
import { validateVitalSigns } from './encounterValidation';

describe('validação de sinais vitais', () => {
  it('aceita valores clínicos dentro dos limites', () => {
    expect(validateVitalSigns({
      systolicPressure: 120,
      diastolicPressure: 80,
      heartRate: 88,
      respiratoryRate: 18,
      oxygenSaturation: 98,
      temperatureCelsius: 36.7,
    })).toBeDefined();
  });

  it('recusa pressão fracionada e temperatura impossível antes de gravar', () => {
    expect(() => validateVitalSigns({
      systolicPressure: 0.3,
      diastolicPressure: -0.2,
      heartRate: 0.2,
      respiratoryRate: -0.3,
      oxygenSaturation: 0.3,
      temperatureCelsius: -0.2,
    })).toThrow('PA sistólica: informe um número inteiro.');
  });
});
