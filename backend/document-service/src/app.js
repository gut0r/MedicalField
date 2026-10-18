import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import { auditMiddleware } from './audit.js';
import { config } from './config.js';
import { DocumentService } from './documentService.js';
import { SmtpMailAdapter } from './mail/smtpMailAdapter.js';
import { authenticate, requireClinicalOrAdmin } from './security.js';
import { openApi } from './openapi.js';

export const app = express();
const mailGateway = new SmtpMailAdapter(config.smtp);
const documents = new DocumentService(mailGateway);

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '100kb' }));
app.use(auditMiddleware);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApi, { customSiteTitle: 'MedicalField - Documentos' }));
app.get('/openapi.json', (_req, res) => res.json(openApi));
app.get('/internal/health', (_req, res) => res.json({ status: 'ok', service: 'document-service' }));
app.use(authenticate, requireClinicalOrAdmin);

app.get('/encounters/:id/pdf', async (req, res) => {
  const encounterId = z.string().uuid().parse(req.params.id);
  const { pdf } = await documents.loadAndBuild(encounterId, req.token, req.principal.professionalId);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="ficha-atendimento-${encounterId}.pdf"`,
    'Content-Length': String(pdf.length),
    'Cache-Control': 'no-store',
  }).send(pdf);
});

app.post('/encounters/:id/email', async (req, res) => {
  const encounterId = z.string().uuid().parse(req.params.id);
  const { recipient } = z.object({ recipient: z.email().max(254) }).parse(req.body);
  const result = await documents.send(encounterId, recipient, req.token, req.principal.professionalId);
  res.json({ accepted: true, messageId: result.messageId, providerResponse: result.response });
});

app.use((error, _req, res, _next) => {
  if (error?.name === 'ZodError') return res.status(422).json({ code: 'VALIDATION_ERROR', issues: error.issues });
  console.error('Erro no document-service', error);
  res.status(error.status ?? 502).json({ code: 'DOCUMENT_ERROR', message: error.message ?? 'Falha ao processar documento' });
});

