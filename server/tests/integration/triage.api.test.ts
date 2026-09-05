import request from 'supertest';
import type { Express } from 'express';
import { TokenBucket } from '../../src/middleware/rateLimit';
import { buildTestApp, VALID_TICKET } from '../helpers/testApp';

const AI_RESULT = {
  category: 'billing',
  priority: 'high',
  summary: 'Invoice export hangs and never produces a file.',
};

const MISSING_ID = '11111111-1111-4111-8111-111111111111';

async function seedTicket(app: Express) {
  const response = await request(app).post('/api/tickets').send(VALID_TICKET).expect(201);
  return response.body.ticket.id as string;
}

describe('POST /api/tickets/:id/triage', () => {
  describe('when Gemini answers', () => {
    it('stores the classification and marks it as AI-sourced', async () => {
      const app = buildTestApp({ classify: jest.fn().mockResolvedValue(AI_RESULT) });
      const id = await seedTicket(app);

      const response = await request(app).post(`/api/tickets/${id}/triage`).expect(200);

      expect(response.body.triage).toEqual({ ...AI_RESULT, source: 'ai' });
      expect(response.body.ticket).toMatchObject({
        category: 'billing',
        priority: 'high',
        summary: AI_RESULT.summary,
        triageSource: 'ai',
      });
      expect(response.body.ticket.triagedAt).toEqual(expect.any(String));
    });

    it('persists the result so a later GET reflects it', async () => {
      const app = buildTestApp({ classify: jest.fn().mockResolvedValue(AI_RESULT) });
      const id = await seedTicket(app);

      await request(app).post(`/api/tickets/${id}/triage`).expect(200);
      const response = await request(app).get(`/api/tickets/${id}`).expect(200);

      expect(response.body.ticket).toMatchObject({ triageSource: 'ai', category: 'billing' });
    });

    it('does not call the model twice for the same ticket text', async () => {
      const classify = jest.fn().mockResolvedValue(AI_RESULT);
      const app = buildTestApp({ classify });
      const id = await seedTicket(app);

      await request(app).post(`/api/tickets/${id}/triage`).expect(200);
      await request(app).post(`/api/tickets/${id}/triage`).expect(200);

      expect(classify).toHaveBeenCalledTimes(1);
    });

    it('re-runs the model after the ticket text is edited', async () => {
      const classify = jest.fn().mockResolvedValue(AI_RESULT);
      const app = buildTestApp({ classify });
      const id = await seedTicket(app);

      await request(app).post(`/api/tickets/${id}/triage`).expect(200);
      await request(app)
        .patch(`/api/tickets/${id}`)
        .send({ description: 'Actually the login page is what is broken now.' })
        .expect(200);
      await request(app).post(`/api/tickets/${id}/triage`).expect(200);

      expect(classify).toHaveBeenCalledTimes(2);
    });

    it('reports the AI path as enabled on the health endpoint', async () => {
      const app = buildTestApp({ classify: jest.fn().mockResolvedValue(AI_RESULT) });
      const response = await request(app).get('/api/health').expect(200);
      expect(response.body.ai.enabled).toBe(true);
    });
  });

  describe('when the AI call fails', () => {
    it.each([
      ['the API errors', jest.fn().mockRejectedValue(new Error('503 Service Unavailable'))],
      ['the API key is rejected', jest.fn().mockRejectedValue(new Error('401 authentication_error'))],
      ['the response fails schema validation', jest.fn().mockResolvedValue({ category: 'nonsense' })],
      ['the response is empty', jest.fn().mockResolvedValue(null)],
    ])('still returns 200 with a fallback classification when %s', async (_label, classify) => {
      const app = buildTestApp({ classify });
      const id = await seedTicket(app);

      const response = await request(app).post(`/api/tickets/${id}/triage`).expect(200);

      expect(response.body.triage.source).toBe('fallback');
      expect(response.body.triage.reason).toEqual(expect.any(String));
      expect(response.body.ticket.triageSource).toBe('fallback');
      expect(response.body.ticket.category).toBeTruthy();
      expect(response.body.ticket.priority).toBeTruthy();
      expect(response.body.ticket.summary).toBeTruthy();
    });

    it('returns 200 with a fallback when the model hangs past the deadline', async () => {
      const classify = jest.fn(
        () => new Promise((resolve) => setTimeout(resolve, 10_000).unref?.()),
      );
      const app = buildTestApp({ classify, wallClockMs: 30 });
      const id = await seedTicket(app);

      const response = await request(app).post(`/api/tickets/${id}/triage`).expect(200);

      expect(response.body.triage.source).toBe('fallback');
      expect(response.body.triage.reason).toBe('Gemini service was unavailable');
    });

    it('falls back when no API key is configured at all', async () => {
      const app = buildTestApp();
      const id = await seedTicket(app);

      const response = await request(app).post(`/api/tickets/${id}/triage`).expect(200);

      expect(response.body.triage).toMatchObject({
        source: 'fallback',
        reason: 'Gemini triage is not configured on this server',
      });
    });
  });

  describe('validation and limits', () => {
    it('returns 404 for an unknown ticket without calling the model', async () => {
      const classify = jest.fn().mockResolvedValue(AI_RESULT);
      const app = buildTestApp({ classify });

      await request(app).post(`/api/tickets/${MISSING_ID}/triage`).expect(404);

      expect(classify).not.toHaveBeenCalled();
    });

    it('returns 400 for a non-UUID id', async () => {
      await request(buildTestApp()).post('/api/tickets/abc/triage').expect(400);
    });

    it('rate limits the endpoint and reports Retry-After', async () => {
      const classify = jest.fn().mockResolvedValue(AI_RESULT);
      const app = buildTestApp({
        classify,
        triageBucket: new TokenBucket(1, 60, () => 0),
      });
      const id = await seedTicket(app);

      await request(app).post(`/api/tickets/${id}/triage`).expect(200);
      const limited = await request(app).post(`/api/tickets/${id}/triage`).expect(429);

      expect(limited.body.error.code).toBe('RATE_LIMITED');
      expect(limited.headers['retry-after']).toBe('1');
    });

    it('does not rate limit ordinary CRUD routes', async () => {
      const app = buildTestApp({ triageBucket: new TokenBucket(1, 60, () => 0) });
      for (let i = 0; i < 5; i += 1) {
        await request(app).get('/api/tickets').expect(200);
      }
    });
  });
});
