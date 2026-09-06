# Triage Desk

**Live demo: https://triage-desk-te0v.onrender.com**

Triage Desk is a full-stack support queue that uses Gemini to classify customer tickets, assign priority, and draft a concise agent summary. The core ticket workflow remains fully usable when the model is unavailable because the API falls back to a deterministic local classifier.

```text
React + TypeScript -> Express + TypeScript -> PostgreSQL
                              |
                              -> Gemini Generate Content API
```

## Highlights

- React 19 + Vite frontend with ticket intake, filtering, status updates, deletion, and one-click triage.
- Express 5 REST API with layered routing, controllers, services, repositories, validation middleware, and a single error handler.
- PostgreSQL persistence with parameterized SQL and database-level enum constraints.
- Gemini integration isolated behind `server/src/ai/geminiTriageEngine.ts`.
- Structured JSON output, server-side Zod validation, request timeouts, content-keyed caching, and rate limiting.
- Graceful degradation when Gemini is missing, blocked, slow, or returns an invalid payload.
- Jest coverage across service, repository, validation, AI, and API behavior using `pg-mem` for fast database-backed tests.

## Quick Start

Requires Node 20+ and Docker.

```bash
docker compose up -d
cd server
cp .env.example .env
npm install
npm run migrate
npm run dev
```

In another terminal:

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:4000`.

## Gemini Setup

Create a Gemini API key in Google AI Studio, then add it to `server/.env`:

```bash
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
```

Restart the API after saving the key:

```bash
cd server
npm run dev
```

`GET /api/health` reports whether AI triage is enabled.

## API

All API routes are under `/api`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Server status and AI configuration |
| `GET` | `/tickets` | List tickets with optional filters |
| `POST` | `/tickets` | Create a ticket |
| `GET` | `/tickets/:id` | Fetch one ticket |
| `PATCH` | `/tickets/:id` | Update status or ticket fields |
| `DELETE` | `/tickets/:id` | Delete a ticket |
| `POST` | `/tickets/:id/triage` | Classify and summarize a ticket |

## Testing

```bash
cd server
npm test
npm run test:coverage
```

```bash
cd web
npm run build
```

200 tests, 98.1% statement and 95.3% branch coverage.

The server suite uses an in-memory Postgres-compatible database (`pg-mem`), so
tests need neither Docker nor a Gemini key. The SQL is genuinely parsed and
executed rather than mocked, so a typo in a column name fails the test.

The AI-failure behaviour is covered specifically, since it is the point of the
feature: the triage endpoint is asserted to return 200 with a usable
classification when the API errors, when the key is rejected, when the response
fails schema validation, when it is empty, when the model exceeds the deadline,
and when no key is configured at all.

## Deployment

Deployed as a **single service**: Express serves the compiled React app
alongside the API, so there is one origin, one URL, and no CORS negotiation
between separately hosted halves.

- **Database:** Neon (free tier)
- **App:** Render (free tier), configured by the committed `render.yaml`

### Steps

1. Create a Neon project and copy the **pooled** connection string
   (`...-pooler...?sslmode=require`).
2. On Render: **New → Blueprint**, select this repo. `render.yaml` supplies the
   build command, start command, health check path and `NODE_ENV`.
3. Set the two secrets Render prompts for:

```bash
DATABASE_URL=postgresql://...-pooler...neon.tech/neondb?sslmode=require
GEMINI_API_KEY=your_key_here
```

The schema is applied idempotently on boot, so there is no separate release
step.

### Verifying a deploy

A page that loads is not proof the AI works -- the fallback is good enough to
hide a broken model configuration. Check the source explicitly:

```bash
curl -s https://your-app.onrender.com/api/health
```

Expect `"status":"ok"` (database reachable) and `"ai":{"enabled":true}` (key
loaded). Then triage a ticket and confirm the response carries
`"source":"ai"` rather than `"fallback"`, and that the summary panel renders
blue rather than amber.

## Known limitations

Honest notes about the free-tier deployment and the scope of the project:

- **Render's free tier sleeps after 15 minutes idle.** The first request after a
  nap takes 30-60 seconds. Load the page once before demoing.
- **Gemini's free tier is intermittently slow.** Under back-to-back requests a
  minority of calls exceed the timeout and fall back. This is visible rather
  than hidden: the ticket records `triage_source`, and the UI colours a
  fallback differently.
- **The cache and rate limiter are in-process.** With more than one instance
  each keeps its own copy. The worst case is a duplicate API call, not a wrong
  answer, so a shared store would be cost without a correctness benefit here.
- **No authentication.** Every ticket is visible to everyone. Adding auth would
  reshape nearly every endpoint, so it was left out rather than half-done.
- **The schema is applied at boot** rather than through a versioned migration
  tool. Fine for one table; a second table with a destructive change would
  justify `node-pg-migrate`.
