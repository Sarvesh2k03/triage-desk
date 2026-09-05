-- Triage Desk schema. Idempotent: safe to run on every boot.
CREATE TABLE IF NOT EXISTS tickets (
  id              UUID PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority        TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category        TEXT NOT NULL DEFAULT 'other'
                    CHECK (category IN ('billing', 'bug', 'feature_request',
                                        'account_access', 'performance', 'other')),
  summary         TEXT,
  triage_source   TEXT NOT NULL DEFAULT 'manual'
                    CHECK (triage_source IN ('manual', 'ai', 'fallback')),
  triaged_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The list view filters on status/priority and always sorts newest-first.
CREATE INDEX IF NOT EXISTS tickets_created_at_idx ON tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets (status);
CREATE INDEX IF NOT EXISTS tickets_priority_idx ON tickets (priority);
