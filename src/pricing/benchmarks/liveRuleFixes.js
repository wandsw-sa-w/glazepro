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

/**
 * `sql/step-bd4`, ALREADY LIVE: a front door’s euro cylinder pull is the
 * CROFT one.
 *
 * The capture’s rule `cb8eb0b9` gives
 * `hardwick_classic_euro_pull_set_back_to_back` (HK4000PB, 23.92 -> 25.20);
 * live it gives `euro_cylinder_pull` (Croft CRO1774PB, 28.35 -> 29.40).
 * That £4.20 of cost is the £8.40 the reviewer measured on drawings 54 and
 * 55 against the Step BH report, and it is the only money in it.
 *
 * The catalogue already holds the Croft product, so only the rule moves.
 * Idempotent, and a no-op once the snapshot is refreshed.
 */
export const FRONT_DOOR_PULL_RULE = 'cb8eb0b9'
export const FRONT_DOOR_PULL_PRODUCT = 'euro_cylinder_pull'

export function withFrontDoorEuroPull(snapshot) {
  return {
    ...snapshot,
    ironmongeryRules: (snapshot.ironmongeryRules ?? []).map(r => (
      String(r.id ?? '').startsWith(FRONT_DOOR_PULL_RULE)
        ? { ...r, product_short_name: FRONT_DOOR_PULL_PRODUCT }
        : r)),
  }
}

/**
 * `sql/step-bh3` item 4, NOT YET RUN: the front-door set goes on the leaf
 * that carries the lock.
 *
 * The five front-door rules carry `not is_master_leaf_in_french_pair`, so on
 * a PAIR of front doors the master is the one leaf excluded and the whole
 * set — lock, cylinder, keeps and pull — lands on the SLAVE. Nathan’s
 * decision is the front-door set on the MASTER (the slave gets its hinges
 * and the pair’s bolts), so the clause becomes
 * `not is_slave_leaf_in_french_pair`.
 *
 * A SINGLE front door is neither master nor slave, so it is untouched —
 * which is why FT1-FT4 do not move. The pair’s set then comes RIGHT hand
 * (the master is the right leaf), at the same cost as the left.
 */
export const FRONT_DOOR_SET_RULES = [
  'b5c2d45a',   // Front Door Open In Left Hand Hung
  '501f9ca5',   // Front Door Open In Right Hand Hung
  'e938fc5a',   // Front Door Open Out Left Hand Hung
  'd23e8262',   // Front Door Open Out Right Hand Hung
  'cb8eb0b9',   // Front Door Euro Cylinder Pull
]
export const MASTER_CLAUSE = 'not is_master_leaf_in_french_pair'
export const SLAVE_CLAUSE  = 'not is_slave_leaf_in_french_pair'

export function withFrontDoorSetOnMaster(snapshot) {
  return {
    ...snapshot,
    ironmongeryRules: (snapshot.ironmongeryRules ?? []).map(r => (
      FRONT_DOOR_SET_RULES.some(id => String(r.id ?? '').startsWith(id))
        ? { ...r, condition: String(r.condition).replace(MASTER_CLAUSE, SLAVE_CLAUSE) }
        : r)),
  }
}

/**
 * `sql/step-bh3` item 5, NOT YET RUN: Nathan (15 Oct) fits a PAIR of front
 * doors in 14 h + 2 h for the second leaf.
 *
 * Integrate gives a pair only "Front Door and Frame (Base)" 840, because
 * "French Doors Additional Door" 120 carries `not is_front_door`. The new
 * rule is that 120 for a front-door pair, in the same shape as the three
 * "Front Door and Frame" rules: quantity `new_french_door_pair_qty`, value
 * 120, so a single front door (0 pairs), a French pair (not a front door)
 * and a stable door (not a front door) are all unmoved.
 */
export const FRONT_DOOR_PAIR_FITTING = {
  id: 'bb030001-0000-4000-8000-000000000001',
  name: 'Front Door Pair Additional Door',
  rule_family: 'install_labour',
  level: 'item',
  group_name: 'Doors',
  sort_order: 3,
  condition: 'is_front_door and is_complete_new and is_installation_included ' +
    'and new_french_door_pair_qty >= 1',
  quantity: 'new_french_door_pair_qty',
  value: '120',
  is_active: true,
}

export function withFrontDoorPairFitting(snapshot) {
  const rules = snapshot.rules ?? []
  if (rules.some(r => r.name === FRONT_DOOR_PAIR_FITTING.name)) return snapshot
  return { ...snapshot, rules: [...rules, { ...FRONT_DOOR_PAIR_FITTING }] }
}

/** Everything `sql/step-bh3` does, for a test that prices what it will. */
export function withStepBh3(snapshot) {
  return withFrontDoorPairFitting(withFrontDoorSetOnMaster(snapshot))
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
