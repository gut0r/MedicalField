import { useLiveQuery } from 'dexie-react-hooks';
import { WandSparkles } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { connectivity } from '../connectivity';
import { db } from '../db';
import { createPatientDemo } from '../demo/patientDemo';
import { savePatient } from '../repositories/localRepository';
import { SyncFacade } from '../sync/SyncFacade';
import { createUuid } from '../uuid';

type IdentificationStatus = 'IDENTIFIED' | 'PROVISIONAL' | 'UNKNOWN';

export function PatientsPage() {
  const patients = useLiveQuery(() => db.patients.filter((patient) => patient.active).sortBy('fullName'), []) ?? [];
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [identificationStatus, setIdentificationStatus] = useState<IdentificationStatus>('PROVISIONAL');
  const formRef = useRef<HTMLFormElement>(null);
  const identified = identificationStatus === 'IDENTIFIED';

  function fillDemo() {
    const example = createPatientDemo();
    setMessage('');
    setIdentificationStatus('IDENTIFIED');
    window.setTimeout(() => {
      if (formRef.current) setFormValues(formRef.current, example);
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const data = new FormData(event.currentTarget);

    try {
      await savePatient({
        id: createUuid(),
        fullName: String(data.get('fullName')).trim(),
        identificationStatus,
        documentType: identified ? String(data.get('documentType')).trim() : undefined,
        documentNumber: identified ? String(data.get('documentNumber')).trim() : undefined,
        birthDate: String(data.get('birthDate')) || undefined,
        phone: String(data.get('phone')).trim() || undefined,
      });

      let resultMessage = 'Paciente salvo no dispositivo e aguardando envio.';
      if (connectivity.getSnapshot().effectiveOnline) {
        try {
          const result = await new SyncFacade().upload();
          resultMessage = result.errors.length
            ? 'Paciente salvo, mas existe uma pendência com erro no envio.'
            : 'Paciente enviado ao servidor com sucesso.';
        } catch {
          // A operação permanece pendente para uma nova tentativa.
        }
      }
      setMessage(resultMessage);
      setOpen(false);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Não foi possível salvar o paciente.');
    }
  }

  return <section>
    <div className="mb-5 flex items-center justify-between">
      <div><h1 className="text-2xl font-bold">Pacientes</h1><p className="text-slate-500">Pesquisa e cadastro funcionam sem internet.</p></div>
      <button className="btn-primary" onClick={() => setOpen(!open)}>Novo paciente</button>
    </div>
    {message && <p className="mb-4 rounded bg-teal-50 p-3 text-teal-800">{message}</p>}
    {open && <form ref={formRef} className="card mb-5 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
        <div><p className="font-semibold text-amber-950">Modo de demonstração</p><p className="text-sm text-amber-800">Gera dados fictícios válidos e editáveis.</p></div>
        <button type="button" className="btn-secondary bg-white" onClick={fillDemo}><WandSparkles />Preencher exemplo de teste</button>
      </div>
      <div className="sm:col-span-2"><label className="label">Nome completo</label><input name="fullName" className="field" required maxLength={180} /></div>
      <div><label className="label">Situação da identificação</label><select name="identificationStatus" className="field" value={identificationStatus} onChange={(event) => setIdentificationStatus(event.target.value as IdentificationStatus)}><option value="PROVISIONAL">Provisório</option><option value="IDENTIFIED">Identificado</option><option value="UNKNOWN">Desconhecido</option></select></div>
      <div><label className="label">Tipo de documento</label><input name="documentType" className="field" placeholder={identified ? 'CPF, RG...' : 'Não necessário'} required={identified} disabled={!identified} maxLength={30} /></div>
      <div><label className="label">Número do documento</label><input name="documentNumber" className="field" required={identified} disabled={!identified} maxLength={80} /></div>
      <div><label className="label">Nascimento</label><input name="birthDate" type="date" className="field" /></div>
      <div><label className="label">Telefone</label><input name="phone" className="field" maxLength={40} /></div>
      <div className="sm:col-span-2 flex gap-2"><button className="btn-primary">Salvar</button><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancelar</button></div>
    </form>}
    <div className="space-y-3">{patients.map((patient) => <article className="card" key={patient.id}><div className="flex justify-between"><div><h2 className="font-semibold">{patient.fullName}</h2><p className="text-sm text-slate-500">{patient.documentType} {patient.documentNumber}</p></div><span className="text-xs text-slate-400">v{patient.version}</span></div></article>)}</div>
    {!patients.length && <p className="card text-slate-500">Nenhum paciente local. Use Baixar Dados ou cadastre uma pessoa.</p>}
  </section>;
}

function setFormValues(form: HTMLFormElement, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) {
    const control = form.elements.namedItem(name);
    if (control instanceof HTMLInputElement) control.value = value;
  }
}
