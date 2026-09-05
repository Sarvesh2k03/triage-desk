import cors from 'cors';
import express, { type Express } from 'express';
import { corsOrigins } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createHealthRouter } from './routes/healthRoutes';
import { createTicketRouter } from './routes/ticketRoutes';
import { TicketController } from './controllers/ticketController';
import { TicketService } from './services/ticketService';
import { TokenBucket } from './middleware/rateLimit';

export interface AppDependencies {
  ticketService?: TicketService;
    triageBucket?: TokenBucket;
}

export function createApp(deps: AppDependencies = {}): Express {
  const ticketService = deps.ticketService ?? new TicketService();
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(cors({ origin: corsOrigins() }));
  app.use(express.json({ limit: '128kb' }));

  app.use('/api/health', createHealthRouter(ticketService));
  app.use(
    '/api/tickets',
    createTicketRouter(new TicketController(ticketService), deps.triageBucket),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
