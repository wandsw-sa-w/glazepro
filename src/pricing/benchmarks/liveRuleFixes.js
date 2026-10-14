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
