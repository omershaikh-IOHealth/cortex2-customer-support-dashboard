# Cortex 2.0 — New Features Testing Guide

**How to use this guide:** For each feature, follow the steps exactly. After testing, note down what you saw — whether it matched "Expected Result" or not. If something looks wrong or broken, copy the error message you see and report it back.

---

## Before You Start

- Open the app in your browser
- **Admin tests:** log in as `ann.shruthy@iohealth.com`
- **Agent tests:** log in as `asif.k@iohealth.com`
- Both accounts need to be active for the full suite

---

## 1. Customers Page
**Sidebar → Customers**
**Who tests:** Both admin and agent

**Steps:**
1. In the left sidebar, click **Customers** (you'll see a small "NEW" badge next to it)
2. The page should open showing a list of all contacts
3. Type a name or email in the search box — the list should filter in real time
4. Click on any contact row to open their detail panel on the right
5. *(Admin only)* Edit a field (e.g. phone number) and click **Save** — it should show a success indicator
6. Scroll down in the detail panel to see the contact's linked tickets

**Expected result:** Contact list loads, search works, detail panel opens on click, VIP contacts show a ⭐ star next to their name.

**Comments:** ___________________________

---

## 2. Shift Briefing Acknowledgment
**Sidebar → Briefing (scroll to bottom)**
**Who tests:** Agent (asif)

**Steps:**
1. Log in as the agent and click **Briefing** in the sidebar
2. Scroll to the bottom of the page — you should see a card called **Shift Briefing** with a "NEW" badge
3. If today's shift is scheduled, there will be a green **Acknowledge Shift** button
4. Click the button
5. The button should change to **✓ Acknowledged** and show the current time

**Expected result:** Button becomes disabled and shows a green confirmation with timestamp. If no shift is scheduled today, the card will not appear — that is normal.

**Comments:** ___________________________

---

## 3. AI Risk Badge on Tickets
**Sidebar → Tickets**
**Who tests:** Admin

**Steps:**
1. Go to **Tickets** in the sidebar
2. Look at the **Priority** column — below each P1/P2/P3 badge you should see a coloured risk badge: **High Risk** (red), **Med Risk** (amber), or **Low Risk** (green)
3. Open any ticket by clicking its title
4. In the ticket header (where the priority badge is), you should also see the same risk badge

**Expected result:** Every ticket row shows a risk badge. The colour reflects AI sentiment + escalation level (red = most severe). Hover the "NEW" chip next to the column header to read the description.

**Comments:** ___________________________

---

## 4. Channel Tag — Voice / Email
**Sidebar → Tickets (admin) · My Tickets (agent)**
**Who tests:** Admin for ticket list; Agent for My Tickets

**Admin — Tickets page:**
1. Go to **Tickets**
2. Each ticket title should have a small **📞 Voice** or **✉ Email** badge above the title text

**Agent — My Tickets:**
1. Log in as agent, go to **My Tickets**
2. At the top, next to the status tabs (Open, In Progress…), you should see two new tabs: **📞 Voice** and **✉ Email**
3. Click **📞 Voice** — only voice channel tickets should appear
4. Click **✉ Email** — only email tickets should appear

**Expected result:** Channel badges show on every ticket. The Voice/Email filter tabs work correctly.

**Comments:** ___________________________

---

## 5. VIP Customer Flag
**Sidebar → Customers, then → Tickets**
**Who tests:** Admin

**Steps:**
1. Go to **Customers** in the sidebar
2. Find a contact and open their detail panel (click their row)
3. Check the **VIP** checkbox in the edit form and click **Save**
4. Now go to **Tickets** — any ticket linked to that contact should show a ⭐ symbol next to their email in the Reporter column

**Expected result:** ⭐ appears next to VIP contacts in the ticket list. The flag persists after page refresh.

**Comments:** ___________________________

---

## 6. Escalation Modal
**Sidebar → Tickets → open any ticket**
**Who tests:** Admin

**Steps:**
1. Open any ticket from the Tickets list
2. In the action toolbar below the title, click the amber **Escalate** button (you will see a "NEW" badge nearby)
3. A modal dialog should appear — NOT a browser popup
4. Select an escalation level (L1, L2, or L3) from the dropdown
5. Type a reason in the text box (required — the Escalate button stays disabled until you type something)
6. Click **Escalate**
7. The modal closes. Scroll down to the **Activity Thread** — the reason should appear as a new entry

**Expected result:** Modal opens cleanly, the reason field is required, escalation succeeds, reason is logged in the activity thread. The ticket's escalation badge in the header updates.

**Comments:** ___________________________

---

## 7. Internal Notes — Edit, Delete, @Mention & Sort
**Sidebar → Tickets → open any ticket → Internal Notes section**
**Who tests:** Admin

**Steps:**
1. Open any ticket and scroll to the **Internal Notes** section
2. Add a new internal note — type `@` and part of a colleague's name. A dropdown should appear; select them
3. Submit the note
4. The note appears in the thread. Hover over it — you should see **Edit** (pencil) and **Delete** (trash) icons
5. Click **Edit**, change the text, and save
6. Click the **↑ Oldest / Newest** sort toggle at the top of the Activity Thread to reverse the order

**Expected result:** @mention autocomplete works. Edit saves the new content. Delete removes the note after confirmation. Sort toggle reverses the thread order.

**Comments:** ___________________________

---

## 8. Avg Handle Time (AHT) & FCR Rate KPI Cards
**Sidebar → Dashboard (admin) · My Dashboard (agent)**
**Who tests:** Admin on Dashboard; Agent on My Dashboard

**Admin Dashboard:**
1. Go to **Dashboard**
2. In the KPI grid, look for two new cards: **Avg Handle Time** and **FCR Rate**
3. If call logs exist, they should show values (e.g. "3.2 min" and "74%"). If no calls have been synced yet, they show "— min" and "—%" — that is normal until call logs are populated

**Agent Dashboard:**
1. Log in as agent, go to **My Dashboard**
2. Same two tiles should appear: **Avg Handle Time (30d)** and **FCR Rate (30d)**
3. Hover the "NEW" badges to read descriptions

**Expected result:** Cards render without errors. Values are either numbers or dashes (if no data yet).

**Comments:** ___________________________

---

## 9. Sync Call Logs from ZIWO
**Agent: My Dashboard · Admin: System Logs**
**Who tests:** Agent for their own sync; Admin for the global sync

**Agent — My Dashboard:**
1. Log in as agent, go to **My Dashboard**
2. Click **Sync from ZIWO** button in the top-right of the page
3. The button shows a spinner while running
4. After it finishes, a message like "Synced 42 · 0 already existed" appears
5. The call log table below should populate with calls

**Admin — System Logs:**
1. Go to **System Logs**
2. Click **Sync Call Logs from ZIWO** button (top-right)
3. Same spinner + result message behaviour
4. Switch to the **Call Logs** tab to see all synced records

**Expected result:** Sync completes without a red error message. Call records appear in the table. Running it a second time should show "0 synced · N already existed" (no duplicates).

**Comments:** ___________________________

---

## 10. Call Logs Tab in System Logs
**Sidebar → System Logs → Call Logs tab**
**Who tests:** Admin

**Steps:**
1. Go to **System Logs**
2. Click the **Call Logs** tab (you will see a "NEW" badge on it)
3. The table shows calls with: agent name, direction (inbound/outbound), customer number, duration, hangup cause, and a ticket link (or "No ticket" badge)
4. Use the **Agent** dropdown to filter by a specific agent
5. Use the **Direction** dropdown to show only Inbound or Outbound
6. Use the **Ticket** dropdown and select **Has ticket** — only calls that resulted in a ticket should show

**Expected result:** Call records load. Filters narrow down the results. Clicking a ticket link opens the ticket. "No ticket" badge shows for calls with no linked ticket.

**Comments:** ___________________________

---

## 11. Integrations Status Page
**Sidebar → Integrations**
**Who tests:** Admin

**Steps:**
1. In the sidebar, click **Integrations** (look for the "NEW" badge)
2. The page shows 6 integration cards: Database, ClickUp, ZIWO, n8n, AI, Zoho
3. Each card shows a status badge: **Operational**, **Degraded**, **Down**, or **Not configured**
4. Click the **Refresh** button — cards should briefly show a loading state and update

**Expected result:** Database and ClickUp cards should show Operational (green). ZIWO may show Operational if configured. Zoho shows "Not configured" — that is expected as it is not yet set up. Refresh works.

**Comments:** ___________________________

---

## 12. Notifications Page
**Sidebar → Notifications**
**Who tests:** Both admin and agent

**Steps:**
1. Click **Notifications** in the sidebar (look for the "NEW" badge)
2. The page opens with filter tabs: **All · Unread · Escalations · SLA Alerts · System**
3. Click each tab — the list should filter accordingly
4. If there are unread notifications (blue dot), click one — it should mark as read and jump to the linked ticket (if it has a link)
5. If there are multiple unread, click **Mark all read**

> **Note:** The list may be empty if no system events (escalations, SLA breaches, assignments) have happened yet. That is expected — the page is ready and will populate as events occur.

**Expected result:** Page loads without errors. Filter tabs switch the view. Clicking a notification marks it as read. "Mark all read" clears all unread dots.

**Comments:** ___________________________

---

## 13. Wrap-Up Status — Auto Countdown After Calls
**Agent sidebar — status selector**
**Who tests:** Agent — *requires a live ZIWO call to trigger automatically, but can be tested manually*

**Manual test (no live call needed):**
1. Log in as agent
2. In the left sidebar, click the status selector at the top (shows Available / Break / etc.)
3. Select **Wrap-Up** from the dropdown
4. The sidebar should immediately show a countdown timer (e.g. "1:58 left") in orange
5. A **Done** button appears — click it to immediately return to Available
6. Alternatively, wait 2 minutes and it should automatically switch back to **Available**

**Automatic trigger (requires live call):** When a ZIWO call ends (hang-up), the sidebar automatically switches to Wrap-Up without any manual action.

**Expected result:** Wrap-Up countdown is visible in orange. "Done" button works. Auto-revert to Available after 2 minutes works.

**Comments:** ___________________________

---

## 14. Post-Call Ticket Creation ⚠️ Requires live ZIWO call
**Agent — ZIWO widget**
**Who tests:** Agent

**Steps:**
1. Log in as agent with ZIWO configured
2. Receive or make a ZIWO call and let it complete (hang up)
3. After hang-up, a pop-up form should appear titled "Create Ticket from Call"
4. Fill in the Title and Description
5. In the **Customer** section — either search for an existing contact (type a name) or switch to the "New" tab and enter Name / Email / Phone
6. In the **Organization** section — either search for an existing company or switch to "New" to create one
7. Click **Create Ticket**

**Expected result:** Ticket is created and appears in the Tickets list. The call record in System Logs → Call Logs shows the linked ticket. If you created a new contact, they appear in the Customers page.

**Comments:** ___________________________

---

## 15. Caller Screen Pop ⚠️ Requires live ZIWO incoming call
**Agent — ZIWO widget**
**Who tests:** Agent

**Steps:**
1. Log in as agent with ZIWO open
2. Have someone call the ZIWO number
3. Before you answer — look at the ZIWO widget (bottom-left of screen)
4. Above the Answer / Reject buttons, you should see the caller's name, company, and any open tickets linked to their number (if the number is in the Customers database)

**Expected result:** Caller information appears above the call controls on incoming calls. If the caller is not in the system, it shows their number only.

**Comments:** ___________________________

---

*Testing guide prepared for Cortex 2.0 — Dashboard Enhancements 2 sprint.*
