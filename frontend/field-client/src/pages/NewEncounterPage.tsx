import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { WandSparkles } from 'lucide-react';
import { connectivity } from '../connectivity';
import { db } from '../db';
import { createEncounterDemo } from '../demo/encounterDemo';
import { saveEncounter, saveMedicalRecord } from '../repositories/localRepository';
import { SyncFacade } from '../sync/SyncFacade';
import { validateVitalSigns } from '../validation/encounterValidation';
import { createUuid } from '../uuid';

type Protocol = 'GLASGOW' | 'MANCHESTER' | 'START';

export function NewEncounterPage() {
  const patients = useLiveQuery(() => db.patients.filter((item) => item.active).toArray(), []) ?? [];
  const records = useLiveQuery(() => db.medicalRecords.toArray(), []) ?? [];
  const medications = useLiveQuery(() => db.medications.filter((item) => item.active).toArray(), []) ?? [];
  const [protocol, setProtocol] = useState<Protocol>('GLASGOW');
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  function fillDemo() {
    try {
      const example = createEncounterDemo(patients.map(item => item.id), medications);
      setError('');
      setProtocol('GLASGOW');
      window.setTimeout(() => {
        if (formRef.current) setFormValues(formRef.current, example);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível gerar o exemplo.');
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      const patientId = String(form.get('patientId'));
      let record = records.find((item) => item.patientId === patientId && item.status === 'ACTIVE');
      if (!record) record = await saveMedicalRecord(patientId);

      const medicationId = String(form.get('medicationId'));
      const medication = medications.find((item) => item.id === medicationId);
      const dose = optionalNumber(form, 'dose');
      if (medication && (dose == null || dose <= 0)) throw new Error('Informe uma dose positiva para o medicamento.');

      const vitalSigns = validateVitalSigns({
        systolicPressure: optionalNumber(form, 'systolic'),
        diastolicPressure: optionalNumber(form, 'diastolic'),
        heartRate: optionalNumber(form, 'heartRate'),
        respiratoryRate: optionalNumber(form, 'respiratoryRate'),
        oxygenSaturation: optionalNumber(form, 'oxygen'),
        temperatureCelsius: optionalNumber(form, 'temperature'),
      });

      const encounter = await saveEncounter({
        id: createUuid(), medicalRecordId: record.id, patientId,
        occurredAt: new Date(String(form.get('occurredAt'))).toISOString(),
        occurrenceType: String(form.get('occurrenceType')), description: String(form.get('description')),
        generalObservations: value(form, 'observations'),
        vitalSigns: [{ id: createUuid(), measuredAt: new Date().toISOString(),
          ...vitalSigns, consciousnessLevel: value(form, 'consciousness') }],
        assessments: [assessmentFrom(form, protocol)],
        medications: medication ? [{ id: createUuid(), medicationId: medication.id,
          medicationName: medication.name, concentration: medication.concentration, dose,
          doseUnit: String(form.get('doseUnit')), route: value(form, 'medicationRoute'),
          administeredAt: new Date(String(form.get('administeredAt'))).toISOString(),
          notes: value(form, 'medicationNotes') }] : [],
        procedures: value(form, 'procedure') ? [{ id: createUuid(), code: value(form, 'procedureCode'),
          description: String(form.get('procedure')), performedAt: new Date().toISOString(),
          notes: value(form, 'procedureNotes') }] : [],
      });

      let message = `Atendimento ${encounter.id.slice(0, 8)} salvo no dispositivo e aguardando envio.`;
      if (connectivity.getSnapshot().effectiveOnline) {
        try {
          const result = await new SyncFacade().upload();
          message = result.errors.length
            ? `Atendimento ${encounter.id.slice(0, 8)} salvo, mas permaneceu pendente por erro no envio.`
            : `Atendimento ${encounter.id.slice(0, 8)} enviado ao servidor com sucesso.`;
        } catch {
          // A operação permanece na outbox para uma tentativa posterior.
        }
      }
      navigate('/sync', { state: { message } });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Falha ao salvar'); }
  }

  return <section>
    <h1 className="text-2xl font-bold">Registrar atendimento</h1>
    <p className="mb-5 text-slate-500">A gravação ocorre primeiro no banco local.</p>
    {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
    <div className="card mb-5 flex flex-wrap items-center justify-between gap-4 border border-amber-300 bg-amber-50">
      <div><p className="font-semibold text-amber-950">Modo de demonstração</p><p className="text-sm text-amber-800">Preenche o formulário com dados fictícios e válidos. Revise antes de salvar.</p></div>
      <button type="button" className="btn-secondary bg-white" disabled={!patients.length} onClick={fillDemo}><WandSparkles />Preencher exemplo de teste</button>
    </div>
    <form ref={formRef} onSubmit={submit} className="space-y-5">
      <fieldset className="card grid gap-3 sm:grid-cols-2"><legend className="px-2 font-semibold">Ocorrência</legend>
        <Field label="Paciente"><select name="patientId" className="field" required><option value="">Selecione</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></Field>
        <Field label="Data e hora"><input name="occurredAt" type="datetime-local" className="field" required defaultValue={localDateTime()} /></Field>
        <Field label="Tipo"><input name="occurrenceType" className="field" required placeholder="Queda, colisão..." /></Field>
        <div className="sm:col-span-2"><Field label="Descrição"><textarea name="description" className="field" required rows={3} /></Field></div>
      </fieldset>

      <fieldset className="card grid gap-3 sm:grid-cols-3"><legend className="px-2 font-semibold">Sinais vitais</legend>
        {[
          { name: 'systolic', label: 'PA sistólica', min: 20, max: 350, step: 1 },
          { name: 'diastolic', label: 'PA diastólica', min: 10, max: 250, step: 1 },
          { name: 'heartRate', label: 'Frequência cardíaca', min: 0, max: 300, step: 1 },
          { name: 'respiratoryRate', label: 'Frequência respiratória', min: 0, max: 150, step: 1 },
          { name: 'oxygen', label: 'Saturação O₂', min: 0, max: 100, step: 0.1 },
          { name: 'temperature', label: 'Temperatura', min: 20, max: 50, step: 0.1 },
        ].map(({ name, label, min, max, step }) => <Field label={label} key={name}><input name={name} type="number" min={min} max={max} step={step} className="field" /></Field>)}
        <div className="sm:col-span-3"><Field label="Nível de consciência"><input name="consciousness" maxLength={100} className="field" /></Field></div>
      </fieldset>

      <fieldset className="card grid gap-3 sm:grid-cols-3"><legend className="px-2 font-semibold">Triagem</legend>
        <Field label="Protocolo"><select name="protocol" className="field" value={protocol} onChange={(event) => setProtocol(event.target.value as Protocol)}><option value="GLASGOW">Glasgow</option><option value="MANCHESTER">Manchester</option><option value="START">START</option></select></Field>
        {protocol === 'GLASGOW' && <GlasgowFields />}{protocol === 'MANCHESTER' && <ManchesterFields />}{protocol === 'START' && <StartFields />}
        <div className="sm:col-span-3"><Field label="Observação da triagem"><input name="triageNotes" className="field" /></Field></div>
      </fieldset>

      <fieldset className="card grid gap-3 sm:grid-cols-2"><legend className="px-2 font-semibold">Medicação e procedimentos</legend>
        <Field label="Medicamento"><select name="medicationId" className="field"><option value="">Nenhum</option>{medications.map((item) => <option value={item.id} key={item.id}>{item.name} {item.concentration}</option>)}</select></Field>
        <Field label="Dose e unidade"><div className="flex gap-2"><input name="dose" type="number" step="0.001" className="field" /><input name="doseUnit" className="field" placeholder="mL, mg..." /></div></Field>
        <Field label="Via"><input name="medicationRoute" className="field" placeholder="IV, oral..." /></Field>
        <Field label="Horário da administração"><input name="administeredAt" type="datetime-local" className="field" defaultValue={localDateTime()} /></Field>
        <div className="sm:col-span-2"><Field label="Observação da medicação"><input name="medicationNotes" className="field" /></Field></div>
        <Field label="Código do procedimento"><input name="procedureCode" className="field" /></Field><Field label="Procedimento realizado"><input name="procedure" className="field" /></Field>
        <div className="sm:col-span-2"><Field label="Observação do procedimento"><input name="procedureNotes" className="field" /></Field></div>
        <div className="sm:col-span-2"><Field label="Observações gerais"><textarea name="observations" className="field" rows={2} /></Field></div>
      </fieldset>
      <button className="btn-primary w-full sm:w-auto">Salvar atendimento</button>
    </form>
  </section>;
}

function GlasgowFields() { return <><Score name="eyeScore" label="Resposta ocular" values={[4,3,2,1]} /><Score name="verbalScore" label="Resposta verbal" values={[5,4,3,2,1]} /><Score name="motorScore" label="Resposta motora" values={[6,5,4,3,2,1]} /><Field label="Ocular não testável — motivo"><input name="eyeNotTestableReason" className="field" /></Field><Field label="Verbal não testável — motivo"><input name="verbalNotTestableReason" className="field" /></Field><Field label="Motora não testável — motivo"><input name="motorNotTestableReason" className="field" /></Field></>; }
function ManchesterFields() { return <><Field label="Apresentação"><input name="presentation" className="field" required /></Field><Field label="Discriminador"><input name="discriminator" className="field" /></Field><Field label="Prioridade"><select name="priorityLevel" className="field">{[1,2,3,4,5].map((item)=><option key={item}>{item}</option>)}</select></Field><Field label="Cor"><select name="color" className="field"><option>RED</option><option>ORANGE</option><option>YELLOW</option><option>GREEN</option><option>BLUE</option></select></Field><Field label="Tempo-alvo (min)"><select name="targetMinutes" className="field">{[0,10,60,120,240].map((item)=><option key={item}>{item}</option>)}</select></Field></>; }
function StartFields() { return <><BooleanField name="canWalk" label="Consegue caminhar?" /><BooleanField name="spontaneousBreathing" label="Respira espontaneamente?" /><BooleanField name="breathingAfterAirwayOpening" label="Respira após abrir via aérea?" /><Field label="Frequência respiratória"><input name="startRespiratoryRate" type="number" min="0" max="150" className="field" /></Field><BooleanField name="radialPulsePresent" label="Pulso radial presente?" /><Field label="Enchimento capilar (s)"><input name="capillaryRefillSeconds" type="number" min="0" max="30" step="0.1" className="field" /></Field><BooleanField name="followsSimpleCommands" label="Obedece a comandos simples?" /><Field label="Categoria registrada"><select name="startCategory" className="field"><option>GREEN</option><option>YELLOW</option><option>RED</option><option>BLACK</option></select></Field></>; }

function assessmentFrom(form: FormData, protocol: Protocol): Record<string, unknown> {
  const common = { protocol, assessedAt: new Date().toISOString(), notes: value(form, 'triageNotes') };
  if (protocol === 'GLASGOW') { const eye = value(form,'eyeNotTestableReason'); const verbal = value(form,'verbalNotTestableReason'); const motor = value(form,'motorNotTestableReason'); return { ...common, eyeScore: eye ? null : Number(form.get('eyeScore')), verbalScore: verbal ? null : Number(form.get('verbalScore')), motorScore: motor ? null : Number(form.get('motorScore')), eyeNotTestableReason: eye, verbalNotTestableReason: verbal, motorNotTestableReason: motor }; }
  if (protocol === 'MANCHESTER') return { ...common, presentation: String(form.get('presentation')), discriminator: value(form,'discriminator'), priorityLevel: Number(form.get('priorityLevel')), color: String(form.get('color')), targetMinutes: Number(form.get('targetMinutes')) };
  return { ...common, canWalk: optionalBoolean(form,'canWalk'), spontaneousBreathing: optionalBoolean(form,'spontaneousBreathing'), breathingAfterAirwayOpening: optionalBoolean(form,'breathingAfterAirwayOpening'), respiratoryRate: optionalNumber(form,'startRespiratoryRate'), radialPulsePresent: optionalBoolean(form,'radialPulsePresent'), capillaryRefillSeconds: optionalNumber(form,'capillaryRefillSeconds'), followsSimpleCommands: optionalBoolean(form,'followsSimpleCommands'), category: String(form.get('startCategory')) };
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span className="label">{label}</span>{children}</label>; }
function Score({ name, label, values }: { name:string; label:string; values:number[] }) { return <Field label={label}><select name={name} className="field">{values.map((item)=><option key={item}>{item}</option>)}</select></Field>; }
function BooleanField({ name, label }: { name:string; label:string }) { return <Field label={label}><select name={name} className="field"><option value="">Não informado</option><option value="true">Sim</option><option value="false">Não</option></select></Field>; }
function value(form: FormData, key:string) { const raw=String(form.get(key)??'').trim(); return raw||undefined; }
function optionalNumber(form: FormData, key:string) { const raw=String(form.get(key)??''); return raw===''?null:Number(raw); }
function optionalBoolean(form: FormData, key:string) { const raw=String(form.get(key)??''); return raw===''?null:raw==='true'; }
function localDateTime() { return new Date(Date.now()-new Date().getTimezoneOffset()*60_000).toISOString().slice(0,16); }
function setFormValues(form: HTMLFormElement, values: Record<string,string>) {
  for (const [name, value] of Object.entries(values)) {
    const control = form.elements.namedItem(name);
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) control.value = value;
  }
}
