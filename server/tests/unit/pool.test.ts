import { getPool, closePool, sslConfig } from '../../src/db/pool';

describe('sslConfig', () => {
  it.each(['postgres://u:p@localhost:5432/db', 'postgres://u:p@127.0.0.1:5432/db'])(
    'disables TLS for the local database %s',
    (url) => {
      expect(sslConfig(url)).toBeUndefined();
    },
  );

  it('enables TLS for a hosted database', () => {
    expect(sslConfig('postgres://u:p@ep-cool.neon.tech/db?sslmode=require')).toEqual({
      rejectUnauthorized: false,
    });
  });
});

describe('getPool', () => {
  afterEach(async () => {
    await closePool();
  });

  it('returns the same pool on repeated calls', () => {
    expect(getPool()).toBe(getPool());
  });

  it('creates a fresh pool after the previous one is closed', async () => {
    const first = getPool();
    await closePool();
    expect(getPool()).not.toBe(first);
  });

  it('is safe to close when no pool was ever created', async () => {
    await closePool();
    await expect(closePool()).resolves.toBeUndefined();
  });
});
