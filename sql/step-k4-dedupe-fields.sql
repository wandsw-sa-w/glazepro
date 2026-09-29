-- step-k4-dedupe-fields.sql
-- Finds and deactivates duplicate default_field_definition labels within the
-- same part type.  Keeps the record with the LOWER sort_order (the older field)
-- and deactivates any extras (higher sort_order, introduced by step-j1-parts.sql).
--
-- ── Known duplicates (verified before running) ───────────────────────────────
--
--   sashPairPart | 'Sash Split'
--     sashSplit      (step-a2, lower sort_order) ← KEPT
--     sashSplitId    (step-j1, sort 2310)        ← DEACTIVATED
--
-- sashGeometry.js reads `pv.sashSplitId ?? pv.sashSplit`, so after deactivation
-- the older `sashSplit` field is used for both display and pricing.
--
-- ── Fields checked but NOT duplicates ────────────────────────────────────────
--
--   sashPairPart | 'Horn Length'      — only one: hornLength (step-a2)
--   sashPairPart | 'Top Horn Length'  — only one: topHornLength (J1, sort 2311)
--   sashPairPart | 'Bottom Horn Length' — only one: bottomHornLength (J1, sort 2312)
--   sashPairPart | 'Top Horn Type'    — only one: topHornTypeShortName (step-a2)
--   sashPairPart | 'Bottom Horn Type' — only one: bottomHornTypeShortName (step-a2)
--   (topHornLength / bottomHornLength are distinct from hornLength by label)
--
-- ── Step 1 — Diagnostic: list all active duplicates before changes ────────────

SELECT
  part_type_code,
  label,
  COUNT(*)                                          AS cnt,
  array_agg(field_key   ORDER BY sort_order)        AS field_keys,
  array_agg(sort_order  ORDER BY sort_order)        AS sort_orders,
  array_agg(is_active   ORDER BY sort_order)        AS active_flags
FROM  default_field_definitions
WHERE is_active = TRUE
GROUP BY part_type_code, label
HAVING COUNT(*) > 1
ORDER BY part_type_code, label;

-- ── Step 2 — Deactivate newer duplicates (keep lowest sort_order) ─────────────

WITH ranked AS (
  SELECT
    id,
    field_key,
    part_type_code,
    label,
    sort_order,
    ROW_NUMBER() OVER (
      PARTITION BY part_type_code, label
      ORDER BY sort_order ASC        -- rank 1 = oldest = keep
    ) AS rn
  FROM  default_field_definitions
  WHERE is_active = TRUE
)
UPDATE default_field_definitions
SET    is_active = FALSE,
       updated_at = NOW()
WHERE  id IN (
  SELECT id FROM ranked WHERE rn > 1
)
RETURNING part_type_code, field_key, label, sort_order,
          'deactivated — duplicate of lower sort_order field' AS reason;
