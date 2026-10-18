import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

// O pool é propositalmente pequeno: os seis serviços compartilham a mesma VM.
export const pool = new Pool({ connectionString: config.databaseUrl, max: 5 });

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

