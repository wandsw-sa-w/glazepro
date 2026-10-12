-- Step AP-2: "Casement MPLS" on Finish & Ironmongery.
-- Run by Nathan in the Supabase SQL editor. Safe to run twice.
--
-- Why: Integrate's default casement ironmongery rules branch on
-- isCasementMpls — a multipoint locking casement gets the Kenrick gearbox and
-- extensions, a non-multipoint one gets a fastener and stay instead. Nathan
-- (9 Oct 2026): casements are multipoint by default and the surveyor can
-- untick it, so the default is ON.
--
-- The Finish & Ironmongery panel renders its fields from
-- default_field_definitions (Step Z), so inserting the row is all that is
-- needed for the tick box to appear — there is no UI change in this step.
--
-- Default ON is set twice on purpose:
--   1. as a default_profile_values row on the casement profile, so a new
--      drawing stores TRUE and a surveyor can see what it is set to;
--   2. in the pricing code, which reads `isCasementMpls ?? true`, so an
--      EXISTING casement drawing saved before this row existed still prices
--      as multipoint rather than silently losing its gearbox.

BEGIN;

-- 1. The field itself (paintAndIronmongeryPart sorts 800-803 are Step A2's
--    four finish fields; this is 804).
INSERT INTO default_field_definitions
    (part_type, field_key, property_name, label, data_type, visibility,
     sort_order, is_active, group_name, unit, role, reference_category,
     part_category, is_required)
VALUES
    ('paintAndIronmongeryPart', 'paintAndIronmongeryPart.isCasementMpls',
     'isCasementMpls', 'Casement MPLS', 'boolean', 'visible',
     804, TRUE, 'paintAndIronmongeryPart', NULL, 'input', NULL, NULL, FALSE)
ON CONFLICT (field_key) DO NOTHING;

-- 2. Default ON, on the casement profile.
INSERT INTO public.default_profile_values (profile_id, field_key, default_value)
SELECT p.id, 'paintAndIronmongeryPart.isCasementMpls', 'true'
FROM public.default_profiles p
WHERE p.code = 'casement'
ON CONFLICT (profile_id, field_key) DO NOTHING;

COMMIT;

-- 3. Check — expect the five paintAndIronmongeryPart fields with
--    "Casement MPLS" last, and one 'true' profile value on `casement`.
SELECT field_key, label, data_type, role, sort_order, is_active
FROM default_field_definitions
WHERE part_type = 'paintAndIronmongeryPart'
ORDER BY sort_order;

SELECT p.code AS profile, v.field_key, v.default_value
FROM public.default_profile_values v
JOIN public.default_profiles p ON p.id = v.profile_id
WHERE v.field_key = 'paintAndIronmongeryPart.isCasementMpls';


-- ---------------------------------------------------------------------------
-- DO NOT RUN — rollback, only if this step has to be undone
-- ---------------------------------------------------------------------------
-- DELETE FROM public.default_profile_values
-- WHERE field_key = 'paintAndIronmongeryPart.isCasementMpls';
--
-- DELETE FROM default_field_definitions
-- WHERE field_key = 'paintAndIronmongeryPart.isCasementMpls';
--
-- Note: removing the row does NOT turn multipoint locking off — the pricing
-- code still reads `isCasementMpls ?? true`. Any drawing that stored FALSE
-- keeps that value in its tree and keeps pricing as non-multipoint; it just
-- loses the tick box the surveyor would use to change it back.
