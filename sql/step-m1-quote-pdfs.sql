-- step-m1-quote-pdfs.sql
-- Private Storage bucket for published quote PDFs, plus RLS policies.
--
-- Run after: step-h1-quotes.sql (which adds quotes.pdf_path)
-- Rollback: step-m1-quote-pdfs-rollback.sql

BEGIN;

-- 1. Create the private bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('quote-pdfs', 'quote-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Read policy: authenticated users can read any PDF
DROP POLICY IF EXISTS "Authenticated users can read quote PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can read quote PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'quote-pdfs');

-- 3. Insert policy: authenticated users can upload PDFs
DROP POLICY IF EXISTS "Authenticated users can insert quote PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can insert quote PDFs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'quote-pdfs');

-- No UPDATE or DELETE policy: a published PDF is never replaced.

-- 4. Ensure quotes.pdf_path column exists (ADD COLUMN IF NOT EXISTS)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS pdf_path text;

COMMIT;
