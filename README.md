# Cortex 2.0

Real-time support center operations dashboard for MedGulf. Monitors tickets, SLA compliance, escalations, and agent operations — with a built-in AI companion, ZIWO phone widget, and ClickUp sync.

---

## Architecture

Single **Next.js 14** application. No separate backend server.

```
Browser → Next.js App Router pages → React Query → Axios (lib/api.js)
       → Next.js API routes (app/api/**/route.js)
       → PostgreSQL (lib/db.js → test.* schema)
```

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth v5 (JWT sessions) |
| Database | PostgreSQL — `test` schema |
| Styling | Tailwind CSS + custom `cortex-*` tokens |
| Data fetching | React Query + Axios |
| Phone | ZIWO WebRTC SDK |
| AI | Core42 LLM (AI Companion) |
| Ticketing | ClickUp REST API |
| Workflow | n8n (optional webhook sync) |

---

## Quick Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Database (VPN required)
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=

# Auth
AUTH_SECRET=          # generate with: openssl rand -base64 32

# AI Companion
CORE42_API_KEY=

# ClickUp integration
CLICKUP_API_TOKEN=    # Personal API token from ClickUp Settings → Apps
CLICKUP_LIST_ID=      # e.g. 901215777514

# Optional — enables Force Sync Now button
N8N_WEBHOOK_URL=
```

### 3. Run database migrations

Start the dev server first, then hit:

```
GET http://localhost:3000/api/setup?key=YOUR_AUTH_SECRET
```

### 4. Start

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # ESLint
```

---

## Default Credentials

| Email | Password | Role |
|---|---|---|
| ann.shruthy@iohealth.com | _(see team credentials store)_ | Admin |
| asif.k@iohealth.com | _(see team credentials store)_ | Agent |

---

## Access by Role

### Admin (`/dashboard`, `/tickets`, `/sla`, `/escalations`, `/analytics`, `/qa`, `/logs`, `/admin`, `/rota`, `/agent-status`)

Full visibility across all tickets, SLA, escalations, analytics, QA sampling, system logs, and all admin configuration (companies, POCs, solutions, SLA rules, escalation configs, assignees, modules, request types, case types, KPIs, circulars, shift rotas, agent accounts).

### Agent (`/briefing`, `/my-tickets`, `/agent-dashboard`, `/knowledge-base`)

Personal shift briefing, own ticket queue, per-agent performance dashboard, knowledge base search. Status control (Available / On Break / Meeting / Not Ready) syncs live to ZIWO.

---

## Key Files

| File | Purpose |
|---|---|
| `lib/db.js` | Singleton `pg.Pool` |
| `lib/api.js` | All Axios API wrappers (base `/api`, 10s timeout) |
| `lib/auth.js` | `useAuth()` hook |
| `lib/clickup.js` | ClickUp create/update task helpers |
| `lib/schema-context.js` | Full DB schema injected into AI Companion prompt |
| `auth.js` | NextAuth v5 config (root) |
| `middleware.js` | Route protection and role enforcement |
| `app/api/**/route.js` | All API routes |
| `components/ui/Sidebar.js` | Admin navigation |
| `components/ui/AgentSidebar.js` | Agent navigation + live status selector |
| `components/ui/AICompanion.js` | Floating AI chat panel |
| `components/ui/ZiwoWidget.js` | WebRTC phone widget |

---

## Database

All tables in the `test` schema. All ticket queries filter `company_id` for MedGulf and `is_deleted = false`.

Core tables: `tickets`, `threads`, `sla_alerts`, `companies`, `solutions`, `pocs`, `sla_configs`, `escalation_configs`, `assignee_configs`, `modules`, `request_types`, `case_types`, `kpi_configs`, `processing_logs`, `companion_sessions`, `users`, `agent_status`, `call_logs`, `shift_rotas`, `shift_breaks`, `circulars`, `circular_versions`, `notifications`, `auth_logs`.

---

## Adding a New Feature

1. Add API route in `app/api/<feature>/route.js` (parameterised SQL via `pool`)
2. Add Axios wrapper in `lib/api.js`
3. Create page at `app/<feature>/page.js` using `useQuery` with `refetchInterval`
4. Add nav link in `components/ui/Sidebar.js` (admin) or `AgentSidebar.js` (agent)
5. Style with `cortex-*` Tailwind classes and `.card` / `.badge` / `.btn-primary`

---

## Security Notes

- `.env.local` is gitignored — never commit it
- Auth lockout: 5 failed attempts → 15-minute account lock
- All auth events logged to `test.auth_logs`
- Agents can only read/modify their own data; admins are unrestricted
- All DB queries use parameterised placeholders (`$1, $2`) — no string interpolation

---

**Built for:** MedGulf support operations
**Stack:** Next.js 14 · NextAuth v5 · PostgreSQL · Tailwind CSS · React Query · ZIWO · Core42 · ClickUp
