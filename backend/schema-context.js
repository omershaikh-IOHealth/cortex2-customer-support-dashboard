export const getSchemaContext = (userRole, userCompanyId) => {
    const roleFilter = userRole === 'support' && userCompanyId 
      ? `Note: This user has role='support' and company_id=${userCompanyId}. Filter all ticket-related queries with: WHERE company_id = ${userCompanyId}`
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
     - priority (VARCHAR: P1, P2, P3, P4)
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
  
  COMMON QUERY PATTERNS:
  - Active/Open tickets: WHERE is_deleted=FALSE AND status NOT IN ('Closed', 'Resolved', 'complete')
  - Breached SLA: WHERE sla_status='breached' AND is_deleted=FALSE
  - Critical/Warning: WHERE sla_status IN ('critical','warning')
  - Escalated tickets: WHERE escalation_level > 0
  - Always exclude deleted: is_deleted=FALSE
  
  JOINS:
  - Tickets → Companies: JOIN companies c ON t.company_id = c.id
  - Tickets → Solutions: JOIN solutions s ON t.solution_id = s.id
  - Tickets → POCs: JOIN pocs p ON t.poc_id = p.id
  - Threads → Tickets: JOIN tickets t ON th.ticket_id = t.id
  
  IMPORTANT:
  - Always exclude deleted tickets: is_deleted=FALSE
  - Use schema prefix: test.tickets, test.companies, etc.
  - Priority order: P1 (highest) > P2 > P3 > P4 (lowest)
  - SLA status order: breached (worst) > critical > warning > healthy
  - For ticket details with comments, JOIN threads table
  - For assignee info, reference assignee_configs by solution_id
  `;
  };