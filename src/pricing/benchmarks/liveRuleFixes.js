/**
 * liveRuleFixes.js — live price-rule changes the captured snapshot pre-dates.
 *
 * `pf30-snapshot.json` is a CAPTURE. When the reviewer runs a file that
 * changes a rule, the live site moves and the capture does not, and a
 * benchmark priced from the capture would report a difference that no longer
 * exists on the site it is supposed to describe.
 *
 * The honest fix is the one Step BB used for the Kenrick gearbox parts and
 * Step BD for the AV4 costs: name the change here, apply it to the snapshot
 * in the tests, and let it become a no-op when the snapshot is refreshed.
 * Nothing here touches the live data — it describes what the reviewer has
 * already run.
 */

/**
 * `sql/step-be1`, RUN LIVE 14 Oct 2026: a SHAPED unit is priced at the SQUARE
 * glass rate.
 *
 * Nathan's decision e puts the supplier's 25% on the AREA (the largest
 * rectangle of the cut glass, which the engine works out), so the RATE must
 * stop carrying it as well — Integrate's shaped rate is the square rate's
 * panes x 1.25, the same quarter in the other place. The file takes the
 * expression from the square rule itself, and so does this.
 *
 * Idempotent: on a snapshot where the shaped rule already reads the square
 * expression it changes nothing.
 */
export const SHAPED_GLASS_RULE = 'Shaped Glass Cost'
export const SQUARE_GLASS_RULE = 'Square Glass Cost'

export function withShapedGlassRate(snapshot) {
  const rules = snapshot.rules ?? []
  const square = rules.find(r => r.name === SQUARE_GLASS_RULE && r.is_active)
  if (!square) return snapshot
  if (String(square.value).includes('1.25')) return snapshot
  return {
    ...snapshot,
    rules: rules.map(r => (r.name === SHAPED_GLASS_RULE && r.value !== square.value
      ? { ...r, value: square.value }
      : r)),
  }
}

/**
 * `sql/step-bf3`, RE-ISSUED 14 Oct 2026: what a NEW stable door gets.
 *
 * The first issue of bf3 added FIVE rules, one of them a pair of hinges — and
 * live that made a new stable door £34.65 too dear, which the offline test did
 * not see because it replaced the rule set instead of adding to it. Two
 * things were double-counted, and both were already in the live data:
 *
 *  - **the hinges.** Rule c11aeeb4 "4 Hinges per Door" is a door_leaf rule at
 *    qty 2, and a stable door has TWO halves — so it already gives two
 *    pair-lines, 14.70 + 14.70 = £29.40, which IS Nathan's "each half on its
 *    own pair". bf3's own hinge rule added another £29.40 on top. It goes.
 *  - **the trickle vents.** Both "Trickle Vent" rules carry
 *    `not is_front_door`, so they fire on a stable door: XR16 WHITE 3.15 and
 *    "trickle" white 2.10. Nathan's list has XR16 BLACK once, so the two are
 *    gated on `new_stable_door_pair_qty < 1` — they keep firing on everything
 *    else, which is what they are for.
 *
 * 29.40 + 3.15 + 2.10 = £34.65, which is the figure the reviewer measured on
 * drawings 50-52.
 */
export const STABLE_DOOR_DEFAULT_SET = [
  { short_name: 'era_5_lever_sashlock', finish: 'PB', qty: 1, label: 'Stable Door Sashlock' },
  { short_name: 'era_deadlock', finish: 'PB', qty: 1, label: 'Stable Door Deadlock' },
  { short_name: 'trickle_vent_xr16', finish: 'Blk', qty: 1, label: 'Stable Door Trickle Vent' },
  { short_name: 'victorian', finish: 'PB', qty: 1, label: 'Stable Door Handle' },
]

