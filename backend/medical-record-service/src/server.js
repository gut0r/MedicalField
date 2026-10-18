import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`medical-record-service ouvindo em http://127.0.0.1:${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} recebido; encerrando medical-record-service`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

