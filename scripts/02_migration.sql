-- =============================================================================
-- MIGRATION: Cortex 2.0 — Multi-tenant, Subtask, Hybrid Custom Fields
-- Run this BEFORE the seed SQL.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS).
-- =============================================================================

-- 1. solution_custom_fields: stores per-list ClickUp field UUIDs and option maps
--    This implements the hybrid approach: fixed core columns + dynamic extras via DB
CREATE TABLE IF NOT EXISTS main.solution_custom_fields (
  id            SERIAL PRIMARY KEY,
  solution_id   INTEGER NOT NULL REFERENCES main.solutions(id) ON DELETE CASCADE,
  field_key     VARCHAR NOT NULL,
  -- field_key values: 'request_type', 'case_type', 'source', 'module'
  clickup_field_id VARCHAR NOT NULL,
  -- options: JSON map of { "option_name": "clickup_option_uuid" }
  options       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  CONSTRAINT solution_custom_fields_uq UNIQUE (solution_id, field_key)
);

-- 2. solution_type: differentiate support / development / testing lists
ALTER TABLE main.solutions
  ADD COLUMN IF NOT EXISTS solution_type VARCHAR DEFAULT 'support'
    CHECK (solution_type IN ('support', 'development', 'testing'));

-- 3. parent_ticket_id: subtask relationship in DB
--    linked_clickup_task_ids (text[]) already exists for cross-list links.
--    parent_ticket_id is for true parent/child within same solution.
ALTER TABLE main.tickets
  ADD COLUMN IF NOT EXISTS parent_ticket_id INTEGER REFERENCES main.tickets(id);

-- 4. custom_fields JSONB: stores extra per-org fields not in fixed schema
ALTER TABLE main.tickets
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- 5. linked_thread_source_tag: threads already have metadata JSONB.
--    We'll store linked task info in metadata. No schema change needed.
--    thread_source values: 'clickup' | 'internal' | 'zoho_reply' | 'linked_ticket'
--    Add 'linked_ticket' as a valid tag (no constraint to modify, it's varchar).

-- 6. Escalation level tracking: verify escalation_level column exists on tickets
--    (It does per schema: escalation_level integer DEFAULT 0)
--    last_escalation_at also exists. No change needed.

-- 7. Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_tickets_parent_ticket_id
  ON main.tickets(parent_ticket_id)
  WHERE parent_ticket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solution_custom_fields_solution_id
  ON main.solution_custom_fields(solution_id);

CREATE INDEX IF NOT EXISTS idx_tickets_channel
  ON main.tickets(channel);

CREATE INDEX IF NOT EXISTS idx_solutions_solution_type
  ON main.solutions(solution_type);

-- =============================================================================
-- VERIFICATION QUERIES (run after migration to confirm)
-- =============================================================================
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'main' AND table_name = 'tickets'
--   ORDER BY ordinal_position;
-- SELECT * FROM main.solution_custom_fields LIMIT 5;
