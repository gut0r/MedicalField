import { connectivity } from './connectivity';

const API = import.meta.env.VITE_API_BASE_URL ?? '/api';
const CLIENT_HEADER = 'X-MedicalField-Client';
const CLIENT_NAME = 'field';
let token:string|null = null;
export const setAccessToken = (value:string|null) => { token=value; };

export async function api<T>(path:string, init:RequestInit={}):Promise<T> {
  if (!connectivity.getSnapshot().effectiveOnline) throw new Error('Operação remota bloqueada: cliente offline');
  const headers = new Headers(init.headers);
  headers.set(CLIENT_HEADER, CLIENT_NAME);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type','application/json');
  let response = await fetch(`${API}${path}`, { ...init, headers, credentials:'include' });
  if (response.status===401 && path!=='/auth/login' && path!=='/auth/refresh') {
    const refreshed=await fetch(`${API}/auth/refresh`,{method:'POST',headers:{[CLIENT_HEADER]:CLIENT_NAME},credentials:'include'});
    if (refreshed.ok) { const data=await refreshed.json(); setAccessToken(data.access_token); headers.set('Authorization',`Bearer ${data.access_token}`); response=await fetch(`${API}${path}`,{...init,headers,credentials:'include'}); }
  }
  if (!response.ok) { const body=await response.text(); throw new Error(body || `HTTP ${response.status}`); }
  if (response.status===204) return undefined as T;
  return response.json();
}

