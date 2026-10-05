-- step-m2-paint-finish-options.sql  (corrected 5 Oct 2026)
--
-- The paint_finish reference category and its six options (Clean White, White Gloss,
-- White Satin, Colour Match Satin, Colour Match Gloss, Custom) ALREADY EXIST in the
-- live database ("Finish - Paint" on the Reference Data page). They were created in
-- August outside this repo. This file must not create or touch them.
--
-- What was actually missing: the Sash profile had no default for Internal, External
-- or Cill Finish, so the Quote Overview grid showed "—".
--
-- This file only adds those three defaults (Clean White) to the Sash profile.
-- Safe to run more than once.
-- Rollback: step-m2-paint-finish-options-rollback.sql

BEGIN;

INSERT INTO default_profile_values (profile_id, field_key, default_value)
SELECT p.id, v.field_key, v.default_value
FROM (
  VALUES
    ('paintAndIronmongeryPart.internalFinish', 'clean_white'),
    ('paintAndIronmongeryPart.externalFinish', 'clean_white'),
    ('paintAndIronmongeryPart.cillFinish',     'clean_white')
) AS v(field_key, default_value)
CROSS JOIN (SELECT id FROM default_profiles WHERE code = 'sash') AS p
ON CONFLICT (profile_id, field_key) DO NOTHING;

-- Check: expect 3 rows, all clean_white.
SELECT dpv.field_key, dpv.default_value
FROM default_profile_values dpv
JOIN default_profiles p ON p.id = dpv.profile_id
WHERE p.code = 'sash'
  AND dpv.field_key LIKE 'paintAndIronmongeryPart.%Finish'
ORDER BY dpv.field_key;

COMMIT;
