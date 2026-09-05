import { migrate } from '../../src/db/migrate';
import type { Queryable } from '../../src/db/pool';
import { readSchema } from '../helpers/inMemoryDb';

describe('migrate', () => {
  it('executes the schema against the supplied database', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    await migrate({ query } as unknown as Queryable);

    const sql: string = query.mock.calls[0]![0];
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS tickets');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS tickets_created_at_idx');
  });

  it('guards every DDL statement so re-running the schema is safe', () => {
    // index.ts applies the schema on every boot, so each statement must be
    // idempotent. (Asserted on the SQL text rather than by executing it
    // twice: pg-mem does not implement the IF NOT EXISTS no-op path.)
    const statements = readSchema()
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    expect(statements).toHaveLength(4); // one table, three indexes
    for (const statement of statements) {
      expect(statement).toMatch(/^CREATE (TABLE|INDEX) IF NOT EXISTS/);
    }
  });

  it('propagates a database failure so a bad deploy fails loudly', async () => {
    const query = jest.fn().mockRejectedValue(new Error('permission denied'));
    await expect(migrate({ query } as unknown as Queryable)).rejects.toThrow('permission denied');
  });
});
