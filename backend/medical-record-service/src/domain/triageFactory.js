import { z } from 'zod';

const uuid = z.string().uuid();
const base = z.object({ id: uuid.optional(), assessedAt: z.iso.datetime(), notes: z.string().max(2000).optional() });

const glasgowSchema = base.extend({
  protocol: z.literal('GLASGOW'),
  eyeScore: z.number().int().min(1).max(4).nullable(),
  verbalScore: z.number().int().min(1).max(5).nullable(),
  motorScore: z.number().int().min(1).max(6).nullable(),
  eyeNotTestableReason: z.string().max(500).nullable().optional(),
  verbalNotTestableReason: z.string().max(500).nullable().optional(),
  motorNotTestableReason: z.string().max(500).nullable().optional(),
}).superRefine((value, context) => {
  for (const [score, reason] of [
    [value.eyeScore, value.eyeNotTestableReason],
    [value.verbalScore, value.verbalNotTestableReason],
    [value.motorScore, value.motorNotTestableReason],
  ]) {
    if (score == null && !reason) context.addIssue({ code: 'custom', message: 'Informe o escore ou motivo não testável' });
  }
});

const manchesterSchema = base.extend({
  protocol: z.literal('MANCHESTER'),
  presentation: z.string().min(2).max(180),
  discriminator: z.string().max(180).optional(),
  priorityLevel: z.number().int().min(1).max(5),
  color: z.enum(['RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE']),
  targetMinutes: z.union([z.literal(0), z.literal(10), z.literal(60), z.literal(120), z.literal(240)]),
});

const startSchema = base.extend({
  protocol: z.literal('START'),
  canWalk: z.boolean().nullable().optional(),
  spontaneousBreathing: z.boolean().nullable().optional(),
  breathingAfterAirwayOpening: z.boolean().nullable().optional(),
  respiratoryRate: z.number().int().min(0).max(150).nullable().optional(),
  radialPulsePresent: z.boolean().nullable().optional(),
  capillaryRefillSeconds: z.number().min(0).max(30).nullable().optional(),
  followsSimpleCommands: z.boolean().nullable().optional(),
  category: z.enum(['GREEN', 'YELLOW', 'RED', 'BLACK']),
});

/**
 * Factory Method: seleciona a implementação de validação e persistência de
 * acordo com o protocolo. A criação não fica espalhada pelo controller.
 */
export function createTriageAssessment(raw) {
  switch (raw?.protocol) {
    case 'GLASGOW': {
      const value = glasgowSchema.parse(raw);
      const scores = [value.eyeScore, value.verbalScore, value.motorScore];
      return { ...value, totalScore: scores.every((score) => score != null) ? scores.reduce((a, b) => a + b, 0) : null };
    }
    case 'MANCHESTER': return manchesterSchema.parse(raw);
    case 'START': return startSchema.parse(raw);
    default: throw new Error(`Protocolo de triagem desconhecido: ${raw?.protocol ?? 'ausente'}`);
  }
}

