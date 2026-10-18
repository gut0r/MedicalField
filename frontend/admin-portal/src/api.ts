const API = import.meta.env.VITE_API_BASE_URL ?? '/api';
const CLIENT_HEADER = 'X-MedicalField-Client';
const CLIENT_NAME = 'portal';

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) { super(message); }
}

function errorMessage(body: unknown, status: number): string {
  if (!body || typeof body !== 'object') return `HTTP ${status}`;
  const payload = body as { detail?: unknown; message?: unknown };
  if (typeof payload.detail === 'string') return payload.detail;
  if (typeof payload.message === 'string') return payload.message;
  if (Array.isArray(payload.detail)) {
    return payload.detail.map(item => {
      if (!item || typeof item !== 'object') return 'Campo inválido';
      const issue = item as { loc?: unknown[]; msg?: unknown };
      const field = issue.loc?.filter(part => part !== 'body').join('.') || 'campo';
      return `${field}: ${typeof issue.msg === 'string' ? issue.msg : 'valor inválido'}`;
    }).join('; ');
  }
  return `HTTP ${status}`;
}

let accessToken: string | null = null;
export function setAccessToken(token: string | null) { accessToken = token; }

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set(CLIENT_HEADER, CLIENT_NAME);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let response = await fetch(`${API}${path}`, { ...init, headers, credentials: 'include' });

  // O token de acesso fica apenas em memória. Apó recarregar a página, o
  // cookie HttpOnly renova a sessão sem expor o refresh token ao JavaScript.
  if (response.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    const refreshed = await fetch(`${API}/auth/refresh`, { method: 'POST', headers: { [CLIENT_HEADER]: CLIENT_NAME }, credentials: 'include' });
    if (refreshed.ok) {
      const data = await refreshed.json();
      setAccessToken(data.access_token);
      headers.set('Authorization', `Bearer ${data.access_token}`);
      response = await fetch(`${API}${path}`, { ...init, headers, credentials: 'include' });
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(response.status, errorMessage(body, response.status), body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function downloadPdf(encounterId: string): Promise<void> {
  const headers = new Headers();
  headers.set(CLIENT_HEADER, CLIENT_NAME);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API}/documents/encounters/${encounterId}/pdf`, { headers, credentials: 'include' });
  if (!response.ok) throw new ApiError(response.status, 'Não foi possível gerar a ficha');
  const url = URL.createObjectURL(await response.blob());
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

