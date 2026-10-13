# Step AY hotfix — the drawing board is back

Done 13 Oct 2026. Brief: `docs/step-ay-hotfix-brief.md`.
**Fixed, deployed and verified on the live site.** All five live smoke tests
pass, including the one that covers the outage.

---

## What broke, and that it was mine

`d695667` (Step AY item 4) added `profile?.code` to two `computeVariables`
calls. Both calls live **inside** components, and `profile` is
`DrawingBoard`'s own state — not in their scope.

| | effect |
|---|---|
| **`ValidationPanel`** (~1102) | a `ReferenceError` on **every render**, so every drawing board page on the live site showed "Drawing Board error — profile is not defined". **This was the outage.** |
| **`IronmongeryPanel`** (~508) | the same `ReferenceError`, thrown straight into the `try/catch` in `computeBaseVars`, which returned `{}`. Default ironmongery was computed against **no variables at all**, so every default rule's condition failed — **silently**. |

The second is the worse of the two. The outage announced itself; that one would
have gone on quietly producing short ironmongery lists on new casement
drawings, which is exactly the kind of silent overcharge-or-undercharge this
project keeps trying to design out.

## The fix

Both components now take the code as a **prop**, threaded from
`DrawingBoard`:

```
DrawingBoard (profile?.code)
  ├─ ValidationPanel      profileCode
  └─ PropertyEditor       profileCode
       └─ IronmongeryPanel   profileCode
```

`PropertyEditor` is in the chain because `IronmongeryPanel` is rendered from
inside it. Both default to `null`, so each renders on its own.

**Every other place Step AY item 4 touched was checked** for the same mistake:

| | |
|---|---|
| `Summary` (uses `profile` at ~1067) | already takes it as a prop — fine, and pre-dates this step |
| `QuoteMatrixPage` | `drawingId` in scope |
| `QuoteOverview` | `treeKeys` defined above the use |
| `ValidationRules` | `dwgId` in scope |
| `buildSnapshot` | `profileCodeByDrawing` is a destructured parameter of the function that reads it, and is in the other function's return |
| `publishQuote` | `item.profile_code` |

No others.

## What would have caught it — two things already existed, and I ran neither

This is the part worth keeping.

**1. `npm run lint`.** ESLint's `no-undef` reports, with no configuration
change at all:

```
src/pages/DrawingBoard.jsx:527:69   'profile' is not defined  no-undef
src/pages/DrawingBoard.jsx:1153:65  'profile' is not defined  no-undef
```

Exactly the two lines, including the silent one. **I did not run it.**

It cannot gate as it stands: `src/` has about 100 pre-existing errors of other
kinds (69 `no-unused-vars`, 31 `react-hooks/*` and so on), so `npm run lint`
exits non-zero on a clean tree and tells you nothing.

**2. The live smoke tests.** `e2e/smoke.spec.js` already has a test called
**"the validation panel loads without an error"**, on drawing board **24** —
the very drawing the reviewer reported. It would have failed the moment Step AY
went out. **I did not run them after Step AY** (the brief for that step did not
ask, and I did not offer).

## The test added

`src/pages/drawingBoardScope.test.jsx` — 6 tests, two nets for the two shapes
of failure:

1. **ESLint over `src/`, failing on the REFERENCE rules only** — `no-undef`,
   `no-const-assign`, `no-obj-calls`, `no-class-assign` — and naming each
   file, line and column. It ignores the other ~100 errors, so it is a net for
   this one class of bug rather than a tidy-up that can never go green. This
   catches **both** of the day's bugs, the silent one included.
2. **Render tests** for the two panels, mounted in isolation with
   `renderToStaticMarkup`: `ValidationPanel` with a tree, with and without a
   `profileCode`, and with no tree at all; `IronmongeryPanel` with a tree. A
   scope error in a render body fails these immediately, with no DOM and no
   lint config in the way.

**Verified both ways.** With the two bugs put back exactly as they were:

```
AssertionError: src/pages/DrawingBoard.jsx:527:69 'profile' is not defined. (no-undef)
                src/pages/DrawingBoard.jsx:1153:65 'profile' is not defined. (no-undef)
× ValidationPanel renders — the outage was a ReferenceError here
```

and with the fix, all six pass. The lint test also caught `process` in its own
body on its first run (`src/` is linted as browser code), which is the net
working on the person who wrote it.

