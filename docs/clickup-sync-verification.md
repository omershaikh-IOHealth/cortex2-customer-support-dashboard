# ClickUp ↔ Cortex Sync — Verification Guide

Complete this guide top-to-bottom after deploying the changes.

---

## Prerequisites

`.env.local` already contains all required vars:
```
CLICKUP_API_TOKEN=pk_93735320_...
CLICKUP_LIST_ID=901215777514
DB_HOST=aws-1-ap-northeast-1.pooler.supabase.com
DB_PORT=6543
DB_USER=postgres.alobxvlwznumwikxqewb
DB_NAME=postgres
DB_PASSWORD=...
```

---

## A. DB Migration

Run once against Supabase (uses your `.env.local` individual vars):

```bash
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f migrations/003_zoho_ticket_unique.sql
```

Or paste the exact connection string (load vars from `.env.local` first):
```bash
# Load vars then connect
export $(grep -v '^#' .env.local | xargs)
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f migrations/003_zoho_ticket_unique.sql
```

**Verify:**
```sql
-- Should show unique constraint
SELECT conname FROM pg_constraint
WHERE conrelid = 'main.tickets'::regclass AND conname = 'tickets_zoho_ticket_id_unique';

-- Should show new column
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'main' AND table_name = 'tickets' AND column_name = 'linked_clickup_task_ids';
```

---

## B. ClickUp Custom Fields

Verify all 5 custom fields are present on list 901215777514:

```bash
curl -s "https://api.clickup.com/api/v2/list/901215777514/field" \
  -H "Authorization: $CLICKUP_API_TOKEN" \
  | node -e "
const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
d.fields.forEach(f=>console.log(f.id, f.name));
"
```

Expected fields:
| Name | UUID |
|------|------|
| Request Type | `83ff465c-0075-495c-aeb8-7db8cc56110a` |
| Case Type | `de899780-bc87-4ec2-ba94-fe01690ab330` |
| Project | `c75f543d-799e-4d4e-80c9-193cc1c765bc` |
| Module | `7543a2bd-1322-407f-b171-9295dca96a5b` |
| Cortex Ticket ID | `3b2e3ed4-3c4b-42bd-a3fd-6ae3513c8e12` |

---

## C. Zoho → DB Workflow Fix

1. Re-import `Zoho Desk - Clickup Sync (Modified).json` into n8n
2. Send a test Ticket_Add webhook payload to the Zoho webhook URL
3. In n8n execution log, confirm `Insert Ticket to DB` node is **green**
4. Check DB:
   ```sql
   SELECT id, zoho_ticket_id, clickup_task_id, title
   FROM main.tickets
   ORDER BY created_at DESC LIMIT 3;
   ```
5. Check ClickUp list — new task should appear with:
   - Name: `ticketNo-{id} | {title}`
   - Project = MedGulf
   - Request Type set (if mapped)
   - Module set (if mapped)

**Root cause fixed:** `company_code` column was being inserted but doesn't exist on `main.tickets` — caused every Zoho→DB INSERT to fail silently.

---

## D. Backfill (~60 existing tickets)

```bash
node scripts/backfill-clickup.js
```

Expected output:
```
=== ClickUp Backfill Script ===
Found 60 tickets without ClickUp task IDs
  Creating  #1 [email] — ...
  ✓  Created abc123 → https://app.clickup.com/...
  SKIP FCR  #5 — ...
  ...
=== Summary ===
Created:  55
Skipped:  5 (FCR calls)
Failed:   0
Total:    60
```

**Verify:**
```sql
SELECT COUNT(*) FROM main.tickets WHERE clickup_task_id IS NOT NULL;
```

Go to ClickUp list → filter `Project = MedGulf` → should see ~55 tasks.

---

## E. ClickUp → DB Sync (clickup-cortex-sync)

1. Re-import `clickup-cortex-sync (Modified).json` into n8n
2. In ClickUp, change a backfilled task's status to **In Progress**
3. Manually trigger the workflow (or wait up to 1 minute for the scheduler)
4. Check DB:
   ```sql
   SELECT status, updated_at FROM main.tickets
   WHERE clickup_task_id = '<changed_task_id>';
   -- Expect: status = 'in progress'
   ```
5. Add a comment on a ClickUp task → re-run sync:
   ```sql
   SELECT action_type, thread_source, raw_content
   FROM main.threads WHERE ticket_id = <id>
   ORDER BY created_at DESC LIMIT 3;
   -- Expect: thread_source = 'clickup'
   ```

