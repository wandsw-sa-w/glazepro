# Step BM follow-up — the mid rail DOES count (reviewer, 16 Oct 2026, 17:45)

Settles report item 4b. Commit this, the reviewer's corrected docs/integrate-live-quotes.txt (110 = FLAT) and
docs/step-bm-correction.md (if not already) as item 0.

## The reading that settles it (both asked for in the report, both done 16 Oct)
1. **LQ3 in Integrate's labour editor** (L33022 Q5 item 12, read 17:00):
   - Door Leaf 2 x 1035, Additional for Glazing Bars (door) 2 x 30, **Door Muntin 2 x 60**,
     **Additional for Flat Panel 2 x 60**.
   - Door Frame 855, Glazing 2 x 20, Glazing with Bar 2x12 + 2x12, Door Frame Single Finish 180, Door Leaf Single
     Finish 2 x 90.
   - Total 3,673 min = **61.22 h**, Integrate's price line.

   So there is no contradiction. The LQ3 fixture has the wrong panels: it says raised & fielded because the
   reviewer's facts file wrongly called type 110 raised & fielded (corrected now; 110 is FLAT). R&F 2 x 120 with
   uncounted mid rails equals flat 2 x 60 plus Door Muntin 2 x 60. That coincidence is why LQ3 "passed".
2. **L34242 Q2 item 8's leaves** carry no MullionPart. Each has only a TransomPart 170 isMidrail; the side
   casements have a TransomPart 170 (not flagged isMidrail) between glass and panel. So its Door Muntin 4 x 60 is
   four mid rails, not real muntins.
3. Also read 16 Oct, consistent: L34268 item 2 (leaf transom + leaf mullion) → Door Muntin 2 x 60.
   L34355 Q4 item 7 (two side-casement mid rails + leaf transom + leaf mullion) → 4 x 60.
   L33022 Q5 item 7 (two leaf mid rails + two side-casement mid rails) → 4 x 60.

## The work
1. **Count mid rails** in `sash_muntin_to_be_replaced_qty`: each mid rail in a door leaf, and each mid rail (a
   transom dividing glass from panel) in a casement sash of an item with a new door leaf. Real leaf muntins stay
   counted, as now. This is the change you measured and reverted.
2. **Delete** the declared differences that this makes exact: FD4, FT1, FT2, FT3, FT4 (decision d's mid-rail part).
   Keep any other part of those declared differences (muntin timber and so on) as it is.
3. **LQ3's fixture:** panels flat (110) with ovolo, both faces. It must still price 61.22 h, now as flat + muntin.
4. **Template "French Doors With Panels"**: write sql/step-bm1 to set its four panel faces to flat. The reviewer
   reviews and runs it. FD4's own drawing reads flat (re-read 14 Oct).
5. Every other benchmark unchanged. Deploy, run e2e.

## Report
docs/reports/step-bm-followup.md: before / after on FD4, FT1-FT4, LQ3; the SQL.
The reviewer will then:
- Run step-bm1.
- Re-price drawing 103 (expect +60 min production).
- Set drawing 105's panels to flat (expect production unchanged at 1,509.69: −120 flat, +120 muntin).

Then go straight on to docs/step-bn-brief.md as its own step, with its own item 0 and report. The reviewer has
already edited integrate-targets.json for BN, so commit that in BN's item 0, not this one. LQ tests that fail only
on surround / shutters labour belong to BN.
