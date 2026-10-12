// sqlConsole.js — the pure parts of the /dev/sql page (Step AT item 1).
//
// Kept out of the component so the URL handling and the table building can be
// tested directly, as gridActions.js is for the drawing board.
//
// The page calls public.claude_readonly_query (sql/step-at0-readonly-query.sql),
// which is STABLE, SECURITY INVOKER, restricted to Nathan's login, accepts a
// single SELECT/WITH and caps results at 2000 rows / 15 s. Nothing here can
// widen that: the guards are in the function, not in this page.

/**
 * The query carried in a URL's `?q=` (URL-encoded), or null.
 *
 * This is what lets the reviewer send a query as a link — the page fills the
 * box and runs it on load. A malformed escape is treated as no query rather
 * than throwing, so a bad link still opens an empty console.
 *
 * @param {string} search  e.g. "?q=select%201"
 */
export function queryFromSearch(search) {
  if (!search) return null
  let params
  try {
    params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  } catch {
    return null
  }
  const raw = params.get('q')
  if (raw == null) return null
  // URLSearchParams has already decoded it. A malformed escape does NOT
  // throw — it decodes to U+FFFD — so a hand-edited link yields a query with
  // a replacement character in it. That is fine: the query goes to the
  // function, which refuses anything that is not a SELECT or WITH and says
  // so. The page never has to judge SQL itself.
  const q = raw.trim()
  return q === '' ? null : q
}

/** A link that opens the console with this query already in the box. */
export function shareLinkFor(query, origin = '', path = '/dev/sql') {
  const q = (query ?? '').trim()
  if (!q) return `${origin}${path}`
  return `${origin}${path}?q=${encodeURIComponent(q)}`
}

/**
 * The table's columns: the UNION of the keys of every row, in the order they
 * are first met.
 *
 * The union matters because the function returns `jsonb_agg` of whatever the
 * query selected, and Postgres omits a key whose value is SQL NULL on some
 * row shapes — taking the first row's keys alone would silently drop a
 * column that only later rows have.
 */
export function resultColumns(rows) {
  if (!Array.isArray(rows)) return []
  const seen = []
  const have = new Set()
  for (const row of rows) {
    if (row == null || typeof row !== 'object' || Array.isArray(row)) continue
    for (const key of Object.keys(row)) {
      if (have.has(key)) continue
      have.add(key)
      seen.push(key)
    }
  }
  return seen
}

/**
 * One cell, as text. Nested JSON is shown compactly so a row of jsonb does
 * not break the table; null is shown as an explicit marker so it cannot be
 * confused with an empty string.
 */
export function formatCell(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** "1 row" / "24 rows" / "no rows", and a note when the 2000 cap was hit. */
export function rowCountLabel(rows) {
  const n = Array.isArray(rows) ? rows.length : 0
  const base = n === 0 ? 'no rows' : n === 1 ? '1 row' : `${n} rows`
  // The function caps at 2000, so exactly 2000 means there may be more.
  return n === 2000 ? `${base} (the 2000-row cap — there may be more)` : base
}

/**
 * What the page shows for a failure. The function's own messages explain
 * every refusal ("only a SELECT or WITH query is allowed", "one statement
 * only", "not allowed for this user"), so they are shown VERBATIM rather
 * than replaced with something friendlier that would hide the reason.
 */
export function errorText(error) {
  if (!error) return null
  return [error.message, error.details, error.hint]
    .filter(Boolean).join(' — ') || 'Unknown error'
}

/**
 * The rows out of the function's jsonb result.
 *
 * It returns a jsonb ARRAY, which supabase-js hands back as a parsed array.
 * A single object (a query that returned one row of jsonb) is wrapped, and
 * anything else becomes an empty list rather than throwing in the render.
 */
export function rowsFromResult(data) {
  if (Array.isArray(data)) return data
  if (data == null) return []
  if (typeof data === 'object') return [data]
  return []
}
