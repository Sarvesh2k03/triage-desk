import { Router } from 'express';
import { env } from '../config/env';
import { TicketController } from '../controllers/ticketController';
import { TokenBucket, rateLimit } from '../middleware/rateLimit';
import { validate } from '../middleware/validate';
import {
  createTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
  updateTicketSchema,
} from '../validation/ticketSchemas';

export function createTicketRouter(
  controller: TicketController = new TicketController(),
  triageBucket?: TokenBucket,
): Router {
  const bucket =
    triageBucket ??
    new TokenBucket(env.AI_RATE_LIMIT_CAPACITY, env.AI_RATE_LIMIT_REFILL_PER_MIN);
  const router = Router();

  router.get('/', validate(listTicketsQuerySchema, 'query'), controller.list);
  router.post('/', validate(createTicketSchema), controller.create);

  router.get('/:id', validate(ticketIdParamSchema, 'params'), controller.getById);
  router.patch(
    '/:id',
    validate(ticketIdParamSchema, 'params'),
    validate(updateTicketSchema),
    controller.update,
  );
  router.delete('/:id', validate(ticketIdParamSchema, 'params'), controller.remove);

  router.post(
    '/:id/triage',
    validate(ticketIdParamSchema, 'params'),
    rateLimit(bucket),
    controller.triage,
  );

  return router;
}