/** The three imported rules bf3 turns off: an espag set, a multipoint lock, two cylinders. */
export const STABLE_DOOR_IMPORTED_RULES = [
  '0a4a3749-9cba-49e8-b0f9-0fe52f4cb077',
  '8d303c72-0623-4232-9843-8ef987afbf59',
  '12d2787c-7d3f-467c-bf92-89a28bcc93f6',
]

/** The two Trickle Vent rules that must stand down for a stable door. */
export const TRICKLE_VENT_RULES = [
  'e4c01f82-8fe6-4f0c-af01-c0b8eacbd84e',
  '943e246d-aa70-448e-a575-188d230289b8',
]

export const STABLE_DOOR_NO_VENT = 'new_stable_door_pair_qty < 1'

/**
 * A pricing context with `sql/step-bf3` applied, ON TOP of the live rule set.
 *
 * It ADDS to `ironmongeryRules` rather than replacing them, which is the
 * mistake the first offline test made: the live set is where the hinges and
 * the trickle vents come from, so a test that cannot see them cannot catch a
 * double. Idempotent.
 */
/**
 * `sql/step-bh1`, NOT YET RUN: the French master’s multipoint lock does not
 * belong on a PAIR OF FRONT DOORS.
 *
 * Step BH found it: a pair of front doors (two open-in leaves, master right)
 * fires allocator rule `cebdd8b5` "MPLS master or tall – shootbolt", which
 * gives the master leaf a Winkhaus Thunderbolt (RJZ2382, £53.55) on top of
 * the AV3 Heritage locking system the default set already gives it. The
 * master’s lock IS the heritage set (Nathan 2 / decision a); the Thunderbolt
 * is a FRENCH door’s lock.
 *
 * Every other rule in that family already carries `not is_front_door`
 * (`1b55d5a5`, `36d8eb57`, `c2ed4405`) — this one never was, because
 * Integrate has no pair of front doors to catch it. The file appends the
 * same clause, so a FRENCH pair keeps its Thunderbolt and a front-door pair
 * does not. The SLAVE bolts and keeps are untouched: Nathan 2 asks for them.
 *
 * Idempotent, and a no-op on a snapshot where the clause is already there.
 */
export const FRENCH_MASTER_LOCK_RULE = 'cebdd8b5'
export const FRONT_DOOR_NOT = 'not is_front_door'

export function withFrontDoorPairLock(snapshot) {
  const rules = (snapshot.partAllocationRules ?? []).map(r => (
    String(r.id ?? '').startsWith(FRENCH_MASTER_LOCK_RULE) &&
      !String(r.condition).includes(FRONT_DOOR_NOT)
      ? { ...r, condition: `${r.condition} and ${FRONT_DOOR_NOT}` }
      : r))
  return { ...snapshot, partAllocationRules: rules }
}

export function withStableDoorIronmongery(snapshot) {
  const rules = (snapshot.ironmongeryRules ?? []).map(r => {
    if (STABLE_DOOR_IMPORTED_RULES.includes(r.id)) return { ...r, is_active: false }
    if (TRICKLE_VENT_RULES.includes(r.id) && !String(r.condition).includes(STABLE_DOOR_NO_VENT)) {
      return { ...r, condition: `${r.condition} and ${STABLE_DOOR_NO_VENT}` }
    }
    return r
  })
  const have = new Set(rules.filter(r => r.is_active).map(
    r => `${r.product_short_name}:${r.finish_code}:${r.condition}`))
  const added = STABLE_DOOR_DEFAULT_SET.map((x, i) => ({
    id: `bf03000${i + 1}-0000-4000-8000-00000000000${i + 1}`,
    sort_order: 61 + i,
    group_name: 'stable_doors',
    loop_target: null,
    label: x.label,
    condition: 'new_stable_door_pair_qty >= 1',
    qty_expr: String(x.qty),
    product_short_name: x.short_name,
    finish_code: x.finish,
    is_active: true,
  })).filter(r => !have.has(
    `${r.product_short_name}:${r.finish_code}:${r.condition}`))
  return { ...snapshot, ironmongeryRules: [...rules, ...added] }
}
