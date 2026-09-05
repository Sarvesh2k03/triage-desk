import request from 'supertest';
import { createApp } from '../../src/app';
import { createHealthRouter } from '../../src/routes/healthRoutes';
import { createTicketRouter } from '../../src/routes/ticketRoutes';
import { TicketController } from '../../src/controllers/ticketController';
import { TicketService } from '../../src/services/ticketService';
import { TicketRepository } from '../../src/repositories/ticketRepository';
import { TriageService } from '../../src/ai/triageService';
import { TriageCache } from '../../src/ai/triageCache';
import { closePool } from '../../src/db/pool';
import { AppError } from '../../src/errors/AppError';
import { corsOrigins } from '../../src/config/env';

/**
 * Production wiring: every collaborator in this app is injectable but has a
 * real default, and `src/index.ts` relies on those defaults. These tests
 * construct each piece with no arguments so a broken default is caught here
 * rather than on first boot in a deploy.
 */
describe('default wiring', () => {
  afterAll(async () => {
    await closePool();
  });

  it('builds an app with no injected dependencies', async () => {
    const app = createApp();
    // Health touches the service but not the database.
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('builds routers and a controller with no injected dependencies', () => {
    expect(createHealthRouter()).toBeDefined();
    expect(createTicketRouter()).toBeDefined();
    expect(new TicketController()).toBeInstanceOf(TicketController);
    expect(new TicketRepository()).toBeInstanceOf(TicketRepository);
  });

  it('reads the CORS allow-list from the environment by default', () => {
    expect(corsOrigins()).toEqual(['http://localhost:5173']);
  });
});

describe('triage race condition', () => {
  it('returns 404 when the ticket is deleted between the read and the write', async () => {
    // applyTriage returning null means the row vanished mid-request. The
    // service must not pretend the update succeeded.
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'abc',
        title: 'Gone',
        description: 'This ticket is about to be deleted.',
      }),
      applyTriage: jest.fn().mockResolvedValue(null),
    } as unknown as TicketRepository;

    const service = new TicketService(
      repository,
      new TriageService({ engine: null, cache: new TriageCache(1_000, 5) }),
    );

    await expect(service.triage('abc')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(AppError.notFound().status).toBe(404);
  });
});
