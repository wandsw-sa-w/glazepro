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

// Structural comparison: ignore key/id, compare part_type + values + children
function treesMatch(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  if (a.part_type !== b.part_type) return false

  const av = a.values ?? {}
  const bv = b.values ?? {}
  const keys = new Set([...Object.keys(av), ...Object.keys(bv)])
  for (const k of keys) {
    if (JSON.stringify(av[k] ?? null) !== JSON.stringify(bv[k] ?? null)) return false
  }

  const ac = a.children ?? []
  const bc = b.children ?? []
  if (ac.length !== bc.length) return false
  for (let i = 0; i < ac.length; i++) {
    if (!treesMatch(ac[i], bc[i])) return false
  }
  return true
}

// Remove glassPart from the first topSashPart found in the tree (immutably)
function removeGlassFromTopSash(node) {
  if (!node) return node
  if (node.part_type === 'topSashPart') {
    return { ...node, children: (node.children ?? []).filter(c => c.part_type !== 'glassPart') }
  }
  return { ...node, children: (node.children ?? []).map(removeGlassFromTopSash) }
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
  const [error,        setError]        = useState(null)
  const [loading,      setLoading]      = useState(false)

  function clearResults() {
    setTree(null); setWarnings([]); setDerived(null)
    setReloadedTree(null); setMatchStatus(null); setError(null)
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
    setLoading(true); setError(null)
    try {
      await saveDrawingParts(Number(drawingId), treeToSave)
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  // Reload from DB and compare structure with the last saved tree
  async function handleReload() {
    if (!drawingId.trim()) { setError('Enter a drawing ID first.'); return }
    setLoading(true); setError(null); setReloadedTree(null); setMatchStatus(null)
    try {
      const loaded = await loadDrawingParts(Number(drawingId))
      setReloadedTree(loaded)
      if (tree && loaded) {
        setMatchStatus(treesMatch(tree, loaded) ? 'match' : 'mismatch')
      }
    } catch (e) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  // Remove glassPart from topSashPart then try to save — RPC should reject
  async function handleBreakContainment() {
    if (!tree) { setError('Build a tree first.'); return }
    if (!drawingId.trim()) { setError('Enter a drawing ID first.'); return }
    setLoading(true); setError(null)
    try {
      const broken = removeGlassFromTopSash(tree)
      await saveDrawingParts(Number(drawingId), broken)
      setError('Save succeeded unexpectedly — containment check did not fire.\n(Are the min_count updates from step-a applied?)')
    } catch (e) {
      setError('Expected rejection from RPC:\n' + (e?.message ?? String(e)))
    } finally {
      setLoading(false)
    }
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

      {matchStatus && (
        <div style={S.section}>
          <div style={matchStatus === 'match' ? S.match : S.mismatch}>
            {matchStatus === 'match' ? '✓ MATCH' : '✗ MISMATCH'}
            {' '}— reloaded tree {matchStatus === 'match' ? 'matches' : 'does not match'} saved tree
          </div>
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
