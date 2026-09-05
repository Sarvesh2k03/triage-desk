import type {
  HealthResponse,
  NewTicket,
  Ticket,
  TicketPage,
  TicketStatus,
  TriageResult,
} from './types';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, string> };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is the API running?');
  }

  if (response.status === 204) return undefined as T;

  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & T;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.message ?? `Request failed with status ${response.status}`,
      body.error?.details,
    );
  }
  return body as T;
}

export const api = {
  health: () => request<HealthResponse>('/health'),

  listTickets: (status?: TicketStatus) =>
    request<TicketPage>(`/tickets${status ? `?status=${status}` : ''}`),

  createTicket: (ticket: NewTicket) =>
    request<{ ticket: Ticket }>('/tickets', { method: 'POST', body: JSON.stringify(ticket) }).then(
      (r) => r.ticket,
    ),

  updateTicket: (id: string, changes: Partial<Ticket>) =>
    request<{ ticket: Ticket }>(`/tickets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }).then((r) => r.ticket),

  deleteTicket: (id: string) => request<void>(`/tickets/${id}`, { method: 'DELETE' }),

  triageTicket: (id: string) =>
    request<{ ticket: Ticket; triage: TriageResult }>(`/tickets/${id}/triage`, { method: 'POST' }),
};
