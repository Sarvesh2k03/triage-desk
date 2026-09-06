import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPool, type Queryable } from './pool';
import { logger } from '../utils/logger';
import { seedDemoTickets } from './demoData';

function schemaPath(): string {
  const paths = [
    join(__dirname, 'schema.sql'),
    join(process.cwd(), 'server/src/db/schema.sql'),
    join(process.cwd(), 'server/dist/db/schema.sql'),
  ];
  const found = paths.find((path) => existsSync(path));
  if (!found) throw new Error('schema.sql was not found');
  return found;
}

export async function migrate(db: Queryable = getPool()): Promise<void> {
  const sql = readFileSync(schemaPath(), 'utf8');
  await db.query(sql);
  logger.info('database schema applied');
  await seedDemoTickets(db);
  logger.info('demo tickets ready');
}
