-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE main.agent_status (
  id integer NOT NULL DEFAULT nextval('main.agent_status_id_seq'::regclass),
  user_id integer UNIQUE,
  status character varying DEFAULT 'available'::character varying,
  status_note character varying,
  set_at timestamp without time zone DEFAULT now(),
  CONSTRAINT agent_status_pkey PRIMARY KEY (id),
  CONSTRAINT agent_status_user_id_fkey FOREIGN KEY (user_id) REFERENCES main.users(id)
);
CREATE TABLE main.ai_companion_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  messages jsonb DEFAULT '[]'::jsonb,
  summary text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT ai_companion_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE main.assignee_configs (
  id integer NOT NULL DEFAULT nextval('main.assignee_configs_id_seq'::regclass),
  solution_id integer,
  role_code character varying NOT NULL,
  role_name character varying,
  person_name character varying,
  email character varying,
  clickup_user_id character varying,
  is_active boolean DEFAULT true,
  CONSTRAINT assignee_configs_pkey PRIMARY KEY (id),
  CONSTRAINT assignee_configs_solution_id_fkey FOREIGN KEY (solution_id) REFERENCES main.solutions(id)
);
CREATE TABLE main.auth_logs (
  id integer NOT NULL DEFAULT nextval('main.auth_logs_id_seq'::regclass),
  user_id integer,
  email character varying,
  success boolean NOT NULL,
  ip_address character varying,
  user_agent text,
  failure_reason character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT auth_logs_pkey PRIMARY KEY (id),
  CONSTRAINT auth_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES main.users(id)
);
CREATE TABLE main.briefing_acks (
  id integer NOT NULL DEFAULT nextval('main.briefing_acks_id_seq'::regclass),
  user_id integer NOT NULL,
  shift_id integer NOT NULL,
  acked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT briefing_acks_pkey PRIMARY KEY (id),
  CONSTRAINT briefing_acks_user_id_fkey FOREIGN KEY (user_id) REFERENCES main.users(id),
  CONSTRAINT briefing_acks_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES main.shift_rotas(id)
);
CREATE TABLE main.call_logs (
  id integer NOT NULL DEFAULT nextval('main.call_logs_id_seq'::regclass),
  primary_call_id character varying UNIQUE,
  agent_call_id character varying,
  agent_id integer,
  direction character varying NOT NULL DEFAULT 'inbound'::character varying,
  customer_number character varying,
  queue_name character varying,
  duration_secs integer DEFAULT 0,
  talk_time_secs integer DEFAULT 0,
  hold_time_secs integer DEFAULT 0,
  hangup_cause character varying,
  hangup_by character varying,
  recording_file character varying,
  status character varying DEFAULT 'ended'::character varying,
  ticket_id integer,
  started_at timestamp without time zone DEFAULT now(),
  answered_at timestamp without time zone,
  ended_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT call_logs_pkey PRIMARY KEY (id),
  CONSTRAINT call_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES main.users(id),
  CONSTRAINT call_logs_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES main.tickets(id)
);
CREATE TABLE main.case_types (
  id integer NOT NULL DEFAULT nextval('main.case_types_id_seq'::regclass),
  solution_id integer,
  request_type_id integer,
  case_type character varying NOT NULL,
  description text,
  default_priority character varying,
  CONSTRAINT case_types_pkey PRIMARY KEY (id),
  CONSTRAINT case_types_solution_id_fkey FOREIGN KEY (solution_id) REFERENCES main.solutions(id),
  CONSTRAINT case_types_request_type_id_fkey FOREIGN KEY (request_type_id) REFERENCES main.request_types(id)
);
CREATE TABLE main.circular_versions (
  id integer NOT NULL DEFAULT nextval('main.circular_versions_id_seq'::regclass),
  circular_id integer,
  version integer NOT NULL,
  title character varying,
  content text,
  changed_by integer,
  changed_at timestamp without time zone DEFAULT now(),
  CONSTRAINT circular_versions_pkey PRIMARY KEY (id),
  CONSTRAINT circular_versions_circular_id_fkey FOREIGN KEY (circular_id) REFERENCES main.circulars(id),
  CONSTRAINT circular_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES main.users(id)
);
CREATE TABLE main.circulars (
  id integer NOT NULL DEFAULT nextval('main.circulars_id_seq'::regclass),
  title character varying NOT NULL,
  content text NOT NULL,
  category character varying,
  tags ARRAY,
  is_active boolean DEFAULT true,
  created_by integer,
  updated_by integer,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT circulars_pkey PRIMARY KEY (id),
  CONSTRAINT circulars_created_by_fkey FOREIGN KEY (created_by) REFERENCES main.users(id),
  CONSTRAINT circulars_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES main.users(id)
);
CREATE TABLE main.companies (
  id integer NOT NULL DEFAULT nextval('main.companies_id_seq'::regclass),
  company_code character varying NOT NULL UNIQUE,
  company_name character varying NOT NULL,
  description text,
  domain character varying,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT companies_pkey PRIMARY KEY (id)
);
CREATE TABLE main.escalation_configs (
  id integer NOT NULL DEFAULT nextval('main.escalation_configs_id_seq'::regclass),
  solution_id integer,
  level integer NOT NULL,
  threshold_percent integer NOT NULL,
  level_name character varying,
  notify_roles ARRAY,
  action_description text,
  CONSTRAINT escalation_configs_pkey PRIMARY KEY (id),
  CONSTRAINT escalation_configs_solution_id_fkey FOREIGN KEY (solution_id) REFERENCES main.solutions(id)
);
CREATE TABLE main.kpi_configs (
  id integer NOT NULL DEFAULT nextval('main.kpi_configs_id_seq'::regclass),
  solution_id integer,
  kpi_code character varying NOT NULL,
  kpi_name character varying,
  description text,
  calculation_method text,
  target_value numeric,
  unit character varying,
  report_frequency character varying,
  CONSTRAINT kpi_configs_pkey PRIMARY KEY (id),
  CONSTRAINT kpi_configs_solution_id_fkey FOREIGN KEY (solution_id) REFERENCES main.solutions(id)
);
CREATE TABLE main.modules (
  id integer NOT NULL DEFAULT nextval('main.modules_id_seq'::regclass),
  solution_id integer,
  module_code character varying NOT NULL,
  module_name character varying NOT NULL,
  description text,
  CONSTRAINT modules_pkey PRIMARY KEY (id),
  CONSTRAINT modules_solution_id_fkey FOREIGN KEY (solution_id) REFERENCES main.solutions(id)
);
CREATE TABLE main.notification_queue (
  id integer NOT NULL DEFAULT nextval('main.notification_queue_id_seq'::regclass),
  ticket_id integer,
  notification_type character varying NOT NULL,
  template_key character varying,
  recipients ARRAY,
  subject text,
  body text,
  status character varying DEFAULT 'pending'::character varying,
  attempts integer DEFAULT 0,
  sent_at timestamp without time zone,
  error_message text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT notification_queue_pkey PRIMARY KEY (id),
  CONSTRAINT notification_queue_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES main.tickets(id)
);
CREATE TABLE main.notifications (
  id integer NOT NULL DEFAULT nextval('main.notifications_id_seq'::regclass),
  user_id integer,
  type character varying NOT NULL,
  title character varying NOT NULL,
  body text,
  link character varying,
  is_read boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES main.users(id)
);
CREATE TABLE main.pocs (
  id integer NOT NULL DEFAULT nextval('main.pocs_id_seq'::regclass),
  company_id integer,
  email character varying NOT NULL UNIQUE,
  name character varying,
  phone character varying,
  role character varying,
  status character varying DEFAULT 'active'::character varying,
  is_primary boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  is_vip boolean DEFAULT false,
  CONSTRAINT pocs_pkey PRIMARY KEY (id),
  CONSTRAINT pocs_company_id_fkey FOREIGN KEY (company_id) REFERENCES main.companies(id)
);
CREATE TABLE main.processing_logs (
  id integer NOT NULL DEFAULT nextval('main.processing_logs_id_seq'::regclass),
  workflow_name character varying,
  entity_type character varying,
  entity_id integer,
  action character varying,
  status character varying,
  details jsonb,
  error_message text,
  duration_ms integer,
  alerts_sent integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT processing_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE main.request_types (
  id integer NOT NULL DEFAULT nextval('main.request_types_id_seq'::regclass),
  solution_id integer,
  request_type character varying NOT NULL,
  description text,
  sla_applicable boolean DEFAULT true,
  CONSTRAINT request_types_pkey PRIMARY KEY (id),
  CONSTRAINT request_types_solution_id_fkey FOREIGN KEY (solution_id) REFERENCES main.solutions(id)
);
CREATE TABLE main.shift_breaks (
  id integer NOT NULL DEFAULT nextval('main.shift_breaks_id_seq'::regclass),
  shift_id integer,
  break_start time without time zone NOT NULL,
  break_end time without time zone NOT NULL,
  break_type character varying DEFAULT 'scheduled'::character varying,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT shift_breaks_pkey PRIMARY KEY (id),
  CONSTRAINT shift_breaks_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES main.shift_rotas(id)
);
CREATE TABLE main.shift_rotas (
  id integer NOT NULL DEFAULT nextval('main.shift_rotas_id_seq'::regclass),
  user_id integer,
  shift_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  shift_type character varying DEFAULT 'regular'::character varying,
  notes text,
  created_by integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT shift_rotas_pkey PRIMARY KEY (id),
  CONSTRAINT shift_rotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES main.users(id),
  CONSTRAINT shift_rotas_created_by_fkey FOREIGN KEY (created_by) REFERENCES main.users(id)
);
CREATE TABLE main.sla_alerts (
  id integer NOT NULL DEFAULT nextval('main.sla_alerts_id_seq'::regclass),
  ticket_id integer,
  alert_level integer NOT NULL,
  consumption_pct numeric,
  notified_emails ARRAY,
  notification_channel character varying,
  acknowledged_by character varying,
  is_acknowledged boolean DEFAULT false,
  acknowledged_at timestamp without time zone,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT sla_alerts_pkey PRIMARY KEY (id),
  CONSTRAINT sla_alerts_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES main.tickets(id)
);
CREATE TABLE main.sla_configs (
  id integer NOT NULL DEFAULT nextval('main.sla_configs_id_seq'::regclass),
  solution_id integer,
  priority character varying NOT NULL,
  priority_name character varying,
  priority_description text,
  response_hours numeric,
  resolution_hours numeric,
  resolution_type character varying DEFAULT 'hours'::character varying,
  CONSTRAINT sla_configs_pkey PRIMARY KEY (id),
  CONSTRAINT sla_configs_solution_id_fkey FOREIGN KEY (solution_id) REFERENCES main.solutions(id)
);
CREATE TABLE main.solutions (
  id integer NOT NULL DEFAULT nextval('main.solutions_id_seq'::regclass),
  company_id integer,
  solution_code character varying NOT NULL,
  solution_name character varying NOT NULL,
  description text,
  clickup_space_id character varying,
  clickup_list_id character varying,
  business_hours_start time without time zone DEFAULT '08:00:00'::time without time zone,
  business_hours_end time without time zone DEFAULT '20:00:00'::time without time zone,
  timezone character varying DEFAULT 'Asia/Dubai'::character varying,
  working_days ARRAY DEFAULT '{0,1,2,3,4,5,6}'::integer[],
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT solutions_pkey PRIMARY KEY (id),
  CONSTRAINT solutions_company_id_fkey FOREIGN KEY (company_id) REFERENCES main.companies(id)
);
CREATE TABLE main.threads (
  id integer NOT NULL DEFAULT nextval('main.threads_id_seq'::regclass),
  ticket_id integer,
  clickup_history_id character varying,
  action_type character varying NOT NULL,
  actor_email character varying,
  actor_name character varying,
  old_value text,
  new_value text,
  raw_content text,
  ai_summary text,
  has_attachments boolean DEFAULT false,
  attachment_urls ARRAY,
  thread_source character varying DEFAULT 'clickup'::character varying,
  metadata jsonb,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT threads_pkey PRIMARY KEY (id),
  CONSTRAINT threads_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES main.tickets(id)
);
CREATE TABLE main.tickets (
  id integer NOT NULL DEFAULT nextval('main.tickets_id_seq'::regclass),
  company_id integer,
  solution_id integer,
  poc_id integer,
  assigned_to_id integer,
  clickup_task_id character varying UNIQUE,
  clickup_url text,
  title character varying NOT NULL,
  description text,
  module character varying,
  operating_system character varying,
  mobile_or_national_id character varying,
  request_type character varying,
  case_type character varying,
  priority character varying,
  status character varying DEFAULT 'Open'::character varying,
  assigned_to_email character varying,
  sla_response_due timestamp without time zone,
  sla_resolution_due timestamp without time zone,
  sla_consumption_pct numeric DEFAULT 0,
  sla_status character varying DEFAULT 'healthy'::character varying,
  sla_paused_at timestamp without time zone,
  sla_paused_duration interval DEFAULT '00:00:00'::interval,
  escalation_level integer DEFAULT 0,
  last_escalation_at timestamp without time zone,
  ai_summary text,
  ai_sentiment character varying,
  created_by_email character varying,
  created_by_name character varying,
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  resolved_at timestamp without time zone,
  closed_at timestamp without time zone,
  channel character varying DEFAULT 'email'::character varying,
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_company_id_fkey FOREIGN KEY (company_id) REFERENCES main.companies(id),
  CONSTRAINT tickets_solution_id_fkey FOREIGN KEY (solution_id) REFERENCES main.solutions(id),
  CONSTRAINT tickets_poc_id_fkey FOREIGN KEY (poc_id) REFERENCES main.pocs(id),
  CONSTRAINT tickets_assigned_to_id_fkey FOREIGN KEY (assigned_to_id) REFERENCES main.users(id)
);
CREATE TABLE main.users (
  id integer NOT NULL DEFAULT nextval('main.users_id_seq'::regclass),
  email character varying NOT NULL UNIQUE,
  password_hash character varying NOT NULL,
  full_name character varying NOT NULL,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['admin'::character varying, 'agent'::character varying]::text[])),
  ziwo_email character varying,
  ziwo_password character varying,
  is_active boolean DEFAULT true,
  login_attempts integer DEFAULT 0,
  locked_until timestamp without time zone,
  last_login_at timestamp without time zone,
  current_session_tok character varying,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- =====================================================================
