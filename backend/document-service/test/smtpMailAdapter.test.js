import test from 'node:test';
import assert from 'node:assert/strict';
import { SmtpMailAdapter } from '../src/mail/smtpMailAdapter.js';

test('adapter somente confirma quando SMTP aceita destinatário', async () => {
  const fakeTransport = { sendMail: async () => ({ messageId: 'm-1', accepted: ['destino@example.com'], rejected: [], response: '250 OK' }) };
  const adapter = new SmtpMailAdapter({ from: 'teste@example.com' }, fakeTransport);
  const result = await adapter.sendPdf({ to: 'destino@example.com', subject: 'Ficha', text: 'Anexo', filename: 'ficha.pdf', pdf: Buffer.from('%PDF') });
  assert.equal(result.messageId, 'm-1');
});

