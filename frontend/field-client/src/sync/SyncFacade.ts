import { api } from '../api';
import { db,type SyncHistory } from '../db';
import type { LocalAuditEvent,OutboxOperation } from '../types';
import { createUuid } from '../uuid';

type OperationResult={operationId:string;status:string;error?:string};
type Change={sequenceId:number;entityType:string;action:string;payload:Record<string,unknown>};

/**
 * Facade Pattern: a interface chama três métodos simples e não precisa conhecer
 * Outbox, cursores, lotes, conflitos ou transações Dexie.
 */
export class SyncFacade {
  async upload():Promise<{sent:number;errors:string[]}> {
    const pending=await db.outbox.where('status').anyOf('PENDING','ERROR').sortBy('createdAt');
    const audits=await db.auditEvents.filter((event)=>!event.sent).toArray();
    const order:Record<string,number>={PATIENT:1,MEDICAL_RECORD:2,ENCOUNTER:3};
    pending.sort((a,b)=>(order[a.entityType]??9)-(order[b.entityType]??9));
    const operations=[...pending.map((op)=>this.serialize(op)),...audits.map((event)=>this.serializeAudit(event))].slice(0,200);
    if(!operations.length)return{sent:0,errors:[]};
    const deviceId=localStorage.getItem('medicalfield.field.deviceId'); if(!deviceId)throw new Error('Dispositivo não registrado');
    const response=await api<{results:OperationResult[]}>('/sync/upload',{method:'POST',body:JSON.stringify({deviceId,operations})});
    const errors:string[]=[]; let sent=0;
    await db.transaction('rw',db.outbox,db.auditEvents,db.conflicts,async()=>{
      for(const result of response.results){
        const domain=await db.outbox.get(result.operationId); const audit=await db.auditEvents.get(result.operationId);
        if(['CONFIRMED','ALREADY_PROCESSED'].includes(result.status)){sent++;if(domain)await db.outbox.delete(result.operationId);if(audit)await db.auditEvents.update(result.operationId,{sent:true});}
        else if(domain){errors.push(result.error??'Falha de sincronização');await db.outbox.update(result.operationId,{status:result.status==='CONFLICT'?'CONFLICT':'ERROR',lastError:result.error,attempts:domain.attempts+1});if(result.status==='CONFLICT')await db.conflicts.put({id:createUuid(),operationId:result.operationId,entityType:domain.entityType,entityId:domain.entityId,details:result,createdAt:new Date().toISOString()});}
      }
    }); return{sent,errors};
  }

  async download():Promise<{received:number;errors:string[]}> {
    let cursor=Number((await db.metadata.get('syncCursor'))?.value??0);let received=0;let hasMore=true;
    while(hasMore){const page=await api<{items:Change[];nextCursor:number;hasMore:boolean}>(`/sync/download?cursor=${cursor}&limit=200`);await db.transaction('rw',db.patients,db.medicalRecords,db.encounters,db.medications,db.metadata,async()=>{for(const change of page.items){await this.apply(change);received++;}await db.metadata.put({key:'syncCursor',value:page.nextCursor});});cursor=page.nextCursor;hasMore=page.hasMore;}
    await db.metadata.put({key:'lastSuccessfulSync',value:new Date().toISOString()});return{received,errors:[]};
  }

  async syncAll(){const startedAt=new Date().toISOString();const id=createUuid();let sent=0,received=0;const errors:string[]=[];try{const up=await this.upload();sent=up.sent;errors.push(...up.errors);const down=await this.download();received=down.received;errors.push(...down.errors);return{sent,received,errors};}finally{const history:SyncHistory={id,startedAt,finishedAt:new Date().toISOString(),direction:'BOTH',status:errors.length?'PARTIAL':'COMPLETED',sent,received,errors};await db.syncHistory.put(history);}}

  private serialize(op:OutboxOperation){return{operationId:op.operationId,entityId:op.entityId,entityType:op.entityType,action:op.action,baseVersion:op.baseVersion,occurredAt:op.occurredAt,payload:op.payload};}
  private serializeAudit(event:LocalAuditEvent){return{operationId:event.id,entityId:event.id,entityType:'OFFLINE_AUDIT',action:'CREATE',occurredAt:event.occurredAt,payload:{eventType:event.eventType,entityType:event.entityType,entityId:event.entityId,...event.metadata}};}
  private async apply(change:Change){const p=change.payload as Record<string,any>;if(change.entityType==='PATIENT')await db.patients.put(p as any);else if(change.entityType==='MEDICAL_RECORD')await db.medicalRecords.put(p as any);else if(change.entityType==='ENCOUNTER')await db.encounters.put(p as any);else if(change.entityType==='MEDICATION')await db.medications.put(p as any);}
}

