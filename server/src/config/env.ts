import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ quiet: true });

const positiveInt = (fallback: number) =>
  z
    .string()
    .default(String(fallback))
    .refine((raw) => /^\d+$/.test(raw), 'must be a whole number')
    .transform(Number)
    .refine((n) => n > 0, 'must be greater than zero');

const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: positiveInt(4000),
  DATABASE_URL: z.string().min(1).default('postgres://triage:triage@localhost:5432/triage'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  GEMINI_API_KEY: optionalSecret,
  GEMINI_MODEL: z.string().min(1).default('gemini-3.7-flash'),
  AI_REQUEST_TIMEOUT_MS: positiveInt(8_000),
  AI_WALL_CLOCK_TIMEOUT_MS: positiveInt(20_000),
  AI_CACHE_TTL_MS: positiveInt(15 * 60_000),
  AI_CACHE_MAX_ENTRIES: positiveInt(500),
  AI_RATE_LIMIT_CAPACITY: positiveInt(10),
  AI_RATE_LIMIT_REFILL_PER_MIN: positiveInt(10),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

export const env = parseEnv();

export const isAiConfigured = (): boolean => env.GEMINI_API_KEY !== undefined;

export function corsOrigins(value: string = env.CORS_ORIGIN): string[] | '*' {
  if (value.trim() === '*') return '*';
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
