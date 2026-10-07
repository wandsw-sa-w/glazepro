/**
 * fetchAllRows.js
 * Supabase (PostgREST) caps every response at 1,000 rows by default, and a
 * query that hits the cap returns the first 1,000 rows with NO error — the
 * tail of the result silently vanishes (how the trickle vent lost its cost,
 * commit 0452d98).
 *
 * Every select that can return more than 1,000 rows must go through this
 * helper. The query MUST carry a deterministic order() (unique column, or a
 * unique tie-breaker as the last order) so pages never overlap or skip.
 *
 * @param {() => import('@supabase/supabase-js').PostgrestFilterBuilder} makeQuery
 *        Factory returning a FRESH query each call (builders are single-use).
 * @param {string} label - for the error message
 * @returns {Promise<Array>} all rows
 * @throws on any page error (a failed load must never look like an empty one)
 */
export const PAGE_SIZE = 1000

export async function fetchAllRows(makeQuery, label) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`Failed to fetch ${label}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}
