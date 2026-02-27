# Cortex 2.0 — Feature Reference

Complete feature inventory for the MedGulf support operations dashboard.

---

## Authentication & Security

- **Role-based access** — `admin` and `agent` roles enforced in middleware; agents cannot access admin routes
- **Account lockout** — 5 consecutive failed logins trigger a 15-minute lock
- **Audit trail** — every login attempt (success or failure) logged to `test.auth_logs` with IP and user agent
- **JWT sessions** — NextAuth v5 with short-lived tokens; `current_session_tok` stored per user for single-session enforcement
- **Login error messages** — lockout countdown shown in UI

---

## Admin Portal

### Dashboard (`/dashboard`)
- KPI cards: Active Tickets, Critical SLA, High Escalations, Avg SLA Consumption
- Critical SLA feed (top 5 tickets, live countdown)
- Recent tickets and escalations feed
- System status indicators (ClickUp sync, DB, AI, Escalations)
- Auto-refreshes every 30 seconds

### Ticket Management (`/tickets`)
- Paginated ticket list with server-side filtering
- Filter presets saved to localStorage
- Filters: status, priority, SLA status, escalation level, assignee, free-text search
- Smart sort: critical SLA → at-risk → escalated → newest
- "Time in Status" column (derived from thread history)
- SLA pause/resume toggle per ticket
- Auto-refreshes every 30 seconds

### Ticket Detail (`/tickets/[id]`)
- Live SLA countdown timer (response + resolution deadlines)
- Full activity thread with comments, status changes, field changes
- Internal notes (admin-only, not synced to ClickUp)
- Similar tickets panel (same module + request type + case type, resolved)
- Soft hold (pause SLA) with confirmation
- Status change dropdown, Escalate button, Re-assign dropdown
- "Ask AI" button — opens AI Companion pre-populated with ticket context
- ClickUp task link

### SLA Monitor (`/sla`)
- All tickets at or above the warning threshold
- Status breakdown: Critical / At Risk / Warning / total
- Large SLA % display per ticket, visual progress bar
- Auto-refreshes every 15 seconds (fastest refresh rate)

### Escalations (`/escalations`)
- All active escalation alerts grouped by level (1–3)
- Notification recipients list
- Acknowledgment status and timestamp

### Analytics (`/analytics`)
- 30-day ticket trend (area chart, daily volume)
- Week-over-week toggle (current vs previous 30 days overlay)
- Priority distribution (pie chart)
- Average resolution hours per priority (bar chart)
- Priority breakdown cards with counts + avg SLA consumption

### QA Sampling (`/qa`)
- Random ticket sampling (`ORDER BY RANDOM()`)
- Filters: priority, status, date range, sample size
- CSV export of results

### System Logs (`/logs`)
- Last 100 workflow execution logs
- Success / error / warning status with colour coding
- Full metadata JSON, error messages, timestamps

### ROTA Management (`/rota`)
- Weekly calendar grid (Mon–Sun)
- Create shifts with agent, date, start/end times, shift type, notes
- Scheduled breaks per shift (type: scheduled / lunch)
- Drag-and-drop to move shifts between days
- Delete shifts with confirmation
- Week navigation (prev / next / today)
- Timezone-safe date handling (`TO_CHAR` prevents UTC offset bugs)

### Agent Status Viewer (`/agent-status`)
- Live grid of all agents with current status, duration, and status note
- Status badges: Available (green), On Call (amber), On Break (blue), Meeting (purple), Not Ready (red), Offline (grey)
- Break overtime warning (highlights agents on break > 30 min)
- Auto-refreshes every 30 seconds

### Admin Configuration (`/admin`)
- Full CRUD for: Companies, POCs, Solutions, SLA Configs, Escalation Configs, Assignees, Modules, Request Types, Case Types, KPIs
- Circular (Knowledge Base) management with version history and archive
- User management (create, edit, deactivate agents/admins; set ZIWO credentials)
- **Force Sync Now** — triggers n8n webhook for a manual ClickUp sync
- **Sync Assignments** — backfills `assigned_to_email` / `assigned_to_id` on all tickets from ClickUp assignees

---

## Agent Portal

### Briefing (`/briefing`)
- Today's shift details (start/end time, type, notes)
- Scheduled breaks for the shift
- Full weekly rota view

