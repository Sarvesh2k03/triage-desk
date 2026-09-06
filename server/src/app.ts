import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import { corsOrigins, env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createHealthRouter } from './routes/healthRoutes';
import { createTicketRouter } from './routes/ticketRoutes';
import { TicketController } from './controllers/ticketController';
import { TicketService } from './services/ticketService';
import { TokenBucket } from './middleware/rateLimit';

export interface AppDependencies {
  ticketService?: TicketService;
  triageBucket?: TokenBucket;
  /**
   * Directory holding the built frontend, or null to serve API routes only.
   * Defaults to web/dist in production and to null everywhere else, because
   * in development Vite serves the frontend and proxies /api here.
   */
  webDist?: string | null;
}

/** web/dist, resolved relative to this file whether it runs from src or dist. */
function defaultWebDist(): string | null {
  if (env.NODE_ENV !== 'production') return null;
  return resolve(__dirname, '../../web/dist');
}

/**
 * Builds the Express app.
 *
 * In production this serves the API *and* the compiled frontend from one
 * process, so the whole app deploys as a single service: one URL, one origin,
 * and therefore no CORS negotiation between a separately hosted frontend and
 * backend.
 */
export function createApp(deps: AppDependencies = {}): Express {
  const ticketService = deps.ticketService ?? new TicketService();
  const webDist = deps.webDist !== undefined ? deps.webDist : defaultWebDist();
  const app = express();

  // Render terminates TLS at a proxy, so req.ip is only correct with this set.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(cors({ origin: corsOrigins() }));
  app.use(express.json({ limit: '128kb' }));

  app.use('/api/health', createHealthRouter(ticketService));
  app.use(
    '/api/tickets',
    createTicketRouter(new TicketController(ticketService), deps.triageBucket),
  );

  if (webDist && existsSync(webDist)) {
    app.use(express.static(webDist));
    // SPA fallback. The negative lookahead is what keeps it from swallowing
    // unmatched /api routes -- those must still return a JSON 404, not
    // index.html, or every client bug turns into "unexpected token <".
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
