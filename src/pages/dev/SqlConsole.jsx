// SqlConsole.jsx — /dev/sql, read-only queries for the reviewer (Step AT item 1).
//
// Calls public.claude_readonly_query (sql/step-at0-readonly-query.sql) BY GET:
// PostgREST runs a GET rpc in a READ ONLY transaction, which is the outermost
// of the function's four guards. The others — Nathan's login only, a single
// SELECT/WITH, STABLE — are in the function itself, so this page cannot widen
// what may be read, and it changes no other data access anywhere in the app.
//
// Normal app login applies (the route sits inside the authenticated tree), and
// there is deliberately no nav link: it is a reviewer tool, not a feature.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabase.js'
import {
  queryFromSearch, shareLinkFor, resultColumns, formatCell,
  rowCountLabel, errorText, rowsFromResult,
} from './sqlConsole.js'

const EXAMPLES = [
  ['Casement validation rules',
   "select sort_order, name, loop_target, is_active, condition from validation_rules where loop_target = 'casement_sash' order by sort_order"],
  ['Casement profile values',
   "select v.field_key, v.default_value from default_profile_values v join default_profiles p on p.id = v.profile_id where p.code = 'casement' order by v.field_key"],
  ['Casement templates',
   "select name, sort_order, is_active, tree #>> '{values,product}' as product from drawing_templates where family = 'casement' order by sort_order"],
]

export default function SqlConsole() {
  const [query, setQuery]   = useState('')
  const [rows, setRows]     = useState(null)
  const [error, setError]   = useState(null)
  const [running, setRunning] = useState(false)
  const [ranAt, setRanAt]   = useState(null)
  const ranFromUrl = useRef(false)

  const run = useCallback(async (q) => {
    const text = (q ?? '').trim()
    if (!text) return
    setRunning(true)
    setError(null)
    // The previous result is cleared, so a failure can never be read as the
    // new answer.
    setRows(null)
    // `get: true` is required, not cosmetic: PostgREST runs a GET rpc in a
    // READ ONLY transaction.
    const { data, error: rpcError } = await supabase
      .rpc('claude_readonly_query', { q: text }, { get: true })
    if (rpcError) {
      setError(rpcError)
    } else {
      setRows(rowsFromResult(data))
      setRanAt(new Date())
    }
    setRunning(false)
  }, [])

  // ?q= (URL-encoded) fills the box and runs on load, so a query can be
  // opened by link. Once only, whatever React does with effects.
  useEffect(() => {
    if (ranFromUrl.current) return
    ranFromUrl.current = true
    const fromUrl = queryFromSearch(window.location.search)
    if (!fromUrl) return
    setQuery(fromUrl)
    run(fromUrl)
  }, [run])

  const columns = resultColumns(rows ?? [])
  const message = errorText(error)

  function onKeyDown(e) {
    // Ctrl/Cmd+Enter runs, as every SQL editor does
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      run(query)
    }
  }

  async function copyLink() {
    const link = shareLinkFor(query, window.location.origin)
    try { await navigator.clipboard.writeText(link) } catch { /* no clipboard */ }
  }

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, sans-serif', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>SQL console <span style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>— read only</span></h1>
      <p style={{ fontSize: 12, color: '#666', margin: '0 0 14px', lineHeight: 1.5 }}>
        Runs <code>claude_readonly_query</code>: one SELECT or WITH, at most 2000 rows,
        15 second limit, your own row-level security. It cannot change data.
        Add <code>?q=</code> to the URL to open a query by link.
      </p>

      <textarea
        data-testid="sql-query"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        spellCheck={false}
        placeholder="select name, is_active from validation_rules where loop_target = 'casement_sash' order by sort_order"
        style={{
          width: '100%', minHeight: 110, padding: 10, fontSize: 13,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          border: '1px solid #d8d5cf', borderRadius: 8, resize: 'vertical',
        }}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0 16px', flexWrap: 'wrap' }}>
        <button
          data-testid="sql-run"
          onClick={() => run(query)}
          disabled={running || !query.trim()}
          style={{
            fontSize: 13, fontWeight: 600, padding: '7px 18px', borderRadius: 7,
            border: 'none', background: running ? '#9b97d8' : '#3d35a8', color: '#fff',
            cursor: running || !query.trim() ? 'default' : 'pointer',
          }}
        >{running ? 'Running…' : 'Run'}</button>
        <button
          onClick={copyLink}
          disabled={!query.trim()}
          style={{
            fontSize: 12, padding: '7px 12px', borderRadius: 7,
            border: '1px solid #d8d5cf', background: '#fff', color: '#555',
            cursor: query.trim() ? 'pointer' : 'default',
          }}
        >Copy link</button>
        <span style={{ fontSize: 11, color: '#999' }}>Ctrl/Cmd + Enter</span>
        {rows && !message && (
          <span data-testid="sql-rowcount" style={{ fontSize: 12, color: '#555', marginLeft: 'auto' }}>
            {rowCountLabel(rows)}
            {ranAt && <span style={{ color: '#aaa' }}> · {ranAt.toLocaleTimeString()}</span>}
          </span>
        )}
      </div>

      {/* Examples — plain links, so they are also a record of what to ask */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {EXAMPLES.map(([label, q]) => (
          <button
            key={label}
            onClick={() => { setQuery(q); run(q) }}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 999,
              border: '1px solid #e2dfd8', background: '#faf9f7', color: '#555', cursor: 'pointer',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Errors VERBATIM: the function's own messages say why a query was
          refused, and rewording them would hide the reason. */}
      {message && (
        <pre
          data-testid="sql-error"
          style={{
            background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b',
            borderRadius: 8, padding: '10px 12px', fontSize: 12, whiteSpace: 'pre-wrap',
            margin: '0 0 16px',
          }}
        >{message}</pre>
      )}

      {rows && rows.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #e8e6e0', borderRadius: 8, marginBottom: 16 }}>
          <table data-testid="sql-table" style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
            <thead>
              <tr style={{ background: '#faf9f7' }}>
                {columns.map(c => (
                  <th key={c} style={{ textAlign: 'left', padding: '7px 10px', borderBottom: '1px solid #e8e6e0', whiteSpace: 'nowrap', fontWeight: 600, color: '#444' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ background: i % 2 ? '#fcfcfb' : '#fff' }}>
                  {columns.map(c => (
                    <td key={c} style={{ padding: '6px 10px', borderBottom: '1px solid #f3f1ed', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', verticalAlign: 'top' }}>
                      {formatCell(row?.[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows && rows.length === 0 && !message && (
        <p style={{ fontSize: 12, color: '#666' }}>The query returned no rows.</p>
      )}

      {/* The raw result, for copying straight into a report */}
      {rows && (
        <>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Raw JSON</div>
          <pre
            id="sql-result-json"
            data-testid="sql-result-json"
            style={{
              background: '#1e1e2e', color: '#cdd6f4', borderRadius: 8, padding: 12,
              fontSize: 11, maxHeight: 360, overflow: 'auto', whiteSpace: 'pre-wrap',
            }}
          >{JSON.stringify(rows, null, 2)}</pre>
        </>
      )}
    </div>
  )
}
