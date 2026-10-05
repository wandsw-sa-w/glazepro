-- ============================================================================
-- Step N1: settings_history table + quote-assets Storage bucket  (RUN THIS ONE)
-- ============================================================================
-- Run order: after step-n0-users-rls.sql
-- Rollback:  step-n1-settings-history-rollback.sql
-- ============================================================================

BEGIN;

-- 1. settings_history — audit trail for every Settings save
CREATE TABLE IF NOT EXISTS settings_history (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text     NOT NULL,           -- e.g. 'quote_letters', 'quote_lead_times'
  description text     NOT NULL DEFAULT '',-- human-readable "Changed front cover letter"
  changed_by  text     NOT NULL DEFAULT '',-- user email
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for listing recent changes
CREATE INDEX IF NOT EXISTS idx_settings_history_created
  ON settings_history (created_at DESC);

-- RLS: authenticated users can read + insert
ALTER TABLE settings_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_history_read ON settings_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY settings_history_insert ON settings_history
  FOR INSERT TO authenticated WITH CHECK (true);

-- 2. quote-assets Storage bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-assets', 'quote-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read (public bucket)
CREATE POLICY quote_assets_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'quote-assets');

-- Allow authenticated users to upload/update/delete
CREATE POLICY quote_assets_auth_write ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'quote-assets');

CREATE POLICY quote_assets_auth_update ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'quote-assets');

CREATE POLICY quote_assets_auth_delete ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'quote-assets');

COMMIT;
