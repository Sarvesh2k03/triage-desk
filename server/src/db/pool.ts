import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env';

export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>>;
}

let pool: Pool | undefined;

export function sslConfig(connectionString: string) {
  const isLocal =
    connectionString.includes('@localhost') || connectionString.includes('@127.0.0.1');
  return isLocal ? undefined : { rejectUnauthorized: false };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: sslConfig(env.DATABASE_URL),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
