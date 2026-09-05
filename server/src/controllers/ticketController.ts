import type { Request, RequestHandler, Response } from 'express';
import { TicketService } from '../services/ticketService';
import type { CreateTicketBody, ListTicketsQuery, UpdateTicketBody } from '../validation/ticketSchemas';

export class TicketController {
  constructor(private readonly service: TicketService = new TicketService()) {}

  create: RequestHandler = async (req: Request, res: Response) => {
    const ticket = await this.service.create(req.body as CreateTicketBody);
    res.status(201).json({ ticket });
  };

  list: RequestHandler = async (req: Request, res: Response) => {
    const { status, priority, category, limit, offset } = req.query as unknown as ListTicketsQuery;
    const result = await this.service.list({ status, priority, category, limit, offset });
    res.json(result);
  };

  getById: RequestHandler = async (req: Request, res: Response) => {
    const ticket = await this.service.getById(req.params.id as string);
    res.json({ ticket });
  };

  update: RequestHandler = async (req: Request, res: Response) => {
    const ticket = await this.service.update(req.params.id as string, req.body as UpdateTicketBody);
    res.json({ ticket });
  };

  remove: RequestHandler = async (req: Request, res: Response) => {
    await this.service.delete(req.params.id as string);
    res.status(204).send();
  };

  triage: RequestHandler = async (req: Request, res: Response) => {
    const { ticket, triage } = await this.service.triage(req.params.id as string);
    res.json({ ticket, triage });
  };
}
