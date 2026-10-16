# Step BK — bi-glass on French casements (reviewer, 16 Oct 2026)

Facts: the ADDENDUM at the end of docs/integrate-L31115-casement-biglass.txt (16 Oct). Targets: benchmarkBGF1 / BGF2 in
integrate-targets.json (reviewer insertions only). Commit those two files and this brief as item 0.

The BJ follow-up left French casements out of bi-glass because the pair holds its own clearances and there was no
Integrate reading. Both are now read.

## Nathan (16 Oct)
- Bi-glass is NOT offered on sash windows. Casements only, French casements included. Nothing for sliding sashes,
  ever: keep them exactly as they are.
- Everything decided for casements in Step BJ applies to French casements too: draught sealing always included, no
  default ironmongery (stored ironmongery priced as stored), and the fixed-sash fitting hour copied from Integrate.

## What Integrate does to a French pair (facts addendum)
Ticking Bi-Glass zeroes the clearances on the frame, the PAIR and both LEAVES. The pair = its opening. Each leaf =
(pair width − gapBetweenMeetingStiles 4) / 2 wide and the full opening high. The gap stays 4. FR1: leaves 560.5 x 1219
(complete new 556.5 x 1211). FR2: fanlight 825 x 304 = its opening, leaves 410.5 x 1074. Glass follows (stiles 62 / 63
meeting stile, rails 62 / 83).

## The work
1. **BGF1 and BGF2**: benchmarks from the facts. Expect every group exact, by the same rules as BG1–BG4. A French pair
   has no divider, so BGF1 has no production. BGF2's transom gives rule 211 60 min. Fitting is 240 per glass unit only.
2. **The switch**: let `applyBiGlassCasement` handle a French pair. Set the pair's own clearances to 0 as well as the
   leaves', and give every leaf toBeReplaced false, Single glass to be replaced, and the rest as Step BJ. Switching back
   to Complete New restores the pair's clearances (4) and the leaves' as they were before. Round trip, as in BJ.
3. **The board**: offer Bi-glass on a French casement and on FR2 (casement fanlight over a French pair). Doors stay out,
   and so do direct-glazed-only frames. The board-built tree switched to bi-glass must price what the fixtures price,
   to the penny (as BJ did for BG1 / BG3). Update the e2e only if it needs to change.
4. **Decoration (no change expected)**: Integrate does not show its Decoration box in Survey Mode, so it couldn't be
   read. The rules are the same in both systems. "Sashes Only Painting Profits" is quantity sliding_sash_qty, so it is
   0 on a casement. GlazePro live on drawing 70 already does the right thing (+150 min "Casement DSO Decoration", no
   profit line). Add one test that pins exactly that, and close the warning in docs/reports/step-bj.md.
5. Every existing benchmark unchanged; sliding sashes untouched. Deploy, e2e.

## Report
docs/reports/step-bk.md: BGF1 / BGF2 group by group; what changed in the switch; the round trip; what the reviewer
should make live (expect a French casement template switched to bi-glass with nothing stored to be BGF1 less its 59.85
ironmongery: 388.40 / 776.78).