**Project filter:** The workflow now skips ClickUp tasks where `Project ≠ MedGulf`, preventing the whole team workspace from syncing into Cortex.

---

## F. Linked Task Tracking

1. In ClickUp, open a MedGulf support task and link it to a task from another space (right-click → Relationships → Link task)
2. Run the clickup-cortex-sync workflow
3. Check DB:
   ```sql
   SELECT linked_clickup_task_ids FROM main.tickets
   WHERE clickup_task_id = '<task_id>';
   -- Expect: array containing linked task ID(s)
   ```
4. Add a comment on the **linked task** → re-run sync:
   ```sql
   SELECT thread_source, metadata FROM main.threads
   WHERE ticket_id = <id> ORDER BY created_at DESC LIMIT 3;
   -- Expect: thread_source = 'linked_clickup_task'
   -- metadata.linked_task_id should be set
   ```
5. Open ticket detail in Cortex UI → thread should show purple **"Linked Task"** badge

---

## G. Zoho Thread Sync (Thread_Add)

1. In Zoho Desk, reply to an existing ticket that has a `zoho_ticket_id` in the Cortex DB
2. Trigger the `thread-add` webhook path in n8n (Zoho sends this automatically on reply)
3. Verify:
   ```sql
   SELECT action_type, thread_source, raw_content, actor_email
   FROM main.threads
   WHERE action_type = 'customer_reply'
   ORDER BY created_at DESC LIMIT 3;
   -- Expect: thread_source = 'zoho'
   ```
4. Open ticket detail in Cortex → thread should show green **"Zoho"** badge

**Configuration:** In Zoho Desk → Settings → Developer Space → Webhooks, add a webhook for `Thread_Add` events pointing to:
```
https://<your-n8n-host>/webhook/thread-add
```

---

## H. Link Email as Thread (UI)

1. Open any admin ticket detail page (`/tickets/{id}`)
2. In the **Activity Thread** section header, click **"Link email"** button
3. A modal opens — search for another ticket by title or ID
4. Click a result to link it
5. The modal closes and the thread list refreshes
6. The new thread entry should show an orange **"Linked Email"** badge
7. Verify via API:
   ```bash
   curl -X POST https://localhost:3000/api/tickets/{id}/link-as-thread \
     -H "Content-Type: application/json" \
     -d '{"source_ticket_id": 5}'
   # Expected: { "ok": true, "thread_id": ..., "source_ticket": {...} }
   ```

---

## I. Thread Source Badges

Open a ticket that has threads from multiple sources and verify:

| `thread_source` | Badge colour | Label |
|---|---|---|
| `clickup` | Blue | **ClickUp** |
| `zoho` | Green | **Zoho** |
| `linked_clickup_task` | Purple | **Linked Task** (or **Linked: {task name}**) |
| `linked_email` | Orange | **Linked Email** |
| `internal` | _(none)_ | _(no source badge — action_type badge only)_ |

---

## J. Call Ticket FCR Gate

| Scenario | `push_to_clickup` | Expected ClickUp outcome |
|---|---|---|
| FCR call (resolved on first contact) | `false` | No task created |
| Non-FCR call (open, needs follow-up) | `true` (default) | Task created with `channel=call` |
| Email / Apex / Zoho ticket | `true` (default) | Task created normally |

**Test:**
```bash
# FCR — should NOT create ClickUp task
curl -X POST /api/tickets -H "Content-Type: application/json" \
  -d '{"title":"Test FCR call","channel":"call","push_to_clickup":false}'

# Non-FCR — SHOULD create ClickUp task
curl -X POST /api/tickets -H "Content-Type: application/json" \
  -d '{"title":"Test open call","channel":"call","push_to_clickup":true}'
```

---

## Full End-to-End Test

Simulate the complete Zoho → Cortex → ClickUp → update → sync-back cycle:

1. Send a test `Ticket_Add` Zoho webhook → ticket created in DB with `zoho_ticket_id` **and** `clickup_task_id`
2. In Cortex UI, change ticket status to **In Progress** → confirm ClickUp task updates automatically
3. In ClickUp, change status to **Complete** → run clickup-cortex-sync → confirm DB status = `complete`
4. Customer replies in Zoho (`Thread_Add`) → confirm thread appears in Cortex ticket detail with Zoho badge
5. Link a task from another space in ClickUp → run sync → confirm `linked_clickup_task_ids` populated
6. Add comment on linked task → run sync → confirm thread appears with purple Linked Task badge
