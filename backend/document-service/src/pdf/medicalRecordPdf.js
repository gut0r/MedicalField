import PDFDocument from 'pdfkit';

function text(value) {
  return value == null || value === '' ? 'Não informado' : String(value);
}

function dateTime(value) {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function yesNo(value) {
  if (value == null) return 'Não informado';
  return value ? 'Sim' : 'Não';
}

function ensureSpace(doc, height = 80) {
  if (doc.y + height > doc.page.height - 55) doc.addPage();
}

function section(doc, title) {
  ensureSpace(doc, 55);
  doc.moveDown(0.6).fontSize(13).fillColor('#0f4c5c').text(title).fillColor('#111827').fontSize(10);
  doc.moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#d1d5db').stroke();
  doc.moveDown(0.5);
}

function line(doc, label, value) {
  ensureSpace(doc, 25);
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(text(value));
}

function vitalLine(vital) {
  return `${dateTime(vital.measured_at)} — PA ${text(vital.systolic_pressure)}/${text(vital.diastolic_pressure)} mmHg; `
    + `FC ${text(vital.heart_rate)} bpm; FR ${text(vital.respiratory_rate)} irpm; `
    + `SpO₂ ${text(vital.oxygen_saturation)}%; T ${text(vital.temperature_celsius)} °C; `
    + `consciência: ${text(vital.consciousness_level)}`;
}

function assessmentLine(assessment) {
  if ('total_score' in assessment) {
    return `Glasgow — ocular ${text(assessment.eye_score)}, verbal ${text(assessment.verbal_score)}, `
      + `motora ${text(assessment.motor_score)}, total ${text(assessment.total_score)}`;
  }
  if ('priority_level' in assessment) {
    return `Manchester — ${text(assessment.presentation)}; discriminador: ${text(assessment.discriminator)}; `
      + `cor ${text(assessment.color)}; prioridade ${text(assessment.priority_level)}; `
      + `tempo-alvo ${text(assessment.target_minutes)} min`;
  }
  return `START — anda: ${yesNo(assessment.can_walk)}; respiração espontânea: ${yesNo(assessment.spontaneous_breathing)}; `
    + `FR: ${text(assessment.respiratory_rate)}; pulso radial: ${yesNo(assessment.radial_pulse_present)}; `
    + `obedece comandos: ${yesNo(assessment.follows_simple_commands)}; categoria: ${text(assessment.category)}`;
}

function encounterSection(doc, encounter, index) {
  section(doc, `Atendimento ${index + 1} — ${dateTime(encounter.occurredAt)}`);
  line(doc, 'Identificador', encounter.id);
  line(doc, 'Ocorrência', encounter.occurrenceType);
  line(doc, 'Situação', encounter.status);
  line(doc, 'Profissional responsável', encounter.responsibleProfessionalId);
  line(doc, 'Descrição', encounter.description);
  line(doc, 'Observações', encounter.generalObservations);

  ensureSpace(doc, 40);
  doc.moveDown(0.3).font('Helvetica-Bold').text('Sinais vitais').font('Helvetica');
  if (!encounter.vitalSigns?.length) doc.text('Nenhum sinal vital registrado.');
  for (const vital of encounter.vitalSigns ?? []) {
    ensureSpace(doc, 35);
    doc.text(vitalLine(vital), { indent: 10 });
  }

  ensureSpace(doc, 40);
  doc.moveDown(0.3).font('Helvetica-Bold').text('Triagens').font('Helvetica');
  if (!encounter.assessments?.length) doc.text('Nenhuma triagem registrada.');
  for (const assessment of encounter.assessments ?? []) {
    ensureSpace(doc, 35);
    doc.text(assessmentLine(assessment), { indent: 10 });
  }

  ensureSpace(doc, 40);
  doc.moveDown(0.3).font('Helvetica-Bold').text('Medicamentos administrados').font('Helvetica');
  if (!encounter.medications?.length) doc.text('Nenhum medicamento registrado.');
  for (const medication of encounter.medications ?? []) {
    ensureSpace(doc, 30);
    doc.text(`${text(medication.medication_name_snapshot)} — ${text(medication.dose)} `
      + `${text(medication.dose_unit)} — ${dateTime(medication.administered_at)}`, { indent: 10 });
  }

  ensureSpace(doc, 40);
  doc.moveDown(0.3).font('Helvetica-Bold').text('Procedimentos').font('Helvetica');
  if (!encounter.procedures?.length) doc.text('Nenhum procedimento registrado.');
  for (const procedure of encounter.procedures ?? []) {
    ensureSpace(doc, 30);
    doc.text(`${dateTime(procedure.performed_at)} — ${text(procedure.description)}`, { indent: 10 });
  }
}

/** Gera uma visão consolidada do prontuário sem persistir o arquivo no servidor. */
export async function buildMedicalRecordPdf({ record, patient, encounters, issuer }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: `Prontuário ${record.recordNumber}`, Author: 'MedicalField' },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(20).fillColor('#0f4c5c').text('MedicalField', { align: 'center' });
    doc.fontSize(14).text('Prontuário Médico Consolidado', { align: 'center' });
    doc.moveDown().fillColor('#111827').fontSize(10);
    line(doc, 'Número do prontuário', record.recordNumber);
    line(doc, 'Situação', record.status);
    line(doc, 'Versão', record.version);
    line(doc, 'Data de emissão', dateTime(new Date()));
    line(doc, 'Emitido por', issuer);

    section(doc, 'Paciente');
    line(doc, 'Nome', patient.fullName);
    line(doc, 'Identificação', [patient.documentType, patient.documentNumber].filter(Boolean).join(' '));
    line(doc, 'Data de nascimento', patient.birthDate);
    line(doc, 'Contato', patient.phone);
    line(doc, 'Observações cadastrais', patient.notes);

    section(doc, 'Resumo do histórico');
    line(doc, 'Total de atendimentos', encounters.length);
    if (encounters.length) {
      const dates = encounters.map((item) => new Date(item.occurredAt).getTime()).filter(Number.isFinite);
      if (dates.length) {
        line(doc, 'Primeiro atendimento', dateTime(new Date(Math.min(...dates))));
        line(doc, 'Atendimento mais recente', dateTime(new Date(Math.max(...dates))));
      }
    }

    if (!encounters.length) {
      doc.moveDown().text('Este prontuário ainda não possui atendimentos registrados.');
    } else {
      encounters.forEach((encounter, index) => encounterSection(doc, encounter, index));
    }

    ensureSpace(doc, 30);
    doc.moveDown().fontSize(8).fillColor('#6b7280')
      .text(`Documento consolidado do prontuário ${record.recordNumber} gerado pelo MedicalField`, { align: 'center' });
    doc.end();
  });
}
