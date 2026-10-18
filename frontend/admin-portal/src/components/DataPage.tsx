import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { JsonRecord } from '../types';

export function DataPage({ title, endpoint, columns, actions }: {
  title: string; endpoint: string; columns: Array<[string, string]>;
  actions?: (row: JsonRecord) => ReactNode;
}) {
  const [rows, setRows] = useState<JsonRecord[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { api<JsonRecord[]>(endpoint).then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [endpoint]);
  return <section>
    <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">{title}</h1><p className="text-slate-500">Dados consolidados no servidor central.</p></div>
    {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="card overflow-x-auto p-0">
      {loading ? <p className="p-5">Carregando...</p> : <table className="w-full text-left text-sm"><thead className="bg-slate-100 text-slate-600"><tr>
        {columns.map(([key, label]) => <th key={key} className="px-4 py-3">{label}</th>)}{actions && <th className="px-4 py-3">Ações</th>}
      </tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-t border-slate-100">
        {columns.map(([key]) => <td key={key} className="max-w-xs px-4 py-3">{format(row[key])}</td>)}{actions && <td className="px-4 py-3">{actions(row)}</td>}
      </tr>)}</tbody></table>}
      {!loading && !rows.length && <p className="p-5 text-slate-500">Nenhum registro encontrado.</p>}
    </div>
  </section>;
}

function format(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') return JSON.stringify(value);
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return new Date(raw).toLocaleString('pt-BR');
  return raw;
}

