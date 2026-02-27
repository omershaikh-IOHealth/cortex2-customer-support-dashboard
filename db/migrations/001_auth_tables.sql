-- Cortex 2.0 — Phase 1 Auth & Call Tracking Migration
-- Run: psql -h HOST -U USER -d DBNAME -f db/migrations/001_auth_tables.sql

-- ─── Users ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test.users (
  id              SERIAL PRIMARY KEY,
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  full_name       VARCHAR(255) NOT NULL,
  role            VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'agent')),
  ziwo_email      VARCHAR(255),
  ziwo_password   VARCHAR(255),
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ─── Agent manual status ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test.agent_status (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES test.users(id) ON DELETE CASCADE UNIQUE,
  status      VARCHAR(50) DEFAULT 'available',
  status_note VARCHAR(255),
  set_at      TIMESTAMP DEFAULT NOW()
);

-- ─── ZIWO call logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test.call_logs (
  id               SERIAL PRIMARY KEY,
  primary_call_id  VARCHAR(255) UNIQUE,
  agent_call_id    VARCHAR(255),
  agent_id         INT REFERENCES test.users(id),
  direction        VARCHAR(20) NOT NULL DEFAULT 'inbound',
  customer_number  VARCHAR(50),
  queue_name       VARCHAR(255),
  duration_secs    INT DEFAULT 0,
  talk_time_secs   INT DEFAULT 0,
  hold_time_secs   INT DEFAULT 0,
  hangup_cause     VARCHAR(100),
  hangup_by        VARCHAR(50),
  recording_file   VARCHAR(255),
  status           VARCHAR(50) DEFAULT 'ended',
  ticket_id        INT REFERENCES test.tickets(id),
  started_at       TIMESTAMP DEFAULT NOW(),
  answered_at      TIMESTAMP,
  ended_at         TIMESTAMP,
  created_at       TIMESTAMP DEFAULT NOW()
);

-- ─── Shift rotas ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test.shift_rotas (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES test.users(id) ON DELETE CASCADE,
  shift_date  DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  shift_type  VARCHAR(50) DEFAULT 'regular',
  notes       TEXT,
  created_by  INT REFERENCES test.users(id),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Circulars / Knowledge Base ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test.circulars (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(500) NOT NULL,
  content     TEXT NOT NULL,
  category    VARCHAR(100),
  tags        TEXT[],
  is_active   BOOLEAN DEFAULT true,
  created_by  INT REFERENCES test.users(id),
  updated_by  INT REFERENCES test.users(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Circular version history ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test.circular_versions (
  id          SERIAL PRIMARY KEY,
  circular_id INT REFERENCES test.circulars(id) ON DELETE CASCADE,
  version     INT NOT NULL,
  title       VARCHAR(500),
  content     TEXT,
  changed_by  INT REFERENCES test.users(id),
  changed_at  TIMESTAMP DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_id      ON test.call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at    ON test.call_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_direction     ON test.call_logs(direction);
CREATE INDEX IF NOT EXISTS idx_shift_rotas_user_date   ON test.shift_rotas(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_circulars_is_active     ON test.circulars(is_active);
