-- DO NOT RUN — rollback for step-m1-quote-pdfs.sql

BEGIN;

DROP POLICY IF EXISTS "Authenticated users can read quote PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can insert quote PDFs" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'quote-pdfs';
-- ALTER TABLE public.quotes DROP COLUMN IF EXISTS pdf_path;
-- ^ commented out: other code may depend on this column

COMMIT;
