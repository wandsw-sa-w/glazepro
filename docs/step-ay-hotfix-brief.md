# Step AY hotfix — the drawing board is down ("profile is not defined")

URGENT. Since d695667 (Step AY item 4) every drawing board page on the live site shows "Drawing Board error —
profile is not defined" (reviewer, 13 Oct 14:30, drawing 24).

Cause: two components use `profile?.code` but `profile` is not in their scope.
- `ValidationPanel({ tree, derived, onSelectKey })` (src/pages/DrawingBoard.jsx ~line 1098, used at ~3053) — throws on
  every render. This is the outage.
- `IronmongeryPanel({ ... })` (~line 508, used at ~850) — the same ReferenceError, swallowed by the try/catch in
  computeBaseVars, so default ironmongery silently gets NO variables at all (every default rule's condition fails).
  A silent failure — fix it too.

Fix: pass the drawing's profile (or just its code) into both components as a prop from DrawingBoard, where
`const [profile, setProfile]` lives (~1703), and use the prop. Nothing else.

Then:
- add a render test that mounts ValidationPanel and IronmongeryPanel (or the whole board page with a stub tree) so a
  scope error like this fails the suite — say which test would have caught it;
- check every other place Step AY item 4 touched for the same mistake;
- commit, push, wait for the deploy, and run the live smoke tests (npm run test:e2e as in Step AT) — they open a drawing
  board, so they must pass. Report in docs/reports/step-ay-hotfix.md.

Also commit, attributed to the reviewer, his uncommitted rewrites of sql/step-ay1-delete-test2-rule.sql and
sql/step-ay2-french-panel-fields.sql (Nathan ran both on 13 Oct). Never run SQL.
