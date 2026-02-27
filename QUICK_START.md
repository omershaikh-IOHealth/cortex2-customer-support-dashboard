# Cortex 2.0 — Quick Start

## Prerequisites

- Node.js 18+
- VPN access to the database server (`10.0.10.189`)
- ClickUp Personal API Token (Settings → Apps → API Token)
- Core42 API key

---

## 1. Install

```bash
npm install
```

## 2. Configure

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```env
DB_HOST=10.0.10.189
DB_PORT=5432
DB_NAME=<your_db_name>
DB_USER=<your_db_user>
DB_PASSWORD=<your_db_password>

AUTH_SECRET=<run: openssl rand -base64 32>

CORE42_API_KEY=<your_core42_key>

CLICKUP_API_TOKEN=pk_<your_personal_token>
CLICKUP_LIST_ID=901215777514

# Optional
N8N_WEBHOOK_URL=
```

## 3. Run migrations

Start the app first:

```bash
npm run dev
```

Then in your browser (one time only):

```
http://localhost:3000/api/setup?key=<your AUTH_SECRET value>
```

You should see `{"ok":true,"migrations":[...]}`.

## 4. Log in

Open **http://localhost:3000** — you'll be redirected to `/login`.

| Email | Password | Role |
|---|---|---|
| ann.shruthy@iohealth.com | W@c62288 | Admin |
| asif.k@iohealth.com | Agent@Cortex2025 | Agent |

---

## What you'll see

### Admin
- `/dashboard` — KPI overview + live SLA feed
- `/tickets` — full ticket list with filters
- `/sla` — SLA monitor (15s refresh)
- `/escalations` — escalation alerts
- `/analytics` — 30-day trends, WoW comparison
- `/qa` — random ticket sampling + CSV export
- `/logs` — workflow execution logs
- `/rota` — weekly shift calendar (drag & drop)
- `/agent-status` — live agent availability grid
- `/admin` — full configuration + user management

### Agent
- `/briefing` — today's shift + weekly rota
- `/my-tickets` — own ticket queue
- `/agent-dashboard` — personal KPIs
- `/knowledge-base` — searchable circulars

---

## Common Issues

**Database connection refused**
→ Check VPN is connected and credentials in `.env.local` are correct

**`AUTH_SECRET` error on startup**
→ Make sure `AUTH_SECRET` is set — run `openssl rand -base64 32` to generate one

**ClickUp token error (OAUTH_025)**
→ You're using the wrong token type. Use the **Personal API Token** (`pk_...`) from ClickUp Settings → Apps, not an OAuth token

**Login works but page shows empty data**
→ Verify the DB has `company_code = 'medgulf'` data and VPN is active

**ZIWO widget doesn't connect**
→ The logged-in user needs `ziwo_email` and `ziwo_password` set in Admin → Users

---

## Useful commands

```bash
npm run dev      # development server (port 3000)
npm run build    # production build
npm run lint     # ESLint check
```
