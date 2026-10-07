-- step-s4-sash-material-rules-rollback.sql
-- DO NOT RUN unless rolling back step-s4-sash-material-rules.sql.
--
-- Removes the "and to_be_replaced" suffix from the three sash material
-- rules, restoring them to the original Integrate conditions.

-- Rule sort 10: Laminated Softwood (bottom)
UPDATE price_rules
SET condition = REPLACE(condition, ' and to_be_replaced', '')
WHERE price_file_id = (SELECT id FROM price_files WHERE is_current = true LIMIT 1)
  AND rule_family = 'price'
  AND group_name = 'manufacture_materials'
  AND name LIKE 'Laminated Softwood%'
  AND sort_order = 10
  AND condition LIKE '%and to_be_replaced%';

-- Rule sort 15: Laminated Softwood (top)
UPDATE price_rules
SET condition = REPLACE(condition, ' and to_be_replaced', '')
WHERE price_file_id = (SELECT id FROM price_files WHERE is_current = true LIMIT 1)
  AND rule_family = 'price'
  AND group_name = 'manufacture_materials'
  AND name LIKE 'Laminated Softwood%'
  AND sort_order = 15
  AND condition LIKE '%and to_be_replaced%';

-- Rule sort 310: Glazing Bead for Sashes
UPDATE price_rules
SET condition = REPLACE(condition, ' and to_be_replaced', '')
WHERE price_file_id = (SELECT id FROM price_files WHERE is_current = true LIMIT 1)
  AND rule_family = 'price'
  AND group_name = 'manufacture_materials'
  AND name LIKE 'Glazing Bead for Sashes%'
  AND sort_order = 310
  AND condition LIKE '%and to_be_replaced%';
