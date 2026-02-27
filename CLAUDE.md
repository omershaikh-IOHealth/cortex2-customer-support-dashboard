# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cortex 2.0** is a real-time support center operations dashboard for MedGulf. It monitors support tickets, SLA compliance, escalations, and AI-assisted workflows. The app is a **unified Next.js 14 application** — the backend API lives as Next.js App Router API routes, with no separate Express server.

## Commands

```bash
npm install       # Install all dependencies
npm run dev       # Next.js dev server on port 3000
npm run build     # Production build
npm run lint      # ESLint
```

Single `.env.local` at the repo root (copy from `.env.local.example`):
```
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=
CORE42_API_KEY=
N8N_WEBHOOK_URL=   # optional — for Force Sync Now feature
```

## Architecture

### Data flow
```
Browser → Next.js App Router pages → React Query → Axios (lib/api.js, relative paths)
       → Next.js API routes (app/api/**/route.js) → PostgreSQL (lib/db.js pool → test.* schema)
```

### Key library files
- `lib/db.js` — Singleton `pg.Pool`. All API routes import this.
- `lib/api.js` — All Axios API wrapper functions. Base path `/api`, 10s timeout.
- `lib/auth.js` — `useAuth` hook and `apiFetch` (uses relative paths, not localhost).
- `lib/utils.js` — Formatting helpers and `cortex-*` color mapping for priorities/SLA.
- `lib/schema-context.js` — Full DB schema string injected into AI Companion system prompt.

### API routes (`app/api/`)
All routes use `import pool from '@/lib/db'` and return `NextResponse.json(...)`. Always use parameterized queries (`$1, $2` placeholders). All queries filter `company_code = 'medgulf'` and `is_deleted = false`.

Key route groups:
- `metrics/overview` — Dashboard KPIs
- `tickets` + `tickets/[id]` — Ticket list/detail with filters; `last_status_change_at` computed via subquery on `test.threads`
- `tickets/[id]/notes` — Internal notes (action_type='internal_note', thread_source='internal')
- `tickets/[id]/hold` — SLA pause/resume (sets `sla_paused_at`, `sla_status`)
- `tickets/[id]/similar` — Resolved tickets sharing module+request_type+case_type
- `sla/critical` — Tickets at/above SLA warning threshold
- `escalations`, `logs` — Alerts and processing logs
- `analytics/trends` — Returns `{ current: [...30 days], previous: [...30 days] }` for WoW comparison
- `analytics/priority-distribution` — Includes `avg_resolution_hours` per priority
- `admin/*` — CRUD for all config entities (companies, POCs, solutions, SLA/escalation configs, assignees, modules, request types, case types, KPIs); `admin/sync` triggers N8N webhook
- `qa/sample` — `ORDER BY RANDOM() LIMIT $N`, supports priority/status/date filters
- `companion/chat`, `companion/clear`, `companion/history` — AI Companion using Core42 LLM

### Frontend pages (`app/`)
- `dashboard/page.js` — KPI metric cards, escalations feed
- `tickets/page.js` — Table with filter presets (localStorage), SLA pause toggle, "Time in Status" column
- `tickets/[id]/page.js` — Detail: live SLA countdown, internal notes, similar tickets, soft hold, "Ask AI" button
- `analytics/page.js` — 30-day trends with WoW toggle, priority breakdown with avg resolution time
- `qa/page.js` — Random ticket sampling with CSV export
- `admin/page.js` — Full CRUD for all config entities + Force Sync Now button
- `sla/page.js`, `escalations/page.js`, `logs/page.js`

### Layout & UI
- `app/layout.js` — Root layout wrapping all pages with Sidebar + AICompanion
- `components/ui/Sidebar.js` — Navigation (Dashboard, Tickets, SLA Monitor, Escalations, Analytics, QA Sampling, System Logs, Admin)
- `components/ui/AICompanion.js` — Floating chat panel (admin/support only). Exports `openCompanionWith(message)` global event for cross-page trigger. Shows SLA alert chips with countdown timers when open.
- `components/ui/Modal.js`, `MetricCard.js`, `ThemeToggle.js`

### Design System
Custom Tailwind theme with `cortex-*` tokens: `cortex-bg`, `cortex-surface`, `cortex-text`, `cortex-accent`, `cortex-muted`, `cortex-border`, `cortex-success`, `cortex-warning`, `cortex-danger`, `cortex-critical`. Global component classes (`.card`, `.badge`, `.btn-primary`, `.btn-secondary`, `.input`, `.table-header`, `.table-cell`) defined in `app/globals.css`. Fonts: IBM Plex Sans (body), Inter Tight (display), JetBrains Mono (mono).

### Database schema
All tables in the `test` schema: `test.tickets`, `test.threads`, `test.sla_alerts`, `test.companies`, `test.solutions`, `test.pocs`, `test.sla_configs`, `test.escalation_configs`, `test.assignee_configs`, `test.modules`, `test.request_types`, `test.case_types`, `test.kpi_configs`, `test.processing_logs`, `test.companion_sessions`.

## Adding New Features

1. Add API route handler in `app/api/<feature>/route.js` using parameterized SQL via `pool`
2. Add API wrapper in `lib/api.js`
3. Create page at `app/<feature>/page.js` using `useQuery` with a `refetchInterval`
4. Add nav link to `components/ui/Sidebar.js`
5. Style with `cortex-*` Tailwind classes and `.card` / `.badge` component classes
