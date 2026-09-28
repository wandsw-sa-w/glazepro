-- ============================================================
-- Step F1 — Timber densities table
--
-- DO NOT RUN DIRECTLY — paste into Supabase SQL editor.
--
-- Creates timber_densities and seeds the four material codes
-- used by the sash weight engine (densities from Integrate's
-- Weight Calc page, 28 Sep 2026).
--
-- Re-runnable: CREATE TABLE IF NOT EXISTS + upsert.
-- ============================================================

CREATE TABLE IF NOT EXISTS timber_densities (
  material_code   text PRIMARY KEY,
  kg_per_m3       numeric       NOT NULL,
  adjustment_pct  numeric       NOT NULL DEFAULT 0,
  notes           text
);

-- RLS: authenticated users can read; only service-role can write
ALTER TABLE timber_densities ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'timber_densities' AND policyname = 'timber_densities_select'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY timber_densities_select ON timber_densities
        FOR SELECT TO authenticated USING (true)
    $pol$;
  END IF;
END $$;

-- Seed / update — same four codes shown in Integrate Weight Calc
INSERT INTO timber_densities (material_code, kg_per_m3, adjustment_pct, notes)
VALUES
  ('solid_redwood',         508.3, 0, 'Softwood; matches Accoya density in Integrate Weight Calc'),
  ('accoya',                508.3, 0, 'Accoya modified pine; same density as solid_redwood in Integrate'),
  ('solid_utile_hardwood',  780.1, 0, 'Sapele = Utile in Integrate; both use this density'),
  ('idigbo',                780.1, 0, 'West African hardwood; same density as utile in Integrate')
ON CONFLICT (material_code) DO UPDATE
  SET kg_per_m3      = EXCLUDED.kg_per_m3,
      adjustment_pct = EXCLUDED.adjustment_pct,
      notes          = EXCLUDED.notes;

-- Verify
SELECT material_code, kg_per_m3, adjustment_pct FROM timber_densities ORDER BY material_code;
