-- ============================================================================
-- step-q1-drawing-templates.sql — Drawing templates schema
-- DO NOT RUN — apply through Supabase SQL Editor after review
-- ============================================================================

-- ── 1. drawing_templates table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.drawing_templates (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               text    NOT NULL,
  family             text    NOT NULL CHECK (family IN ('sash', 'casement', 'door', 'free_text')),
  group_name         text    NOT NULL DEFAULT '',
  sort_order         int     NOT NULL DEFAULT 0,
  default_profile_id bigint,  -- corrected from uuid; step-r0 fixes existing databases
  window_type        text,
  tree               jsonb   NOT NULL DEFAULT '{}'::jsonb,
  is_active          boolean NOT NULL DEFAULT true,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drawing_templates_family
  ON public.drawing_templates(family);

-- ── 2. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.drawing_templates ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all templates
CREATE POLICY "auth_read_drawing_templates"
  ON public.drawing_templates FOR SELECT TO authenticated USING (true);

-- Authenticated users can write (same roles as validation rules)
CREATE POLICY "auth_write_drawing_templates"
  ON public.drawing_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ══════════════════════════════════════════════════════════════════════════════
-- DROP POLICY IF EXISTS "auth_write_drawing_templates" ON public.drawing_templates;
-- DROP POLICY IF EXISTS "auth_read_drawing_templates"  ON public.drawing_templates;
-- DROP TABLE IF EXISTS public.drawing_templates;
