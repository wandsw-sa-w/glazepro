-- DO NOT RUN — rollback for step-m2-paint-finish-options.sql

BEGIN;

DELETE FROM default_profile_values
WHERE field_key IN (
  'paintAndIronmongeryPart.internalFinish',
  'paintAndIronmongeryPart.externalFinish',
  'paintAndIronmongeryPart.cillFinish'
);

DELETE FROM reference_options WHERE category = 'paint_finish';

DELETE FROM reference_categories WHERE category = 'paint_finish';

COMMIT;
