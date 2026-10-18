import { db } from '../db';
import type { Professional } from '../types';

const encoder = new TextEncoder(); const decoder = new TextDecoder();
const toB64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const fromB64=(value:string)=>Uint8Array.from(atob(value),(c)=>c.charCodeAt(0));
const asBuffer=(bytes:Uint8Array):ArrayBuffer=>new Uint8Array(bytes).buffer;
const OFFLINE_SECURITY_ERROR = 'O modo offline seguro exige HTTPS ou acesso por localhost. Use Entrar online neste endereço.';

type OfflineCrypto = Pick<Crypto, 'subtle' | 'getRandomValues'>;

export function isOfflineSecurityAvailable(candidate: Partial<OfflineCrypto> | undefined = globalThis.crypto): boolean {
  return typeof candidate?.subtle !== 'undefined' && typeof candidate?.getRandomValues === 'function';
}

function requireOfflineSecurity() {
  if (!isOfflineSecurityAvailable()) throw new Error(OFFLINE_SECURITY_ERROR);
}

async function deriveKey(password:string,salt:Uint8Array) {
  const material=await globalThis.crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
  return globalThis.crypto.subtle.deriveKey({name:'PBKDF2',salt:asBuffer(salt),iterations:250_000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}

/** O servidor nunca confia nesta sessão; ela serve apenas para desbloquear dados locais. */
export async function saveOfflineSession(username:string, password:string, professional:Professional, offlineGrant:string, expiresAt:string) {
  requireOfflineSecurity();
  if (!username.trim() || password.length < 8) throw new Error('Informe o mesmo usuário e senha usados no acesso online');
  const salt=globalThis.crypto.getRandomValues(new Uint8Array(16)); const iv=globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(password,salt);
  const plaintext=encoder.encode(JSON.stringify({username:username.trim().toLocaleLowerCase(),professional,offlineGrant}));
  const encrypted=await globalThis.crypto.subtle.encrypt({name:'AES-GCM',iv:asBuffer(iv)},key,plaintext);
  await db.offlineSessions.put({id:'current',salt:toB64(salt),iv:toB64(iv),ciphertext:toB64(new Uint8Array(encrypted)),expiresAt});
}

export async function unlockOfflineSession(username:string, password:string):Promise<Professional> {
  requireOfflineSecurity();
  const stored=await db.offlineSessions.get('current');
  if (!stored) throw new Error('Este dispositivo ainda não foi preparado para uso offline');
  if (new Date(stored.expiresAt)<=new Date()) throw new Error('Autorização offline expirada; conecte-se para autenticar novamente');
  try {
    const key=await deriveKey(password,fromB64(stored.salt));
    const decrypted=await globalThis.crypto.subtle.decrypt({name:'AES-GCM',iv:asBuffer(fromB64(stored.iv))},key,asBuffer(fromB64(stored.ciphertext)));
    const session=JSON.parse(decoder.decode(decrypted));
    if (session.username!==username.trim().toLocaleLowerCase()) throw new Error('Usuário divergente');
    return session.professional;
  } catch { throw new Error('Usuário ou senha offline inválidos'); }
}

