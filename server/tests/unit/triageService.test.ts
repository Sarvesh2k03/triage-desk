import { TriageService } from '../../src/ai/triageService';
import { TriageCache } from '../../src/ai/triageCache';
import type { TriageEngine } from '../../src/ai/triageEngine';

const TICKET = {
  title: 'Charged twice for May',
  description: 'My card was billed twice for the May invoice and I need a refund.',
};

const VALID_AI_RESPONSE = {
  category: 'billing' as const,
  priority: 'high' as const,
  summary: 'Customer was double-billed for May and is requesting a refund.',
};

/** Builds a service with a stub engine and a cache we control. */
function buildService(
  classify: TriageEngine['classify'],
  overrides: { wallClockMs?: number; cache?: TriageCache } = {},
) {
  const cache = overrides.cache ?? new TriageCache(60_000, 100);
  const engine: TriageEngine = { classify };
  const service = new TriageService({ engine, cache, wallClockMs: overrides.wallClockMs ?? 50 });
  return { service, cache, engine };
}

describe('TriageService', () => {
  describe('happy path', () => {
    it('returns the model classification tagged as source "ai"', async () => {
      const { service } = buildService(jest.fn().mockResolvedValue(VALID_AI_RESPONSE));

      const result = await service.triage(TICKET.title, TICKET.description);

      expect(result).toEqual({ ...VALID_AI_RESPONSE, source: 'ai' });
    });

    it('reports the AI path as enabled', () => {
      const { service } = buildService(jest.fn());
      expect(service.stats().aiEnabled).toBe(true);
    });
  });

  describe('caching', () => {
    it('serves a repeated ticket from cache without calling the model again', async () => {
      const classify = jest.fn().mockResolvedValue(VALID_AI_RESPONSE);
      const { service } = buildService(classify);

      await service.triage(TICKET.title, TICKET.description);
      const second = await service.triage(TICKET.title, TICKET.description);

      expect(classify).toHaveBeenCalledTimes(1);
      expect(second.source).toBe('ai');
    });

    it('treats whitespace and case differences as the same ticket', async () => {
      const classify = jest.fn().mockResolvedValue(VALID_AI_RESPONSE);
      const { service } = buildService(classify);

      await service.triage(TICKET.title, TICKET.description);
      await service.triage(`  ${TICKET.title.toUpperCase()} `, `${TICKET.description}   `);

      expect(classify).toHaveBeenCalledTimes(1);
    });

    it('calls the model again when the ticket text changes', async () => {
      const classify = jest.fn().mockResolvedValue(VALID_AI_RESPONSE);
      const { service } = buildService(classify);

      await service.triage(TICKET.title, TICKET.description);
      await service.triage(TICKET.title, 'A completely different problem description.');

      expect(classify).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the AI call fails', () => {
    it('falls back to the local classifier instead of rejecting', async () => {
      const { service } = buildService(jest.fn().mockRejectedValue(new Error('503 upstream')));

      const result = await service.triage(TICKET.title, TICKET.description);

      expect(result.source).toBe('fallback');
      expect(result.reason).toBe('Gemini service was unavailable');
      expect(result.category).toBe('billing');
      expect(result.priority).toBeDefined();
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('falls back when the model exceeds the wall-clock deadline', async () => {
      const classify = jest.fn(
        () => new Promise((resolve) => setTimeout(resolve, 5_000).unref?.()),
      );
      const { service } = buildService(classify, { wallClockMs: 20 });

      const result = await service.triage(TICKET.title, TICKET.description);

      expect(result.source).toBe('fallback');
      expect(result.reason).toBe('Gemini service was unavailable');
    });

    it('does not cache a fallback, so the next call retries the model', async () => {
      const classify = jest
        .fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce(VALID_AI_RESPONSE);
      const { service } = buildService(classify);

      const first = await service.triage(TICKET.title, TICKET.description);
      const second = await service.triage(TICKET.title, TICKET.description);

      expect(first.source).toBe('fallback');
      expect(second.source).toBe('ai');
      expect(classify).toHaveBeenCalledTimes(2);
    });
  });

  describe('when the AI returns something unusable', () => {
    it.each([
      ['a category outside the allowed set', { ...VALID_AI_RESPONSE, category: 'space_lasers' }],
      ['a priority outside the allowed set', { ...VALID_AI_RESPONSE, priority: 'apocalyptic' }],
      ['an empty summary', { ...VALID_AI_RESPONSE, summary: '' }],
      ['a missing field', { category: 'billing' }],
      ['null', null],
      ['a bare string', 'billing, high'],
    ])('falls back on %s', async (_label, payload) => {
      const { service } = buildService(jest.fn().mockResolvedValue(payload));

      const result = await service.triage(TICKET.title, TICKET.description);

      expect(result.source).toBe('fallback');
      expect(result.reason).toBe('Gemini response failed validation');
    });

    it('does not cache an invalid response', async () => {
      const classify = jest.fn().mockResolvedValue({ nonsense: true });
      const { service, cache } = buildService(classify);

      await service.triage(TICKET.title, TICKET.description);

      expect(cache.size).toBe(0);
    });
  });

  describe('when no engine is configured', () => {
    it('uses the local classifier and says so', async () => {
      const service = new TriageService({ engine: null, cache: new TriageCache(60_000, 10) });

      const result = await service.triage(TICKET.title, TICKET.description);

      expect(result.source).toBe('fallback');
      expect(result.reason).toBe('Gemini triage is not configured on this server');
    });

    it('reports the AI path as disabled', () => {
      const service = new TriageService({ engine: null });
      expect(service.stats()).toEqual({ aiEnabled: false, cacheSize: 0 });
    });

    it('defaults to no engine when the environment has no API key', () => {
      expect(new TriageService().stats().aiEnabled).toBe(false);
    });
  });
});
