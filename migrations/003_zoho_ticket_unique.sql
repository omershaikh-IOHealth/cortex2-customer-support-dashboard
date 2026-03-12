-- Migration 003: Add UNIQUE constraint on zoho_ticket_id + linked ClickUp task IDs
-- Run against Supabase main schema

-- Required for ON CONFLICT (zoho_ticket_id) in Zoho n8n workflow
-- Wrap in DO block to skip gracefully if it already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tickets_zoho_ticket_id_unique'
      AND conrelid = 'main.tickets'::regclass
  ) THEN
    ALTER TABLE main.tickets
      ADD CONSTRAINT tickets_zoho_ticket_id_unique UNIQUE (zoho_ticket_id);
  END IF;
END
$$;

-- Column for tracking native ClickUp linked task IDs (cross-space relationships)
-- Used by clickup-cortex-sync to fetch threads from tasks linked by the technical team
ALTER TABLE main.tickets
  ADD COLUMN IF NOT EXISTS linked_clickup_task_ids text[] DEFAULT '{}';
