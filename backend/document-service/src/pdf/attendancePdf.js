import PDFDocument from 'pdfkit';

function text(value) {
  return value == null || value === '' ? 'Não informado' : String(value);
}

function dateTime(value) {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function section(doc, title) {
  if (doc.y > 700) doc.addPage();
  doc.moveDown(0.6).fontSize(13).fillColor('#0f4c5c').text(title).fillColor('#111827').fontSize(10);
  doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#d1d5db').stroke();
  doc.moveDown(0.5);
}

function line(doc, label, value) {
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(text(value));
}

/** Gera o PDF em memória; nenhum documento clínico é armazenado desnecessariamente. */
export async function buildAttendancePdf({ encounter, patient, issuer }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: `Ficha ${encounter.id}`, Author: 'MedicalField' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).fillColor('#0f4c5c').text('MedicalField', { align: 'center' });
    doc.fontSize(14).text('Prontuário Médico de Emergência', { align: 'center' });
    doc.moveDown().fillColor('#111827').fontSize(10);
    line(doc, 'Número do atendimento', encounter.id);
    line(doc, 'Data de emissão', dateTime(new Date()));
    line(doc, 'Emitido por', issuer);

    section(doc, 'Paciente');
    line(doc, 'Nome', patient.fullName);
    line(doc, 'Identificação', [patient.documentType, patient.documentNumber].filter(Boolean).join(' '));
    line(doc, 'Data de nascimento', patient.birthDate);

    section(doc, 'Ocorrência');
    line(doc, 'Data e hora', dateTime(encounter.occurredAt));
    line(doc, 'Tipo', encounter.occurrenceType);
    line(doc, 'Descrição', encounter.description);
    line(doc, 'Profissional responsável', encounter.responsibleProfessionalId);

    section(doc, 'Avaliação');
    if (!encounter.vitalSigns?.length) doc.text('Nenhum sinal vital registrado.');
    for (const vital of encounter.vitalSigns ?? []) {
      doc.text(`${dateTime(vital.measured_at)} — PA ${text(vital.systolic_pressure)}/${text(vital.diastolic_pressure)} mmHg; `
        + `FC ${text(vital.heart_rate)} bpm; FR ${text(vital.respiratory_rate)} irpm; `
        + `SpO₂ ${text(vital.oxygen_saturation)}%; T ${text(vital.temperature_celsius)} °C`);
    }
    for (const assessment of encounter.assessments ?? []) {
      if ('total_score' in assessment) line(doc, 'Glasgow', assessment.total_score ?? 'Componente não testável');
      else if ('priority_level' in assessment) line(doc, 'Manchester', `${assessment.color} — prioridade ${assessment.priority_level}`);
      else if ('category' in assessment) line(doc, 'START', assessment.category);
    }

    section(doc, 'Medicamentos administrados');
    if (!encounter.medications?.length) doc.text('Nenhum medicamento registrado.');
    for (const med of encounter.medications ?? []) {
      doc.text(`${text(med.medication_name_snapshot)} — ${text(med.dose)} ${text(med.dose_unit)} — ${dateTime(med.administered_at)}`);
    }

    section(doc, 'Procedimentos');
    if (!encounter.procedures?.length) doc.text('Nenhum procedimento registrado.');
    for (const procedure of encounter.procedures ?? []) {
      doc.text(`${dateTime(procedure.performed_at)} — ${text(procedure.description)}`);
    }

    section(doc, 'Observações');
    doc.text(text(encounter.generalObservations));

    const bottom = doc.page.height - 45;
    doc.fontSize(8).fillColor('#6b7280').text(`Documento ${encounter.id} gerado pelo MedicalField`, 50, bottom, { align: 'center', width: 495 });
    doc.end();
  });
}