`ValidationPanel` and `IronmongeryPanel` are now exported so they can be
mounted. That is the only other change to the file.

## The reviewer's SQL rewrites, committed as written

Both committed unchanged and attributed (`c145939`). The reviewer read the
**live** rows with `/dev/sql`; **Nathan ran both on 13 Oct.** Each rewrite
fixes something I had invented rather than verified.

### `sql/step-ay1-delete-test2-rule.sql` — my version would not have run

- I guarded on references in **`pricing_run_lines`**. **That table does not
  exist.** Runs live in `pricing_runs`, and no row there mentions the id
  (counted 0). My script would have errored on its first guard.
- My other guard was "its price file is not PF30". TEST2's `price_file_id`
  points at a price file that has been **deleted**, so the `LEFT JOIN` yields a
  NULL name and my `_pf IS NULL` branch would have raised and stopped.

The reviewer's version deletes the one known id
(`097070f8-61d9-41ef-9f11-c596d9843e72`, created 17 Apr 2026, with nonsense in
its fields — `tris_box_sashue`, `0is_frame_redwood`, group `123`) and carries
the **whole live row in the rollback**. That is better than my "keep section
0b's output" instruction: the row is now recorded in the repository instead of
depending on somebody having saved a query result.

### `sql/step-ay2-french-panel-fields.sql` — my allow-list hid the leaf panel

- The two **leaf** part types have only **8** definitions each, all profile
  settings. There is **no** `operation`, To Be Replaced, meeting stile, bottom
  rail or master leaf definition at all — so my "hide everything not in the
  allow-list" would have left a leaf panel **almost empty**. The reviewer's
  version inserts the missing ones, with shapes copied from the live
  `casementSashPart` definitions.
- `frenchCasementPart` has 9 definitions, all `role 'input'`, including the gap
  and the two that showed blank.

My Step AY report said section 0 would reveal "a field spelled differently".
The real risk was not spelling — it was **fields that do not exist**, which an
allow-list hides silently instead of surfacing. A deny-list would have been the
safer shape, and the reviewer's rewrite uses one.

## SQL files this step wrote

**None.** The only SQL is the reviewer's two rewrites, committed as written.
Nathan has run both.

## What the tests show

**Offline: 1,504 passing, 8 failing** — the standing eight only (A50 +0.28, D
+0.54, six Step W counterweight-display rows). Up from 1,498 (the six new
ones).

**Live smoke tests: 5 passed, 1.2 min**, against `https://glazepro.vercel.app`
after the deploy. The command is **`npm run e2e`** — there is no `test:e2e`
script in `package.json`.

```
ok 1  logs in                                                        (5.0s)
ok 2  every benchmark passes except the parked residuals             (58.2s)
ok 3  the fanlight drawing shows Fanlight A1 and Casement Sash A2     (3.3s)
ok 4  the validation panel loads without an error                    (2.7s)
ok 5  every drawing card on the L507712 quote matrix shows a price    (4.2s)
```

**Test 4 is the one that matters**: it opens drawing board 24 and asserts the
validation panel renders without an error. That panel threw on every render
before this fix, so its passing is direct evidence the fix is live — not an
inference from a build marker.

Nothing was written to the live database: the smoke tests are read-only, and
no SQL was run.

## Not verified

- **How long the board was down.** The reviewer saw it at 14:30; `d695667` was
  pushed earlier in the afternoon. I have not checked logs for the first
  failure, so the window is unknown.
- **The silent ironmongery failure's reach.** Any casement drawing opened
  between `d695667` going live and this fix had its default ironmongery
  computed against no variables, which means an **empty or short default
  list**. A drawing whose list was auto-applied and then SAVED in that window
  has the short list stored on it. I cannot read live rows, so I cannot say
  whether any drawing was saved in that window — **worth the reviewer
  checking** any casement drawing touched this afternoon before quoting from
  it.
- **The two SQL files' effect**, which Nathan has run and I cannot read.
- **`npm run lint` as a gate.** The new test gates the reference rules only.
  The other ~100 errors are untouched and still make `npm run lint` useless as
  a pass/fail signal; making it clean is a job of its own and was not in this
  brief.
- **Whether other components read state they do not own.** The new lint test
  covers undefined identifiers, which is this bug exactly. It does not catch a
  component reading a prop that is never passed — that would be `undefined`,
  not a `ReferenceError`, and would fail quietly the way the ironmongery panel
  did.
