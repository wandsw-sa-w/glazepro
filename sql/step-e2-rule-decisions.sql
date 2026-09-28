-- ============================================================
-- Step E2 — Flagged-rule decisions (Integrate PF30 only)
--
-- DO NOT RUN DIRECTLY — paste into Supabase SQL editor.
--
-- Applies Nathan's review decisions to the 15 needs_review=true
-- rules in the "Integrate PF30 (Draft Import)" price file.
--
-- Actions:
--   UPDATE  Draught Seal Only Painting Profits (rename + comment)
--   UPDATE  Stain £100 per item (rename + comment)
--   UPDATE  InstallSure Up to £30,000 (comment only)
--   UPDATE  Curved Head (Joinery) — 1680 min  (needs_review → false)
--   UPDATE  Curved Head (Joinery) — 3360 min  (needs_review → false)
--   UPDATE  5 × Utile hardwood rules (replace 'Sapele' → 'Utile' in comment)
--   DELETE  Machining & Joining a Bifolding Frame Additional
--   DELETE  Yorkshire Sash Frame
--   LEAVE   Utile Section Part (still needs manual rewrite)
--   NOTICE  Remaining needs_review=true rules
--
-- Re-runnable: all UPDATEs are idempotent.
-- ============================================================

BEGIN;

DO $$
DECLARE
  _pf_id uuid;
  _updated integer;
  _deleted integer;
  r record;
