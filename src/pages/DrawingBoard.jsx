import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'
import {
  loadFieldDefinitions, loadProfile, loadProfileValues,
  loadReferenceOptions, loadContainment, loadDrawingParts, saveDrawingParts,
} from '../drawingBoard/api.js'
import { buildNewBoxSash } from '../drawingBoard/buildTree.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { applyOperationDefaults } from '../drawingBoard/applyOperationDefaults.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const PART_LABELS = {
  drawingItemPart:         'Item',
  paintAndIronmongeryPart: 'Finish & Ironmongery',
  notesPart:               'Access & H&S',
  pricePart:               'Price',
  assemblyFramePart:       'Frame',
  cillPart:                'Cill',
  sashPairPart:            'Pair of Sashes',
  topSashPart:             'Top Sash',
  bottomSashPart:          'Bottom Sash',
  glassPart:               'Glazing',
  containerPart:           'Container',
  visionPanelGlassPart:    'Vision Panel Glazing',
}

const OPERATION_FIELDS = new Set([
  'topSashPart.operation',
  'bottomSashPart.operation',
])

// Shared input style (matches Ironmongery/QuoteDrawer)
const SI = {
  width: '100%', padding: '6px 8px', fontSize: 12,
  border: '1px solid #d8d5cf', borderRadius: 6, outline: 'none',
  background: '#fff', boxSizing: 'border-box',
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const c of (node.children ?? [])) {
    const f = findFirst(c, partType); if (f) return f
  }
  return null
}

function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const c of (node.children ?? [])) findAll(c, partType, acc)
  return acc
}

function findNodeByKey(node, key) {
  if (!node) return null
  if (node.key === key) return node
  for (const c of (node.children ?? [])) {
    const f = findNodeByKey(c, key); if (f) return f
  }
  return null
}

function updateNodeValues(tree, key, patch) {
  if (!tree) return tree
  if (tree.key === key) return { ...tree, values: { ...tree.values, ...patch } }
  return { ...tree, children: (tree.children ?? []).map(c => updateNodeValues(c, key, patch)) }
}

function collectCategories(fieldDefs) {
  const cats = new Set()
  for (const fields of Object.values(fieldDefs)) {
    for (const f of fields) { if (f.reference_category) cats.add(f.reference_category) }
  }
  return [...cats]
}

function findRequiredEmpty(tree, fieldDefs) {
  const issues = []
  function traverse(node) {
    const fields = (fieldDefs[node.part_type] ?? []).filter(f => f.is_required && f.role === 'input')
    for (const f of fields) {
      const v = node.values?.[f.property_name]
      if (v === null || v === undefined || v === '') {
        issues.push({ key: node.key, fieldKey: f.field_key, label: f.label, partType: node.part_type })
      }
    }
    for (const c of (node.children ?? [])) traverse(c)
  }
  if (tree) traverse(tree)
  return issues
}

function partLabel(node) {
  return node.label_override || PART_LABELS[node.part_type] || node.part_type
}

// ── PropertyField ─────────────────────────────────────────────────────────────

