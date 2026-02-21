import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`[db] Slow query (${duration}ms):`, text.slice(0, 80));
  }
  return result;
}

export async function getClient() {
  return pool.connect();
}

export async function close() {
  await pool.end();
}

export default { query, getClient, close };
