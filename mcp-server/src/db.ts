/**
 * Database connection and query helpers
 */

import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    pool = new Pool(config);

    pool.on('error', (err) => {
      process.stderr.write(`[db] Unexpected database error: ${err instanceof Error ? err.message : String(err)}\n`);
    });
  }

  return pool;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const client = getPool();
    const result = await client.query('SELECT 1');
    return result.rows.length === 1;
  } catch (error) {
    process.stderr.write(`[db] Database health check failed: ${error instanceof Error ? error.message : String(error)}\n`);
    return false;
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Safe query wrapper with error handling
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: Array<string | number | boolean | null | Date>
): Promise<T[]> {
  const client = getPool();
  const result = await client.query(text, params);
  return result.rows as T[];
}

/**
 * Transaction helper
 */
export async function transaction<T>(
  callback: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
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
