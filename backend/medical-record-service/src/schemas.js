import { z } from 'zod';

const uuid = z.string().uuid();

export const medicalRecordInput = z.object({
  id: uuid.optional(),
  patientId: uuid,
});

export const encounterInput = z.object({
  id: uuid.optional(),
  medicalRecordId: uuid,
  patientId: uuid,
  occurredAt: z.iso.datetime(),
  occurrenceType: z.string().min(2).max(100),
  description: z.string().min(2).max(5000),
  generalObservations: z.string().max(5000).optional(),
  vitalSigns: z.array(z.object({
    id: uuid.optional(),
    measuredAt: z.iso.datetime(),
    systolicPressure: z.number().int().min(20).max(350).nullable().optional(),
    diastolicPressure: z.number().int().min(10).max(250).nullable().optional(),
    heartRate: z.number().int().min(0).max(300).nullable().optional(),
    respiratoryRate: z.number().int().min(0).max(150).nullable().optional(),
    oxygenSaturation: z.number().min(0).max(100).nullable().optional(),
    temperatureCelsius: z.number().min(20).max(50).nullable().optional(),
    consciousnessLevel: z.string().max(100).optional(),
  })).default([]),
  assessments: z.array(z.record(z.string(), z.unknown())).default([]),
  medications: z.array(z.object({
    id: uuid.optional(), medicationId: uuid, medicationName: z.string().min(2).max(180),
    concentration: z.string().max(100).optional(), dose: z.number().positive(),
    doseUnit: z.string().min(1).max(30), route: z.string().max(60).optional(),
    administeredAt: z.iso.datetime(), notes: z.string().max(1000).optional(),
  })).default([]),
  procedures: z.array(z.object({
    id: uuid.optional(), code: z.string().max(60).optional(), description: z.string().min(2).max(2000),
    performedAt: z.iso.datetime(), notes: z.string().max(1000).optional(),
  })).default([]),
});

export const correctionInput = z.object({
  entityType: z.enum(['ENCOUNTER', 'VITAL_SIGN', 'ASSESSMENT', 'MEDICATION', 'PROCEDURE']),
  entityId: uuid,
  reason: z.string().min(5).max(1000),
  previousValue: z.record(z.string(), z.unknown()),
  correctedValue: z.record(z.string(), z.unknown()),
});