function PropertyField({ field, value, derivedValue, onChange, refOptions, required }) {
  const isRequired = required && (value === null || value === undefined || value === '')
  const inputBorder = isRequired ? '1px solid #e57373' : '1px solid #d8d5cf'

  if (field.role === 'derived') {
    return (
      <div style={{ marginBottom: 10 }}>
        <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#aaa', display: 'block', marginBottom: 3 }}>
          {field.label} {field.unit ? <span style={{ fontWeight: 400 }}>({field.unit})</span> : null}
        </label>
        <div style={{ fontSize: 12, padding: '6px 8px', background: '#f7f6f2', borderRadius: 6, color: '#888', border: '1px solid #e8e6e0' }}>
          {derivedValue !== null && derivedValue !== undefined ? String(derivedValue) : '—'}
        </div>
      </div>
    )
  }

  if (field.data_type === 'boolean') {
    return (
      <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          onClick={() => onChange(!value)}
          style={{ width: 32, height: 18, borderRadius: 999, background: value ? '#3d35a8' : '#d8d5cf', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .15s' }}
        >
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 16 : 2, transition: 'left .15s' }} />
        </div>
        <label title={field.field_key} style={{ fontSize: 12, color: '#555', cursor: 'pointer', userSelect: 'none' }} onClick={() => onChange(!value)}>
          {field.label}
        </label>
      </div>
    )
  }

  if (field.data_type === 'number') {
    return (
      <div style={{ marginBottom: 10 }}>
        <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>
          {field.label}{field.is_required ? ' *' : ''}
          {field.unit ? <span style={{ fontWeight: 400, color: '#aaa' }}> ({field.unit})</span> : null}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number"
            value={value ?? ''}
            onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
            style={{ ...SI, border: inputBorder, flex: 1 }}
          />
          {field.unit && <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{field.unit}</span>}
        </div>
      </div>
    )
  }

  if (field.data_type === 'reference') {
    const opts = refOptions[field.reference_category] ?? []
    return (
      <div style={{ marginBottom: 10 }}>
        <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>
          {field.label}{field.is_required ? ' *' : ''}
        </label>
        <select
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          style={{ ...SI, border: inputBorder }}
        >
          <option value="">— select —</option>
          {opts.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
          {value && !opts.some(o => o.code === value) && (
            <option value={value}>{value} (unknown)</option>
          )}
        </select>
      </div>
    )
  }

  if (field.data_type === 'multi_reference') {
    const opts = refOptions[field.reference_category] ?? []
    const current = Array.isArray(value) ? value : []
    function toggle(code) {
      const next = current.includes(code) ? current.filter(c => c !== code) : [...current, code]
      onChange(next)
    }
    return (
      <div style={{ marginBottom: 10 }}>
        <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>
          {field.label}{field.is_required ? ' *' : ''}
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {opts.map(o => {
            const sel = current.includes(o.code)
            return (
              <button key={o.code} onClick={() => toggle(o.code)} style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 6, cursor: 'pointer', fontWeight: sel ? 600 : 400,
                border: `1px solid ${sel ? '#3d35a8' : '#d8d5cf'}`,
                background: sel ? '#f0eefc' : '#fff',
                color: sel ? '#3d35a8' : '#555',
              }}>{o.label}</button>
            )
          })}
        </div>
      </div>
    )
  }

  if (field.data_type === 'part') {
    return (
      <div style={{ marginBottom: 10 }}>
        <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>
          {field.label}{field.is_required ? ' *' : ''}
        </label>
        <input
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder="Part number…"
          style={{ ...SI, border: inputBorder }}
        />
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Parts catalogue not yet available</div>
      </div>
    )
  }

  // text (default)
  return (
    <div style={{ marginBottom: 10 }}>
      <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>
        {field.label}{field.is_required ? ' *' : ''}
      </label>
      <input
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        style={{ ...SI, border: inputBorder }}
      />
    </div>
  )
}

// ── PropertyEditor ────────────────────────────────────────────────────────────

function PropertyEditor({ node, fieldDefs, derived, refOptions, onChangeField, onPrev, onNext, prevDisabled, nextDisabled }) {
  if (!node) {
    return (
      <div style={{ padding: 16, color: '#aaa', fontSize: 12, textAlign: 'center', paddingTop: 48 }}>
        Select a part to edit its properties
      </div>
    )
  }

  const fields = (fieldDefs[node.part_type] ?? []).filter(f => f.role !== 'config')
  const derivedMap = derived?.[node.key] ?? {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #e8e6e0', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          {partLabel(node)}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onPrev} disabled={prevDisabled} style={{ flex: 1, fontSize: 11, padding: '4px 0', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: prevDisabled ? 'default' : 'pointer', color: prevDisabled ? '#ccc' : '#555' }}>
            ← Prev
          </button>
          <button onClick={onNext} disabled={nextDisabled} style={{ flex: 1, fontSize: 11, padding: '4px 0', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: nextDisabled ? 'default' : 'pointer', color: nextDisabled ? '#ccc' : '#555' }}>
            Next →
          </button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {fields.length === 0 && (
          <div style={{ fontSize: 12, color: '#aaa' }}>No editable fields for this part type.</div>
        )}
        {fields.map(field => (
          <PropertyField
            key={field.field_key}
            field={field}
            value={node.values?.[field.property_name] ?? null}
            derivedValue={derivedMap[field.property_name] ?? null}
            onChange={v => onChangeField(node.key, field.property_name, v, field.field_key)}
            refOptions={refOptions}
            required={field.is_required}
          />
        ))}
      </div>
    </div>
  )
}

