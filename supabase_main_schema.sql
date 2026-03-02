-- ============================================================
-- Cortex Dashboard — Schema: main
-- Run this in Supabase SQL Editor
-- LMS tables excluded (lms_* and auth_users)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS main;

-- ── companies ──────────────────────────────────────────────────────────────
CREATE TABLE main.companies (
    id serial PRIMARY KEY,
    company_code varchar(50) NOT NULL UNIQUE,
    company_name varchar(255) NOT NULL,
    description text,
    domain varchar(255),
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- ── processing_logs ────────────────────────────────────────────────────────
CREATE TABLE main.processing_logs (
    id serial PRIMARY KEY,
    workflow_name varchar(100),
    entity_type varchar(50),
    entity_id integer,
    action varchar(100),
    status varchar(50),
    details jsonb,
    error_message text,
    duration_ms integer,
    alerts_sent integer,
    created_at timestamp DEFAULT now()
);

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TABLE main.users (
    id serial PRIMARY KEY,
    email varchar(255) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    full_name varchar(255) NOT NULL,
    role varchar(50) NOT NULL,
    ziwo_email varchar(255),
    ziwo_password varchar(255),
    is_active boolean DEFAULT true,
    login_attempts integer DEFAULT 0,
    locked_until timestamp,
    last_login_at timestamp,
    current_session_tok varchar(255),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'agent'))
);

-- ── ai_companion_sessions ──────────────────────────────────────────────────
CREATE TABLE main.ai_companion_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id text NOT NULL UNIQUE,
    messages jsonb DEFAULT '[]',
    summary text,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX idx_companion_sessions_user ON main.ai_companion_sessions (user_id);

