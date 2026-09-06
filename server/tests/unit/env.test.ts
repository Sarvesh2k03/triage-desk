import { parseEnv, corsOrigins } from '../../src/config/env';

const MINIMUM = { DATABASE_URL: 'postgres://localhost/db' } as NodeJS.ProcessEnv;

describe('parseEnv', () => {
  it('applies defaults for everything that is optional', () => {
    const env = parseEnv(MINIMUM);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      GEMINI_MODEL: 'gemini-3.1-flash-lite',
      AI_REQUEST_TIMEOUT_MS: 15_000,
      AI_WALL_CLOCK_TIMEOUT_MS: 25_000,
    });
    expect(env.GEMINI_API_KEY).toBeUndefined();
  });

  it('parses numeric values into numbers, not strings', () => {
    const env = parseEnv({ ...MINIMUM, PORT: '8080', AI_CACHE_MAX_ENTRIES: '25' });
    expect(env.PORT).toBe(8080);
    expect(env.AI_CACHE_MAX_ENTRIES).toBe(25);
  });

  it.each([
    ['a non-numeric port', { PORT: 'eighty' }],
    ['a partially numeric value', { PORT: '80abc' }],
    ['a zero timeout', { AI_REQUEST_TIMEOUT_MS: '0' }],
    ['an unknown NODE_ENV', { NODE_ENV: 'staging' }],
    ['an empty DATABASE_URL', { DATABASE_URL: '' }],
  ])('refuses to start on %s', (_label, override) => {
    expect(() => parseEnv({ ...MINIMUM, ...override } as NodeJS.ProcessEnv)).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('names the offending variable in the error', () => {
    expect(() => parseEnv({ ...MINIMUM, PORT: 'nope' })).toThrow(/PORT/);
  });

  it('treats a blank API key the same as an absent one', () => {
    expect(parseEnv({ ...MINIMUM, GEMINI_API_KEY: '   ' }).GEMINI_API_KEY).toBeUndefined();
  });

  it('trims a supplied API key', () => {
    expect(parseEnv({ ...MINIMUM, GEMINI_API_KEY: ' gemini-key ' }).GEMINI_API_KEY).toBe('gemini-key');
  });
});

describe('corsOrigins', () => {
  it('splits a comma-separated list and trims each entry', () => {
    expect(corsOrigins('http://a.com, http://b.com')).toEqual(['http://a.com', 'http://b.com']);
  });

  it('passes through the wildcard', () => {
    expect(corsOrigins(' * ')).toBe('*');
  });

  it('drops empty entries', () => {
    expect(corsOrigins('http://a.com,,')).toEqual(['http://a.com']);
  });
});
