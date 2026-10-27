import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

/** Consulta somente o IndexedDB; a tela continua funcional sem acesso a VM. */
export function LocalDataPage() {
  const encounters = useLiveQuery(() => db.encounters.orderBy('occurredAt').reverse().toArray(), []) ?? [];
  const medications = useLiveQuery(() => db.medications.orderBy('name').toArray(), []) ?? [];
  const patients = useLiveQuery(() => db.patients.filter((patient) => patient.active).toArray(), []) ?? [];
  const activePatientIds = new Set(patients.map((patient) => patient.id));
  const visibleEncounters = encounters.filter((encounter) => activePatientIds.has(encounter.patientId));
  const names = new Map(patients.map((patient) => [patient.id, patient.fullName]));
  const desktop = window.medicalFieldDesktop;
  return <section className="space-y-6">
    <div><h1 className="text-2xl font-bold">Dados no dispositivo</h1><p className="text-slate-500">Histórico e catálogo disponíveis offline.</p></div>
    {desktop && <div className="card"><h2 className="font-semibold">Armazenamento do aplicativo</h2><p className="mt-1 text-sm text-slate-600">Os dados clínicos deste dispositivo estão no IndexedDB local do aplicativo.</p><p className="mt-2 break-all rounded bg-slate-100 p-2 font-mono text-xs">{desktop.storagePath}</p><p className="mt-2 text-xs text-slate-500">Para inspecionar as tabelas, pressione <strong>{desktop.inspectShortcut}</strong> e abra Application → IndexedDB.</p></div>}
    <div><h2 className="mb-3 text-lg font-semibold">Atendimentos anteriores</h2><div className="space-y-3">{visibleEncounters.map((item) => <article className="card" key={item.id}><div className="flex flex-wrap justify-between gap-2"><div><strong>{names.get(item.patientId) ?? item.patientId}</strong><p className="text-sm text-slate-600">{item.occurrenceType} — {item.description}</p></div><time className="text-sm text-slate-500">{new Date(item.occurredAt).toLocaleString('pt-BR')}</time></div></article>)}</div>{!visibleEncounters.length && <p className="card text-slate-500">Nenhum atendimento foi sincronizado ou criado neste dispositivo.</p>}</div>
    <div><h2 className="mb-3 text-lg font-semibold">Medicamentos baixados</h2><div className="grid gap-3 sm:grid-cols-2">{medications.filter((item) => item.active).map((item) => <article className="card" key={item.id}><strong>{item.name}</strong><p className="text-sm text-slate-600">{item.activeIngredient || 'Princípio ativo não informado'} • {item.concentration || 'Sem concentração'}</p><p className="mt-1 text-xs text-slate-400">versão {item.version}</p></article>)}</div>{!medications.length && <p className="card text-slate-500">Use “Baixar dados” no Centro de Sincronização.</p>}</div>
  </section>;
}