-- MIGRATION: Phase 2 enhancements (run once)
-- =====================================================================

-- Circular acknowledgments
CREATE TABLE IF NOT EXISTS main.circular_acks (
  id SERIAL PRIMARY KEY,
  circular_id INTEGER REFERENCES main.circulars(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES main.users(id) ON DELETE CASCADE,
  acked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(circular_id, user_id)
);

-- Agent status history (for live timeline)
CREATE TABLE IF NOT EXISTS main.agent_status_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES main.users(id) ON DELETE CASCADE,
  status VARCHAR(50),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- Break requests (agent applies, admin approves)
CREATE TABLE IF NOT EXISTS main.break_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES main.users(id) ON DELETE CASCADE,
  shift_id INTEGER REFERENCES main.shift_rotas(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  duration_mins INTEGER,
  note TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by INTEGER REFERENCES main.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ
);

-- Admin-defined agent categories (inbound, outbound, etc.)
CREATE TABLE IF NOT EXISTS main.agent_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  company_code VARCHAR(20) DEFAULT 'medgulf',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO main.agent_categories (name) VALUES ('inbound'), ('outbound')
  ON CONFLICT DO NOTHING;

-- Minimum agents per shift slot and category
CREATE TABLE IF NOT EXISTS main.shift_type_minimums (
  id SERIAL PRIMARY KEY,
  shift_slot VARCHAR(50),
  agent_type VARCHAR(50),
  min_count INTEGER DEFAULT 1,
  company_code VARCHAR(20) DEFAULT 'medgulf',
  UNIQUE(shift_slot, agent_type, company_code)
);

-- System-wide settings (key-value)
CREATE TABLE IF NOT EXISTS main.system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_by INTEGER REFERENCES main.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO main.system_settings (key, value) VALUES
  ('auto_logoff_enabled', 'true'),
  ('auto_logoff_minutes', '10')
ON CONFLICT (key) DO NOTHING;

-- Call dispositions / tags (admin-managed)
CREATE TABLE IF NOT EXISTS main.call_dispositions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  company_code VARCHAR(20) DEFAULT 'medgulf',
  created_by INTEGER REFERENCES main.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO main.call_dispositions (name) VALUES
  ('Call back'), ('Appointment'), ('Insurance'), ('Radiology'), ('Physiotherapy'), ('Complaint')
ON CONFLICT DO NOTHING;

-- Alter existing tables
ALTER TABLE main.shift_rotas ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50);
ALTER TABLE main.leave_requests ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE main.leave_requests ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE main.call_logs ADD COLUMN IF NOT EXISTS disposition_id INTEGER REFERENCES main.call_dispositions(id) ON DELETE SET NULL;
ALTER TABLE main.call_logs ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200);