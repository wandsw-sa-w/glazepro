import { useState } from 'react'
import {
  loadFieldDefinitions,
  loadProfile,
  loadProfileValues,
  loadReferenceOptions,
  loadContainment,
  loadDrawingParts,
  saveDrawingParts,
} from './api.js'
import { buildNewBoxSash } from './buildTree.js'
import { computeDerived } from './computeDerived.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Collect all unique reference_category values across fieldDefs
function collectCategories(fieldDefs) {
  const cats = new Set()
  for (const fields of Object.values(fieldDefs)) {
    for (const f of fields) {
      if (f.reference_category) cats.add(f.reference_category)
    }
  }
  return [...cats]
}

// Render a tree node as indented lines: part type + non-null values
function renderTreeLines(node, depth = 0) {
  if (!node) return []
  const indent = '  '.repeat(depth)
  const lines = [`${indent}${node.part_type}  [${String(node.key).slice(0, 8)}…]`]
  for (const [k, v] of Object.entries(node.values ?? {})) {
    if (v !== null && v !== undefined) {
      lines.push(`${indent}  ${k}: ${JSON.stringify(v)}`)
    }
  }
  for (const child of (node.children ?? [])) {
    lines.push(...renderTreeLines(child, depth + 1))
  }
  return lines
}

// Sort children by sort_order (stable for comparison)
function sortedChildren(node) {
  return [...(node.children ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

// Describe a value with its type for diff output
function describe(v) {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'string') return `"${v}" (string)`
  if (typeof v === 'number') return `${v} (number)`
  if (typeof v === 'boolean') return `${v} (boolean)`
  return JSON.stringify(v)
}

// Collect all diffs between two trees, matched by part_type + position.
// Returns array of strings describing each difference.
function diffTrees(a, b, path = 'root') {
  const diffs = []

  if (!a && !b) return diffs
  if (!a) { diffs.push(`${path}: missing in saved tree`); return diffs }
  if (!b) { diffs.push(`${path}: missing in reloaded tree`); return diffs }

  if (a.part_type !== b.part_type) {
    diffs.push(`${path}: part_type saved=${a.part_type} reloaded=${b.part_type}`)
    return diffs  // children won't be comparable
  }

  // Compare values — treat missing key same as null
  const av = a.values ?? {}
  const bv = b.values ?? {}
  const allKeys = [...new Set([...Object.keys(av), ...Object.keys(bv)])].sort()
  for (const k of allKeys) {
    const aVal = av[k] ?? null
    const bVal = bv[k] ?? null
    if (JSON.stringify(aVal) !== JSON.stringify(bVal)) {
      diffs.push(`${path}.${k}: saved=${describe(aVal)}  reloaded=${describe(bVal)}`)
    }
  }

  // Compare label_override
  const aLabel = a.label_override ?? null
  const bLabel = b.label_override ?? null
  if (aLabel !== bLabel) {
    diffs.push(`${path}.label_override: saved=${describe(aLabel)}  reloaded=${describe(bLabel)}`)
  }

  // Compare overrides array
  const aOver = JSON.stringify((a.overrides ?? []).slice().sort())
  const bOver = JSON.stringify((b.overrides ?? []).slice().sort())
  if (aOver !== bOver) {
    diffs.push(`${path}.overrides: saved=${aOver}  reloaded=${bOver}`)
  }

  // Recurse into children sorted by sort_order
  const ac = sortedChildren(a)
  const bc = sortedChildren(b)
  const len = Math.max(ac.length, bc.length)
  for (let i = 0; i < len; i++) {
    const childPath = `${path}[${i}:${ac[i]?.part_type ?? bc[i]?.part_type ?? '?'}]`
    diffs.push(...diffTrees(ac[i] ?? null, bc[i] ?? null, childPath))
  }

  return diffs
}

// Remove the glassPart child from the first topSashPart found in the tree (immutably).
// All other parts and parent links are preserved.
// Expected RPC rejection: topSashPart(key)→glassPart: allowed 1..1, got 0
function removeGlassFromTopSash(node, done = { v: false }) {
  if (!node) return node
  if (!done.v && node.part_type === 'topSashPart') {
    done.v = true
    return { ...node, children: (node.children ?? []).filter(c => c.part_type !== 'glassPart') }
  }
  return { ...node, children: (node.children ?? []).map(c => removeGlassFromTopSash(c, done)) }
}

// Stamp the Integrate-check dimensions onto the in-memory tree (no DB write).
// Sets: frame.width=500, frame.height=1849, frame.leftOuterJamb=101,
//       drawingItemPart.typeOfWork='complete_new'
// With cord profile defaults (topHeight=79, leftWidth=85, rightWidth=85, cill.height=70)
// already applied, derived should show: internalWidth=330, internalHeight=1700,
// jambDifference=16, newFrame=true.
function applyTestDimensions(node) {
  if (!node) return node
  if (node.part_type === 'drawingItemPart') {
    return {
      ...node,
      values: { ...node.values, typeOfWork: 'complete_new' },
      children: (node.children ?? []).map(applyTestDimensions),
    }
  }
  if (node.part_type === 'assemblyFramePart') {
    return {
      ...node,
      values: { ...node.values, width: 500, height: 1849, leftOuterJamb: 101 },
      children: (node.children ?? []).map(applyTestDimensions),
    }
  }
  return { ...node, children: (node.children ?? []).map(applyTestDimensions) }
}

// ── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page:     { padding: 24, fontFamily: 'monospace', fontSize: 13, maxWidth: 960 },
  h1:       { fontSize: 17, fontWeight: 'bold', marginBottom: 16 },
  row:      { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 },
  input:    { border: '1px solid #ccc', padding: '4px 8px', fontFamily: 'monospace', fontSize: 13, width: 180 },
  btn:      { padding: '5px 14px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13 },
  btnBreak: { padding: '5px 14px', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13, background: '#fee2e2', border: '1px solid #fca5a5' },
  section:  { marginTop: 16, borderTop: '1px solid #e5e5e5', paddingTop: 12 },
  label:    { fontWeight: 'bold', marginBottom: 6, fontSize: 12, textTransform: 'uppercase', color: '#555' },
  pre:      { background: '#f5f5f5', padding: 10, overflowX: 'auto', fontSize: 12, lineHeight: 1.6, margin: 0 },
  error:    { color: '#b91c1c', background: '#fef2f2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 12 },
  warn:     { color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', padding: '4px 10px', marginBottom: 4, fontSize: 12 },
  match:    { color: '#15803d', fontWeight: 'bold', fontSize: 15 },
  mismatch: { color: '#b91c1c', fontWeight: 'bold', fontSize: 15 },
  spinner:  { color: '#6b7280', fontSize: 12 },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DrawingBoardTest() {
  const [drawingId,    setDrawingId]    = useState('')
  const [tree,         setTree]         = useState(null)
  const [warnings,     setWarnings]     = useState([])
  const [derived,      setDerived]      = useState(null)
  const [reloadedTree, setReloadedTree] = useState(null)
  const [matchStatus,  setMatchStatus]  = useState(null)   // 'match' | 'mismatch'
  const [diffs,        setDiffs]        = useState([])
  const [rowsWritten,  setRowsWritten]  = useState(null)
  const [error,        setError]        = useState(null)
  const [loading,      setLoading]      = useState(false)

  function clearResults() {
    setTree(null); setWarnings([]); setDerived(null)
    setReloadedTree(null); setMatchStatus(null); setDiffs([]); setRowsWritten(null); setError(null)
  }

  // Build a new box sash tree using the Sash profile defaults
  async function handleBuildNew() {
    if (!drawingId.trim()) { setError('Enter a drawing ID first.'); return }
    setLoading(true); clearResults()
    try {
      const [fieldDefs, profile, containment] = await Promise.all([
        loadFieldDefinitions(),
        loadProfile('sash'),
        loadContainment(),
      ])
      if (!profile) throw new Error('Profile with code "sash" not found in default_profiles')

      const profileValues = await loadProfileValues(profile.id)
      const categories    = collectCategories(fieldDefs)
      const refOptions    = await loadReferenceOptions(categories)

      const { tree: t, warnings: w } = buildNewBoxSash({
        profile,
        fieldDefs,
        profileValues,
        containment,
        refOptions,
      })
      setTree(t)
      setWarnings(w)
      setDerived(computeDerived(t))
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  // Save the current tree
  async function handleSave(treeToSave) {
    if (!drawingId.trim()) { setError('Enter a drawing ID first.'); return }
    if (!treeToSave)       { setError('Build a tree first.'); return }
    setLoading(true); setError(null); setRowsWritten(null)
    try {
      const result = await saveDrawingParts(Number(drawingId), treeToSave)
      setRowsWritten(result?.rowsWritten ?? null)
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  // Reload from DB and compare structure with the last saved tree
  async function handleReload() {
    if (!drawingId.trim()) { setError('Enter a drawing ID first.'); return }
    setLoading(true); setError(null); setReloadedTree(null); setMatchStatus(null); setDiffs([])
    try {
      const loaded = await loadDrawingParts(Number(drawingId))
      setReloadedTree(loaded)
      if (tree && loaded) {
        const d = diffTrees(tree, loaded)
        setDiffs(d)
        setMatchStatus(d.length === 0 ? 'match' : 'mismatch')
      }
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  // Remove glassPart from topSashPart then try to save — RPC should reject.
  // Expected error names the failing instance:
  //   topSashPart(key)→glassPart: allowed 1..1, got 0
  async function handleBreakContainment() {
    if (!tree) { setError('Build a tree first.'); return }
    if (!drawingId.trim()) { setError('Enter a drawing ID first.'); return }
    setLoading(true); setError(null)
    try {
      const broken = removeGlassFromTopSash(tree)
      await saveDrawingParts(Number(drawingId), broken)
      setError('Save succeeded unexpectedly — containment check did not fire.')
    } catch (e) {
      setError('Expected rejection from RPC:\n' + (e?.message ?? String(e)))
    } finally {
      setLoading(false)
    }
  }

  // Stamp Integrate-check dimensions onto the in-memory tree and recompute derived.
  // Does not save to DB.
  function handleFillTestDimensions() {
    if (!tree) { setError('Build a tree first.'); return }
    setError(null)
    const updated = applyTestDimensions(tree)
    setTree(updated)
    setDerived(computeDerived(updated))
    setReloadedTree(null); setMatchStatus(null); setDiffs([])
  }

  // Format the derived map as displayable lines
  const derivedLines = derived
    ? Object.entries(derived).flatMap(([key, fields]) => {
        const fieldLines = Object.entries(fields).map(([p, v]) => `  ${p}: ${JSON.stringify(v)}`)
        return fieldLines.length ? [`[part key: ${key.slice(0, 8)}…]`, ...fieldLines] : []
      })
    : []

  const treeLines     = tree         ? renderTreeLines(tree)         : []
  const reloadedLines = reloadedTree ? renderTreeLines(reloadedTree) : []

  return (
    <div style={S.page}>
      <div style={S.h1}>Drawing Board — Data Layer Test</div>

      <div style={S.row}>
        <input
          style={S.input}
          placeholder="Drawing ID (bigint)"
          value={drawingId}
          onChange={e => setDrawingId(e.target.value)}
        />
        <button style={S.btn} onClick={handleBuildNew} disabled={loading}>
          Build new box sash (Sash profile)
        </button>
        <button style={S.btn} onClick={() => handleSave(tree)} disabled={loading || !tree}>
          Save
        </button>
        <button style={S.btn} onClick={handleReload} disabled={loading}>
          Reload from DB
        </button>
        <button style={S.btnBreak} onClick={handleBreakContainment} disabled={loading || !tree}>
          Break containment
        </button>
        <button style={S.btn} onClick={handleFillTestDimensions} disabled={!tree}>
          Fill test dimensions
        </button>
      </div>

      {loading && <div style={S.spinner}>Loading…</div>}

      {error && <div style={S.error}>{error}</div>}

      {warnings.length > 0 && (
        <div style={S.section}>
          <div style={S.label}>Warnings ({warnings.length})</div>
          {warnings.map((w, i) => <div key={i} style={S.warn}>{w}</div>)}
        </div>
      )}

      {treeLines.length > 0 && (
        <div style={S.section}>
          <div style={S.label}>Tree — stored (input) values</div>
          <pre style={S.pre}>{treeLines.join('\n')}</pre>
        </div>
      )}

      {derivedLines.length > 0 && (
        <div style={S.section}>
          <div style={S.label}>Derived values (computed, not stored)</div>
          <pre style={S.pre}>{derivedLines.join('\n')}</pre>
        </div>
      )}

      {rowsWritten !== null && (
        <div style={S.section}>
          <div style={S.label}>Save result</div>
          <div style={{ fontSize: 12 }}>{rowsWritten} row{rowsWritten === 1 ? '' : 's'} sent to RPC</div>
        </div>
      )}

      {matchStatus && (
        <div style={S.section}>
          <div style={matchStatus === 'match' ? S.match : S.mismatch}>
            {matchStatus === 'match' ? '✓ MATCH' : '✗ MISMATCH'}
            {' '}— reloaded tree {matchStatus === 'match' ? 'matches' : 'does not match'} saved tree
          </div>
          {diffs.length > 0 && (
            <pre style={{ ...S.pre, marginTop: 8, color: '#b91c1c' }}>{diffs.join('\n')}</pre>
          )}
        </div>
      )}

      {reloadedLines.length > 0 && (
        <div style={S.section}>
          <div style={S.label}>Reloaded from DB</div>
          <pre style={S.pre}>{reloadedLines.join('\n')}</pre>
        </div>
      )}
    </div>
  )
}
