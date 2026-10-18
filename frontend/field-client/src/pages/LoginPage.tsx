import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useConnectivity } from '../connectivity';
import { isOfflineSecurityAvailable } from '../security/offlineSession';

export function LoginPage() {
  const { login, unlock } = useAuth();
  const network = useConnectivity();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const offlineAvailable = isOfflineSecurityAvailable();

  async function online(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao entrar');
    } finally {
      setBusy(false);
    }
  }

  async function offline() {
    setBusy(true);
    setError('');
    try {
      await unlock(username, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao entrar sem internet');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4">
      <form onSubmit={online} className="w-full max-w-md rounded-2xl bg-white p-7">
        <h1 className="text-2xl font-bold text-teal-800">MedicalField</h1>
        <p className="mb-6 text-slate-500">Cliente do Socorrista</p>
        {error && <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!offlineAvailable && (
          <p className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-800">
            Neste endereço HTTP, o acesso online funciona normalmente. O modo offline seguro exige localhost ou HTTPS.
          </p>
        )}

        <label className="label">Usuário</label>
        <input className="field mb-3" value={username} onChange={(event) => setUsername(event.target.value)} required />
        <label className="label">Senha</label>
        <input
          type="password"
          className="field mb-5"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />

        <button className="btn-primary w-full" disabled={busy || !network.effectiveOnline}>
          {busy ? 'Entrando...' : 'Entrar online'}
        </button>
        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />ou<span className="h-px flex-1 bg-slate-200" />
        </div>
        <button type="button" className="btn-secondary w-full" onClick={() => void offline()} disabled={busy || !offlineAvailable}>
          Entrar sem internet
        </button>
        <p className="mt-4 text-xs text-slate-500">
          {offlineAvailable
            ? 'O primeiro acesso exige internet. Depois, o mesmo usuário e senha desbloqueiam este dispositivo offline. A senha não é armazenada.'
            : 'Quando o site estiver em HTTPS, o mesmo usuário e senha poderão desbloquear este dispositivo sem internet.'}
        </p>
      </form>
    </main>
  );
}
