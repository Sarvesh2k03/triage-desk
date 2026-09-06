import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../../src/app';
import { TicketService } from '../../src/services/ticketService';
import { TriageService } from '../../src/ai/triageService';
import { TicketRepository } from '../../src/repositories/ticketRepository';
import { createTestDb } from '../helpers/inMemoryDb';

/**
 * In production the API process also serves the built frontend, so the whole
 * app is one deployable service. These tests pin the routing rules that make
 * that safe -- above all, that the SPA fallback never intercepts /api.
 */
describe('single-service static hosting', () => {
  let webDist: string;

  const buildApp = (dist: string | null) =>
    createApp({
      ticketService: new TicketService(
        new TicketRepository(createTestDb().queryable),
        new TriageService({ engine: null }),
      ),
      webDist: dist,
    });

  beforeAll(() => {
    webDist = mkdtempSync(join(tmpdir(), 'triage-web-'));
    writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>Triage Desk</title>');
    writeFileSync(join(webDist, 'app.js'), 'console.log("bundle");');
  });

  afterAll(() => {
    rmSync(webDist, { recursive: true, force: true });
  });

  it('serves index.html at the root', async () => {
    const response = await request(buildApp(webDist)).get('/').expect(200);
    expect(response.text).toContain('Triage Desk');
  });

  it('serves static assets', async () => {
    const response = await request(buildApp(webDist)).get('/app.js').expect(200);
    expect(response.text).toContain('bundle');
  });

  it('falls back to index.html for a client-side route', async () => {
    const response = await request(buildApp(webDist)).get('/tickets/some-view').expect(200);
    expect(response.text).toContain('Triage Desk');
  });

  it('still serves the API alongside the frontend', async () => {
    const response = await request(buildApp(webDist)).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
  });

  // The regression that makes a broken API look like a broken frontend: if the
  // SPA fallback catches /api, clients get HTML where they expect JSON and the
  // error surfaces as "Unexpected token <" instead of a 404.
  it('does not let the SPA fallback swallow an unknown /api route', async () => {
    const response = await request(buildApp(webDist)).get('/api/nope').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.text).not.toContain('<!doctype html>');
  });

  it('returns a JSON 404 for an unknown ticket rather than index.html', async () => {
    const response = await request(buildApp(webDist))
      .get('/api/tickets/11111111-1111-4111-8111-111111111111')
      .expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('serves API only when no frontend build is present', async () => {
    const app = buildApp(null);
    await request(app).get('/api/health').expect(200);
    await request(app).get('/').expect(404);
  });

  it('tolerates a configured directory that does not exist', async () => {
    const app = buildApp('/definitely/not/a/real/path');
    await request(app).get('/api/health').expect(200);
    await request(app).get('/').expect(404);
  });
});
