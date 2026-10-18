import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Trash2, Upload } from 'lucide-react';
import { db } from '../db';
import { useConnectivity } from '../connectivity';
import { discardInvalidOperation } from '../repositories/localRepository';
import { SyncFacade } from '../sync/SyncFacade';

export function SyncPage() {
  const network = useConnectivity();
  const pendingItems = useLiveQuery(() => db.outbox.orderBy('createdAt').toArray(), []) ?? [];
  const last = useLiveQuery(() => db.metadata.get('lastSuccessfulSync'), [])?.value as string | undefined;
  const history = useLiveQuery(() => db.syncHistory.orderBy('startedAt').reverse().limit(5).toArray(), []) ?? [];
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState((useLocation().state as { message?: string } | null)?.message ?? '');
  const facade = new SyncFacade();

  async function run(kind: 'download' | 'upload') {
    if (!network.effectiveOnline) {
      setResult('Sem conexão: nenhuma pendência foi enviada. Os dados continuam salvos neste dispositivo. Volte para Online e tente novamente.');
      return;
    }
    setBusy(kind);
    setResult('');
    try {
      const response = kind === 'download' ? await facade.download() : await facade.upload();
      const sent = 'sent' in response ? response.sent : 0;
      const received = 'received' in response ? response.received : 0;
      const detail = response.errors.map(friendlyError).join(' ');
      setResult(`Concluído: ${sent} enviados, ${received} recebidos, ${response.errors.length} erro(s).${detail ? ` ${detail}` : ''}`);
    } catch (caught) {
      setResult(caught instanceof Error ? caught.message : 'Falha');
    } finally {
      setBusy('');
    }
  }

  async function discard(operationId: string) {
    if (!window.confirm('Descartar este cadastro inválido do dispositivo? Esta ação não apaga outros dados.')) return;
    try {
      const discarded = await discardInvalidOperation(operationId);
      setResult(discarded ? 'Cadastro inválido descartado. Você já pode registrá-lo novamente.' : 'A pendência não pôde ser descartada.');
    } catch (caught) {
      setResult(caught instanceof Error ? caught.message : 'A pendência não pôde ser descartada.');
    }
  }

  return <section>
    <h1 className="text-2xl font-bold">Centro de Sincronização</h1>
    <p className="mb-5 text-slate-500">Pendências só são removidas depois da confirmação do servidor.</p>
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <div className="card"><p className="text-sm text-slate-500">Estado</p><p className="font-semibold">{network.label}</p></div>
      <div className="card"><p className="text-sm text-slate-500">Pendências</p><p className="font-semibold">{pendingItems.length}</p></div>
      <div className="card"><p className="text-sm text-slate-500">Última sincronização</p><p className="font-semibold">{last ? new Date(last).toLocaleString('pt-BR') : 'Nunca'}</p></div>
    </div>
    {result && <p className={`mb-4 rounded p-3 ${result.startsWith('Sem conexão') ? 'bg-amber-50 text-amber-900' : 'bg-slate-100'}`}>{result}</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <button className="btn-secondary py-4" disabled={!network.effectiveOnline || !!busy} onClick={() => run('download')}><Download />Baixar Dados</button>
      <button className="btn-secondary py-4" disabled={!!busy || pendingItems.length === 0} onClick={() => run('upload')}><Upload />Enviar Pendências</button>
    </div>
    {pendingItems.some(item => item.status === 'ERROR') && <div className="card mt-5">
      <h2 className="font-semibold">Pendências com erro</h2>
      {pendingItems.filter(item => item.status === 'ERROR').map(item => <div className="mt-3 border-t pt-3" key={item.operationId}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-medium">{entityLabel(item.entityType)} {item.entityId.slice(0, 8)}</p><p className="mt-1 text-sm text-red-700">{friendlyError(item.lastError)}</p></div>
          {(item.entityType === 'ENCOUNTER' || item.entityType === 'PATIENT') && <button className="btn-secondary" onClick={() => discard(item.operationId)}><Trash2 />Descartar inválido</button>}
        </div>
      </div>)}
    </div>}
    <div className="card mt-5"><h2 className="font-semibold">Histórico local</h2>{history.map(item => <div className="mt-2 flex justify-between border-t pt-2 text-sm" key={item.id}><span>{new Date(item.startedAt).toLocaleString('pt-BR')} • {item.status}</span><span>{item.sent} ↑ / {item.received} ↓</span></div>)}</div>
  </section>;
}

function friendlyError(raw?: string) {
  if (!raw) return 'Falha de sincronização sem detalhe.';
  try {
    const parsed = JSON.parse(raw) as { code?: string; issues?: Array<{ path?: Array<string | number> }> };
    if (parsed.code === 'VALIDATION_ERROR') {
      const fields = new Set((parsed.issues ?? []).map(issue => issue.path?.at(-1)).filter(Boolean));
      if (fields.has('temperatureCelsius') || fields.has('systolicPressure')) return 'Os sinais vitais possuem valores inválidos. Descarte este teste e registre novamente com valores dentro dos limites.';
      return 'Há campos inválidos no atendimento. Revise os dados antes de tentar novamente.';
    }
  } catch { /* A API pode retornar uma mensagem simples. */ }
  if (raw.includes('"path":"/patients"')) return 'Os dados do paciente foram recusados. Se estiver como Identificado, informe o tipo e o número do documento.';
  return raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
}

function entityLabel(entityType: string) {
  if (entityType === 'PATIENT') return 'Paciente';
  if (entityType === 'MEDICAL_RECORD') return 'Prontuário';
  return 'Atendimento';
}
