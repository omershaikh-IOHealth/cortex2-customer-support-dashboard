/**
 * One-time setup endpoint — runs DB migration + seeds initial users.
 * Protected by AUTH_SECRET so only the server operator can run it.
 *
 * Usage (after npm run dev):
 *   curl "http://localhost:3000/api/setup?key=YOUR_AUTH_SECRET"
 * OR visit the URL in your browser.
 *
 * Safe to call multiple times — uses CREATE TABLE IF NOT EXISTS and ON CONFLICT DO UPDATE.
 */
import { NextResponse } from 'next/server'
import pool from '@/lib/db'
import bcrypt from 'bcryptjs'

const MIGRATION_SQL = `
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

CREATE TABLE IF NOT EXISTS test.agent_status (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES test.users(id) ON DELETE CASCADE UNIQUE,
  status      VARCHAR(50) DEFAULT 'available',
  status_note VARCHAR(255),
  set_at      TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS test.circular_versions (
  id          SERIAL PRIMARY KEY,
  circular_id INT REFERENCES test.circulars(id) ON DELETE CASCADE,
  version     INT NOT NULL,
  title       VARCHAR(500),
  content     TEXT,
  changed_by  INT REFERENCES test.users(id),
  changed_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_agent_id   ON test.call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON test.call_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_shift_rotas_user_date ON test.shift_rotas(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_circulars_is_active   ON test.circulars(is_active);
`

const SEED_USERS = [
  {
    email: 'ann.shruthy@iohealth.com',
    password: 'W@c62288',
    full_name: 'Ann Shruthy',
    role: 'admin',
    ziwo_email: 'ann.shruthy@iohealth.com',
    ziwo_password: null,
  },
  {
    email: 'asif.k@iohealth.com',
    password: 'Agent@Cortex2025',
    full_name: 'Asif K',
    role: 'agent',
    ziwo_email: 'asif.k@iohealth.com',
    ziwo_password: 'Aachi452282@',
  },
]

export async function GET(request) {
  // Protect with AUTH_SECRET
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  if (!key || key !== process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: 'Missing or invalid key. Pass ?key=AUTH_SECRET' },
      { status: 401 }
    )
  }

  const log = []

  try {
    // 1. Run migration 001
    await pool.query(MIGRATION_SQL)
    log.push('✓ Migration 001 complete (tables created or already exist)')

    // 2. Run migration 002 (phase 2 — auth hardening, notifications, shift_breaks, ticket assignment)
    const MIGRATION_002 = `
ALTER TABLE test.users
  ADD COLUMN IF NOT EXISTS login_attempts      INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until        TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_login_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS current_session_tok VARCHAR(255);

ALTER TABLE test.tickets
  ADD COLUMN IF NOT EXISTS assigned_to_id    INT REFERENCES test.users(id),
  ADD COLUMN IF NOT EXISTS assigned_to_email VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON test.tickets(assigned_to_email);

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

CREATE TABLE IF NOT EXISTS test.notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES test.users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  body       TEXT,
  link       VARCHAR(255),
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON test.notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS test.shift_breaks (
  id          SERIAL PRIMARY KEY,
  shift_id    INT REFERENCES test.shift_rotas(id) ON DELETE CASCADE,
  break_start TIME NOT NULL,
  break_end   TIME NOT NULL,
  break_type  VARCHAR(50) DEFAULT 'scheduled',
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_breaks_shift_id ON test.shift_breaks(shift_id);
`
    await pool.query(MIGRATION_002)
    log.push('✓ Migration 002 complete (auth hardening, notifications, shift_breaks, ticket assignment)')

    // 3. Seed users
    for (const u of SEED_USERS) {
      const hash = await bcrypt.hash(u.password, 10)
      const result = await pool.query(
        `INSERT INTO test.users (email, password_hash, full_name, role, ziwo_email, ziwo_password)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           full_name     = EXCLUDED.full_name,
           role          = EXCLUDED.role,
           ziwo_email    = EXCLUDED.ziwo_email,
           ziwo_password = EXCLUDED.ziwo_password,
           updated_at    = NOW()
         RETURNING id, email, role`,
        [u.email, hash, u.full_name, u.role, u.ziwo_email, u.ziwo_password]
      )
      const row = result.rows[0]
      log.push(`✓ User: ${row.role} | ${row.email} | id=${row.id}`)
    }

    return NextResponse.json({
      success: true,
      log,
      credentials: SEED_USERS.map(u => ({ email: u.email, password: u.password, role: u.role })),
      next: 'Visit /login and sign in. Change passwords via Admin → User Management.',
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message, log },
      { status: 500 }
    )
  }
}
