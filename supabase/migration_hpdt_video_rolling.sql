-- Migration: hpdt_history — thêm trigger_type 'video_rolling'
-- Chạy trên Supabase SQL Editor
-- Safe: xử lý cả trường hợp trigger_type là enum hoặc TEXT

-- ── Nếu trigger_type là ENUM → thêm value 'video_rolling' ────────────────────
DO $$
BEGIN
  -- Tìm enum type có tên chứa 'trigger' liên quan đến hpdt_history
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE e.enumlabel = 'weekly_batch'
      AND t.typname ILIKE '%trigger%'
  ) THEN
    -- Thêm value mới nếu chưa có
    ALTER TYPE hpdt_trigger_type ADD VALUE IF NOT EXISTS 'video_rolling';
    RAISE NOTICE 'Added video_rolling to hpdt_trigger_type enum';
  ELSE
    RAISE NOTICE 'trigger_type is not an enum (likely TEXT) — no action needed';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Enum alter skipped: %', SQLERRM;
END
$$;

-- ── Nếu trigger_type là TEXT với CHECK CONSTRAINT → update constraint ─────────
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'hpdt_history'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%trigger_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE hpdt_history DROP CONSTRAINT %I', constraint_name);
    ALTER TABLE hpdt_history
      ADD CONSTRAINT hpdt_history_trigger_type_check
      CHECK (trigger_type IN ('weekly_batch', 'ai_report', 'manual', 'video_rolling'));
    RAISE NOTICE 'Updated CHECK constraint to include video_rolling';
  ELSE
    RAISE NOTICE 'No CHECK constraint on trigger_type — no action needed';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Constraint update skipped: %', SQLERRM;
END
$$;

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'hpdt_history'
  AND column_name = 'trigger_type';
