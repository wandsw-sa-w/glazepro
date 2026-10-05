-- step-m4-copied-from-quote-id.sql  (written by Claude, 5 Oct 2026)
--
-- "Copy to new quote" fails on the live site with:
--   invalid input syntax for type uuid: "3"
-- quotes.copied_from_quote_id was created as uuid, but quotes.id is a number.
-- Every copy has therefore failed, so the column holds no values.
--
-- This re-creates the column with the same type as quotes.id.
-- It stops without changing anything if the column unexpectedly holds data.
-- Safe to run more than once.
-- Rollback: step-m4-copied-from-quote-id-rollback.sql

DO $$
DECLARE
  id_type  text;
  col_type text;
  n        bigint;
BEGIN
  SELECT format_type(atttypid, atttypmod) INTO id_type
  FROM pg_attribute
  WHERE attrelid = 'public.quotes'::regclass AND attname = 'id' AND NOT attisdropped;

  SELECT format_type(atttypid, atttypmod) INTO col_type
  FROM pg_attribute
  WHERE attrelid = 'public.quotes'::regclass AND attname = 'copied_from_quote_id' AND NOT attisdropped;

  IF col_type IS NOT DISTINCT FROM id_type THEN
    RAISE NOTICE 'copied_from_quote_id is already %, nothing to do', id_type;
    RETURN;
  END IF;

  IF col_type IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.quotes WHERE copied_from_quote_id IS NOT NULL' INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'copied_from_quote_id holds % value(s); not changing it', n;
    END IF;
    EXECUTE 'ALTER TABLE public.quotes DROP COLUMN copied_from_quote_id';
  END IF;

  EXECUTE format('ALTER TABLE public.quotes ADD COLUMN copied_from_quote_id %s REFERENCES public.quotes(id)', id_type);
  RAISE NOTICE 'copied_from_quote_id re-created as %', id_type;
END $$;

-- Check: both rows should show the same data type.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'quotes'
  AND column_name IN ('id', 'copied_from_quote_id');
