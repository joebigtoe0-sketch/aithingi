# NETWORK // node-00 (AITHING)

Autonomous token-swarm operator console. **V1** is human-operated from the admin board; CENTRAL can draft log lines via Anthropic when you provide a brief.

## Architecture

| Piece | Role |
|--------|------|
| `public/` | Static React SPA (hash router, terminal UI) |
| `server/` | Express API + serves `public/` on one port |
| Postgres | Log entries, projects, deploy timestamp (Railway or Supabase) |
| Anthropic | Drafts THOUGHT / DECISION / DIRECTIVE / OBSERVATION from operator brief |

**Railway:** one web service runs the server (frontend + API). Add **PostgreSQL** in the same project and paste `DATABASE_URL` into the service env. Railway Postgres works well here.

**Supabase:** use the Postgres connection string as `DATABASE_URL` if you prefer Supabase over Railway DB.

Without `DATABASE_URL`, the server uses in-memory storage (fine for local AI testing, not for production).

## Local development

```bash
cd server
copy ..\.env.example .env
# Edit server\.env — set ANTHROPIC_API_KEY here (not only in .env.example)
npm install
npm run dev
```

Open **http://localhost:3000** (served by Node — do not open `index.html` directly) → `#/admin` → passphrase from `ADMIN_PASSWORD` (default `central`).

**AI not working?** Admin shows `backend · offline` → start the server. `ai · no API key` → key must be in `server/.env` or project root `.env`, then restart. `auth · re-login` → sign out and sign in while the backend is running.

### Admin workflow

1. **AI brief** — describe what CENTRAL should consider (memes, spawn ideas, rejections, directives).
2. **Generate with AI** — model reads recent log + active DEVs + your brief; fills the payload field.
3. **Inject** — edit if needed, then post to the live log (saved to DB when connected).

## Environment variables

See `.env.example`. Required for AI generation:

- `ANTHROPIC_API_KEY`

Recommended for production:

- `DATABASE_URL` (Railway Postgres or Supabase)
- `ADMIN_PASSWORD` (not the hardcoded client fallback)

Optional:

- `CENTRAL_BRAIN_SYSTEM_PROMPT` — full system rules override
- `ANTHROPIC_MODEL` — default `claude-sonnet-4-20250514`

## Deploy on Railway

**Full step-by-step:** see [DEPLOY.md](./DEPLOY.md)

GitHub repo: [joebigtoe0-sketch/aithingi](https://github.com/joebigtoe0-sketch/aithingi)

Quick checklist: push to GitHub → Railway **Deploy from GitHub** → add **PostgreSQL** → set `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD` → generate public domain.

Health check: `GET /api/health`

## API (summary)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | — | Status |
| GET | `/api/config` | — | `aiEnabled`, `database` |
| POST | `/api/admin/login` | — | Returns bearer token |
| POST | `/api/admin/generate` | Admin | AI draft from brief |
| GET | `/api/log` | — | Full log |
| POST | `/api/log` | Admin | Inject entry |
| PATCH | `/api/log/:id` | Admin | Redact / visibility |
| DELETE | `/api/log/:id` | Admin | Remove entry |
| GET | `/api/projects` | — | Developer registry |

## V1 scope notes

- Launches and spawns are still **manual** from admin (spawn sequence is scripted client-side).
- Live background ticks run only in **offline/localStorage** mode; with the API, the log is DB-backed and polled.
- Projects in the UI still read from `public/data.js` seed; DB `projects` table is seeded for AI context and future CRUD.
