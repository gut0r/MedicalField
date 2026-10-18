import { useState, type FormEvent } from 'react';
import { FileHeart } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setLoading(true);
    try { await login(username, password); } catch (e) { setError(e instanceof Error ? e.message : 'Falha no login'); } finally { setLoading(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-4"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
    <div className="mb-8 text-center"><FileHeart className="mx-auto mb-3 text-teal-700" size={42}/><h1 className="text-2xl font-bold">MedicalField</h1><p className="text-slate-500">Portal Administrativo</p></div>
    {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <label className="label" htmlFor="username">Usuário</label><input id="username" className="field mb-4" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
    <label className="label" htmlFor="password">Senha</label><input id="password" type="password" className="field mb-6" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
    <button className="btn-primary w-full" disabled={loading}>{loading ? 'Autenticando...' : 'Entrar'}</button>
  </form></main>;
}

