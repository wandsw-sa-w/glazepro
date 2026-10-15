/**
 * liveRuleFixes.js — what the live price rules say about doors.
 *
 * THIS FILE USED TO PATCH THE SNAPSHOT. `pf30-snapshot.json` is a CAPTURE,
 * and when the reviewer ran a file that changed a rule the live site moved
 * while the capture did not — so a benchmark priced from the capture reported
 * a difference that no longer existed. Each change was named here, applied to
 * the snapshot in the tests, and meant to become a no-op when the snapshot
 * was refreshed.
 *
 * The reviewer refreshed it on 15 Oct 2026, after `sql/step-bh3` and
 * `sql/step-bh4` ran, and every one of those entries became a no-op:
 *
 *   withAv4Costs              the three AV4 part costs     sql/step-bd1
 *   withFrontDoorIronmongery  the Croft pull and the hand  sql/step-bd4
 *   withShapedGlassRate       the shaped glass rate        sql/step-be1
 *   withStableDoorIronmongery the stable-door set          sql/step-bf3
 *   withFrontDoorPairLock     the master lock's front-door clause  sql/step-bh1
 *   withFrontDoorEuroPull     the Croft pull, again        sql/step-bd4
 *   withFrontDoorSetOnMaster  the set on the master leaf   sql/step-bh3
 *   withFrontDoorPairFitting  the pair's second leaf       sql/step-bh3
 *
 * So they are gone — along with `frontDoorIronmongery.js`, which held the
 * first two — and the snapshot is the single statement of what the live rules
 * are. What remains here is the VOCABULARY those files wrote: the rule ids and
 * the sets, because a test that says `TRICKLE_VENT_RULES` is clearer than one
 * that repeats a uuid, and because what each file DID is worth keeping where
 * the tests can point at it.
 *
 * If the live data moves ahead of the capture again, the pattern is the one
 * above: name the change here, apply it in the tests, and delete it when the
 * snapshot catches up.
 */

// ── sql/step-be1: a SHAPED unit is priced at the SQUARE glass rate ──────────
// Nathan's decision e puts the supplier's 25% on the AREA (the largest
// rectangle of the cut glass, which the engine works out), so the RATE must
// not carry it as well. The file took the expression from the square rule
// itself; in the capture both now read
// `(inner_pane_cost + outer_pane_cost) + 1`.
export const SHAPED_GLASS_RULE = 'Shaped Glass Cost'
export const SQUARE_GLASS_RULE = 'Square Glass Cost'

// ── sql/step-bf3: what a NEW stable door gets ──────────────────────────────
// Four rules, and NO hinge rule of its own: the live per-leaf rule `c11aeeb4`
// ("4 Hinges per Door", qty 2, loop door_leaf) fires once per half and the
// resolver merges the two lines into one of qty 4 — two pairs, which IS
// Nathan's decision j. bf3's first issue added a fifth rule for the hinges and
// made every stable door £34.65 too dear.
export const STABLE_DOOR_DEFAULT_SET = [
  { short_name: 'era_5_lever_sashlock', finish: 'PB', qty: 1, label: 'Stable Door Sashlock' },
  { short_name: 'era_deadlock', finish: 'PB', qty: 1, label: 'Stable Door Deadlock' },
  { short_name: 'trickle_vent_xr16', finish: 'Blk', qty: 1, label: 'Stable Door Trickle Vent' },
  { short_name: 'victorian', finish: 'PB', qty: 1, label: 'Stable Door Handle' },
]

/**
 * The duplicate hinge rule bf3's first issue added. The re-issue left the row
 * in place and INACTIVE (the reviewer's edit: a delete needs Nathan's yes each
 * time), which is why a test can switch it back on to prove what it cost.
 */
export const STABLE_DOOR_HINGE_RULE = 'bf030001'

/** The three imported rules bf3 turned off: an espag set, a multipoint lock, two cylinders. */
export const STABLE_DOOR_IMPORTED_RULES = [
  '0a4a3749-9cba-49e8-b0f9-0fe52f4cb077',
  '8d303c72-0623-4232-9843-8ef987afbf59',
  '12d2787c-7d3f-467c-bf92-89a28bcc93f6',
]

/**
 * The two WHITE Trickle Vent rules, which carry `not is_front_door` and so
 * used to fire on a stable door as well — on top of Nathan's black XR16. bf3
 * gated them on `new_stable_door_pair_qty < 1`.
 */
export const TRICKLE_VENT_RULES = [
  'e4c01f82-8fe6-4f0c-af01-c0b8eacbd84e',
  '943e246d-aa70-448e-a575-188d230289b8',
]
export const STABLE_DOOR_NO_VENT = 'new_stable_door_pair_qty < 1'

// ── sql/step-bh1: the FRENCH master's lock is not a front door's ───────────
// Allocator rule `cebdd8b5` ("MPLS master or tall – shootbolt", RJZ2382) gave
// the master leaf of a pair of FRONT doors a Winkhaus Thunderbolt on top of
// the heritage lock the default set gives it — £53.55. Every other rule in
// that family already carried `not is_front_door`; this one never had, because
// Integrate has no pair of front doors to catch it.
export const FRENCH_MASTER_LOCK_RULE = 'cebdd8b5'
export const FRONT_DOOR_NOT = 'not is_front_door'

// ── sql/step-bh3: the front-door set goes on the leaf that carries the lock ─
// The five front-door rules carried `not is_master_leaf_in_french_pair`, so on
// a PAIR the master was the one leaf excluded and the whole set — lock,
// cylinder, keeps and pull — landed on the slave. A single front door is
// neither, which is why nothing else moved.
export const FRONT_DOOR_SET_RULES = [
  'b5c2d45a',   // Front Door Open In Left Hand Hung
  '501f9ca5',   // Front Door Open In Right Hand Hung
  'e938fc5a',   // Front Door Open Out Left Hand Hung
  'd23e8262',   // Front Door Open Out Right Hand Hung
  'cb8eb0b9',   // Front Door Euro Cylinder Pull
]
export const MASTER_CLAUSE = 'not is_master_leaf_in_french_pair'
export const SLAVE_CLAUSE  = 'not is_slave_leaf_in_french_pair'

/**
 * And Nathan's 2 h for the second leaf of a pair (difference 22):
 * `new_french_door_pair_qty` x 120 minutes.
 */
export const FRONT_DOOR_PAIR_FITTING_RULE = 'Front Door Pair Additional Door'
