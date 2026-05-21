# Deploy AITHINGI to Railway + GitHub

Repo: [joebigtoe0-sketch/aithingi](https://github.com/joebigtoe0-sketch/aithingi)

One Railway **web service** runs the Node server (API + `public/` UI). Add **PostgreSQL** in the same Railway project for persistent log storage.

---

## Part 1 — Push code to GitHub

From your project folder (`AITHING`):

```powershell
cd c:\Users\nikos\AITHING

git init
git add .
git commit -m "Initial Railway deploy setup"
git branch -M main
git remote add origin https://github.com/joebigtoe0-sketch/aithingi.git
git push -u origin main
```

If the remote already exists:

```powershell
git remote set-url origin https://github.com/joebigtoe0-sketch/aithingi.git
git push -u origin main
```

**Do not commit** `server/.env` — it is gitignored. Secrets go only in Railway variables.

---

## Part 2 — Create Railway project

1. Go to [railway.app](https://railway.app) → **New Project**.
2. Choose **Deploy from GitHub repo**.
3. Select **joebigtoe0-sketch/aithingi** (authorize GitHub if prompted).
4. Railway detects `railway.toml` and builds with Nixpacks.

No need to set a custom root directory — config runs `cd server && npm ci` then starts `server/index.js`.

---

## Part 3 — Add PostgreSQL

1. In the same Railway project, click **+ New** → **Database** → **PostgreSQL**.
2. Open your **web service** (not the database) → **Variables**.
3. Add a reference to the database URL:
   - Click **+ New Variable** → **Add Reference** (or paste manually).
   - Variable name: `DATABASE_URL`
   - Reference: `${{Postgres.DATABASE_URL}}`  
     (name may be `Postgres` or `PostgreSQL` depending on Railway UI — pick the Postgres plugin you created.)

The app seeds an **empty** log and project list on first boot.

---

## Part 4 — Required environment variables

On the **web service** → **Variables**, set:

| Variable | Required | Notes |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | Yes | From [Anthropic console](https://console.anthropic.com/) |
| `ADMIN_PASSWORD` | Yes | Admin login for `#/admin` — use a strong value, not `central` |
| `DATABASE_URL` | Yes (prod) | Reference from Postgres plugin (step 3) |
| `ANTHROPIC_MODEL` | No | Default: `claude-sonnet-4-20250514` |
| `CENTRAL_BRAIN_SYSTEM_PROMPT` | No | Override CENTRAL system rules |

Railway sets `PORT` automatically — do not override it.

---

## Part 5 — Public URL

1. Web service → **Settings** → **Networking** → **Generate Domain**.
2. Open `https://YOUR-DOMAIN.up.railway.app` — that is your live site.
3. Admin: `https://YOUR-DOMAIN.up.railway.app/#/admin`

After deploy, check:

- `https://YOUR-DOMAIN.up.railway.app/api/health`  
  Should return: `{"ok":true,"database":"postgres","ai":true}`

---

## Part 6 — First use on production

1. Open `/#/admin`.
2. Sign in with your **`ADMIN_PASSWORD`** (not the old offline `central` shortcut unless you set that as the password).
3. Status line should show: `backend · online` · `ai · ready` · `auth · ok`.
4. Use **Generate with AI** → **Inject** to post your first thought.

If you previously tested locally, production starts with an empty DB — expected.

---

## Redeploys

Every `git push` to `main` triggers a new Railway deploy (if GitHub integration is enabled).

```powershell
git add .
git commit -m "your message"
git push
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `backend · offline` on admin | Open the Railway URL, not a local HTML file |
| `ai · no API key` | Set `ANTHROPIC_API_KEY` on web service, redeploy |
| `auth · re-login` | Sign out, sign in again on production URL |
| Build fails | Check deploy logs; ensure `server/package-lock.json` is committed |
| DB errors | Confirm `DATABASE_URL` is referenced on the **web** service |
| Health check fails | Wait for deploy; visit `/api/health` manually |

---

## Optional — Railway CLI

```powershell
npm i -g @railway/cli
railway login
railway link
railway up
```

For most setups, GitHub → Railway auto-deploy is enough.
