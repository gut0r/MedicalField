import crypto from 'node:crypto';
import { pool } from './db.js';
import { config } from './config.js';

export function auditMiddleware(req, res, next) {
  const started = process.hrtime.bigint();
  const supplied = req.header('x-request-id');
  const requestId = supplied && /^[0-9a-f-]{36}$/i.test(supplied) ? supplied : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.on('finish', async () => {
    const elapsed = Number((process.hrtime.bigint() - started) / 1_000_000n);
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    try {
      await pool.query(
        `INSERT INTO audit.http_request_logs
           (service_name,request_id,client_ip,professional_id,http_method,route,status_code,processing_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          config.serviceName,
          requestId,
          req.ip,
          req.principal?.professionalId ?? null,
          req.method,
          route,
          res.statusCode,
          elapsed,
        ],
      );
    } catch (error) {
      console.error(`Falha ao persistir auditoria requestId=${requestId}`, error.message);
    }
  });
  next();
}