### My Tickets (`/my-tickets`)
- Tickets assigned to the logged-in agent
- Org/Client filter dropdown
- Status and priority filters
- Same smart-sort as admin ticket list

### Agent Dashboard (`/agent-dashboard`)
- Personal KPIs: tickets handled, avg resolution, SLA compliance rate
- Call log summary for today
- Status history

### Knowledge Base (`/knowledge-base`)
- Search circulars by title or content
- Filter by category
- Full article view
- Admin users see create / edit / archive controls inline

---

## AI Companion

- Floating chat panel available on all admin pages (bottom-right)
- Powered by Core42 LLM
- Full DB schema injected into system prompt — can answer questions about any ticket, SLA, agent, or trend
- Session-based history per user (`test.companion_sessions`)
- `openCompanionWith(message)` global event — any page can open the companion pre-filled (e.g. "Ask AI" on ticket detail)
- SLA alert chips with live countdown shown when companion is open
- Clear session button
- Role-aware: agents get company-filtered context

---

## ZIWO Phone Integration

- WebRTC softphone widget (bottom-right of agent pages)
- Powered by `ziwo-core-front` SDK (CDN loaded)
- Agent ZIWO credentials fetched from DB via `/api/users/me`
- Call features: answer, reject, hang up, hold/unhold, mute/unmute, DTMF dial pad
- Outbound dialling with numeric keypad
- Call duration timer (live)
- Post-call summary (duration, direction, number, cause)
- All calls logged to `test.call_logs` automatically after hangup
- **Live status sync** — changing status in the dashboard pushes to ZIWO via `/api/ziwo/status`:

| Cortex status | ZIWO number |
|---|---|
| Available | 1 |
| On Break | 2 |
| Meeting | 3 |
| Not Ready | 5 |

---

## Agent Status System

- Status selector in AgentSidebar: **Available**, **On Break**, **Meeting**, **Not Ready**
- Status stored in `test.agent_status` (upsert per user)
- Duration timer counts elapsed time in current status
- ZIWO status pushed on every change (fire-and-forget, non-blocking)
- Admin Agent Status Viewer reflects all changes in real time

---

## ClickUp Integration

- New tickets created in Cortex are pushed to ClickUp (`POST /list/{id}/task`)
- Task name format: `ticketNo-{id} | {summary}`
- Custom fields synced: Request Type, Case Type (dropdown option UUIDs verified)
- Status and priority updates pushed on ticket changes
- Default assignee: Asif K (ClickUp user 87796566)
- **Sync Assignments** admin button backfills all ticket assignees from ClickUp in bulk

---

## Notifications

- In-app notification bell (top of sidebar) with unread badge
- Notification types: ticket assigned, escalation triggered, SLA breach, circular published
- Mark as read individually or all-at-once
- Stored in `test.notifications`

---

## Top Alert Bar

- Shown at the top of all admin pages
- Displays open critical SLA breaches with ticket IDs
- Links directly to the relevant ticket detail page

---

## Design System

Custom Tailwind theme with `cortex-*` tokens:

| Token | Usage |
|---|---|
| `cortex-bg` | Page background |
| `cortex-surface` | Card/panel background |
| `cortex-text` | Primary text |
| `cortex-accent` | Brand blue (interactive elements) |
| `cortex-muted` | Secondary text |
| `cortex-border` | Borders, dividers |
| `cortex-success` | Green — healthy/available |
| `cortex-warning` | Amber — at risk / on break |
| `cortex-danger` | Red — critical / not ready |
| `cortex-critical` | Highest severity |

Global component classes: `.card`, `.badge`, `.btn-primary`, `.btn-secondary`, `.input`, `.table-header`, `.table-cell`

Fonts: **IBM Plex Sans** (body) · **Inter Tight** (display) · **JetBrains Mono** (mono/data)

Dark mode and light mode supported with FOUC prevention via `next/headers` cookie check.

---

## Auto-Refresh Intervals

| Page | Interval |
|---|---|
| SLA Monitor | 15 seconds |
| Dashboard | 30 seconds |
| Tickets | 30 seconds |
| Escalations | 30 seconds |
| Logs | 30 seconds |
| Agent Status Viewer | 30 seconds |
| Rota | 60 seconds |
| Analytics | On demand |
