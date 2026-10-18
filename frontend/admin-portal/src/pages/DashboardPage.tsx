import { useEffect, useState } from 'react';
import { api } from '../api';

export function DashboardPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => { Promise.all([
    api<Array<{ id: string }>>('/patients'), api<Array<{ patientId: string }>>('/medical-records'), api<unknown[]>('/encounters'), api<unknown[]>('/medications'),
  ]).then(([patients, records, encounters, meds]) => {
    const activePatientIds = new Set(patients.map(patient => patient.id));
    const activeRecords = records.filter(record => activePatientIds.has(record.patientId));
    setCounts({ Pacientes: patients.length, Prontuários: activeRecords.length, Atendimentos: encounters.length, Medicamentos: meds.length });
  }); }, []);
  return <section><h1 className="mb-1 text-2xl font-bold">Visão geral</h1><p className="mb-6 text-slate-500">Indicadores atuais do servidor central.</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(counts).map(([label, value]) => <div className="card" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold text-teal-800">{value}</p></div>)}</div>
  </section>;
}

