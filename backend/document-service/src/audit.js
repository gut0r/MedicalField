import crypto from 'node:crypto';
import { pool } from './db.js';

export function auditMiddleware(req, res, next) {
  const started = process.hrtime.bigint();
  const requestId = /^[0-9a-f-]{36}$/i.test(req.header('x-request-id') ?? '')
    ? req.header('x-request-id') : crypto.randomUUID();
  res.setHeader('X-Request-ID', requestId);
  res.on('finish', async () => {
    try {
      await pool.query(
        `INSERT INTO audit.http_request_logs
          (service_name,request_id,client_ip,professional_id,http_method,route,status_code,processing_ms)
         VALUES ('document-service',$1,$2,$3,$4,$5,$6,$7)`,
        [requestId, req.ip, req.principal?.professionalId ?? null, req.method,
          req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path, res.statusCode,
          Number((process.hrtime.bigint() - started) / 1_000_000n)],
      );
    } catch (error) {
      console.error(`Falha ao registrar auditoria requestId=${requestId}`, error.message);
    }
  });
  next();
}

