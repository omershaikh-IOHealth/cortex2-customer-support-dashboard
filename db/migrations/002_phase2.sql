-- Cortex 2.0 — Phase 2 Migration
-- Run via: GET /api/setup?key=AUTH_SECRET  (idempotent — safe to re-run)

-- ─── Auth hardening columns ───────────────────────────────────────────────
ALTER TABLE test.users
  ADD COLUMN IF NOT EXISTS login_attempts      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until        TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS current_session_tok VARCHAR(255);

-- ─── Ticket assignment ────────────────────────────────────────────────────
ALTER TABLE test.tickets
  ADD COLUMN IF NOT EXISTS assigned_to_id    INT REFERENCES test.users(id),
  ADD COLUMN IF NOT EXISTS assigned_to_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON test.tickets(assigned_to_email);

-- ─── Auth event log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test.auth_logs (
  id             SERIAL PRIMARY KEY,
  user_id        INT REFERENCES test.users(id) ON DELETE SET NULL,
  email          VARCHAR(255),
  success        BOOLEAN NOT NULL,
  ip_address     VARCHAR(45),
  user_agent     TEXT,
  failure_reason VARCHAR(100),
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_email      ON test.auth_logs(email);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON test.auth_logs(created_at DESC);

-- ─── In-app notifications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test.notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES test.users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,  -- sla_alert | escalation | break_exceeded | assignment | system
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  link       VARCHAR(255),
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON test.notifications(user_id, is_read, created_at DESC);

-- ─── Scheduled shift breaks ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test.shift_breaks (
  id          SERIAL PRIMARY KEY,
  shift_id    INT REFERENCES test.shift_rotas(id) ON DELETE CASCADE,
  break_start TIME NOT NULL,
  break_end   TIME NOT NULL,
  break_type  VARCHAR(50) DEFAULT 'scheduled',  -- scheduled | lunch
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_breaks_shift_id ON test.shift_breaks(shift_id);
