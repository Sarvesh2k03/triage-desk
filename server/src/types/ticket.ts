export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  'billing',
  'bug',
  'feature_request',
  'account_access',
  'performance',
  'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TRIAGE_SOURCES = ['manual', 'ai', 'fallback'] as const;
export type TriageSource = (typeof TRIAGE_SOURCES)[number];

export interface Ticket {
  id: string;
  title: string;
  description: string;
  requesterEmail: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  summary: string | null;
  triageSource: TriageSource;
  triagedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTicketInput {
  title: string;
  description: string;
  requesterEmail: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  requesterEmail?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
}

export interface ListTicketsFilter {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  limit: number;
  offset: number;
}

export interface ListTicketsResult {
  tickets: Ticket[];
  total: number;
  limit: number;
  offset: number;
}

export interface TriageResult {
  category: TicketCategory;
  priority: TicketPriority;
  summary: string;
  source: Exclude<TriageSource, 'manual'>;
  reason?: string;
}
