interface DemoMedication {
  id: string;
  unit?: string;
}

interface OccurrenceExample {
  type: string;
  description: string;
}

const occurrences: OccurrenceExample[] = [
  { type: 'Queda', description: 'Queda da própria altura, sem perda de consciência.' },
  { type: 'Colisão', description: 'Colisão de baixa velocidade com paciente consciente e orientado.' },
  { type: 'Mal-estar', description: 'Mal-estar súbito durante atividade, sem trauma aparente.' },
];

export function createEncounterDemo(
  patientIds: string[],
  medications: DemoMedication[],
  random: () => number = Math.random,
): Record<string, string> {
  if (!patientIds.length) throw new Error('Baixe os pacientes antes de preencher um exemplo.');

  const occurrence = pick(occurrences, random);
  const medication = medications.length ? pick(medications, random) : undefined;
  const tablet = medication?.unit?.toLocaleLowerCase('pt-BR').includes('comprimido') ?? false;

  return {
    patientId: pick(patientIds, random),
    occurrenceType: occurrence.type,
    description: occurrence.description,
    observations: 'Dados fictícios gerados para demonstração do sistema.',
    systolic: String(randomInt(110, 130, random)),
    diastolic: String(randomInt(70, 85, random)),
    heartRate: String(randomInt(70, 100, random)),
    respiratoryRate: String(randomInt(14, 20, random)),
    oxygen: String(randomInt(95, 100, random)),
    temperature: (36 + random() * 1.5).toFixed(1),
    consciousness: 'Alerta e orientado',
    eyeScore: String(randomInt(3, 4, random)),
    verbalScore: String(randomInt(4, 5, random)),
    motorScore: String(randomInt(5, 6, random)),
    eyeNotTestableReason: '',
    verbalNotTestableReason: '',
    motorNotTestableReason: '',
    triageNotes: 'Avaliação de demonstração; revisar antes de salvar.',
    medicationId: medication?.id ?? '',
    dose: medication ? (tablet ? '1' : '2') : '',
    doseUnit: medication?.unit ?? '',
    medicationRoute: medication ? (tablet ? 'Oral' : 'IV') : '',
    medicationNotes: medication ? 'Administração simulada para teste.' : '',
    procedureCode: 'IMOB-01',
    procedure: 'Imobilização preventiva',
    procedureNotes: 'Procedimento simulado para demonstração.',
  };
}

function pick<T>(items: T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function randomInt(min: number, max: number, random: () => number) {
  return Math.floor(random() * (max - min + 1)) + min;
}
