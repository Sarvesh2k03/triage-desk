import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPool, type Queryable } from './pool';
import { logger } from '../utils/logger';
import { seedDemoTickets } from './demoData';

export async function migrate(db: Queryable = getPool()): Promise<void> {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await db.query(sql);
  logger.info('database schema applied');
  await seedDemoTickets(db);
  logger.info('demo tickets ready');
}
