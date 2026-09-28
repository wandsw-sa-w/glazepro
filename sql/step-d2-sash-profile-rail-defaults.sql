-- ─────────────────────────────────────────────────────────────────────────────
-- Step D2: ensure the 'sash' default profile has values for the four fields
-- that computeSashGeometry reads from the saved tree.
--
-- Run once in your Supabase SQL editor.
-- ON CONFLICT … DO UPDATE means re-running is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.default_profile_values (profile_id, field_key, default_value)
SELECT
  p.id   AS profile_id,
  v.field_key,
  v.default_value
FROM public.default_profiles p
CROSS JOIN (VALUES
  ('topSashPart.topHeight',        '49'),          -- top rail height (mm)
  ('bottomSashPart.bottomHeight',  '88'),          -- bottom rail height (mm)
  ('sashPairPart.midrailHeight',   '40'),          -- meeting rail height (mm)
  ('sashPairPart.sashSplit',       'half_half')    -- equal top/bottom split
) AS v(field_key, default_value)
WHERE p.code = 'sash'
ON CONFLICT (profile_id, field_key) DO UPDATE
  SET default_value = EXCLUDED.default_value;

-- ── Diagnostic: confirm the rows now exist ────────────────────────────────────
SELECT
  f.part_type,
  f.property_name,
  pv.field_key,
  pv.default_value
FROM public.default_profile_values pv
JOIN public.default_profiles p   ON p.id = pv.profile_id
JOIN public.default_field_definitions f ON f.field_key = pv.field_key
WHERE p.code = 'sash'
  AND pv.field_key IN (
    'topSashPart.topHeight',
    'bottomSashPart.bottomHeight',
    'sashPairPart.midrailHeight',
    'sashPairPart.sashSplit'
  )
ORDER BY f.part_type, f.property_name;
