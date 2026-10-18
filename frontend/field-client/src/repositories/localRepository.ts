import { db } from '../db';
import type { Encounter,MedicalRecord,OutboxOperation,Patient } from '../types';
import { createUuid } from '../uuid';

const now=()=>new Date().toISOString();

async function enqueue(entityType:OutboxOperation['entityType'],entityId:string,payload:Record<string,unknown>,baseVersion?:number) {
  const operation:OutboxOperation={operationId:createUuid(),entityId,entityType,action:baseVersion?'UPDATE':'CREATE',baseVersion,occurredAt:now(),payload,status:'PENDING',attempts:0,createdAt:now()};
  const event={id:createUuid(),eventType:`${entityType}_${operation.action}`,entityType,entityId,occurredAt:operation.occurredAt,metadata:{operationId:operation.operationId},sent:false};
  await db.transaction('rw',db.outbox,db.auditEvents,async()=>{await db.outbox.put(operation);await db.auditEvents.put(event);});
}

export async function savePatient(input:Omit<Patient,'active'|'version'|'createdAt'|'updatedAt'> & Partial<Pick<Patient,'active'|'version'|'createdAt'|'updatedAt'>>) {
  const timestamp=now(); const patient:Patient={...input,active:input.active??true,version:input.version??0,createdAt:input.createdAt??timestamp,updatedAt:timestamp};
  await db.transaction('rw',db.patients,db.outbox,db.auditEvents,async()=>{await db.patients.put(patient);await enqueue('PATIENT',patient.id,{...patient,id:patient.id},patient.version||undefined);}); return patient;
}
export async function saveMedicalRecord(patientId:string){const timestamp=now();const record:MedicalRecord={id:createUuid(),patientId,status:'ACTIVE',version:0,createdAt:timestamp,updatedAt:timestamp};await db.transaction('rw',db.medicalRecords,db.outbox,db.auditEvents,async()=>{await db.medicalRecords.put(record);await enqueue('MEDICAL_RECORD',record.id,{id:record.id,patientId});});return record;}
export async function saveEncounter(input:Omit<Encounter,'status'|'version'|'createdAt'|'updatedAt'>){const timestamp=now();const encounter:Encounter={...input,status:'OPEN',version:0,createdAt:timestamp,updatedAt:timestamp};await db.transaction('rw',db.encounters,db.outbox,db.auditEvents,async()=>{await db.encounters.put(encounter);await enqueue('ENCOUNTER',encounter.id,{...encounter});});return encounter;}

export async function discardInvalidOperation(operationId:string) {
  const operation=await db.outbox.get(operationId);
  if(!operation||operation.status!=='ERROR')return false;
  if(operation.entityType==='PATIENT') {
    const dependencies=(await db.medicalRecords.where('patientId').equals(operation.entityId).count())+(await db.encounters.where('patientId').equals(operation.entityId).count());
    if(dependencies>0)throw new Error('Este paciente possui dados locais vinculados e não pode ser descartado.');
    await db.transaction('rw',db.outbox,db.patients,db.auditEvents,async()=>{
      await db.outbox.delete(operationId);
      await db.patients.delete(operation.entityId);
      await db.auditEvents.where('entityId').equals(operation.entityId).delete();
    });
    return true;
  }
  if(operation.entityType!=='ENCOUNTER')return false;
  await db.transaction('rw',db.outbox,db.encounters,db.auditEvents,async()=>{
    await db.outbox.delete(operationId);
    await db.encounters.delete(operation.entityId);
    await db.auditEvents.where('entityId').equals(operation.entityId).delete();
  });
  return true;
}

