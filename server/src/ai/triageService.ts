import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { TriageResult } from '../types/ticket';
import { classifyLocally } from './fallbackClassifier';
import { TriageCache } from './triageCache';
import { createTriageEngine } from './geminiTriageEngine';
import type { TriageEngine } from './triageEngine';
import { triageOutputSchema } from './triageSchema';

export interface TriageServiceOptions {
  engine?: TriageEngine | null;
  cache?: TriageCache;
  wallClockMs?: number;
}

function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} exceeded ${ms}ms`)), ms);
    timer.unref?.();
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

export class TriageService {
  private readonly engine: TriageEngine | null;
  private readonly cache: TriageCache;
  private readonly wallClockMs: number;

  constructor(options: TriageServiceOptions = {}) {
    this.engine = options.engine !== undefined ? options.engine : createTriageEngine();
    this.cache = options.cache ?? new TriageCache(env.AI_CACHE_TTL_MS, env.AI_CACHE_MAX_ENTRIES);
    this.wallClockMs = options.wallClockMs ?? env.AI_WALL_CLOCK_TIMEOUT_MS;
  }

  async triage(title: string, description: string): Promise<TriageResult> {
    const key = TriageCache.keyFor(title, description);
    const cached = this.cache.get(key);

    if (cached) {
      logger.info('triage cache hit');
      return cached;
    }

    if (!this.engine) {
      return classifyLocally(title, description, 'Gemini triage is not configured on this server');
    }

    let raw: unknown;
    try {
      raw = await withDeadline(
        this.engine.classify({ title, description }),
        this.wallClockMs,
        'Gemini triage',
      );
    } catch (error) {
      logger.warn('Gemini triage failed - using local classifier', { error: String(error) });
      return classifyLocally(title, description, 'Gemini service was unavailable');
    }

    const parsed = triageOutputSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn('Gemini triage returned an unusable payload - using local classifier', {
        issues: parsed.error.issues.map((issue) => issue.path.join('.') || 'root'),
      });
      return classifyLocally(title, description, 'Gemini response failed validation');
    }

    const result: TriageResult = { ...parsed.data, source: 'ai' };
    this.cache.set(key, result);
    return result;
  }

  stats(): { aiEnabled: boolean; cacheSize: number } {
    return { aiEnabled: this.engine !== null, cacheSize: this.cache.size };
  }
}