-- ── pocs ───────────────────────────────────────────────────────────────────
CREATE TABLE main.pocs (
    id serial PRIMARY KEY,
    company_id integer REFERENCES main.companies(id),
    email varchar(255) NOT NULL UNIQUE,
    name varchar(255),
    phone varchar(50),
    role varchar(100),
    status varchar(50) DEFAULT 'active',
    is_primary boolean DEFAULT false,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

-- ── solutions ──────────────────────────────────────────────────────────────
CREATE TABLE main.solutions (
    id serial PRIMARY KEY,
    company_id integer REFERENCES main.companies(id) ON DELETE CASCADE,
    solution_code varchar(50) NOT NULL,
    solution_name varchar(255) NOT NULL,
    description text,
    clickup_space_id varchar(50),
    clickup_list_id varchar(50),
    business_hours_start time DEFAULT '08:00:00',
    business_hours_end time DEFAULT '20:00:00',
    timezone varchar(50) DEFAULT 'Asia/Dubai',
    working_days integer[] DEFAULT '{0,1,2,3,4,5,6}',
    is_active boolean DEFAULT true,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    UNIQUE (company_id, solution_code)
);

-- ── agent_status ───────────────────────────────────────────────────────────
CREATE TABLE main.agent_status (
    id serial PRIMARY KEY,
    user_id integer UNIQUE REFERENCES main.users(id) ON DELETE CASCADE,
    status varchar(50) DEFAULT 'available',
    status_note varchar(255),
    set_at timestamp DEFAULT now()
);

-- ── auth_logs ──────────────────────────────────────────────────────────────
CREATE TABLE main.auth_logs (
    id serial PRIMARY KEY,
    user_id integer REFERENCES main.users(id) ON DELETE SET NULL,
    email varchar(255),
    success boolean NOT NULL,
    ip_address varchar(45),
    user_agent text,
    failure_reason varchar(100),
    created_at timestamp DEFAULT now()
);
CREATE INDEX idx_auth_logs_email ON main.auth_logs (email);
CREATE INDEX idx_auth_logs_created_at ON main.auth_logs (created_at DESC);

-- ── circulars ──────────────────────────────────────────────────────────────
CREATE TABLE main.circulars (
    id serial PRIMARY KEY,
    title varchar(500) NOT NULL,
    content text NOT NULL,
    category varchar(100),
    tags text[],
    is_active boolean DEFAULT true,
    created_by integer REFERENCES main.users(id),
    updated_by integer REFERENCES main.users(id),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);
CREATE INDEX idx_circulars_is_active ON main.circulars (is_active);

-- ── notifications ──────────────────────────────────────────────────────────
CREATE TABLE main.notifications (
    id serial PRIMARY KEY,
    user_id integer REFERENCES main.users(id) ON DELETE CASCADE,
    type varchar(50) NOT NULL,
    title varchar(255) NOT NULL,
    body text,
    link varchar(255),
    is_read boolean DEFAULT false,
    created_at timestamp DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON main.notifications (user_id, is_read, created_at DESC);

-- ── shift_rotas ────────────────────────────────────────────────────────────
CREATE TABLE main.shift_rotas (
    id serial PRIMARY KEY,
    user_id integer REFERENCES main.users(id) ON DELETE CASCADE,
    shift_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    shift_type varchar(50) DEFAULT 'regular',
    notes text,
    created_by integer REFERENCES main.users(id),
    created_at timestamp DEFAULT now()
);
CREATE INDEX idx_shift_rotas_user_date ON main.shift_rotas (user_id, shift_date);

-- ── tickets ────────────────────────────────────────────────────────────────
CREATE TABLE main.tickets (
    id serial PRIMARY KEY,
    company_id integer REFERENCES main.companies(id),
    solution_id integer REFERENCES main.solutions(id),
    poc_id integer REFERENCES main.pocs(id),
    assigned_to_id integer REFERENCES main.users(id),
    clickup_task_id varchar(50) UNIQUE,
    clickup_url text,
    title varchar(500) NOT NULL,
    description text,
    module varchar(100),
    operating_system varchar(50),
    mobile_or_national_id varchar(100),
    request_type varchar(100),
    case_type varchar(100),
    priority varchar(10),
    status varchar(100) DEFAULT 'Open',
    assigned_to_email varchar(255),
    sla_response_due timestamp,
    sla_resolution_due timestamp,
    sla_consumption_pct numeric(5,2) DEFAULT 0,
    sla_status varchar(50) DEFAULT 'healthy',
    sla_paused_at timestamp,
    sla_paused_duration interval DEFAULT '00:00:00',
    escalation_level integer DEFAULT 0,
    last_escalation_at timestamp,
    ai_summary text,
    ai_sentiment varchar(50),
    created_by_email varchar(255),
    created_by_name varchar(255),
    is_deleted boolean DEFAULT false,
    deleted_at timestamptz,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now(),
    resolved_at timestamp,
    closed_at timestamp
);
CREATE INDEX idx_tickets_active ON main.tickets (is_deleted) WHERE is_deleted = false;
CREATE INDEX idx_tickets_assigned_to ON main.tickets (assigned_to_email);

-- ── assignee_configs ───────────────────────────────────────────────────────
CREATE TABLE main.assignee_configs (
    id serial PRIMARY KEY,
    solution_id integer REFERENCES main.solutions(id) ON DELETE CASCADE,
    role_code varchar(50) NOT NULL,
    role_name varchar(100),
    person_name varchar(255),
    email varchar(255),
    clickup_user_id varchar(50),
    is_active boolean DEFAULT true,
    UNIQUE (solution_id, role_code, email)
);

-- ── call_logs ──────────────────────────────────────────────────────────────
CREATE TABLE main.call_logs (
    id serial PRIMARY KEY,
    primary_call_id varchar(255) UNIQUE,
    agent_call_id varchar(255),
    agent_id integer REFERENCES main.users(id),
    direction varchar(20) NOT NULL DEFAULT 'inbound',
    customer_number varchar(50),
    queue_name varchar(255),
    duration_secs integer DEFAULT 0,
    talk_time_secs integer DEFAULT 0,
    hold_time_secs integer DEFAULT 0,
    hangup_cause varchar(100),
    hangup_by varchar(50),
    recording_file varchar(255),
    status varchar(50) DEFAULT 'ended',
    ticket_id integer REFERENCES main.tickets(id),
    started_at timestamp DEFAULT now(),
    answered_at timestamp,
    ended_at timestamp,
    created_at timestamp DEFAULT now()
);
CREATE INDEX idx_call_logs_agent_id ON main.call_logs (agent_id);
CREATE INDEX idx_call_logs_started_at ON main.call_logs (started_at DESC);

-- ── circular_versions ──────────────────────────────────────────────────────
CREATE TABLE main.circular_versions (
    id serial PRIMARY KEY,
    circular_id integer REFERENCES main.circulars(id) ON DELETE CASCADE,
    version integer NOT NULL,
    title varchar(500),
    content text,
    changed_by integer REFERENCES main.users(id),
    changed_at timestamp DEFAULT now()
);

-- ── escalation_configs ─────────────────────────────────────────────────────
CREATE TABLE main.escalation_configs (
    id serial PRIMARY KEY,
    solution_id integer REFERENCES main.solutions(id) ON DELETE CASCADE,
    level integer NOT NULL,
    threshold_percent integer NOT NULL,
    level_name varchar(100),
    notify_roles text[],
    action_description text,
    UNIQUE (solution_id, level)
);

-- ── kpi_configs ────────────────────────────────────────────────────────────
CREATE TABLE main.kpi_configs (
    id serial PRIMARY KEY,
    solution_id integer REFERENCES main.solutions(id) ON DELETE CASCADE,
    kpi_code varchar(100) NOT NULL,
    kpi_name varchar(255),
    description text,
    calculation_method text,
    target_value numeric(10,2),
    unit varchar(50),
    report_frequency varchar(50),
    UNIQUE (solution_id, kpi_code)
);

-- ── modules ────────────────────────────────────────────────────────────────
CREATE TABLE main.modules (
    id serial PRIMARY KEY,
    solution_id integer REFERENCES main.solutions(id) ON DELETE CASCADE,
    module_code varchar(100) NOT NULL,
    module_name varchar(255) NOT NULL,
    description text,
    UNIQUE (solution_id, module_code)
);

-- ── notification_queue ─────────────────────────────────────────────────────
CREATE TABLE main.notification_queue (
    id serial PRIMARY KEY,
    ticket_id integer REFERENCES main.tickets(id),
    notification_type varchar(50) NOT NULL,
    template_key varchar(100),
    recipients text[],
    subject text,
    body text,
    status varchar(50) DEFAULT 'pending',
    attempts integer DEFAULT 0,
    sent_at timestamp,
    error_message text,
    created_at timestamp DEFAULT now()
);

-- ── request_types ──────────────────────────────────────────────────────────
CREATE TABLE main.request_types (
    id serial PRIMARY KEY,
    solution_id integer REFERENCES main.solutions(id) ON DELETE CASCADE,
    request_type varchar(100) NOT NULL,
    description text,
    sla_applicable boolean DEFAULT true,
    UNIQUE (solution_id, request_type)
);

-- ── shift_breaks ───────────────────────────────────────────────────────────
CREATE TABLE main.shift_breaks (
    id serial PRIMARY KEY,
    shift_id integer REFERENCES main.shift_rotas(id) ON DELETE CASCADE,
    break_start time NOT NULL,
    break_end time NOT NULL,
    break_type varchar(50) DEFAULT 'scheduled',
    created_at timestamp DEFAULT now()
);
CREATE INDEX idx_shift_breaks_shift_id ON main.shift_breaks (shift_id);

-- ── sla_alerts ─────────────────────────────────────────────────────────────
CREATE TABLE main.sla_alerts (
    id serial PRIMARY KEY,
    ticket_id integer REFERENCES main.tickets(id) ON DELETE CASCADE,
    alert_level integer NOT NULL,
    consumption_pct numeric(5,2),
    notified_emails text[],
    notification_channel varchar(50),
    acknowledged_by varchar(255),
    is_acknowledged boolean DEFAULT false,
    acknowledged_at timestamp,
    created_at timestamp DEFAULT now()
);
CREATE INDEX idx_sla_alerts_ticket ON main.sla_alerts (ticket_id);
CREATE UNIQUE INDEX idx_sla_alerts_unique_level ON main.sla_alerts (ticket_id, alert_level) WHERE alert_level < 4;

-- ── sla_configs ────────────────────────────────────────────────────────────
CREATE TABLE main.sla_configs (
    id serial PRIMARY KEY,
    solution_id integer REFERENCES main.solutions(id) ON DELETE CASCADE,
    priority varchar(10) NOT NULL,
    priority_name varchar(50),
    priority_description text,
    response_hours numeric(5,2),
    resolution_hours numeric(5,2),
    resolution_type varchar(50) DEFAULT 'hours',
    UNIQUE (solution_id, priority)
);

-- ── threads ────────────────────────────────────────────────────────────────
CREATE TABLE main.threads (
    id serial PRIMARY KEY,
    ticket_id integer REFERENCES main.tickets(id) ON DELETE CASCADE,
    clickup_history_id varchar(50),
    action_type varchar(50) NOT NULL,
    actor_email varchar(255),
    actor_name varchar(255),
    old_value text,
    new_value text,
    raw_content text,
    ai_summary text,
    has_attachments boolean DEFAULT false,
    attachment_urls text[],
    thread_source varchar(50) DEFAULT 'clickup',
    metadata jsonb,
    created_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX idx_threads_clickup_history_id ON main.threads (clickup_history_id) WHERE clickup_history_id IS NOT NULL;
CREATE INDEX idx_threads_history_id ON main.threads (clickup_history_id) WHERE clickup_history_id IS NOT NULL;

-- ── case_types ─────────────────────────────────────────────────────────────
CREATE TABLE main.case_types (
    id serial PRIMARY KEY,
    solution_id integer REFERENCES main.solutions(id) ON DELETE CASCADE,
    request_type_id integer REFERENCES main.request_types(id),
    case_type varchar(100) NOT NULL,
    description text,
    default_priority varchar(10),
    UNIQUE (solution_id, case_type)
);

-- ============================================================
-- Disable Row Level Security (required — app uses its own auth)
-- ============================================================

ALTER TABLE main.companies             DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.processing_logs       DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.users                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.ai_companion_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.pocs                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.solutions             DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.agent_status          DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.auth_logs             DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.circulars             DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.notifications         DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.shift_rotas           DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.tickets               DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.assignee_configs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.call_logs             DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.circular_versions     DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.escalation_configs    DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.kpi_configs           DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.modules               DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.notification_queue    DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.request_types         DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.shift_breaks          DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.sla_alerts            DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.sla_configs           DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.threads               DISABLE ROW LEVEL SECURITY;
ALTER TABLE main.case_types            DISABLE ROW LEVEL SECURITY;
