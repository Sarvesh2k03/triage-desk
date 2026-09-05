import { randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import { getPool, type Queryable } from '../db/pool';
import type {
  CreateTicketInput,
  ListTicketsFilter,
  ListTicketsResult,
  Ticket,
  TriageResult,
  UpdateTicketInput,
} from '../types/ticket';

interface TicketRow extends QueryResultRow {
  id: string;
  title: string;
  description: string;
  requester_email: string;
  status: Ticket['status'];
  priority: Ticket['priority'];
  category: Ticket['category'];
  summary: string | null;
  triage_source: Ticket['triageSource'];
  triaged_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = `id, title, description, requester_email, status, priority,
                 category, summary, triage_source, triaged_at, created_at, updated_at`;

const toDate = (value: Date | string): Date => (value instanceof Date ? value : new Date(value));

function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    requesterEmail: row.requester_email,
    status: row.status,
    priority: row.priority,
    category: row.category,
    summary: row.summary,
    triageSource: row.triage_source,
    triagedAt: row.triaged_at === null ? null : toDate(row.triaged_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export class TicketRepository {
  constructor(private readonly db: Queryable = getPool()) {}

  async create(input: CreateTicketInput): Promise<Ticket> {
    const result = await this.db.query<TicketRow>(
      `INSERT INTO tickets (id, title, description, requester_email, status, priority, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${COLUMNS}`,
      [
        randomUUID(),
        input.title,
        input.description,
        input.requesterEmail,
        input.status ?? 'open',
        input.priority ?? 'medium',
        input.category ?? 'other',
      ],
    );
    return toTicket(result.rows[0] as TicketRow);
  }

  async findById(id: string): Promise<Ticket | null> {
    const result = await this.db.query<TicketRow>(
      `SELECT ${COLUMNS} FROM tickets WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? toTicket(row) : null;
  }

  async list(filter: ListTicketsFilter): Promise<ListTicketsResult> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    for (const [column, value] of [
      ['status', filter.status],
      ['priority', filter.priority],
      ['category', filter.category],
    ] as const) {
      if (value !== undefined) {
        values.push(value);
        conditions.push(`${column} = $${values.length}`);
      }
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.db.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM tickets ${where}`,
      values,
    );

    const rowsResult = await this.db.query<TicketRow>(
      `SELECT ${COLUMNS} FROM tickets ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filter.limit, filter.offset],
    );

    return {
      tickets: rowsResult.rows.map(toTicket),
      total: Number(countResult.rows[0]?.count ?? 0),
      limit: filter.limit,
      offset: filter.offset,
    };
  }

  async update(id: string, input: UpdateTicketInput): Promise<Ticket | null> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    const columnFor: Record<keyof UpdateTicketInput, string> = {
      title: 'title',
      description: 'description',
      requesterEmail: 'requester_email',
      status: 'status',
      priority: 'priority',
      category: 'category',
    };

    for (const key of Object.keys(columnFor) as (keyof UpdateTicketInput)[]) {
      const value = input[key];
      if (value !== undefined) {
        values.push(value);
        assignments.push(`${columnFor[key]} = $${values.length}`);
      }
    }

    if (assignments.length === 0) return this.findById(id);

    values.push(id);
    const result = await this.db.query<TicketRow>(
      `UPDATE tickets SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING ${COLUMNS}`,
      values,
    );
    const row = result.rows[0];
    return row ? toTicket(row) : null;
  }

  async applyTriage(id: string, triage: TriageResult): Promise<Ticket | null> {
    const result = await this.db.query<TicketRow>(
      `UPDATE tickets
          SET category = $1, priority = $2, summary = $3,
              triage_source = $4, triaged_at = now(), updated_at = now()
        WHERE id = $5
        RETURNING ${COLUMNS}`,
      [triage.category, triage.priority, triage.summary, triage.source, id],
    );
    const row = result.rows[0];
    return row ? toTicket(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.query(`DELETE FROM tickets WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
