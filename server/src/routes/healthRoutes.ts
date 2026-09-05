import { Router } from 'express';
import { TicketService } from '../services/ticketService';

export function createHealthRouter(service: TicketService = new TicketService()): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const { aiEnabled, cacheSize } = service.aiStatus();
    res.json({
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      ai: { enabled: aiEnabled, cachedTriages: cacheSize },
    });
  });

  return router;
}
