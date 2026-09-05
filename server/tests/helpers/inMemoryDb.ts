import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newDb, type IMemoryDb } from 'pg-mem';
import type { Queryable } from '../../src/db/pool';

const SCHEMA_PATH = join(__dirname, '../../src/db/schema.sql');

export const readSchema = (): string => readFileSync(SCHEMA_PATH, 'utf8');

/**
 * Spins up an in-process Postgres and applies the real schema.sql.
 *
 * This is a genuine SQL engine, not a stub: the statements in
 * TicketRepository are parsed, planned and executed, so a typo in a column
 * name or a mismatched placeholder fails the test. It costs milliseconds and
 * needs no Docker, which keeps `npm test` runnable anywhere.
 */
export function createTestDb(): { db: IMemoryDb; queryable: Queryable } {
  const db = newDb();
  db.public.none(readSchema());

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();

  return { db, queryable: pool as unknown as Queryable };
}
