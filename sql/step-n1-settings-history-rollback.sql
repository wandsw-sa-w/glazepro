-- ============================================================================
-- DO NOT RUN — Rollback for step-n1-settings-history.sql
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS quote_assets_auth_delete ON storage.objects;
DROP POLICY IF EXISTS quote_assets_auth_update ON storage.objects;
DROP POLICY IF EXISTS quote_assets_auth_write ON storage.objects;
DROP POLICY IF EXISTS quote_assets_public_read ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'quote-assets';

DROP POLICY IF EXISTS settings_history_insert ON settings_history;
DROP POLICY IF EXISTS settings_history_read ON settings_history;
DROP INDEX IF EXISTS idx_settings_history_created;
DROP TABLE IF EXISTS settings_history;

COMMIT;
