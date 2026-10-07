-- step-s4-sash-material-rules.sql
-- Deliberate difference from Integrate, agreed with Nathan 6 Oct 2026.
--
-- Integrate rules "Laminated Softwood for Sashes" (sort 10, 15) and
-- "Glazing Bead for Sashes" (sort 310) in the manufacture_materials
-- group have no condition checking whether the sash is being replaced.
-- This means they charge new sash timber and glazing bead on a draught
-- seal job where no sash is manufactured.
--
-- This SQL adds "and to_be_replaced" to the condition of each rule,
-- using the sliding_sash loop-scoped variable, so the rules only fire
-- when the sash is actually being made.
--
-- Effect: Benchmark B (DSO) cost drops from £233.79 to £208.33,
-- price from £573.55 to £522.65 (three lines totalling £25.46
-- cost / £50.90 price no longer fire).
-- Benchmark A (sash replacement) and L34046 (complete new) are
-- unchanged because to_be_replaced=true for their sashes.
--
-- RUN ORDER: after step-k1

-- ── Find the current price file ──────────────────────────────────────────────
-- We update only the current price file (is_current = true).

-- Rule sort 10: Laminated Softwood for Sashes (bottom sash)
-- BEFORE: is_solid_redwood_sash and is_bottom_sash
-- AFTER:  is_solid_redwood_sash and is_bottom_sash and to_be_replaced
UPDATE price_rules
SET condition = condition || ' and to_be_replaced'
WHERE price_file_id = (SELECT id FROM price_files WHERE is_current = true LIMIT 1)
  AND rule_family = 'price'
  AND group_name = 'manufacture_materials'
  AND name LIKE 'Laminated Softwood%'
  AND sort_order = 10
  AND condition NOT LIKE '%to_be_replaced%';

-- Rule sort 15: Laminated Softwood for Sashes (top sash)
-- BEFORE: is_solid_redwood_sash and is_top_sash
-- AFTER:  is_solid_redwood_sash and is_top_sash and to_be_replaced
UPDATE price_rules
SET condition = condition || ' and to_be_replaced'
WHERE price_file_id = (SELECT id FROM price_files WHERE is_current = true LIMIT 1)
  AND rule_family = 'price'
  AND group_name = 'manufacture_materials'
  AND name LIKE 'Laminated Softwood%'
  AND sort_order = 15
  AND condition NOT LIKE '%to_be_replaced%';

-- Rule sort 310: Glazing Bead for Sashes
-- BEFORE: is not square_top_with_arched_sightline and is not curved_head_sash
-- AFTER:  is not square_top_with_arched_sightline and is not curved_head_sash and to_be_replaced
UPDATE price_rules
SET condition = condition || ' and to_be_replaced'
WHERE price_file_id = (SELECT id FROM price_files WHERE is_current = true LIMIT 1)
  AND rule_family = 'price'
  AND group_name = 'manufacture_materials'
  AND name LIKE 'Glazing Bead for Sashes%'
  AND sort_order = 310
  AND condition NOT LIKE '%to_be_replaced%';
