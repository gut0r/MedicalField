import nodemailer from 'nodemailer';
import { MailGateway } from './mailGateway.js';

/**
 * Adapter Pattern: converte o contrato simples do MedicalField no contrato do
 * Nodemailer. Em testes, outro adapter pode substituir o SMTP sem alterar a regra.
 */
export class SmtpMailAdapter extends MailGateway {
  constructor(smtpConfig, transporter) {
    super();
    this.config = smtpConfig;
    this.transporter = transporter ?? nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: { user: smtpConfig.user, pass: smtpConfig.password },
    });
  }

  async verify() { return this.transporter.verify(); }

  async sendPdf({ to, subject, text, filename, pdf }) {
    const info = await this.transporter.sendMail({
      from: this.config.from,
      to,
      subject,
      text,
      attachments: [{ filename, content: pdf, contentType: 'application/pdf' }],
    });
    if (!info.accepted?.length) throw new Error(`SMTP não aceitou o destinatário: ${info.response ?? 'sem detalhe'}`);
    return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, response: info.response };
  }
}

