# Step BM — correction to item 4 (reviewer, 16 Oct 2026, 16:45)

A new Integrate reading shows item 4 of the brief was wrong.

## The reading
- Integrate's panel types (drawing board options): **110 Flat**, 112 Raised & fielded, 114 Vertical tongue & groove,
  116 Horizontal tongue & groove. Panel beads: 120 Ovolo, 126 Bolection, 320 Bespoke.
  So every door panel the reviewer read (type 110) is FLAT, not raised & fielded.
- Integrate's labour editor, L34242 Q2 item 8 (French doors with side casements; every leaf and side casement has a
  170 mid rail with glass over a type-110 panel): "Additional for Flat Panel" 4 x 60 AND **"Door Muntin" 4 x 60**.
  Item 7 of the same quote (two all-panel casement sashes, no mid rails): Flat Panel 2 x 60, no Door Muntin.
- PF30 "Door Muntin": 60 x `sash_muntin_to_be_replaced_qty`, condition `new_door_leaf_qty >= 1`.

So Integrate charges a flat panel 60 plus 60 per mid rail. GlazePro's "French Doors With Panels" template uses R&F
(120), which comes to the same 2 x 120 on L33022 item 12 by coincidence. Live drawing 103 ("Add mid rail and
panel") is flat 60 with no Door Muntin, which is the hour it is short.

## Instead of item 4
- **Do not** make the added panel raised & fielded. If you already changed it, revert it: flat, ovolo, both faces is
  right.
- Make the mid rail count. A transom that is a door leaf's mid rail (and, in a doorset, a casement sash's mid rail)
  goes into `sash_muntin_to_be_replaced_qty`, so "Door Muntin" fires once per mid rail when the item has a new door
  leaf. Expect:
  - Drawing 103: +60.
  - L34242 item 8's layout: 4 x 60.
  - L34268 item 2: a door leaf with a 170 transom and a 120 muntin below it, two flat panels; Integrate production is
    3 h over the GlazePro board drawing, which has one panel and no muntin. Report what your count gives for a leaf
    mullion when the board can draw one (a later step).
- Report the template: "French Doors With Panels" (and any other template) using R&F where Integrate's doors are flat.
  Don't change template data in this step; the reviewer will decide with Nathan.
- Every existing benchmark unchanged. If one moves, stop and report it. FD4 (French doors with panels) is the one to
  watch.
