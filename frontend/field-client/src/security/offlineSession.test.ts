import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import type { Professional } from '../types';
import { isOfflineSecurityAvailable, saveOfflineSession, unlockOfflineSession } from './offlineSession';

const professional: Professional = {
  id: '10000000-0000-4000-8000-000000000003',
  displayName: 'Enf. Bruno Resgate',
  roles: ['ENFERMEIRO'],
};

describe('sessão offline', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('é desativada quando o navegador não oferece criptografia segura', () => {
    expect(isOfflineSecurityAvailable({})).toBe(false);
    expect(isOfflineSecurityAvailable({
      subtle: globalThis.crypto.subtle,
      getRandomValues: globalThis.crypto.getRandomValues,
    })).toBe(true);
  });

  it('usa as mesmas credenciais do acesso online sem armazenar a senha', async () => {
    await saveOfflineSession('cli', 'Cli@Medical26!', professional, 'offline-grant', '2099-01-01T00:00:00Z');

    await expect(unlockOfflineSession('CLI', 'Cli@Medical26!')).resolves.toEqual(professional);
    const stored = await db.offlineSessions.get('current');
    expect(JSON.stringify(stored)).not.toContain('Cli@Medical26!');
  });

  it('rejeita usuário ou senha divergentes', async () => {
    await saveOfflineSession('cli', 'Cli@Medical26!', professional, 'offline-grant', '2099-01-01T00:00:00Z');

    await expect(unlockOfflineSession('outro', 'Cli@Medical26!')).rejects.toThrow('Usuário ou senha offline inválidos');
    await expect(unlockOfflineSession('cli', 'senha-errada')).rejects.toThrow('Usuário ou senha offline inválidos');
  });
});
