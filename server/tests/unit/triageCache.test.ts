import { TriageCache } from '../../src/ai/triageCache';
import type { TriageResult } from '../../src/types/ticket';

const value = (summary: string): TriageResult => ({
  category: 'bug',
  priority: 'high',
  summary,
  source: 'ai',
});

describe('TriageCache', () => {
  describe('keyFor', () => {
    it('produces the same key for text differing only in case or whitespace', () => {
      expect(TriageCache.keyFor('Login  broken', ' Cannot sign IN ')).toBe(
        TriageCache.keyFor('login broken', 'cannot sign in'),
      );
    });

    it('produces different keys for different text', () => {
      expect(TriageCache.keyFor('a', 'b')).not.toBe(TriageCache.keyFor('a', 'c'));
    });

    it('does not collide when the split between title and description moves', () => {
      expect(TriageCache.keyFor('ab', 'c')).not.toBe(TriageCache.keyFor('a', 'bc'));
    });
  });

  it('returns undefined for a key it has never seen', () => {
    expect(new TriageCache(1_000, 10).get('missing')).toBeUndefined();
  });

  it('stores and returns a value', () => {
    const cache = new TriageCache(1_000, 10);
    cache.set('k', value('stored'));
    expect(cache.get('k')?.summary).toBe('stored');
  });

  it('expires entries once the TTL has elapsed', () => {
    let now = 0;
    const cache = new TriageCache(1_000, 10, () => now);
    cache.set('k', value('stored'));

    now = 999;
    expect(cache.get('k')).toBeDefined();

    now = 1_000;
    expect(cache.get('k')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('evicts the least recently used entry when full', () => {
    const cache = new TriageCache(10_000, 2);
    cache.set('a', value('a'));
    cache.set('b', value('b'));
    cache.get('a'); // 'a' is now the most recently used, so 'b' should go.
    cache.set('c', value('c'));

    expect(cache.size).toBe(2);
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBeDefined();
  });

  it('overwrites rather than duplicating an existing key', () => {
    const cache = new TriageCache(10_000, 5);
    cache.set('k', value('first'));
    cache.set('k', value('second'));

    expect(cache.size).toBe(1);
    expect(cache.get('k')?.summary).toBe('second');
  });

  it('refreshes the TTL when a key is overwritten', () => {
    let now = 0;
    const cache = new TriageCache(1_000, 5, () => now);
    cache.set('k', value('first'));
    now = 900;
    cache.set('k', value('second'));
    now = 1_500;
    expect(cache.get('k')?.summary).toBe('second');
  });

  it('clears every entry', () => {
    const cache = new TriageCache(1_000, 5);
    cache.set('a', value('a'));
    cache.set('b', value('b'));
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
