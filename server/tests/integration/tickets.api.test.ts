import request from 'supertest';
import type { Express } from 'express';
import { buildTestApp, VALID_TICKET } from '../helpers/testApp';

const MISSING_ID = '11111111-1111-4111-8111-111111111111';

describe('Tickets API', () => {
  let app: Express;

  beforeEach(() => {
    app = buildTestApp();
  });

  const createTicket = async (overrides: Record<string, unknown> = {}) => {
    const response = await request(app)
      .post('/api/tickets')
      .send({ ...VALID_TICKET, ...overrides })
      .expect(201);
    return response.body.ticket;
  };

  describe('POST /api/tickets', () => {
    it('creates a ticket and returns 201 with the stored record', async () => {
      const response = await request(app).post('/api/tickets').send(VALID_TICKET).expect(201);

      expect(response.body.ticket).toMatchObject({
        title: VALID_TICKET.title,
        requesterEmail: 'dana@example.com',
        status: 'open',
        priority: 'medium',
        triageSource: 'manual',
        summary: null,
      });
      expect(response.body.ticket.id).toEqual(expect.any(String));
    });

    it('normalises the requester email to lowercase and trims whitespace', async () => {
      const ticket = await createTicket({ requesterEmail: '  DANA@Example.COM ' });
      expect(ticket.requesterEmail).toBe('dana@example.com');
    });

    it.each([
      ['a missing title', { title: undefined }, 'title'],
      ['a too-short title', { title: 'ab' }, 'title'],
      ['a too-short description', { description: 'short' }, 'description'],
      ['an invalid email', { requesterEmail: 'not-an-email' }, 'requesterEmail'],
      ['an unknown status', { status: 'pending' }, 'status'],
      ['an unknown priority', { priority: 'catastrophic' }, 'priority'],
    ])('rejects %s with a 400 naming the field', async (_label, override, field) => {
      const response = await request(app)
        .post('/api/tickets')
        .send({ ...VALID_TICKET, ...override })
        .expect(400);

      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(Object.keys(response.body.error.details)).toContain(field);
    });

    it('rejects a malformed JSON body with a 400, not a 500', async () => {
      const response = await request(app)
        .post('/api/tickets')
        .set('Content-Type', 'application/json')
        .send('{"title": ')
        .expect(400);

      expect(response.body.error.message).toMatch(/not valid JSON/);
    });
  });

  describe('GET /api/tickets', () => {
    it('returns an empty page when there are no tickets', async () => {
      const response = await request(app).get('/api/tickets').expect(200);
      expect(response.body).toEqual({ tickets: [], total: 0, limit: 25, offset: 0 });
    });

    it('lists tickets with pagination metadata', async () => {
      await createTicket();
      await createTicket();

      const response = await request(app).get('/api/tickets').expect(200);
      expect(response.body.tickets).toHaveLength(2);
      expect(response.body).toMatchObject({ total: 2, limit: 25, offset: 0 });
    });

    it('filters by status', async () => {
      await createTicket({ status: 'open' });
      await createTicket({ status: 'closed' });

      const response = await request(app).get('/api/tickets?status=closed').expect(200);
      expect(response.body.total).toBe(1);
      expect(response.body.tickets[0].status).toBe('closed');
    });

    it('applies limit and offset', async () => {
      await createTicket();
      await createTicket();
      await createTicket();

      const response = await request(app).get('/api/tickets?limit=2&offset=1').expect(200);
      expect(response.body.tickets).toHaveLength(2);
      expect(response.body).toMatchObject({ total: 3, limit: 2, offset: 1 });
    });

    it.each([
      ['a non-numeric limit', 'limit=many'],
      ['a limit above the maximum', 'limit=500'],
      ['a negative offset', 'offset=-1'],
      ['an unknown status', 'status=pending'],
    ])('rejects %s with a 400', async (_label, query) => {
      await request(app).get(`/api/tickets?${query}`).expect(400);
    });
  });

  describe('GET /api/tickets/:id', () => {
    it('returns the ticket', async () => {
      const created = await createTicket();
      const response = await request(app).get(`/api/tickets/${created.id}`).expect(200);
      expect(response.body.ticket.id).toBe(created.id);
    });

    it('returns 404 for an unknown id', async () => {
      const response = await request(app).get(`/api/tickets/${MISSING_ID}`).expect(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 400 for an id that is not a UUID', async () => {
      const response = await request(app).get('/api/tickets/abc').expect(400);
      expect(response.body.error.details.id).toMatch(/UUID/);
    });
  });

  describe('PATCH /api/tickets/:id', () => {
    it('updates the supplied fields and leaves the rest alone', async () => {
      const created = await createTicket();

      const response = await request(app)
        .patch(`/api/tickets/${created.id}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(response.body.ticket).toMatchObject({
        status: 'in_progress',
        title: created.title,
      });
    });

    it('rejects an empty body', async () => {
      const created = await createTicket();
      const response = await request(app).patch(`/api/tickets/${created.id}`).send({}).expect(400);
      expect(JSON.stringify(response.body)).toMatch(/at least one field/);
    });

    it('rejects an invalid field value', async () => {
      const created = await createTicket();
      await request(app).patch(`/api/tickets/${created.id}`).send({ status: 'nope' }).expect(400);
    });

    it('returns 404 for an unknown id', async () => {
      await request(app).patch(`/api/tickets/${MISSING_ID}`).send({ status: 'closed' }).expect(404);
    });
  });

  describe('DELETE /api/tickets/:id', () => {
    it('deletes the ticket and returns 204', async () => {
      const created = await createTicket();

      await request(app).delete(`/api/tickets/${created.id}`).expect(204);
      await request(app).get(`/api/tickets/${created.id}`).expect(404);
    });

    it('returns 404 when the ticket is already gone', async () => {
      await request(app).delete(`/api/tickets/${MISSING_ID}`).expect(404);
    });
  });

  describe('GET /api/health', () => {
    it('reports status and whether AI triage is configured', async () => {
      const response = await request(app).get('/api/health').expect(200);
      expect(response.body).toMatchObject({ status: 'ok', ai: { enabled: false } });
      expect(typeof response.body.uptimeSeconds).toBe('number');
    });
  });

  it('returns a 404 envelope for an unknown route', async () => {
    const response = await request(app).get('/api/nonexistent').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
