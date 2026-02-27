export const getSchemaContext = (userRole, userCompanyId) => {
    const roleFilter = userRole === 'agent' && userCompanyId
      ? `Note: This user has role='agent' and company_id=${userCompanyId}. Filter all ticket-related queries with: WHERE company_id = ${userCompanyId}`
      : `Note: This user has role='admin'. No company filtering needed.`;
  
    return `
  DATABASE SCHEMA (PostgreSQL, schema: test)
  SCOPE: Customer Support System ONLY (no LMS tables)
  
  ${roleFilter}
  
  CORE TABLES:
  
  1. companies
     - id (PK, INT)
     - company_name (VARCHAR 255)
     - company_code (VARCHAR 50)
     - domain (VARCHAR 255)
     - is_active (BOOLEAN)
  
  2. solutions
     - id (PK, INT)
     - company_id (FK -> companies.id)
     - solution_name (VARCHAR 255)
     - solution_code (VARCHAR 50)
     - clickup_space_id (VARCHAR 50)
     - clickup_list_id (VARCHAR 50)
  
  3. pocs (Point of Contacts)
     - id (PK, INT)
     - company_id (FK -> companies.id)
     - name (VARCHAR 255)
     - email (VARCHAR 255)
     - phone (VARCHAR 50)
     - role (VARCHAR 100)
     - status (VARCHAR 50)
     - is_primary (BOOLEAN)
  
  4. tickets
     - id (PK, INT)
     - company_id (FK -> companies.id)
     - solution_id (FK -> solutions.id)
     - poc_id (FK -> pocs.id)
     - clickup_task_id (VARCHAR 50)
     - title (VARCHAR 500)
     - description (TEXT)
     - module (VARCHAR 100)
     - request_type (VARCHAR 100)
     - case_type (VARCHAR 100)
     - priority (VARCHAR: P1, P2, P3, P4, P5) ⚠️ P5 is also valid (P1 highest → P5 lowest)
     - status (VARCHAR: 'Open', 'In Progress', 'Waiting', 'Resolved', 'Closed', 'complete')
       ⚠️ CRITICAL: 'complete', 'Resolved', 'Closed' are ALL closed/completed statuses
       ⚠️ CRITICAL: Only 'Open', 'In Progress', 'Waiting' count as active/open tickets
       ⚠️ For "open" or "active" tickets, use: WHERE status NOT IN ('Closed', 'Resolved', 'complete')
     - sla_status (VARCHAR: healthy, warning, critical, breached)
     - sla_consumption_pct (NUMERIC 5,2)
     - sla_response_due (TIMESTAMP)
     - sla_resolution_due (TIMESTAMP)
     - escalation_level (INT, default 0)
     - last_escalation_at (TIMESTAMP)
     - ai_summary (TEXT)
     - ai_sentiment (VARCHAR 50)
     - assigned_to_id (FK -> users.id)
     - assigned_to_email (VARCHAR 255)
     - created_at, updated_at, resolved_at, closed_at (TIMESTAMP)
     - created_by_email, created_by_name (VARCHAR 255)
     - is_deleted (BOOLEAN, default FALSE)
  
  5. threads (ticket history/comments)
     - id (PK, INT)
     - ticket_id (FK -> tickets.id)
     - clickup_history_id (VARCHAR 50)
     - action_type (VARCHAR: comment, status_change, priority_change, assignment, etc.)
     - actor_email (VARCHAR 255)
     - actor_name (VARCHAR 255)
     - old_value (TEXT)
     - new_value (TEXT)
     - raw_content (TEXT) -- full comment text
     - ai_summary (TEXT)
     - has_attachments (BOOLEAN)
     - attachment_urls (TEXT[])
     - created_at (TIMESTAMP)
     - thread_source (VARCHAR 50)
     - metadata (JSONB)
  
  6. sla_configs
     - id (PK, INT)
     - solution_id (FK -> solutions.id)
     - priority (VARCHAR: P1, P2, P3, P4)
     - priority_name (VARCHAR 50)
     - priority_description (TEXT)
     - response_hours (NUMERIC 5,2)
     - resolution_hours (NUMERIC 5,2)
  
  7. escalation_configs
     - id (PK, INT)
     - solution_id (FK -> solutions.id)
     - level (INT: 1, 2, 3)
     - threshold_percent (INT)
     - level_name (VARCHAR 100)
     - notify_roles (TEXT[])
     - action_description (TEXT)
  
  8. sla_alerts
     - id (PK, INT)
     - ticket_id (FK -> tickets.id)
     - alert_level (INT: 1, 2, 3)
     - consumption_pct (NUMERIC 5,2)
     - notified_emails (TEXT[])
     - notification_channel (VARCHAR 50)
     - created_at (TIMESTAMP)
     - is_acknowledged (BOOLEAN)
     - acknowledged_at (TIMESTAMP)
  
  9. assignee_configs (team members)
     - id (PK, INT)
     - solution_id (FK -> solutions.id)
     - role_code (VARCHAR 50)
     - role_name (VARCHAR 100)
     - person_name (VARCHAR 255)
     - email (VARCHAR 255)
     - clickup_user_id (VARCHAR 50)
     - is_active (BOOLEAN)
  
  10. modules
      - id (PK, INT)
      - solution_id (FK -> solutions.id)
      - module_code (VARCHAR 100)
      - module_name (VARCHAR 255)
      - description (TEXT)
  
  11. notification_queue
      - id (PK, INT)
      - ticket_id (FK -> tickets.id)
      - notification_type (VARCHAR 50)
      - recipients (TEXT[])
      - subject (TEXT)
      - status (VARCHAR 50: pending, sent, failed)
      - sent_at (TIMESTAMP)

  12. users (Cortex dashboard users)
      - id (PK, SERIAL INT)
      - email (VARCHAR 255, UNIQUE)
      - password_hash (VARCHAR 255)
      - full_name (VARCHAR 255)
      - role (VARCHAR 50: 'admin' or 'agent' — ONLY these two values)
      - ziwo_email (VARCHAR 255)
      - ziwo_password (VARCHAR 255)
      - is_active (BOOLEAN, default true)
      - login_attempts (INT, default 0)
      - locked_until (TIMESTAMP, null if not locked)
      - last_login_at (TIMESTAMP)
      - current_session_tok (VARCHAR 255)
      - created_at, updated_at (TIMESTAMP)

  13. agent_status (real-time agent availability)
      - id (PK, SERIAL INT)
      - user_id (FK -> users.id, UNIQUE — one status per agent)
      - status (VARCHAR 50: 'available', 'break', 'not_ready')
      - status_note (VARCHAR 255)
      - set_at (TIMESTAMP)

  14. call_logs (ZIWO VoIP call records)
      - id (PK, SERIAL INT)
      - primary_call_id (VARCHAR 255, UNIQUE)
      - agent_call_id (VARCHAR 255)
      - agent_id (FK -> users.id)
      - direction (VARCHAR 20: 'inbound', 'outbound')
      - customer_number (VARCHAR 50)
      - queue_name (VARCHAR 255)
      - duration_secs, talk_time_secs, hold_time_secs (INT)
      - hangup_cause (VARCHAR 100)
      - hangup_by (VARCHAR 50)
      - recording_file (VARCHAR 255)
      - status (VARCHAR 50)
      - ticket_id (FK -> tickets.id, nullable)
      - started_at, answered_at, ended_at, created_at (TIMESTAMP)

  15. shift_rotas (agent shift schedules)
      - id (PK, SERIAL INT)
      - user_id (FK -> users.id)
      - shift_date (DATE)
      - start_time, end_time (TIME)
      - shift_type (VARCHAR 50: 'regular', etc.)
      - notes (TEXT)
      - created_by (FK -> users.id)

  16. shift_breaks
      - id (PK, SERIAL INT)
      - shift_id (FK -> shift_rotas.id, CASCADE)
      - break_start, break_end (TIME)
      - break_type (VARCHAR 50: 'scheduled', etc.)

  17. circulars (knowledge base articles)
      - id (PK, SERIAL INT)
      - title (VARCHAR 500)
      - content (TEXT)
      - category (VARCHAR 100)
      - tags (TEXT[])
      - is_active (BOOLEAN)
      - created_by, updated_by (FK -> users.id)
      - created_at, updated_at (TIMESTAMP)

  18. circular_versions (edit history)
      - id (PK, SERIAL INT)
      - circular_id (FK -> circulars.id, CASCADE)
      - version (INT)
      - title (VARCHAR 500), content (TEXT)
      - changed_by (FK -> users.id)
      - changed_at (TIMESTAMP)

  19. notifications (in-app notifications)
      - id (PK, SERIAL INT)
      - user_id (FK -> users.id, CASCADE)
      - type (VARCHAR 50)
      - title (VARCHAR 255)
      - body (TEXT)
      - link (VARCHAR 255)
      - is_read (BOOLEAN, default false)
      - created_at (TIMESTAMP)

  20. auth_logs (login audit trail)
      - id (PK, SERIAL INT)
      - user_id (FK -> users.id)
      - email (VARCHAR 255)
      - success (BOOLEAN)
      - ip_address (VARCHAR 45)
      - user_agent (TEXT)
      - failure_reason (VARCHAR 100)
      - created_at (TIMESTAMP)

  21. request_types
      - id (PK, SERIAL INT)
      - solution_id (FK -> solutions.id)
      - request_type (VARCHAR 100)
      - description (TEXT)
      - sla_applicable (BOOLEAN)

  22. case_types
      - id (PK, SERIAL INT)
      - solution_id (FK -> solutions.id)
      - request_type_id (FK -> request_types.id)
      - case_type (VARCHAR 100)
      - description (TEXT)
      - default_priority (VARCHAR 10)

  COMMON QUERY PATTERNS:
  - Active/Open tickets: WHERE is_deleted=FALSE AND status NOT IN ('Closed', 'Resolved', 'complete')
  - Breached SLA: WHERE sla_status='breached' AND is_deleted=FALSE
  - Critical/Warning: WHERE sla_status IN ('critical','warning')
  - Escalated tickets: WHERE escalation_level > 0
  - Always exclude deleted: is_deleted=FALSE
  - Agent calls today: WHERE cl.started_at >= CURRENT_DATE AND cl.agent_id = <id>
  - Unread notifications: WHERE n.user_id = <id> AND n.is_read = false ORDER BY created_at DESC
  - Agent on shift today: WHERE sr.shift_date = CURRENT_DATE AND sr.user_id = <id>
  - Active circulars: WHERE is_active = true ORDER BY updated_at DESC

  JOINS:
  - Tickets → Companies: JOIN test.companies c ON t.company_id = c.id
  - Tickets → Solutions: JOIN test.solutions s ON t.solution_id = s.id
  - Tickets → POCs: JOIN test.pocs p ON t.poc_id = p.id
  - Threads → Tickets: JOIN test.tickets t ON th.ticket_id = t.id
  - Call logs → Agent: JOIN test.users u ON cl.agent_id = u.id
  - Call logs → Ticket: JOIN test.tickets t ON cl.ticket_id = t.id
  - Agent status → User: JOIN test.users u ON ast.user_id = u.id
  - Shifts → User: JOIN test.users u ON sr.user_id = u.id
  - Notifications → User: JOIN test.users u ON n.user_id = u.id
  - Circulars → Creator: JOIN test.users u ON cir.created_by = u.id
  
  IMPORTANT:
  - Always exclude deleted tickets: is_deleted=FALSE
  - Use schema prefix: test.tickets, test.companies, etc.
  - Priority order: P1 (highest) > P2 > P3 > P4 (lowest)
  - SLA status order: breached (worst) > critical > warning > healthy
  - For ticket details with comments, JOIN threads table
  - For assignee info, reference assignee_configs by solution_id
  `;
  };