import { createHash } from 'node:crypto';
import type { TriageResult } from '../types/ticket';

interface Entry {
  value: TriageResult;
  expiresAt: number;
}

export class TriageCache {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number,
    private readonly now: () => number = Date.now,
  ) {}

  static keyFor(title: string, description: string): string {
    const normalised = `${title}\n${description}`.trim().toLowerCase().replace(/\s+/g, ' ');
    return createHash('sha256').update(normalised).digest('hex');
  }

  get(key: string): TriageResult | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: TriageResult): void {
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
