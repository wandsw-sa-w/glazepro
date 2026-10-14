/**
 * frontDoorIronmongery.js — Nathan's two front-door ironmongery decisions of
 * 14 Oct 2026, as DATA, so that the SQL that applies them live and the tests
 * that check them read one definition.
 *
 * Step BD follow-up items 3a and 3b. Both are changes to LIVE DATA — a
 * default-ironmongery rule and two kit variants — made by
 * `sql/step-bd4-front-door-ironmongery.sql`. Nothing here changes the live
 * site; it describes the change, prints it for the SQL, and lets a test price
 * a snapshot as if it had been run.
 *
 * Both patches are IDEMPOTENT: applied to data that has already been
 * corrected they do nothing, so a refreshed snapshot keeps the tests passing.
 */

/**
 * 3a. A NEW front door's euro cylinder pull.
 *
 * The imported rule gives Hardwick's back-to-back pull set (HK4000PB, 25.20).
 * Nathan wants Integrate's CROFT pull (CRO1774PB, 29.40) — the one Integrate's
 * own front-door template stores — on every new GlazePro front door. The rest
 * of the live set is what he asked for already: 102mm hinges x 2, the AV4
 * Heritage locking system, the Hardwick sleeved letterbox, and no letter tidy.
 */
export const FRONT_DOOR_DEFAULT_PULL = {
  rule_id: 'cb8eb0b9-056f-40a0-80b9-3b9f0b14f214',  // "Front Door Euro Cylinder Pull"
  from: 'hardwick_classic_euro_pull_set_back_to_back',
  to:   'euro_cylinder_pull',
  finish_code: 'PB',
}

/** What a new front door gets, after 3a — for the report and the SQL checks. */
export const FRONT_DOOR_DEFAULT_SET = [
  { short_name: '102mm_hinges', finish: 'PB', qty: 2 },
  { short_name: 'hardwick_classic_sleeved_letterbox', finish: 'PB', qty: 1 },
  { short_name: 'euro_cylinder_pull', finish: 'PB', qty: 1 },
  { short_name: 'av3_heritage_locking_system_lh', finish: 'PC', qty: 1 },
]

/**
 * The three costs `sql/step-bd1` wrote, RUN LIVE on 14 Oct 2026.
 *
 * The captured `pf30-snapshot.json` pre-dates the run and still holds them
 * at 0, so an offline benchmark priced every front door £149.10 light. This
 * is the same situation as the Kenrick gearbox parts in Step BB — the live
 * data has moved on and the capture has not — and it is handled the same
 * way: the figures are named here, the tests price the snapshot WITH them,
 * and when the reviewer refreshes the snapshot the patch becomes a no-op.
 *
 * Both hands carry the same cost, which is why the hand fix (3b) moves no
 * money.
 */
export const AV4_BD1_COSTS = {
  RHZ2482: 107,   // Winkhaus AV4 Heritage Lock RH   -> prices 112.35
  RHZ2481: 107,   // ...LH, the same lock
  RHZ3092: 30,    // AV4 RH Centre Keep w Dayswitch  -> prices  31.50
  RHZ3091: 30,    // ...LH
  RHZ2427: 5,     // AV4 Pocket Keep                 -> prices   5.25
}

/**
 * A pricing context with the bd1 costs filled in where the capture has 0.
 * A cost the snapshot HAS is never overwritten — the live catalogue wins,
 * as `livePartCosts.js` insists.
 */
export function withAv4Costs(snapshot) {
  const catalogue = Object.fromEntries(
    Object.entries(snapshot.ironmongeryCatalogue ?? {}).map(([k, v]) => [k, {
      ...v,
      parts: (v.parts ?? []).map(p => (
        (p.unit_cost > 0) || !(p.part_code in AV4_BD1_COSTS)
          ? p
          : { ...p, unit_cost: AV4_BD1_COSTS[p.part_code] })),
    }]))
  return { ...snapshot, ironmongeryCatalogue: catalogue }
}

/**
 * 3b. The AV4 HAND.
 *
 * Integrate prices RIGHT-hand AV4 parts on a LEFT-hand door, and the imported
 * variants copied it: `av3_heritage_locking_system_lh` held the RH lock
 * (RHZ2482) and the RH centre keep w dayswitch (RHZ3092). Nathan's standing
 * rule is that GlazePro corrects Integrate's errors, so the LH variant takes
 * the LH parts and the RH variant the RH ones.
 *
 * The pocket keep (RHZ2427) is handed neither way and stays in both. The
 * costs are the same for both hands, so NO PRICE MOVES — which is a test, not
 * an assumption (frontDoorIronmongery.test.js).
 */
export const AV4_HAND_FIX = {
  lh: { RHZ2482: 'RHZ2481', RHZ3092: 'RHZ3091' },
  rh: { RHZ2481: 'RHZ2482', RHZ3091: 'RHZ3092' },
}

/** The variant keys the hand fix touches, by hand. */
export const AV4_VARIANTS = {
  lh: 'av3_heritage_locking_system_lh:PC',
  rh: 'av3_heritage_locking_system_rh:PC',
}

/** The part names, so a swapped row can be checked by eye. */
export const AV4_PART_NAMES = {
  RHZ2481: 'Winkhaus AV4 Heritage Lock LH',
  RHZ2482: 'Winkhaus AV4 Heritage Lock RH',
  RHZ3091: 'Winkhaus AV4 LH Centre Keep w Dayswitch',
  RHZ3092: 'Winkhaus AV4 RH Centre Keep w Dayswitch',
  RHZ2427: 'Winkhaus AV4 Pocket Keep',
  LJZ5074040CP: 'Thumbturn Euro Cylinder 40/40 Polished Chrome',
}

/**
 * A pricing context with both decisions applied — what the live data looks
 * like once `sql/step-bd4` has run.
 *
 * @param {Object} snapshot  a pf30-snapshot-shaped context
 * @returns {Object} a copy; the input is not touched
 */
export function withFrontDoorIronmongery(snapshot) {
  const rules = (snapshot.ironmongeryRules ?? snapshot.partAllocationRules ?? [])
  const swapPull = r => (
    r.id === FRONT_DOOR_DEFAULT_PULL.rule_id &&
    r.product_short_name === FRONT_DOOR_DEFAULT_PULL.from
      ? { ...r, product_short_name: FRONT_DOOR_DEFAULT_PULL.to }
      : r)

  const catalogue = { ...(snapshot.ironmongeryCatalogue ?? {}) }
  for (const [hand, key] of Object.entries(AV4_VARIANTS)) {
    const variant = catalogue[key]
    if (!variant) continue
    const map = AV4_HAND_FIX[hand]
    catalogue[key] = {
      ...variant,
      parts: (variant.parts ?? []).map(p => (map[p.part_code]
        ? { ...p, part_code: map[p.part_code], part_name: AV4_PART_NAMES[map[p.part_code]] ?? p.part_name }
        : p)),
    }
  }

  return {
    ...snapshot,
    ironmongeryRules: rules.map(swapPull),
    partAllocationRules: (snapshot.partAllocationRules ?? []).map(swapPull),
    ironmongeryCatalogue: catalogue,
  }
}
