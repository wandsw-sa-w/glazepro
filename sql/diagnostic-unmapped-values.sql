-- ─────────────────────────────────────────────────────────────────────────────
-- Diagnostic: list all distinct lead source / stage / tag values that are
-- NOT in the application reference lists.
--
-- Run in the Supabase SQL editor to identify data needing normalisation.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Unmapped source values ────────────────────────────────────────────────────
SELECT
  source                                    AS value,
  count(*)                                  AS lead_count,
  'source'                                  AS field
FROM public.leads
WHERE source IS NOT NULL
  AND lower(trim(source)) NOT IN (
    'online presence', 'recommendation', 'repeat customer',
    'frs presence', 'srs presence', 'physical presence', 'historical remedial'
  )
GROUP BY source
ORDER BY lead_count DESC;

-- ── Unmapped stage values ─────────────────────────────────────────────────────
SELECT
  stage                                     AS value,
  count(*)                                  AS lead_count,
  'stage'                                   AS field
FROM public.leads
WHERE stage IS NOT NULL
  AND lower(trim(stage)) NOT IN (
    'new', 'in contact with customer', 'budget quote provided',
    'appointment arranged', 'pending', 'won', 'rejected', 'lost',
    'historical remedial', 'contact failed', 'appointment cancelled', 'quoted'
  )
GROUP BY stage
ORDER BY lead_count DESC;

-- ── Unmapped lead_tags (each comma-separated tag checked individually) ────────
WITH tag_rows AS (
  SELECT
    trim(tag)  AS tag
  FROM public.leads,
       unnest(string_to_array(lead_tags, ',')) AS tag
  WHERE lead_tags IS NOT NULL AND lead_tags <> ''
)
SELECT
  tag                                        AS value,
  count(*)                                   AS occurrence_count,
  'lead_tag'                                 AS field
FROM tag_rows
WHERE lower(tag) NOT IN (
  'awaiting deposit', 'awaiting planning', 'stained glass required',
  'psa', 'pre order', 'second survey required'
)
GROUP BY tag
ORDER BY occurrence_count DESC;