// ── ExplorerNode ──────────────────────────────────────────────────────────────

function ExplorerNode({ node, selectedKey, onSelect, depth = 0 }) {
  const [open, setOpen] = useState(true)
  const hasChildren = (node.children ?? []).length > 0
  const isSelected = node.key === selectedKey

  return (
    <div>
      <div
        onClick={() => onSelect(node.key)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: `4px 12px 4px ${12 + depth * 14}px`,
          cursor: 'pointer',
          background: isSelected ? '#f0eefc' : 'transparent',
          borderLeft: isSelected ? '3px solid #3d35a8' : '3px solid transparent',
        }}
      >
        {hasChildren ? (
          <span
            onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
            style={{ fontSize: 9, color: '#aaa', width: 10, flexShrink: 0, cursor: 'pointer' }}
          >
            {open ? '▼' : '▶'}
          </span>
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}
        <span style={{ fontSize: 12, color: isSelected ? '#3d35a8' : '#444', fontWeight: isSelected ? 500 : 400 }}>
          {partLabel(node)}
        </span>
      </div>
      {open && hasChildren && node.children.map(child => (
        <ExplorerNode
          key={child.key}
          node={child}
          selectedKey={selectedKey}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}

// ── DrawingPlaceholder ────────────────────────────────────────────────────────

function DrawingPlaceholder({ tree, derived, refOptions }) {
  const frame  = findFirst(tree, 'assemblyFramePart')
  const pair   = findFirst(tree, 'sashPairPart')
  const pairDerived = pair ? derived?.[pair.key] : null
  const topSash = findFirst(tree, 'topSashPart')
  const botSash = findFirst(tree, 'bottomSashPart')
  const glass   = findFirst(tree, 'glassPart')

  function opLabel(code) {
    if (!code) return '—'
    return (refOptions['sash_operation'] ?? []).find(o => o.code === code)?.label ?? code
  }
  function glazingLabel(code) {
    if (!code) return '—'
    return (refOptions['glazing_type'] ?? []).find(o => o.code === code)?.label ?? code
  }

  const frameW = frame?.values?.width
  const frameH = frame?.values?.height
  const intW   = pairDerived?.internalWidth
  const intH   = pairDerived?.internalHeight
  const topOp  = opLabel(topSash?.values?.operation)
  const botOp  = opLabel(botSash?.values?.operation)
  const glazing = glazingLabel(glass?.values?.glazingId)

  function Stat({ label, value }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 80 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#3d35a8' }}>{value ?? '—'}</div>
        <div style={{ fontSize: 10, color: '#888', textAlign: 'center' }}>{label}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
      {/* Window outline placeholder */}
      <div style={{ border: '2px solid #c4a882', borderRadius: 4, background: '#e8f4f8', width: 160, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ borderTop: '1px solid #aaa', width: '80%', position: 'relative', top: '10%' }} />
        <span style={{ fontSize: 11, color: '#888', position: 'absolute' }}>Drawing coming in step (c)</span>
      </div>

      {/* Key figures */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 24px', display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center', maxWidth: 480 }}>
        <Stat label="Frame W × H" value={frameW && frameH ? `${frameW} × ${frameH}` : null} />
        <Stat label="Internal W × H" value={intW && intH ? `${intW} × ${intH}` : null} />
        <Stat label="Top operation"    value={topOp} />
        <Stat label="Bottom operation" value={botOp} />
        <Stat label="Glazing" value={glazing} />
      </div>
    </div>
  )
}

// ── Summary ───────────────────────────────────────────────────────────────────

function Summary({ tree, fieldDefs, derived, refOptions, onSelectKey, drawingMeta }) {
  const item  = findFirst(tree, 'drawingItemPart')
  const frame = findFirst(tree, 'assemblyFramePart')

  const towCode = item?.values?.typeOfWork
  const towLabel = towCode
    ? ((refOptions['type_of_work'] ?? []).find(o => o.code === towCode)?.label ?? towCode)
    : '—'

  const frameW = frame?.values?.width
  const frameH = frame?.values?.height
  const frameSize = frameW && frameH ? `${frameW} × ${frameH} mm` : '—'

  const requiredEmpty = findRequiredEmpty(tree, fieldDefs)

  return (
    <div style={{ borderTop: '1px solid #e8e6e0', padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
        Summary
      </div>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
        <span style={{ color: '#aaa' }}>Range: </span>Box Sash
      </div>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
        <span style={{ color: '#aaa' }}>Type of work: </span>{towLabel}
      </div>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>
        <span style={{ color: '#aaa' }}>Frame: </span>{frameSize}
      </div>

      {requiredEmpty.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#b91c1c', marginBottom: 6 }}>
            Required fields empty ({requiredEmpty.length})
          </div>
          {requiredEmpty.map(issue => (
            <button
              key={issue.key + issue.fieldKey}
              onClick={() => onSelectKey(issue.key)}
              style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 11, padding: '3px 6px', marginBottom: 2, border: '1px solid #fca5a5', borderRadius: 5, background: '#fef2f2', color: '#b91c1c', cursor: 'pointer' }}
            >
              {PART_LABELS[issue.partType] ?? issue.partType} → {issue.label}
            </button>
          ))}
        </div>
      )}

      {requiredEmpty.length === 0 && tree && (
        <div style={{ fontSize: 11, color: '#15803d', fontWeight: 500 }}>✓ All required fields filled</div>
      )}
    </div>
  )
}

// ── Sidebar nav (matches other pages) ────────────────────────────────────────

function Sidebar({ navigate, unmatchedCount, user, signOut }) {
  return (
    <div style={{ width: 215, background: '#fff', borderRight: '1px solid #e8e6e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: 16, borderBottom: '1px solid #e8e6e0' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>GlazePro</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Window management</div>
      </div>
      <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Workflow</div>
      {[
        ['Leads',            '/leads'],
        ['Scheduling',       '/calendar'],
        ['Tasks',            '/tasks'],
        ['Unmatched emails', '/unmatched-emails'],
      ].map(([label, path]) => (
        <div key={label} onClick={() => navigate(path)} style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{label}</span>
          {label === 'Unmatched emails' && unmatchedCount > 0 && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#fceaea', color: '#8b2020', fontWeight: 600 }}>{unmatchedCount}</span>
          )}
        </div>
      ))}
      <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Catalogue</div>
      {[['Ironmongery', '/ironmongery'], ['Pricing', '/pricing'], ['Reference Data', '/reference-data'], ['Defaults & Parts', '/defaults']].map(([label, path]) => (
        <div key={label} onClick={() => navigate(path)} style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', color: '#555', cursor: 'pointer' }}>{label}</div>
      ))}
      <div style={{ marginTop: 'auto', padding: 13, borderTop: '1px solid #e8e6e0' }}>
        <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
        <button onClick={signOut} style={{ fontSize: 12, padding: '6px 14px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#555', width: '100%' }}>Sign out</button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DrawingBoard() {
  const { drawingId } = useParams()
  const navigate      = useNavigate()
  const { user, signOut } = useAuth()
  const unmatchedCount = useUnmatchedCount()

  // ── Data & loading ──────────────────────────────────────────────────────────
  const [drawingMeta, setDrawingMeta]   = useState(null)  // { drawing_number, window_type, job_item_id }
  const [fieldDefs,   setFieldDefs]     = useState({})
  const [refOptions,  setRefOptions]    = useState({})
  const [profileValues, setProfileValues] = useState([])
  const [containment, setContainment]   = useState([])
  const [loading,     setLoading]       = useState(true)
  const [loadError,   setLoadError]     = useState(null)

  // ── Editor state ────────────────────────────────────────────────────────────
  const [tree,        setTreeRaw]       = useState(null)
  const [selectedKey, setSelectedKey]   = useState(null)
  const [dirty,       setDirty]         = useState(false)
  const [saveStatus,  setSaveStatus]    = useState(null) // null | 'saving' | 'saved' | 'error'
  const [saveError,   setSaveError]     = useState(null)

  // ── History ─────────────────────────────────────────────────────────────────
  const undoStack = useRef([])
  const redoStack = useRef([])

  function setTree(newTree) { setTreeRaw(newTree) }

  function commit(newTree) {
    undoStack.current = [...undoStack.current.slice(-49), tree]
    redoStack.current = []
    setTree(newTree)
    setDirty(true)
  }

  function undo() {
    if (!undoStack.current.length) return
    const prev = undoStack.current[undoStack.current.length - 1]
    redoStack.current = [...redoStack.current, tree]
    undoStack.current = undoStack.current.slice(0, -1)
    setTree(prev)
    setDirty(true)
  }

  function redo() {
    if (!redoStack.current.length) return
    const next = redoStack.current[redoStack.current.length - 1]
    undoStack.current = [...undoStack.current, tree]
    redoStack.current = redoStack.current.slice(0, -1)
    setTree(next)
    setDirty(true)
  }

  // ── Derived values (recompute whenever tree changes) ────────────────────────
  const derived = tree ? computeDerived(tree) : {}

  // ── Route blocker for unsaved changes ───────────────────────────────────────
  const blocker = useBlocker(dirty)
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm('You have unsaved changes. Leave anyway?')) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker.state])

  // Tab/window close warning
  useEffect(() => {
    function onBeforeUnload(e) {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (dirty) handleSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, tree])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load on mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true); setLoadError(null)
      try {
        // Fetch drawing metadata (for top bar)
        const { data: dwg, error: dwgErr } = await supabase
          .from('drawings')
          .select('id, drawing_number, window_type, job_item_id')
          .eq('id', Number(drawingId))
          .maybeSingle()
        if (dwgErr) throw dwgErr
        if (dwg) setDrawingMeta(dwg)

        // Load all reference data in parallel
        const [fDefs, profile, cont] = await Promise.all([
          loadFieldDefinitions(),
          loadProfile('sash'),
          loadContainment(),
        ])
        if (!profile) throw new Error('Profile with code "sash" not found in default_profiles')

        const [pVals, rOpts] = await Promise.all([
          loadProfileValues(profile.id),
          loadReferenceOptions(collectCategories(fDefs)),
        ])

        setFieldDefs(fDefs)
        setRefOptions(rOpts)
        setProfileValues(pVals)
        setContainment(cont)

        // Load or build the tree
        const loadedTree = await loadDrawingParts(Number(drawingId))
        if (loadedTree) {
          setTree(loadedTree)
          setSelectedKey(loadedTree.key)
          setDirty(false)
        } else {
          // No drawing_parts yet — build from profile
          const { tree: newTree, warnings } = buildNewBoxSash({
            profile,
            fieldDefs: fDefs,
            profileValues: pVals,
            containment: cont,
            refOptions: rOpts,
          })
          if (warnings.length > 0) console.warn('buildNewBoxSash warnings:', warnings)
          setTree(newTree)
          setSelectedKey(newTree.key)
          setDirty(true)  // new tree is unsaved
        }
      } catch (e) {
        setLoadError(e?.message ?? String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [drawingId])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!tree) return
    setSaveStatus('saving'); setSaveError(null)
    try {
      await saveDrawingParts(Number(drawingId), tree)
      setDirty(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (e) {
      setSaveStatus('error')
      setSaveError(e?.message ?? String(e))
    }
  }

  // ── Field change handler ──────────────────────────────────────────────────────
  const handleChangeField = useCallback((nodeKey, propertyName, newValue, fieldKey) => {
    if (!tree) return
    let newTree = updateNodeValues(tree, nodeKey, { [propertyName]: newValue })

    // If an operation field changed, apply frame/cill defaults as ONE step
    if (OPERATION_FIELDS.has(fieldKey)) {
      newTree = applyOperationDefaults(newTree, profileValues, refOptions)
    }

    commit(newTree)
  }, [tree, profileValues, refOptions])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selection / prev-next ─────────────────────────────────────────────────────
  const selectedNode = selectedKey ? findNodeByKey(tree, selectedKey) : null
  const siblingsOfType = selectedNode ? findAll(tree, selectedNode.part_type) : []
  const siblingIdx = siblingsOfType.findIndex(n => n.key === selectedKey)
  const prevDisabled = siblingIdx <= 0
  const nextDisabled = siblingIdx >= siblingsOfType.length - 1

  function handlePrev() {
    if (!prevDisabled) setSelectedKey(siblingsOfType[siblingIdx - 1].key)
  }
  function handleNext() {
    if (!nextDisabled) setSelectedKey(siblingsOfType[siblingIdx + 1].key)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Failed to load drawing</div>
          <div style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, marginBottom: 16 }}>{loadError}</div>
          <button onClick={() => navigate(-1)} style={{ fontSize: 13, padding: '8px 20px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>← Go back</button>
        </div>
      </div>
    )
  }

  const topBarTitle = drawingMeta
    ? `Drawing ${drawingMeta.drawing_number ?? drawingId}${drawingMeta.window_type ? ` — ${drawingMeta.window_type}` : ''}`
    : `Drawing ${drawingId}`

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'inherit', background: '#f5f4f0' }}>

      {/* ── Sidebar nav ──────────────────────────────────────────────────────── */}
      <Sidebar navigate={navigate} unmatchedCount={unmatchedCount} user={user} signOut={signOut} />

      {/* ── Editor area ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{ height: 48, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
          <button onClick={() => navigate(-1)} style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#555' }}>
            ← Back
          </button>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {loading ? 'Loading…' : topBarTitle}
          </div>

          {/* Unsaved indicator */}
          {dirty && saveStatus !== 'saving' && (
            <span style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', padding: '2px 9px', borderRadius: 999, flexShrink: 0 }}>
              Unsaved changes
            </span>
          )}
          {saveStatus === 'saved' && (
            <span style={{ fontSize: 11, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 9px', borderRadius: 999, flexShrink: 0 }}>
              Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span style={{ fontSize: 11, color: '#b91c1c', flexShrink: 0 }}>Save failed</span>
          )}

          <button onClick={undo} disabled={!undoStack.current.length} title="Undo (Ctrl+Z)" style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: undoStack.current.length ? 'pointer' : 'default', color: undoStack.current.length ? '#555' : '#ccc' }}>
            ↩ Undo
          </button>
          <button onClick={redo} disabled={!redoStack.current.length} title="Redo (Ctrl+Y)" style={{ fontSize: 12, padding: '5px 10px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: redoStack.current.length ? 'pointer' : 'default', color: redoStack.current.length ? '#555' : '#ccc' }}>
            Redo ↪
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saveStatus === 'saving' || loading}
            style={{
              fontSize: 12, padding: '5px 14px', border: 'none', borderRadius: 7, fontWeight: 600,
              background: !dirty || saveStatus === 'saving' || loading ? '#c4c0e8' : '#3d35a8',
              color: '#fff', cursor: !dirty || saveStatus === 'saving' || loading ? 'default' : 'pointer',
            }}
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Save error banner */}
        {saveStatus === 'error' && saveError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 0, padding: '8px 16px', fontSize: 12, color: '#b91c1c', flexShrink: 0 }}>
            {saveError}
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13 }}>
            Loading drawing…
          </div>
        )}

        {/* Three-panel layout */}
        {!loading && tree && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Left: Property editor */}
            <div style={{ width: 280, borderRight: '1px solid #e8e6e0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <PropertyEditor
                node={selectedNode}
                fieldDefs={fieldDefs}
                derived={derived}
                refOptions={refOptions}
                onChangeField={handleChangeField}
                onPrev={handlePrev}
                onNext={handleNext}
                prevDisabled={prevDisabled}
                nextDisabled={nextDisabled}
              />
            </div>

            {/* Centre: Drawing placeholder */}
            <div style={{ flex: 1, background: '#f7f6f2', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, minWidth: 0 }}>
              <DrawingPlaceholder tree={tree} derived={derived} refOptions={refOptions} />
            </div>

            {/* Right: Explorer + Summary */}
            <div style={{ width: 248, borderLeft: '1px solid #e8e6e0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              {/* Explorer header */}
              <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #e8e6e0', flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Parts
                </div>
              </div>
              {/* Explorer tree */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <ExplorerNode
                  node={tree}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                />
              </div>
              {/* Summary */}
              <Summary
                tree={tree}
                fieldDefs={fieldDefs}
                derived={derived}
                refOptions={refOptions}
                onSelectKey={setSelectedKey}
                drawingMeta={drawingMeta}
              />
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
