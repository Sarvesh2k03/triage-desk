import { TicketService } from '../../src/services/ticketService';
import { TicketRepository } from '../../src/repositories/ticketRepository';
import { TriageService } from '../../src/ai/triageService';
import { TriageCache } from '../../src/ai/triageCache';
import { AppError } from '../../src/errors/AppError';
import { createTestDb } from '../helpers/inMemoryDb';
import type { TriageEngine } from '../../src/ai/triageEngine';
import type { CreateTicketInput } from '../../src/types/ticket';

const INPUT: CreateTicketInput = {
  title: 'Payment failed at checkout',
  description: 'The card form returns "declined" for a card that works elsewhere.',
  requesterEmail: 'sam@example.com',
};

const MISSING_ID = '11111111-1111-4111-8111-111111111111';

function buildService(classify?: TriageEngine['classify']) {
  const repository = new TicketRepository(createTestDb().queryable);
  const triageService = new TriageService({
    engine: classify ? { classify } : null,
    cache: new TriageCache(60_000, 50),
    wallClockMs: 50,
  });
  return { service: new TicketService(repository, triageService), repository };
}

describe('TicketService', () => {
  describe('CRUD', () => {
    it('creates and reads back a ticket', async () => {
      const { service } = buildService();
      const created = await service.create(INPUT);
      await expect(service.getById(created.id)).resolves.toMatchObject({ id: created.id });
    });

    it('lists tickets with pagination metadata', async () => {
      const { service } = buildService();
      await service.create(INPUT);
      await service.create(INPUT);

      await expect(service.list({ limit: 10, offset: 0 })).resolves.toMatchObject({
        total: 2,
        limit: 10,
        offset: 0,
      });
    });

    it('updates a ticket', async () => {
      const { service } = buildService();
      const created = await service.create(INPUT);
      await expect(service.update(created.id, { status: 'resolved' })).resolves.toMatchObject({
        status: 'resolved',
      });
    });

    it('deletes a ticket', async () => {
      const { service } = buildService();
      const created = await service.create(INPUT);
      await service.delete(created.id);
      await expect(service.getById(created.id)).rejects.toThrow(AppError);
    });

    it.each([
      ['getById', (s: TicketService) => s.getById(MISSING_ID)],
      ['update', (s: TicketService) => s.update(MISSING_ID, { status: 'closed' as const })],
      ['delete', (s: TicketService) => s.delete(MISSING_ID)],
      ['triage', (s: TicketService) => s.triage(MISSING_ID)],
    ])('throws a 404 AppError from %s when the ticket is missing', async (_name, call) => {
      const { service } = buildService();
      await expect(call(service)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    });
  });

  describe('triage', () => {
    it('stores the AI classification on the ticket', async () => {
      const { service } = buildService(
        jest.fn().mockResolvedValue({
          category: 'billing',
          priority: 'urgent',
          summary: 'Checkout rejects a valid card.',
        }),
      );
      const created = await service.create(INPUT);

      const { ticket, triage } = await service.triage(created.id);

      expect(triage).toMatchObject({ source: 'ai', category: 'billing', priority: 'urgent' });
      expect(ticket).toMatchObject({
        category: 'billing',
        priority: 'urgent',
        summary: 'Checkout rejects a valid card.',
        triageSource: 'ai',
      });
      expect(ticket.triagedAt).toBeInstanceOf(Date);

      // The change is durable, not just present on the returned object.
      await expect(service.getById(created.id)).resolves.toMatchObject({ triageSource: 'ai' });
    });

    // The defensive-engineering case: the AI is down, the endpoint still works.
    it('still persists a classification when the AI call fails', async () => {
      const { service } = buildService(jest.fn().mockRejectedValue(new Error('502 Bad Gateway')));
      const created = await service.create(INPUT);

      const { ticket, triage } = await service.triage(created.id);

      expect(triage.source).toBe('fallback');
      expect(ticket.triageSource).toBe('fallback');
      expect(ticket.summary).toBeTruthy();
      expect(ticket.triagedAt).toBeInstanceOf(Date);
    });

    it('reports whether the AI path is configured', () => {
      expect(buildService().service.aiStatus()).toMatchObject({ aiEnabled: false });
      expect(buildService(jest.fn()).service.aiStatus()).toMatchObject({ aiEnabled: true });
    });
  });

  it('constructs its own repository and triage service when none are injected', () => {
    // Guards the production wiring in app.ts, which relies on the defaults.
    expect(new TicketService()).toBeInstanceOf(TicketService);
  });
});
