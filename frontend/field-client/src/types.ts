export interface Patient {
  id: string; fullName: string; identificationStatus: 'IDENTIFIED'|'PROVISIONAL'|'UNKNOWN';
  documentType?: string; documentNumber?: string; birthDate?: string; phone?: string;
  emergencyContactName?: string; emergencyContactPhone?: string; notes?: string;
  active: boolean; version: number; createdAt: string; updatedAt: string;
}
export interface MedicalRecord { id:string; patientId:string; recordNumber?:string; status:string; version:number; createdAt:string; updatedAt:string; }
export interface Medication { id:string; name:string; activeIngredient?:string; pharmaceuticalForm?:string; concentration?:string; unit?:string; active:boolean; version:number; createdAt:string; updatedAt:string; }
export interface Encounter { id:string; medicalRecordId:string; patientId:string; occurredAt:string; occurrenceType:string; description:string; generalObservations?:string; status?:string; version:number; vitalSigns:Record<string,unknown>[]; assessments:Record<string,unknown>[]; medications:Record<string,unknown>[]; procedures:Record<string,unknown>[]; createdAt:string; updatedAt:string; }
export type EntityType = 'PATIENT'|'MEDICAL_RECORD'|'ENCOUNTER'|'OFFLINE_AUDIT';
export interface OutboxOperation { operationId:string; entityId:string; entityType:Exclude<EntityType,'OFFLINE_AUDIT'>; action:'CREATE'|'UPDATE'|'INACTIVATE'; baseVersion?:number; occurredAt:string; payload:Record<string,unknown>; status:'PENDING'|'ERROR'|'CONFLICT'; lastError?:string; attempts:number; createdAt:string; }
export interface LocalAuditEvent { id:string; eventType:string; entityType?:string; entityId?:string; occurredAt:string; metadata:Record<string,unknown>; sent:boolean; }
export interface OfflineSession { id:'current'; salt:string; iv:string; ciphertext:string; expiresAt:string; }
export interface Professional { id:string; display_name?:string; displayName?:string; roles:string[]; license_type?:string; license_number?:string; }

