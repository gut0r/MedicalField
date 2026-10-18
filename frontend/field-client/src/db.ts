import Dexie, { type EntityTable } from 'dexie';
import type { Encounter, LocalAuditEvent, MedicalRecord, Medication, OfflineSession, OutboxOperation, Patient } from './types';

export interface Metadata { key:string; value:unknown; }
export interface SyncHistory { id:string; startedAt:string; finishedAt:string; direction:string; status:string; sent:number; received:number; errors:string[]; }
export interface Conflict { id:string; operationId:string; entityType:string; entityId:string; details:unknown; createdAt:string; }

class MedicalFieldDatabase extends Dexie {
  patients!: EntityTable<Patient, 'id'>;
  medicalRecords!: EntityTable<MedicalRecord, 'id'>;
  encounters!: EntityTable<Encounter, 'id'>;
  medications!: EntityTable<Medication, 'id'>;
  outbox!: EntityTable<OutboxOperation, 'operationId'>;
  auditEvents!: EntityTable<LocalAuditEvent, 'id'>;
  offlineSessions!: EntityTable<OfflineSession, 'id'>;
  metadata!: EntityTable<Metadata, 'key'>;
  syncHistory!: EntityTable<SyncHistory, 'id'>;
  conflicts!: EntityTable<Conflict, 'id'>;

  constructor() {
    super('medicalfield-field-client');
    this.version(1).stores({
      patients: '&id, fullName, documentNumber, updatedAt, version, active',
      medicalRecords: '&id, patientId, updatedAt, version, status',
      encounters: '&id, patientId, medicalRecordId, occurredAt, updatedAt, version',
      medications: '&id, name, updatedAt, version, active',
      outbox: '&operationId, entityType, entityId, status, createdAt',
      auditEvents: '&id, sent, occurredAt, entityType, entityId',
      offlineSessions: '&id, expiresAt', metadata: '&key',
      syncHistory: '&id, startedAt, status', conflicts: '&id, operationId, entityType, entityId, createdAt',
    });
  }
}

export const db = new MedicalFieldDatabase();

