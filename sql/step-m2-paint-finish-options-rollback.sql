-- DO NOT RUN — rollback for step-m2-paint-finish-options.sql  (corrected 5 Oct 2026)
--
-- Removes only the three Sash-profile finish defaults that step-m2 added.
-- It must never delete the paint_finish category or its options: those existed
-- before step-m2 and drawings and pricing rules depend on them.

BEGIN;

DELETE FROM default_profile_values
WHERE profile_id IN (SELECT id FROM default_profiles WHERE code = 'sash')
  AND field_key IN (
    'paintAndIronmongeryPart.internalFinish',
    'paintAndIronmongeryPart.externalFinish',
    'paintAndIronmongeryPart.cillFinish'
  );

COMMIT;
