import crypto from 'node:crypto';
import { config } from './config.js';
import { pool } from './db.js';
import { authenticatedJson } from './http.js';
import { buildAttendancePdf } from './pdf/attendancePdf.js';

export class DocumentService {
  constructor(mailGateway) { this.mailGateway = mailGateway; }

  async loadAndBuild(encounterId, token, issuer) {
    const encounter = await authenticatedJson(`${config.medicalRecordServiceUrl}/encounters/${encounterId}`, token);
    const patient = await authenticatedJson(`${config.patientServiceUrl}/patients/${encounter.patientId}`, token);
    const pdf = await buildAttendancePdf({ encounter, patient, issuer });
    await this.#event(encounterId, issuer, 'GENERATED');
    return { pdf, encounter, patient };
  }

  async send(encounterId, recipient, token, professionalId) {
    const { pdf, patient } = await this.loadAndBuild(encounterId, token, professionalId);
    try {
      const result = await this.mailGateway.sendPdf({
        to: recipient,
        subject: `Ficha de atendimento MedicalField — ${patient.fullName}`,
        text: 'Segue em anexo a ficha de atendimento solicitada. Este e-mail contém informações confidenciais.',
        filename: `ficha-atendimento-${encounterId}.pdf`,
        pdf,
      });
      await this.#event(encounterId, professionalId, 'EMAIL_ACCEPTED', recipient, result.messageId, result);
      return result;
    } catch (error) {
      await this.#event(encounterId, professionalId, 'EMAIL_REJECTED', recipient, null, { error: error.message });
      throw error;
    }
  }

  async #event(encounterId, professionalId, action, recipient, messageId, details = {}) {
    const recipientHash = recipient ? crypto.createHash('sha256').update(recipient.toLowerCase()).digest('hex') : null;
    await pool.query(
      `INSERT INTO audit.document_events
        (encounter_id,professional_id,action,recipient_hash,provider_message_id,details)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [encounterId, professionalId, action, recipientHash, messageId, JSON.stringify(details)],
    );
  }
}

