import type { Express } from 'express';
import { createApp } from '../../src/app';
import { TriageCache } from '../../src/ai/triageCache';
import { TriageService } from '../../src/ai/triageService';
import type { TriageEngine } from '../../src/ai/triageEngine';
import { TokenBucket } from '../../src/middleware/rateLimit';
import { TicketRepository } from '../../src/repositories/ticketRepository';
import { TicketService } from '../../src/services/ticketService';
import { createTestDb } from './inMemoryDb';

export interface TestAppOptions {
  classify?: TriageEngine['classify'];
  triageBucket?: TokenBucket;
  wallClockMs?: number;
}

export function buildTestApp(options: TestAppOptions = {}): Express {
  const repository = new TicketRepository(createTestDb().queryable);
  const triageService = new TriageService({
    engine: options.classify ? { classify: options.classify } : null,
    cache: new TriageCache(60_000, 100),
    wallClockMs: options.wallClockMs ?? 100,
  });

  return createApp({
    ticketService: new TicketService(repository, triageService),
    triageBucket: options.triageBucket,
  });
}

export const VALID_TICKET = {
  title: 'Invoice export never finishes',
  description: 'Clicking export on the billing page spins forever and no file downloads.',
  requesterEmail: 'dana@example.com',
};
