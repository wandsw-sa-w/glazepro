# Step AU fixes — read the stormproof sections from the keys Integrate's import already created

Written by the reviewer after reading the Step AU report and the live database (/dev/sql, 13 Oct). All handover rules
apply. Never run SQL. Report to docs/reports/step-au-fixes.md in the handover format.

## What the live database holds (fact, read 13 Oct)
- sash_type 'stormproof' (label "Stormproof", sort 50, applies_to {} = any part) already exists — section 1 of
  sql/step-au1 is a no-op, which is fine.
- The casement profile (default_profiles id 2, code 'casement') ALREADY holds Integrate's stormproof sections, all on the
  casementSashPart prefix — none of the spellings your SQL used:

  | key                                                   | value          |
  |-------------------------------------------------------|----------------|
  | casementSashPart.defaultStormProofFrameJamb           | 41             |
  | casementSashPart.defaultStormProofFrameHead           | 41             |
  | casementSashPart.defaultStormProofFrameDepth          | 69             |
  | casementSashPart.defaultStormProofFrameJambType       | Solid Profiled |
  | casementSashPart.defaultStormProofCillHeight          | 56             |
  | casementSashPart.defaultStormProofCillDepth           | 69             |
  | casementSashPart.defaultStormProofFrameHeadStopSize   | 15             |
  | casementSashPart.defaultStormProofFrameStileStopSize  | 15             |
  | casementSashPart.defaultStormProofCillStopSize        | 15             |
  | casementSashPart.stormProofOverlap                    | 7              |
  | casementSashPart.stormProofLipThickness               | 15             |
  (plus left/rightFrenchCasementSashPart.stormProofOverlap 7 and .stormProofLipThickness 15)

  There is NO stormproof sash bottom rail key. Run as written, sql/step-au1 section 2 would have created eleven duplicate
  keys under new spellings. The reviewer has rewritten section 2 (and the 4b check and the rollback) to add ONLY
  casementSashPart.defaultStormProofBottomHeight = 76 — already one of your sashBottom candidates. Commit that SQL
  edit as is, attributed to the reviewer.

## 1. STORMPROOF_CANDIDATES (casementOpenings.js)
Put the live keys FIRST: both jambs <- defaultStormProofFrameJamb; head <- defaultStormProofFrameHead; depth <-
defaultStormProofFrameDepth; head / stile / cill stops <- defaultStormProofFrameHeadStopSize / FrameStileStopSize /
CillStopSize; cill height / depth <- defaultStormProofCillHeight / CillDepth (all casementSashPart.*). The frame's
bottomHeight: Integrate stores 56 = the cill height on every stormproof drawing — take it the way the flush build takes
its frame bottomHeight (report which). Jamb type: read defaultStormProofFrameJambType and resolve the label
'Solid Profiled' to the jamb_type code the same way applyOperationDefaults.resolveJambTypeCode does, instead of the
hard-coded 'solid_profiled' (keep that only as the fallback). Keep your old spellings after the live ones or drop them —
say which. Tests: the stormproof profile fixture uses the LIVE spellings, and a test fails if the board resolves any
section from anything but them.

## 2. is_replacement_sashes_range
GlazePro does store Integrate's product range: it is the drawing's profile. default_profiles holds 'sash', 'casement',
'sashes_only', 'open_out_doors', 'open_in_doors' — Integrate's ranges. "Product range is set to Sashes Only" = the
drawing's profile code is 'sashes_only'. If computeVariables can see the drawing's profile, compute it from that; if it
cannot, say what would need to pass it in and leave it false. Do not use typeOfWork.

## 3. Checks
Every benchmark unchanged (SA..SF included). Report the six SA..SF prices again. List the SQL files this step wrote — the
reviewer's edit to sql/step-au1-stormproof.sql is the only SQL; Nathan runs it after your push.
