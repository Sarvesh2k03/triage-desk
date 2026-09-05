import { createTestDb } from '../helpers/inMemoryDb';
import { TicketRepository } from '../../src/repositories/ticketRepository';
import type { Queryable } from '../../src/db/pool';
import type { CreateTicketInput } from '../../src/types/ticket';

const baseTicket: CreateTicketInput = {
  title: 'Cannot export invoices',
  description: 'The export button spins forever on the billing page.',
  requesterEmail: 'dana@example.com',
};

describe('TicketRepository', () => {
  let db: Queryable;
  let repo: TicketRepository;

  beforeEach(() => {
    db = createTestDb().queryable;
    repo = new TicketRepository(db);
  });

  describe('create', () => {
    it('persists a ticket and applies column defaults', async () => {
      const ticket = await repo.create(baseTicket);

      expect(ticket).toMatchObject({
        title: baseTicket.title,
        description: baseTicket.description,
        requesterEmail: baseTicket.requesterEmail,
        status: 'open',
        priority: 'medium',
        category: 'other',
        summary: null,
        triageSource: 'manual',
        triagedAt: null,
      });
      expect(ticket.createdAt).toBeInstanceOf(Date);
      expect(ticket.updatedAt).toBeInstanceOf(Date);
    });

    it('honours explicitly supplied status, priority and category', async () => {
      const ticket = await repo.create({
        ...baseTicket,
        status: 'in_progress',
        priority: 'urgent',
        category: 'billing',
      });

      expect(ticket).toMatchObject({
        status: 'in_progress',
        priority: 'urgent',
        category: 'billing',
      });
    });

    it('assigns a distinct id to every ticket', async () => {
      const [a, b] = await Promise.all([repo.create(baseTicket), repo.create(baseTicket)]);
      expect(a.id).not.toEqual(b.id);
    });
  });

  describe('findById', () => {
    it('returns the stored ticket', async () => {
      const created = await repo.create(baseTicket);
      await expect(repo.findById(created.id)).resolves.toMatchObject({ id: created.id });
    });

    it('returns null for an id that does not exist', async () => {
      await expect(
        repo.findById('11111111-1111-4111-8111-111111111111'),
      ).resolves.toBeNull();
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await repo.create({ ...baseTicket, status: 'open', priority: 'high', category: 'billing' });
      await repo.create({ ...baseTicket, status: 'closed', priority: 'low', category: 'bug' });
      await repo.create({ ...baseTicket, status: 'open', priority: 'low', category: 'bug' });
    });

    it('returns every ticket with a total when no filter is supplied', async () => {
      const result = await repo.list({ limit: 25, offset: 0 });
      expect(result.tickets).toHaveLength(3);
      expect(result).toMatchObject({ total: 3, limit: 25, offset: 0 });
    });

    it('filters by a single column', async () => {
      const result = await repo.list({ status: 'open', limit: 25, offset: 0 });
      expect(result.total).toBe(2);
      expect(result.tickets.every((t) => t.status === 'open')).toBe(true);
    });

    it('ANDs multiple filters together', async () => {
      const result = await repo.list({ status: 'open', category: 'bug', limit: 25, offset: 0 });
      expect(result.total).toBe(1);
      expect(result.tickets[0]).toMatchObject({ status: 'open', category: 'bug' });
    });

    it('filters by priority', async () => {
      const result = await repo.list({ priority: 'high', limit: 25, offset: 0 });
      expect(result.total).toBe(1);
      expect(result.tickets[0]?.priority).toBe('high');
    });

    it('paginates without changing the reported total', async () => {
      const page = await repo.list({ limit: 2, offset: 2 });
      expect(page.tickets).toHaveLength(1);
      expect(page.total).toBe(3);
      expect(page).toMatchObject({ limit: 2, offset: 2 });
    });

    it('returns an empty page past the end of the result set', async () => {
      const page = await repo.list({ limit: 10, offset: 99 });
      expect(page.tickets).toEqual([]);
      expect(page.total).toBe(3);
    });
  });

  describe('update', () => {
    it('changes only the supplied fields', async () => {
      const created = await repo.create(baseTicket);
      const updated = await repo.update(created.id, { status: 'resolved' });

      expect(updated).toMatchObject({
        id: created.id,
        status: 'resolved',
        title: created.title,
        description: created.description,
      });
    });

    it('maps requesterEmail onto the requester_email column', async () => {
      const created = await repo.create(baseTicket);
      const updated = await repo.update(created.id, { requesterEmail: 'new@example.com' });
      expect(updated?.requesterEmail).toBe('new@example.com');
    });

    it('updates several fields in one statement', async () => {
      const created = await repo.create(baseTicket);
      const updated = await repo.update(created.id, {
        title: 'Renamed',
        description: 'A different description entirely.',
        priority: 'urgent',
        category: 'performance',
      });

      expect(updated).toMatchObject({
        title: 'Renamed',
        description: 'A different description entirely.',
        priority: 'urgent',
        category: 'performance',
      });
    });

    it('returns the current row unchanged when no fields are supplied', async () => {
      const created = await repo.create(baseTicket);
      const updated = await repo.update(created.id, {});
      expect(updated).toMatchObject({ id: created.id, title: created.title });
    });

    it('returns null when the ticket does not exist', async () => {
      await expect(
        repo.update('11111111-1111-4111-8111-111111111111', { status: 'closed' }),
      ).resolves.toBeNull();
    });
  });

  describe('applyTriage', () => {
    it('writes the classification and stamps triagedAt', async () => {
      const created = await repo.create(baseTicket);
      const updated = await repo.applyTriage(created.id, {
        category: 'billing',
        priority: 'high',
        summary: 'Invoice export never completes.',
        source: 'ai',
      });

      expect(updated).toMatchObject({
        category: 'billing',
        priority: 'high',
        summary: 'Invoice export never completes.',
        triageSource: 'ai',
      });
      expect(updated?.triagedAt).toBeInstanceOf(Date);
    });

    it('records a fallback classification as such', async () => {
      const created = await repo.create(baseTicket);
      const updated = await repo.applyTriage(created.id, {
        category: 'other',
        priority: 'medium',
        summary: 'Keyword classified.',
        source: 'fallback',
      });
      expect(updated?.triageSource).toBe('fallback');
    });

    it('returns null when the ticket does not exist', async () => {
      await expect(
        repo.applyTriage('11111111-1111-4111-8111-111111111111', {
          category: 'bug',
          priority: 'low',
          summary: 'x',
          source: 'ai',
        }),
      ).resolves.toBeNull();
    });
  });

  describe('delete', () => {
    it('removes the ticket and reports success', async () => {
      const created = await repo.create(baseTicket);
      await expect(repo.delete(created.id)).resolves.toBe(true);
      await expect(repo.findById(created.id)).resolves.toBeNull();
    });

    it('reports failure when nothing was deleted', async () => {
      await expect(repo.delete('11111111-1111-4111-8111-111111111111')).resolves.toBe(false);
    });
  });

  describe('database constraints', () => {
    it.each([
      ['status', "INSERT INTO tickets (id,title,description,requester_email,status) VALUES ('11111111-1111-4111-8111-111111111111','t','d','e@x.com','bogus')"],
      ['priority', "INSERT INTO tickets (id,title,description,requester_email,priority) VALUES ('11111111-1111-4111-8111-111111111111','t','d','e@x.com','bogus')"],
      ['category', "INSERT INTO tickets (id,title,description,requester_email,category) VALUES ('11111111-1111-4111-8111-111111111111','t','d','e@x.com','bogus')"],
      ['triage_source', "INSERT INTO tickets (id,title,description,requester_email,triage_source) VALUES ('11111111-1111-4111-8111-111111111111','t','d','e@x.com','bogus')"],
    ])('rejects an out-of-range %s at the database level', async (_column, sql) => {
      // Validation happens in Zod at the edge, but the constraint is the
      // backstop: no code path, present or future, can write a bad enum.
      await expect(db.query(sql)).rejects.toThrow(/check constraint/i);
    });
  });

  it('normalises ISO date strings from drivers that do not return Date objects', async () => {
    // Some pg driver configurations hand back strings for timestamptz. The
    // repository is responsible for presenting Dates to the rest of the app.
    const stringDb: Queryable = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            title: 't',
            description: 'd',
            requester_email: 'e@x.com',
            status: 'open',
            priority: 'medium',
            category: 'other',
            summary: null,
            triage_source: 'ai',
            triaged_at: '2024-05-01T10:00:00.000Z',
            created_at: '2024-05-01T09:00:00.000Z',
            updated_at: '2024-05-01T09:30:00.000Z',
          },
        ],
        rowCount: 1,
      }),
    } as unknown as Queryable;

    const ticket = await new TicketRepository(stringDb).findById(
      '11111111-1111-4111-8111-111111111111',
    );

    expect(ticket?.createdAt).toBeInstanceOf(Date);
    expect(ticket?.triagedAt?.toISOString()).toBe('2024-05-01T10:00:00.000Z');
  });

  it('reports a delete as unsuccessful when the driver omits rowCount', async () => {
    const nullCountDb = { query: jest.fn().mockResolvedValue({ rows: [], rowCount: null }) };
    await expect(
      new TicketRepository(nullCountDb as unknown as Queryable).delete('x'),
    ).resolves.toBe(false);
  });
});
