import { Download, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { JsonRecord } from '../types';

interface LogsResult {
  items: JsonRecord[];
  total: number;
}

const PAGE_SIZE = 50;
const EXPORT_PAGE_SIZE = 200;

function cleanCell(value: unknown): string {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ');
}

function formatLogs(logs: JsonRecord[]): string {
  const header = ['Data', 'API', 'Profissional', 'Método', 'Rota', 'Status', 'ms'];
  const rows = logs.map((log) => [
    new Date(String(log.occurredAt)).toLocaleString('pt-BR'),
    log.service,
    log.professionalId || '—',
    log.method,
    log.route,
    log.status,
    log.processingMs,
  ].map(cleanCell).join('\t'));

  return [
    'MedicalField - Histórico de Logs',
    `Exportado em: ${new Date().toLocaleString('pt-BR')}`,
    `Total de registros: ${logs.length}`,
    '',
    header.join('\t'),
    ...rows,
  ].join('\r\n');
}

async function fetchLogs(page: number, size: number): Promise<LogsResult> {
  const query = new URLSearchParams({ page: String(page), size: String(size) });
  return api<LogsResult>(`/audit/logs?${query}`);
}

export function LogsPage() {
  const [logs, setLogs] = useState<JsonRecord[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<JsonRecord | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<'export' | 'clear' | null>(null);

  async function load(nextPage = 0) {
    try {
      const result = await fetchLogs(nextPage, PAGE_SIZE);
      setLogs(result.items);
      setTotal(result.total);
      setPage(nextPage);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao consultar auditoria');
    }
  }

  useEffect(() => { void load(0); }, []);

  async function saveAsText() {
    setBusy('export');
    setError('');
    setMessage('');
    try {
      const allLogs: JsonRecord[] = [];
      let nextPage = 0;
      let expectedTotal = 0;

      do {
        const result = await fetchLogs(nextPage, EXPORT_PAGE_SIZE);
        allLogs.push(...result.items);
        expectedTotal = result.total;
        nextPage += 1;
      } while (allLogs.length < expectedTotal);

      const blob = new Blob(['\uFEFF', formatLogs(allLogs)], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `medicalfield-logs-${timestamp}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage(`${allLogs.length} registros salvos no arquivo TXT.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar os logs');
    } finally {
      setBusy(null);
    }
  }

  async function clearLogs() {
    const confirmed = window.confirm(
      `Excluir permanentemente ${total} registro${total === 1 ? '' : 's'} de log? Esta ação não pode ser desfeita.`,
    );
    if (!confirmed) return;

    setBusy('clear');
    setError('');
    setMessage('');
    try {
      const result = await api<{ deleted: number }>('/audit/logs', { method: 'DELETE' });
      setLogs([]);
      setTotal(0);
      setPage(0);
      setSelected(null);
      setMessage(`${result.deleted} registro${result.deleted === 1 ? '' : 's'} removido${result.deleted === 1 ? '' : 's'}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível limpar os logs');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Histórico de Logs</h1>
          <p className="text-slate-500">Auditoria HTTP centralizada. Corpos, senhas e tokens não são armazenados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={total === 0 || busy !== null} onClick={() => void saveAsText()}>
            <Download size={18} aria-hidden="true" />
            {busy === 'export' ? 'Salvando...' : 'Salvar em TXT'}
          </button>
          <button
            className="btn border border-red-300 bg-white text-red-700 hover:bg-red-50"
            disabled={total === 0 || busy !== null}
            onClick={() => void clearLogs()}
          >
            <Trash2 size={18} aria-hidden="true" />
            {busy === 'clear' ? 'Limpando...' : 'Limpar logs'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {message && <p className="mb-4 rounded bg-emerald-50 p-3 text-emerald-800">{message}</p>}

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100">
            <tr>{['Data', 'API', 'Profissional', 'Método', 'Rota', 'Status', 'ms'].map((heading) => <th className="px-3 py-2" key={heading}>{heading}</th>)}</tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr className="cursor-pointer border-t hover:bg-slate-50" key={String(log.id)} onClick={() => setSelected(log)}>
                <td className="px-3 py-2">{new Date(String(log.occurredAt)).toLocaleString('pt-BR')}</td>
                <td className="px-3">{String(log.service)}</td>
                <td className="px-3">{String(log.professionalId || '—')}</td>
                <td className="px-3">{String(log.method)}</td>
                <td className="px-3">{String(log.route)}</td>
                <td className="px-3">{String(log.status)}</td>
                <td className="px-3">{String(log.processingMs)}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td className="px-3 py-10 text-center text-slate-500" colSpan={7}>Nenhum log registrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Página {page + 1} • {total} registros</p>
        <div className="flex gap-2">
          <button className="btn-secondary" disabled={page === 0} onClick={() => void load(page - 1)}>Anterior</button>
          <button className="btn-secondary" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => void load(page + 1)}>Próxima</button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex justify-between">
              <h2 className="font-semibold">Detalhes da requisição</h2>
              <button className="btn-secondary" onClick={() => setSelected(null)}>Fechar</button>
            </div>
            <pre className="overflow-auto rounded bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}
    </section>
  );
}
