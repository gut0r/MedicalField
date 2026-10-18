import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { auditMiddleware } from './audit.js';
import { authenticate } from './security.js';
import { errorHandler } from './errors.js';
import { router } from './routes.js';
import { openApi } from './openapi.js';

export const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(auditMiddleware);

// A interface e o contrato podem ser lidos sem token; executar qualquer rota
// de negocio pelo botao "Try it out" continua exigindo Bearer JWT.
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApi, { customSiteTitle: 'MedicalField - Prontuarios' }));
app.get('/openapi.json', (_req, res) => res.json(openApi));

// A rota é publicada apenas em loopback pelo Nginx/systemd.
app.get('/internal/health', (_req, res) => res.json({ status: 'ok', service: 'medical-record-service' }));
app.use(authenticate);
app.use(router);
app.use(errorHandler);

