import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../api/client';
import type { NewTicket, Ticket, TicketStatus } from '../api/types';

const messageFor = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Something went wrong.';

export function useTickets(statusFilter: TicketStatus | 'all') {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const page = await api.listTickets(statusFilter === 'all' ? undefined : statusFilter);
      setTickets(page.tickets);
      setError(null);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createTicket = useCallback(
    async (input: NewTicket) => {
      await api.createTicket(input);
      await refresh();
    },
    [refresh],
  );

  const updateTicket = useCallback(
    async (id: string, changes: Partial<Ticket>) => {
      await api.updateTicket(id, changes);
      await refresh();
    },
    [refresh],
  );

  const deleteTicket = useCallback(
    async (id: string) => {
      await api.deleteTicket(id);
      await refresh();
    },
    [refresh],
  );

  return { tickets, loading, error, refresh, createTicket, updateTicket, deleteTicket };
}
