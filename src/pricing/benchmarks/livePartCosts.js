/**
 * livePartCosts.js — Step AZ hotfix item 4
 *
 * THE LIVE CATALOGUE WINS.
 *
 * The benchmark page used to build its cost map as
 * `{ ...livePartCostMap, ...(benchmark.partCostMap ?? {}) }`, so a fixture's
 * own costs overrode the database's. That is how fourteen missing
 * `mpls_doors` lock parts stayed invisible through a whole step: the page
 * priced a French door with the fixture's costs and the row read PASS, while
 * `parts_catalogue` had no such part and a real door on the live site lost
 * £190.05 of lock ironmongery in silence.
 *
 * A fixture cost now fills a gap ONLY — a code the live catalogue does not
 * have at all — and every gap it fills is reported, so the page can say so
 * and the live smoke test fails on it.
 *
 * A live cost of 0 is a live ANSWER, not a gap: the four Kenrick gearbox
 * parts really do carry `unit_cost 0` today (`sql/step-ap0-gearbox-part-costs.sql`
 * is the pending data fix), and the page must show what the site charges
 * rather than paper over it with a fixture figure.
 */

/**
 * @param {Object<string, number>} livePartCostMap - part_code → unit_cost,
 *        from the live parts catalogue (loadPricingContext).
 * @param {Object<string, number>} [fixturePartCostMap] - the benchmark's own
 *        costs, used only for codes the live catalogue lacks.
 * @returns {{ partCostMap: Object<string, number>, missingLive: string[] }}
 *          `missingLive` is sorted, so a row's label is stable.
 */
export function mergeBenchmarkPartCosts(livePartCostMap = {}, fixturePartCostMap = {}) {
  const live    = livePartCostMap ?? {}
  const fixture = fixturePartCostMap ?? {}

  const partCostMap = { ...live }
  const missingLive = []
  for (const [code, cost] of Object.entries(fixture)) {
    if (code in live) continue
    partCostMap[code] = cost
    missingLive.push(code)
  }
  missingLive.sort()

  return { partCostMap, missingLive }
}
