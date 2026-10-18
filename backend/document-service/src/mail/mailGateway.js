/** Porta interna que impede o domínio de documentos de depender diretamente do Nodemailer. */
export class MailGateway {
  async sendPdf(_message) { throw new Error('sendPdf precisa ser implementado'); }
}

