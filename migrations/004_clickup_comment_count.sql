-- Migration 004: Add clickup_comment_count column
-- Tracks the raw ClickUp comment_count last seen during sync.
-- Separate from clickup_thread_count (which was used ambiguously).
-- Used by clickup-cortex-sync Compare & Classify to skip unchanged tasks (early-exit optimisation).

ALTER TABLE main.tickets
  ADD COLUMN IF NOT EXISTS clickup_comment_count integer DEFAULT 0;
