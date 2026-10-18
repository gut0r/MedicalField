export interface VitalSignsInput {
  systolicPressure: number | null;
  diastolicPressure: number | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  temperatureCelsius: number | null;
}

const rules: Array<{
  key: keyof VitalSignsInput;
  label: string;
  min: number;
  max: number;
  integer?: boolean;
}> = [
  { key: 'systolicPressure', label: 'PA sistólica', min: 20, max: 350, integer: true },
  { key: 'diastolicPressure', label: 'PA diastólica', min: 10, max: 250, integer: true },
  { key: 'heartRate', label: 'Frequência cardíaca', min: 0, max: 300, integer: true },
  { key: 'respiratoryRate', label: 'Frequência respiratória', min: 0, max: 150, integer: true },
  { key: 'oxygenSaturation', label: 'Saturação de O₂', min: 0, max: 100 },
  { key: 'temperatureCelsius', label: 'Temperatura', min: 20, max: 50 },
];

export function validateVitalSigns(input: VitalSignsInput): VitalSignsInput {
  for (const rule of rules) {
    const value = input[rule.key];
    if (value == null) continue;
    if (!Number.isFinite(value)) throw new Error(`${rule.label}: informe um número válido.`);
    if (rule.integer && !Number.isInteger(value)) {
      throw new Error(`${rule.label}: informe um número inteiro.`);
    }
    if (value < rule.min || value > rule.max) {
      throw new Error(`${rule.label}: informe um valor entre ${rule.min} e ${rule.max}.`);
    }
  }
  return input;
}
