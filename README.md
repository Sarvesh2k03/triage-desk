# Triage Desk

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
GEMINI_MODEL=gemini-3.7-flash
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

The server suite uses an in-memory Postgres-compatible database, so tests do not require Docker or a Gemini key.

## Deployment

Use a hosted Postgres database such as Neon, Render Postgres, or Supabase for `DATABASE_URL`. Deploy the API with the `server` folder and the web app with the `web` folder. Set `GEMINI_API_KEY`, `GEMINI_MODEL`, `DATABASE_URL`, and `CORS_ORIGIN` in the API host environment.
