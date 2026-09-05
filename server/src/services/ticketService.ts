import { TriageService } from '../ai/triageService';
import { AppError } from '../errors/AppError';
import { TicketRepository } from '../repositories/ticketRepository';
import type {
  CreateTicketInput,
  ListTicketsFilter,
  ListTicketsResult,
  Ticket,
  TriageResult,
  UpdateTicketInput,
} from '../types/ticket';

export interface TriagedTicket {
  ticket: Ticket;
  triage: TriageResult;
}

export class TicketService {
  constructor(
    private readonly repository: TicketRepository = new TicketRepository(),
    private readonly triageService: TriageService = new TriageService(),
  ) {}

  create(input: CreateTicketInput): Promise<Ticket> {
    return this.repository.create(input);
  }

  async getById(id: string): Promise<Ticket> {
    const ticket = await this.repository.findById(id);
    if (!ticket) throw AppError.notFound(`Ticket ${id} was not found`);
    return ticket;
  }

  list(filter: ListTicketsFilter): Promise<ListTicketsResult> {
    return this.repository.list(filter);
  }

  async update(id: string, input: UpdateTicketInput): Promise<Ticket> {
    const ticket = await this.repository.update(id, input);
    if (!ticket) throw AppError.notFound(`Ticket ${id} was not found`);
    return ticket;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw AppError.notFound(`Ticket ${id} was not found`);
  }

  async triage(id: string): Promise<TriagedTicket> {
    const existing = await this.getById(id);
    const triage = await this.triageService.triage(existing.title, existing.description);

    const updated = await this.repository.applyTriage(id, triage);
    if (!updated) throw AppError.notFound(`Ticket ${id} was not found`);

    return { ticket: updated, triage };
  }

  aiStatus(): { aiEnabled: boolean; cacheSize: number } {
    return this.triageService.stats();
  }
}
