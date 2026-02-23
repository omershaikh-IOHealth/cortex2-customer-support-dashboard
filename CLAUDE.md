# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Cortex 2.0** is a real-time support center operations dashboard for MedGulf. It monitors support tickets, SLA compliance, escalations, and workflows. The app is a monorepo with:

- `backend/` — Express.js REST API (Node.js + PostgreSQL)
- `frontend/` — Next.js 14 dashboard (React + React Query + Tailwind CSS)

## Commands

### Backend
```bash
cd backend
npm install
npm run dev    # node --watch server.js (dev with hot reload)
npm start      # node server.js (production)
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # Next.js dev server on port 3000
npm run build  # Production build
npm run lint   # ESLint
```

### Running the full stack
Start both terminals simultaneously. Frontend proxies `/api` calls to `http://localhost:5000` via `next.config.js` rewrites.

Health check: `GET http://localhost:5000/api/health`

### Environment setup
```bash
# Backend
cp backend/.env.example backend/.env
# Fill in: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, PORT, NODE_ENV

# Frontend
cp frontend/.env.local.example frontend/.env.local
# NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Architecture

### Data flow
```
Browser → Next.js App Router → React Query → Axios (frontend/lib/api.js)
    → Express REST API (backend/server.js) → PostgreSQL (test.* schema)
```

### Backend
All API logic is in a single file: **`backend/server.js`** (~1,000 lines). It exposes 40+ REST endpoints. Database uses a pg connection pool (max 20 connections). All queries filter by `company_code = 'medgulf'` and `is_deleted = false`.

Key endpoint groups:
- `/api/metrics/*` — Dashboard KPIs
- `/api/tickets` — Ticket list/details with filters
- `/api/sla/*` — SLA status
- `/api/escalations` — Alert management
- `/api/analytics/*` — Trend charts
- `/api/logs` — Workflow execution logs
- `/api/admin/*` — CRUD for all configuration entities (companies, POCs, solutions, SLA configs, escalation configs, assignees, modules, request types, case types, KPIs)

### Frontend
Uses the **Next.js App Router**. Key files:

- `frontend/lib/api.js` — All API functions (Axios wrapper with base `/api` path, 10s timeout)
- `frontend/lib/utils.js` — Formatting helpers and color mapping for priorities/SLA status
- `frontend/app/providers.js` — React Query setup (30s stale time, no refetch on window focus, 1 retry)
- `frontend/app/layout.js` — Root layout with sidebar and AI companion
- `frontend/components/ui/Sidebar.js` — Navigation (7 sections: Dashboard, Tickets, SLA Monitor, Escalations, Analytics, System Logs, Admin)
- `frontend/components/ui/AICompanion.js` — Chat interface (role-based, admin/support only)

Page auto-refresh intervals:
- SLA Monitor: 15 seconds
- All other pages: 30 seconds

### Design System
Custom Tailwind theme in `frontend/tailwind.config.js` with `cortex-*` color tokens (`cortex-bg`, `cortex-surface`, `cortex-text`, `cortex-accent`, `cortex-success`, `cortex-warning`, `cortex-danger`, `cortex-critical`). Global component classes (`.card`, `.badge`, `.btn-primary`, etc.) are defined in `frontend/app/globals.css`. Fonts: IBM Plex Sans (body), Inter Tight (display), JetBrains Mono (code).

### Database schema
All tables are in the `test` schema. Key tables: `test.tickets`, `test.threads`, `test.sla_alerts`, `test.companies`, `test.solutions`, `test.pocs`, `test.sla_configs`, `test.escalation_configs`, `test.assignee_configs`, `test.modules`, `test.request_types`, `test.case_types`, `test.kpi_configs`, `test.processing_logs`.

## Adding New Features

1. Add endpoint in `backend/server.js`
2. Add API wrapper function in `frontend/lib/api.js`
3. Create page at `frontend/app/<feature>/page.js`
4. Use `useQuery` from React Query with a `refetchInterval` for auto-refresh
5. Use `cortex-*` Tailwind classes and `.card` / `.badge` component classes for styling

## Current Uncommitted Changes
- `frontend/app/admin/page.js` — Toast notifications, domain display, query optimizations
- `frontend/components/ui/Sidebar.js` — Navigation updates
- `frontend/lib/api.js` — Switched from absolute to relative API paths
- `frontend/next.config.js` — API proxy rewrites added
- `frontend/app/config/page.js` — Deleted (config moved into admin panel)
