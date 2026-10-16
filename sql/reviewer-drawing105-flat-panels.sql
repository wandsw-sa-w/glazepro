-- Reviewer fix, 16 Oct: test drawing 105 (lead 13, PRICING TEST copy of Integrate L33022 item 12) — FLAT panels.
-- Run by Nathan in the Supabase SQL editor. Test data only; touches the two panel parts of drawing 105.
--
-- Integrate L33022 i12 has panelType 110 = FLAT on both panels. Drawing 105 was built from the
-- "French Doors With Panels" template while it still read raised & fielded (see sql/step-bm1).
-- The board shows panel type as a NUMBER box, so it can't hold "flat"; the reviewer's attempt
-- to type it blanked panel 5379 to null. This sets both panels to flat / ovolo.

-- Before: expect 5376 raised_and_fielded and 5379 null.
SELECT id, values->>'internalPanelTypeId' AS i, values->>'externalPanelTypeId' AS e
FROM   public.drawing_parts
WHERE  drawing_id = 105 AND part_type = 'panelPart'
ORDER  BY id;

UPDATE public.drawing_parts
SET    values = values || '{"internalPanelTypeId":"flat","externalPanelTypeId":"flat","internalPanelBeadId":"ovolo","externalPanelBeadId":"ovolo"}'::jsonb
WHERE  drawing_id = 105 AND part_type = 'panelPart' AND id IN (5376, 5379);

-- After: expect both rows flat / flat.
SELECT id, values->>'internalPanelTypeId' AS i, values->>'externalPanelTypeId' AS e
FROM   public.drawing_parts
WHERE  drawing_id = 105 AND part_type = 'panelPart'
ORDER  BY id;
