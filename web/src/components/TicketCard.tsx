import { useState } from 'react';
import { ApiError, api } from '../api/client';
import { Badge } from './Badge';
import { TICKET_STATUSES, type Ticket, type TriageResult } from '../api/types';

interface TicketCardProps {
  ticket: Ticket;
  onChange: (id: string, changes: Partial<Ticket>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTriaged: () => Promise<void>;
}

function triageNote(ticket: Ticket, latest: TriageResult | null): string | null {
  if (latest?.source === 'fallback' || ticket.triageSource === 'fallback') return 'Local classifier';
  if (latest?.source === 'ai' || ticket.triageSource === 'ai') return 'Gemini';
  return null;
}

export function TicketCard({ ticket, onChange, onDelete, onTriaged }: TicketCardProps) {
  const [triaging, setTriaging] = useState(false);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTriage() {
    setTriaging(true);
    setError(null);
    try {
      const result = await api.triageTicket(ticket.id);
      setTriage(result.triage);
      await onTriaged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Triage failed.');
    } finally {
      setTriaging(false);
    }
  }

  const note = triageNote(ticket, triage);

  return (
    <article className="card ticket">
      <header className="ticket__header">
        <div>
          <h3>{ticket.title}</h3>
          <span className="ticket__meta">{ticket.requesterEmail}</span>
        </div>
        <div className="ticket__badges">
          <Badge kind="priority" value={ticket.priority} />
          <Badge kind="category" value={ticket.category} />
        </div>
      </header>

      <p className="ticket__description">{ticket.description}</p>

      {ticket.summary && (
        <div className={`triage-summary triage-summary--${ticket.triageSource}`}>
          <span className="triage-summary__label">
            Summary
            {note && <em>{note}</em>}
          </span>
          <p>{ticket.summary}</p>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <footer className="ticket__footer">
        <span className="ticket__meta">Created {new Date(ticket.createdAt).toLocaleDateString()}</span>

        <div className="ticket__actions">
          <label className="sr-only" htmlFor={`status-${ticket.id}`}>
            Status
          </label>
          <select
            id={`status-${ticket.id}`}
            value={ticket.status}
            onChange={(event) => void onChange(ticket.id, { status: event.target.value as Ticket['status'] })}
          >
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace('_', ' ')}
              </option>
            ))}
          </select>

          <button type="button" onClick={() => void handleTriage()} disabled={triaging}>
            {triaging ? 'Triaging...' : ticket.triagedAt ? 'Run again' : 'Auto-triage'}
          </button>

          <button type="button" className="danger" onClick={() => void onDelete(ticket.id)}>
            Delete
          </button>
        </div>
      </footer>
    </article>
  );
}
