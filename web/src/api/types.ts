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

export type TriageSource = 'manual' | 'ai' | 'fallback';

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
  triagedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TriageResult {
  category: TicketCategory;
  priority: TicketPriority;
  summary: string;
  source: 'ai' | 'fallback';
  reason?: string;
}

export interface TicketPage {
  tickets: Ticket[];
  total: number;
  limit: number;
  offset: number;
}

export interface HealthResponse {
  status: string;
  uptimeSeconds: number;
  ai: { enabled: boolean; cachedTriages: number };
}

export interface NewTicket {
  title: string;
  description: string;
  requesterEmail: string;
}

export const LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
  billing: 'Billing',
  bug: 'Bug',
  feature_request: 'Feature request',
  account_access: 'Account access',
  performance: 'Performance',
  other: 'Other',
};
