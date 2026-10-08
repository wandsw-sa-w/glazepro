# Step AG findings — fixtures A and B from Integrate's saved drawings

Against `docs/step-ag-fixtures-a-b-brief.md`; facts from
`docs/integrate-L31115-A-B-trees.txt`. All figures from the committed snapshot; nothing read
from the live site.

## Item 2 — full line diff after the rewrite

**A and all four thickness variants: not one line moved.** Frame depth 165→140, hollow box
jambs, bottom 70, stop sizes (incl. A's cill stop 20), removing the 101 outer jambs / 50 cill
horns / 200 cill depth / invented profiledHeight 45, partingBeadTypeId, the bar
offsets/22 mm/nib 4, and removing frameMaterialId — none of it feeds a fired line on a sash
replacement. A stays 728.26 / 1,408.66 exact; L34046, C and D are also byte-identical.

**B moved — reported, not compensated (the brief's stop condition):**

| | cost / price |
|---|---|
| B before (target) | 208.33 / 522.65 |
| B after | **257.85 / 621.69** (+49.52 / +99.04) |

The input that moved it: **Integrate's own stored glass** (GL100010 / GL100080 on both
not-to-be-replaced sashes — facts file, B block). With glass units present, these lines fire:

| New line | GlazePro | Integrate |
|---|---|---|
| Square Glass Cost ×2 | 0.4000 → 23.40 / 46.80 each | *(no glass line at all)* |
| All Glass Energy Surcharge ×2 | 8.00 → 1.36 / 2.72 each | *(none)* |
| Glazing Bar ×2 | 0.00 (zero lines, hidden by the Step AE toggle) | *(none)* |

Why: `Square Glass Cost` (`is_double_glazed and inner_pane_thickness > 1 and not
is_sash_arched`) and `All Glass Energy Surcharge` (`is_double_glazed and
inner_pane_thickness >= 1`) have **no `to_be_replaced` gate** — they price any stored glass,
including glass that is not being supplied. Integrate stores exactly this glass on its DSO
drawing and prices none of it, so its glass pricing is evidently gated on the sash (or unit)
being replaced. This is the same family of gap as benchmark B's original S4 correction (the
three sash material rules gained `to_be_replaced` gates); gating the glass rules is an
engine/rule change, so per the brief it is **reported and stopped** — the honest B (corrected)
test now fails truthfully by +49.52 / +99.04. No other B line moved (stiles 49, horns, chamfer,
frame/cill changes all inert, as expected).

No values were changed beyond what the facts file covers; nothing was tuned.

## Item 3 — engine-read values still uncited after this step

- `staffBeadTypeId: 'small'` (A and B) — the saved-drawing read omits zero/blank values and
  lists no staff bead; the value is corroborated by Integrate's own priced "Small staff bead"
  component lines (stage-4) but is not itself a stored-field citation.
- A's spacer (16 mm White Warm Edge, argon) and both items' ironmongery (PB; claw kit on A,
  Brighton kit on B) — stage-4 QUOTE SPEC, not the GetDrawing read. A's paint finishes are now
  cited (facts line 8: Teknos Clean White int/ext/cill).
- B's `glazingId: 'double_glazing'` — inferred from the two stored pane codes; the read does
  not name the glazing type.
- L34046: `floorLevel: 'ground_floor'`, finishes, spacer, ABs ironmongery — original L34046
  quote spec (its GetDrawing read holds no such fields). Unchanged from Step AF's audit.
- C/D: `mouldingTypeId: 'ovolo'` — board template value; the Integrate read has no stated
  equivalent.

Fields Integrate stores that GlazePro has no field for (left out of the fixtures, listed in
their comments): range, A's draughtseal-true-alongside-newSashes (typeOfWork is
single-valued), installByUs / deliveryByUs, installationLevel, cill width, per-unit glass
rebate/tolerance (GlazePro reads the profile), surround auto-calc flags, B's
"Affected areas will be primed only" finish (no primed-only `paint_finish` code — left unset;
no fired B line reads the finishes).

## Item 4

No engine change; `PRICING_ENGINE_VERSION` stays 9.

## Not verified

- Anything live; all figures from the committed snapshot.
- How Integrate gates its glass pricing (replaced-sash gate is inferred from B's stored glass
  pricing nothing — the exact rule/condition is not visible from here).
- Whether Integrate's blank staff bead field defaults to "small" internally.
