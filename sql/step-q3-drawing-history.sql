-- ============================================================================
-- step-q3-drawing-history.sql — Drawing history audit trail
-- DO NOT RUN — apply through Supabase SQL Editor after review
-- Run order: after step-q1b-template-seed.sql
-- ============================================================================

-- ── 1. drawing_history table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.drawing_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  drawing_id  bigint       NOT NULL REFERENCES public.drawings(id) ON DELETE CASCADE,
  user_id     uuid,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  event       text         NOT NULL CHECK (event IN ('created', 'saved', 'created_from_template', 'copied')),
  changes     jsonb        NOT NULL DEFAULT '[]'::jsonb,
  note        text
);

CREATE INDEX IF NOT EXISTS idx_drawing_history_drawing
  ON public.drawing_history(drawing_id, created_at DESC);

-- ── 2. RLS — insert-only for authenticated users ──────────────────────────

ALTER TABLE public.drawing_history ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all history
CREATE POLICY "auth_read_drawing_history"
  ON public.drawing_history FOR SELECT TO authenticated USING (true);

-- Authenticated users can insert history rows (append-only audit trail)
CREATE POLICY "auth_insert_drawing_history"
  ON public.drawing_history FOR INSERT TO authenticated WITH CHECK (true);

-- No UPDATE or DELETE policies — history is immutable

-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — DO NOT RUN
-- ══════════════════════════════════════════════════════════════════════════════
-- DROP POLICY IF EXISTS "auth_insert_drawing_history" ON public.drawing_history;
-- DROP POLICY IF EXISTS "auth_read_drawing_history"   ON public.drawing_history;
-- DROP TABLE IF EXISTS public.drawing_history;