BEGIN

  -- ── Resolve price file ──────────────────────────────────────
  SELECT id INTO _pf_id
  FROM price_files
  WHERE name = 'Integrate PF30 (Draft Import)'
  LIMIT 1;

  IF _pf_id IS NULL THEN
    RAISE EXCEPTION 'Price file "Integrate PF30 (Draft Import)" not found.';
  END IF;

  RAISE NOTICE 'Using price_file_id = %', _pf_id;

  -- ── 1. Rename "Sashes Only Painting Profits" ────────────────
  -- This is a deliberate deterrent: markup=35000 makes draught-seal-only
  -- jobs commercially non-viable. The name "Sashes Only" was misleading —
  -- renaming to match the actual condition (needs_draughtsealing).
  UPDATE price_rules SET
    name         = 'Draught Seal Only Painting Profits',
    comment      = 'Deliberate deterrent markup (35000×) — makes draught-seal-only decoration quotes commercially non-viable. Retained intentionally.',
    needs_review = false
  WHERE price_file_id = _pf_id
    AND name          = 'Sashes Only Painting Profits';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Renamed "Sashes Only Painting Profits": % row(s) updated', _updated;

  -- ── 2. Fix "Stain £75 per frame" ────────────────────────────
  -- Value in rule is 100 (£100 per item), not £75. Label was wrong.
  UPDATE price_rules SET
    name         = 'Stain £100 per item',
    comment      = '£100 per item for stain finish. The old label "£75 per frame" was incorrect — value has always been 100.',
    needs_review = false
  WHERE price_file_id = _pf_id
    AND name          = 'Stain £75 per frame';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Fixed "Stain £75 per frame": % row(s) updated', _updated;

  -- ── 3. Fix "InstallSure Up to £30,000" ──────────────────────
  -- Value=43 is correct; the label in Integrate said £41.28 (previous tier).
  UPDATE price_rules SET
    comment      = '£43 premium for InstallSure on quotes between £25k–£30k (inc. VAT). The £41.28 label in the original was the previous tier — value=43 is correct.',
    needs_review = false
  WHERE price_file_id = _pf_id
    AND name          = 'InstallSure Up to £30,000';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Fixed "InstallSure Up to £30,000": % row(s) updated', _updated;

  -- ── 4. Curved Head 1680 min — keep, clear review flag ───────
  UPDATE price_rules SET
    comment      = 'Curved head sash: 1680 minutes (28 hours). Retained alongside the 3360 min variant.',
    needs_review = false
  WHERE price_file_id = _pf_id
    AND name          = 'Curved Head (Joinery) — 1680 min';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Cleared review on "Curved Head 1680 min": % row(s) updated', _updated;

  -- ── 5. Curved Head 3360 min — keep, clear review flag ───────
  UPDATE price_rules SET
    comment      = 'Curved head box frame sash: 3360 minutes (56 hours / ~7 days). Retained alongside the 1680 min variant.',
    needs_review = false
  WHERE price_file_id = _pf_id
    AND name          = 'Curved Head (Joinery) — 3360 min';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Cleared review on "Curved Head 3360 min": % row(s) updated', _updated;

  -- ── 6. Utile hardwood rules — replace Sapele → Utile in comment ──
  -- Door Stiles & Top Rail (sort=100)
  UPDATE price_rules SET
    comment      = '63.5mm Utile section. £18.70 per meter. Door stiles and top rail — linear metre with 10% waste.',
    needs_review = false
  WHERE price_file_id = _pf_id
    AND name          = 'Door Stiles & Top Rail';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Updated "Door Stiles & Top Rail": % row(s) updated', _updated;

  -- Door Bottom Rail (sort=105)
  UPDATE price_rules SET
    comment      = '63.5mm Utile section. £17.24 per meter. Door bottom rail — linear metre with 10% waste.',
    needs_review = false
  WHERE price_file_id = _pf_id
    AND name          = 'Door Bottom Rail';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Updated "Door Bottom Rail": % row(s) updated', _updated;

  -- Casement Frame Jambs & Cills (sort=110)
  UPDATE price_rules SET
    comment      = '63.5mm Utile section. Two jambs out of one board. £17.24 per meter. Jambs and cills — linear metre with 10% waste.',
    needs_review = false
  WHERE price_file_id = _pf_id
    AND name          = 'Casement Frame Jambs & Cills';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Updated "Casement Frame Jambs & Cills": % row(s) updated', _updated;

  -- Casement Frame Head (sort=115)
  UPDATE price_rules SET
    comment      = '76.2mm Utile section. £12.40 per meter. Casement frame head — linear metre with 10% waste.',
    needs_review = false
  WHERE price_file_id = _pf_id
    AND name          = 'Casement Frame Head';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Updated "Casement Frame Head": % row(s) updated', _updated;

  -- Casement Transoms & Mullions (sort=121)
  UPDATE price_rules SET
    comment      = '76mm Utile section. £12.40 per meter. Casement transoms and mullions — linear metre with 10% waste.',
    needs_review = false
  WHERE price_file_id = _pf_id
    AND name          = 'Casement Transoms & Mullions';
  GET DIAGNOSTICS _updated = ROW_COUNT;
  RAISE NOTICE 'Updated "Casement Transoms & Mullions": % row(s) updated', _updated;

  -- ── 7. Delete bi-fold rule ────────────────────────────────────
  DELETE FROM price_rules
  WHERE price_file_id = _pf_id
    AND name          = 'Machining & Joining a Bifolding Frame Additional';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted bi-fold rule: % row(s) deleted', _deleted;

  -- ── 8. Delete Yorkshire sash rule ────────────────────────────
  DELETE FROM price_rules
  WHERE price_file_id = _pf_id
    AND name          = 'Yorkshire Sash Frame';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RAISE NOTICE 'Deleted Yorkshire sash rule: % row(s) deleted', _deleted;

  -- ── 9. Report remaining needs_review=true rules ──────────────
  RAISE NOTICE '';
  RAISE NOTICE 'Rules still flagged needs_review=true:';
  FOR r IN
    SELECT sort_order, rule_family, name, comment
    FROM price_rules
    WHERE price_file_id = _pf_id
      AND needs_review  = true
    ORDER BY sort_order
  LOOP
    RAISE NOTICE '  sort=% [%] % — %', r.sort_order, r.rule_family, r.name, r.comment;
  END LOOP;

END $$;

COMMIT;
