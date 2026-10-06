-- ============================================================================
-- step-p1-validation.sql — Validation rules schema
-- DO NOT RUN — apply through Supabase SQL Editor after review
-- ============================================================================

-- ── 1. validation_groups ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.validation_groups (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text    NOT NULL UNIQUE,
  sort_order  int     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. validation_rules ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.validation_rules (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id      bigint  NOT NULL REFERENCES public.validation_groups(id),
  name          text    NOT NULL DEFAULT '',
  sort_order    int     NOT NULL DEFAULT 0,
  loop_target   text,                                   -- null = per item
  level         text    NOT NULL DEFAULT 'item'
                        CHECK (level IN ('item', 'quote')),
  severity      text    NOT NULL DEFAULT 'warning'
                        CHECK (severity IN ('information', 'warning', 'error')),
  condition     text    NOT NULL DEFAULT 'true',
  message       text    NOT NULL DEFAULT '',
  comment       text,
  is_active     boolean NOT NULL DEFAULT true,
  blocked_reason text,                                  -- non-null = auto-deactivated
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_rules_group
  ON public.validation_rules(group_id);

-- ── 3. validation_lists ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.validation_lists (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text    NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 4. validation_list_values ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.validation_list_values (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  list_id  bigint NOT NULL REFERENCES public.validation_lists(id) ON DELETE CASCADE,
  value    text   NOT NULL,
  UNIQUE (list_id, value)
);

-- ── 5. validation_rule_history ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.validation_rule_history (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_id    bigint NOT NULL REFERENCES public.validation_rules(id) ON DELETE CASCADE,
  user_id    uuid,
  user_email text,
  field      text   NOT NULL,
  old_value  text,
  new_value  text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_rule_history_rule
  ON public.validation_rule_history(rule_id);

-- ── 6. Seed groups ───────────────────────────────────────────────────────────
-- 16 Integrate groups + "Quote Summary"

INSERT INTO public.validation_groups (name, sort_order) VALUES
  ('Quote Summary',          0),
  ('Glass',                  1),
  ('Sash Windows',           2),
  ('Stormproof Casements',   3),
  ('Missing Detail',         4),
  ('Dimension',              5),
  ('Suspicious Detail',      6),
  ('Recommendation',         7),
  ('Ironmongery',            8),
  ('Friction Hinges',        9),
  ('Casement Espags',       10),
  ('Health & Safety',       11),
  ('Doors',                 12),
  ('Factory',               13),
  ('To Be Checked',        14),
  ('Heritage',              15),
  ('Section Details',       16)
ON CONFLICT (name) DO NOTHING;

-- ── 7. Seed allowed_sash_thickess list ───────────────────────────────────────
-- Note: the Integrate list name has the typo "thickess" (not "thickness").
-- We keep it as-is so that imported rule conditions match.

INSERT INTO public.validation_lists (name, description)
VALUES ('allowed_sash_thickess', 'Permitted sash thickness values (mm)')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.validation_list_values (list_id, value)
SELECT vl.id, v.val
FROM public.validation_lists vl
CROSS JOIN (VALUES ('35'), ('40'), ('45'), ('50')) AS v(val)
WHERE vl.name = 'allowed_sash_thickess'
ON CONFLICT (list_id, value) DO NOTHING;

-- ── 8. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.validation_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_lists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_list_values   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validation_rule_history  ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read and write all rows
CREATE POLICY "auth_read_validation_groups"
  ON public.validation_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_validation_groups"
  ON public.validation_groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_validation_rules"
  ON public.validation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_validation_rules"
  ON public.validation_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_validation_lists"
  ON public.validation_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_validation_lists"
  ON public.validation_lists FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_validation_list_values"
  ON public.validation_list_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_validation_list_values"
  ON public.validation_list_values FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_read_validation_rule_history"
  ON public.validation_rule_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_write_validation_rule_history"
  ON public.validation_rule_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ══════════════════════════════════════════════════════════════════════════════
-- DROP POLICY IF EXISTS "auth_write_validation_rule_history"  ON public.validation_rule_history;
-- DROP POLICY IF EXISTS "auth_read_validation_rule_history"   ON public.validation_rule_history;
-- DROP POLICY IF EXISTS "auth_write_validation_list_values"   ON public.validation_list_values;
-- DROP POLICY IF EXISTS "auth_read_validation_list_values"    ON public.validation_list_values;
-- DROP POLICY IF EXISTS "auth_write_validation_lists"         ON public.validation_lists;
-- DROP POLICY IF EXISTS "auth_read_validation_lists"          ON public.validation_lists;
-- DROP POLICY IF EXISTS "auth_write_validation_rules"         ON public.validation_rules;
-- DROP POLICY IF EXISTS "auth_read_validation_rules"          ON public.validation_rules;
-- DROP POLICY IF EXISTS "auth_write_validation_groups"        ON public.validation_groups;
-- DROP POLICY IF EXISTS "auth_read_validation_groups"         ON public.validation_groups;
--
-- DROP TABLE IF EXISTS public.validation_rule_history;
-- DROP TABLE IF EXISTS public.validation_list_values;
-- DROP TABLE IF EXISTS public.validation_lists;
-- DROP TABLE IF EXISTS public.validation_rules;
-- DROP TABLE IF EXISTS public.validation_groups;
