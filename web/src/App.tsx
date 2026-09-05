import { useEffect, useMemo, useState } from 'react';
import { api } from './api/client';
import { useTickets } from './hooks/useTickets';
import { TicketForm } from './components/TicketForm';
import { TicketCard } from './components/TicketCard';
import { TICKET_STATUSES, type HealthResponse, type TicketStatus } from './api/types';

export default function App() {
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const { tickets, loading, error, refresh, createTicket, updateTicket, deleteTicket } =
    useTickets(statusFilter);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  const openCount = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress').length,
    [tickets],
  );
  const urgentCount = useMemo(
    () => tickets.filter((ticket) => ticket.priority === 'urgent' || ticket.priority === 'high').length,
    [tickets],
  );
  const triagedCount = useMemo(
    () => tickets.filter((ticket) => ticket.triagedAt !== null).length,
    [tickets],
  );

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <p className="eyebrow">Support operations</p>
          <h1>Triage Desk</h1>
          <p>A simple support desk demo: review sample tickets, run Gemini triage, and move work through the queue.</p>
        </div>
        <div className={`health ${health?.ai.enabled ? 'health--ready' : 'health--offline'}`}>
          <span>{health?.ai.enabled ? 'Gemini ready' : 'Local mode'}</span>
          <strong>{health ? `${Math.round(health.uptimeSeconds / 60)}m uptime` : 'Checking'}</strong>
        </div>
      </header>

      <section className="metrics" aria-label="Ticket metrics">
        <div>
          <span>Active queue</span>
          <strong>{loading ? '...' : openCount}</strong>
        </div>
        <div>
          <span>High priority</span>
          <strong>{loading ? '...' : urgentCount}</strong>
        </div>
        <div>
          <span>Triaged</span>
          <strong>{loading ? '...' : triagedCount}</strong>
        </div>
      </section>

      <section className="process" aria-label="Demo workflow">
        <div>
          <span>1</span>
          <strong>Ticket arrives</strong>
          <p>A customer issue enters the queue with a subject, email, and details.</p>
        </div>
        <div>
          <span>2</span>
          <strong>Gemini triages</strong>
          <p>The app assigns category, priority, and a short agent summary.</p>
        </div>
        <div>
          <span>3</span>
          <strong>Agent resolves</strong>
          <p>Status updates keep the queue clear from open to resolved.</p>
        </div>
      </section>

      <main className="app__body">
        <aside>
          <TicketForm onCreate={createTicket} />
        </aside>

        <section className="tickets">
          <div className="tickets__toolbar">
            <div>
              <p className="eyebrow">Demo queue</p>
              <h2>Tickets {!loading && <span className="count">{tickets.length}</span>}</h2>
            </div>
            <label>
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as TicketStatus | 'all')}
              >
                <option value="all">All statuses</option>
                {TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="form-error">{error}</p>}
          {loading && <p className="empty">Loading tickets...</p>}
          {!loading && !error && tickets.length === 0 && (
            <p className="empty">Demo tickets load automatically. You can also create a new one.</p>
          )}

          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onChange={updateTicket}
              onDelete={deleteTicket}
              onTriaged={refresh}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
