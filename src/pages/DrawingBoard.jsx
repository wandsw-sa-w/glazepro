import { Component, useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { Layout } from '../components/Layout'
import {
  loadFieldDefinitions, loadProfile, loadProfileValues,
  loadReferenceOptions, loadContainment, loadDrawingParts, saveDrawingParts,
} from '../drawingBoard/api.js'
import { buildNewBoxSash } from '../drawingBoard/buildTree.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { applyOperationDefaults } from '../drawingBoard/applyOperationDefaults.js'
import { computeSashGeometry } from '../drawingBoard/sashGeometry.js'
import { SashElevation } from '../drawingBoard/renderElevation.jsx'
import { applyDividers, applyBars } from '../drawingBoard/gridActions.js'
import { saveAsTemplate, listTemplates } from '../drawingBoard/templates.js'
import { FALLBACK_PROFILE_CODE } from '../drawingBoard/defaultProfile.js'
import { defaultIronmonger } from '../pricing/defaultIronmongery.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { validateDrawing, countBySeverity } from '../validation/validate.js'

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
  mullionPart:             'Mullion',
  transomPart:             'Transom',
  verticalGlazingBarPart:  'Vertical GB',
  horizontalGlazingBarPart:'Horizontal GB',
}

const OPERATION_FIELDS = new Set([
  'topSashPart.operation',
  'bottomSashPart.operation',
])

// Fields that filter their options by a component tag ('frame'/'sash'/'cill')
// stored in applies_to.  All other reference fields get no applies_to filter.
const COMPONENT_FILTER = {
  'drawingItemPart.frameMaterialId': 'frame',
  'drawingItemPart.sashMaterialId':  'sash',
  'drawingItemPart.cillMaterialId':  'cill',
}

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

function findRequiredEmpty(tree, fieldDefs, hiddenFields = new Set()) {
  const issues = []
  function traverse(node) {
    const fields = (fieldDefs[node.part_type] ?? []).filter(
      f => f.is_required && f.role === 'input' && !hiddenFields.has(f.field_key)
    )
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

function PropertyField({ field, value, derivedValue, onChange, refOptions, required, partType }) {
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
    let opts = refOptions[field.reference_category] ?? []
    let missingValueLabel = '(unknown)'

    const componentTag = COMPONENT_FILTER[field.field_key]
    if (componentTag) {
      // Component filter: applies_to holds component names ('frame'/'sash'/'cill').
      // Options with no applies_to tag are allowed everywhere.
      opts = opts.filter(o => !o.applies_to?.length || o.applies_to.includes(componentTag))
      missingValueLabel = '(not allowed for this component)'
    } else if (field.reference_category === 'sash_operation' && partType) {
      // Part-type filter: applies_to holds part type codes.
      // Only activates after the step-b2c SQL migration populates applies_to.
      const anyHasAppliesTo = opts.some(o => o.applies_to?.length > 0)
      if (anyHasAppliesTo) {
        opts = opts.filter(o => !o.applies_to?.length || o.applies_to.includes(partType))
      }
    }
    // All other reference fields: no applies_to filtering.

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
            <option value={value}>{value} {missingValueLabel}</option>
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

// ── IronmongeryPanel ──────────────────────────────────────────────────────────

function IronmongeryPanel({ node, tree, derived, refOptions, onChangeField, onAutoApplyDefaults, ironmongeryRules, ironmongeryProducts }) {
  const lines      = node.values?.ironmongeryLines  ?? []
  const finish     = node.values?.ironmongeryFinish ?? 'PB'
  const finishOpts = refOptions?.['ironmongery_finish'] ?? []

  // Product name lookup: short_name → display name
  const productNameMap = {}
  for (const p of (ironmongeryProducts ?? [])) productNameMap[p.short_name] = p.name

  // Compute item variables for defaultIronmonger (no pf variables needed for boolean flags)
  function computeBaseVars() {
    try { return computeVariables(tree, derived, {}) ?? {} }
    catch { return {} }
  }

  // Auto-apply defaults when lines are empty and data is loaded.
  // Uses onAutoApplyDefaults (not onChangeField) so the auto-applied tree
  // is treated as the baseline for dirty tracking — the user hasn't changed
  // anything, so the drawing should not show "Unsaved".
  const appliedRef = useRef(false)
  useEffect(() => {
    if (!appliedRef.current && lines.length === 0 && ironmongeryRules && ironmongeryRules.length > 0) {
      appliedRef.current = true
      doApplyDefaults()
    }
  }, [ironmongeryRules])  // eslint-disable-line react-hooks/exhaustive-deps

  function doApplyDefaults() {
    const vars = computeBaseVars()
    const defaultLines = defaultIronmonger(tree, vars, ironmongeryRules ?? [])
    const manualLines  = lines.filter(l => l.source === 'manual')
    const newLines = [
      ...defaultLines.map(l => ({ ...l, source: 'default' })),
      ...manualLines,
    ]
    onAutoApplyDefaults(node.key, 'ironmongeryLines', newLines)
  }

  function handleQtyChange(idx, val) {
    const parsed = parseFloat(val)
    if (!Number.isFinite(parsed) || parsed <= 0) return
    const newLines = lines.map((l, i) => i === idx ? { ...l, qty: parsed } : l)
    onChangeField(node.key, 'ironmongeryLines', newLines, 'paintAndIronmongeryPart.ironmongeryLines')
  }

  function handleFinishOverride(idx, val) {
    const newLines = lines.map((l, i) => i === idx ? { ...l, finish_code: val || null } : l)
    onChangeField(node.key, 'ironmongeryLines', newLines, 'paintAndIronmongeryPart.ironmongeryLines')
  }

  function handleRemove(idx) {
    const newLines = lines.filter((_, i) => i !== idx)
    onChangeField(node.key, 'ironmongeryLines', newLines, 'paintAndIronmongeryPart.ironmongeryLines')
  }

  function handleAddManual() {
    const newLines = [...lines, { product_short_name: '', finish_code: null, qty: 1, source: 'manual', rule_id: null, scope_part_id: null }]
    onChangeField(node.key, 'ironmongeryLines', newLines, 'paintAndIronmongeryPart.ironmongeryLines')
  }

  const cellStyle = { fontSize: 11, padding: '4px 6px', borderBottom: '1px solid #f0ede6' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Finish selector */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>Ironmongery Finish</div>
        <select
          value={finish}
          onChange={e => onChangeField(node.key, 'ironmongeryFinish', e.target.value, 'paintAndIronmongeryPart.ironmongeryFinish')}
          style={{ ...SI, fontSize: 12 }}
        >
          {finishOpts.length === 0 && <option value={finish}>{finish}</option>}
          {finishOpts.map(o => <option key={o.code} value={o.code}>{o.label} ({o.code})</option>)}
        </select>
      </div>

      {/* Lines table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555' }}>Ironmongery Lines</div>
          <button
            onClick={doApplyDefaults}
            style={{ fontSize: 10, padding: '3px 8px', border: '1px solid #3d35a8', borderRadius: 5, background: '#f0eefc', color: '#3d35a8', cursor: 'pointer' }}
          >
            Apply Defaults
          </button>
        </div>
        {lines.length === 0 ? (
          <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic' }}>
            {ironmongeryRules ? 'No lines — click Apply Defaults' : 'Loading…'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f7f6f2' }}>
                <th style={{ ...cellStyle, textAlign: 'left', fontWeight: 600 }}>Product</th>
                <th style={{ ...cellStyle, textAlign: 'left', fontWeight: 600 }}>Finish</th>
                <th style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, width: 40 }}>Qty</th>
                <th style={{ ...cellStyle, width: 20 }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#fafaf8' }}>
                  <td style={cellStyle}>
                    <span title={line.product_short_name} style={{ color: line.source === 'manual' ? '#92400e' : 'inherit' }}>
                      {productNameMap[line.product_short_name] ?? line.product_short_name}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, minWidth: 60 }}>
                    <select
                      value={line.finish_code ?? ''}
                      onChange={e => handleFinishOverride(idx, e.target.value)}
                      style={{ fontSize: 10, padding: '2px 4px', border: '1px solid #d8d5cf', borderRadius: 4, background: '#fff' }}
                    >
                      <option value="">Item finish</option>
                      {finishOpts.map(o => <option key={o.code} value={o.code}>{o.code}</option>)}
                    </select>
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    <input
                      type="number"
                      value={line.qty}
                      min="0.1"
                      step="0.5"
                      onChange={e => handleQtyChange(idx, e.target.value)}
                      style={{ width: 40, fontSize: 11, padding: '2px 4px', border: '1px solid #d8d5cf', borderRadius: 4, textAlign: 'right' }}
                    />
                  </td>
                  <td style={cellStyle}>
                    <button
                      onClick={() => handleRemove(idx)}
                      title="Remove"
                      style={{ fontSize: 10, padding: '1px 5px', border: '1px solid #fca5a5', borderRadius: 4, background: '#fef2f2', color: '#b91c1c', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <button
          onClick={handleAddManual}
          style={{ marginTop: 6, fontSize: 10, padding: '3px 8px', border: '1px solid #d8d5cf', borderRadius: 5, background: '#fff', color: '#555', cursor: 'pointer', width: '100%' }}
        >
          + Add manual line
        </button>
      </div>
    </div>
  )
}

// ── PropertyEditor ────────────────────────────────────────────────────────────

function PropertyEditor({ node, fieldDefs, derived, refOptions, onChangeField, onAutoApplyDefaults, onPrev, onNext, prevDisabled, nextDisabled, hiddenFields, tree, ironmongeryRules, ironmongeryProducts }) {
  if (!node) {
    return (
      <div style={{ padding: 16, color: '#aaa', fontSize: 12, textAlign: 'center', paddingTop: 48 }}>
        Select a part to edit its properties
      </div>
    )
  }

  const fields = (fieldDefs[node.part_type] ?? []).filter(
    f => f.role !== 'config' && !hiddenFields.has(f.field_key)
  )
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
        {/* Ironmongery panel for paintAndIronmongeryPart */}
        {node.part_type === 'paintAndIronmongeryPart' && (
          <IronmongeryPanel
            node={node}
            tree={tree}
            derived={derived}
            refOptions={refOptions}
            onChangeField={onChangeField}
            onAutoApplyDefaults={onAutoApplyDefaults}
            ironmongeryRules={ironmongeryRules}
            ironmongeryProducts={ironmongeryProducts}
          />
        )}
        {node.part_type === 'paintAndIronmongeryPart' && fields.length > 0 && (
          <div style={{ borderTop: '1px solid #e8e6e0', marginTop: 12, paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 8 }}>Other Fields</div>
          </div>
        )}
        {fields.length === 0 && node.part_type !== 'paintAndIronmongeryPart' && (
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
            partType={node.part_type}
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

function Summary({ tree, fieldDefs, derived, refOptions, onSelectKey, drawingMeta, hiddenFields }) {
  const item  = findFirst(tree, 'drawingItemPart')
  const frame = findFirst(tree, 'assemblyFramePart')

  const towCode = item?.values?.typeOfWork
  const towLabel = towCode
    ? ((refOptions['type_of_work'] ?? []).find(o => o.code === towCode)?.label ?? towCode)
    : '—'

  const frameW = frame?.values?.width
  const frameH = frame?.values?.height
  const frameSize = frameW && frameH ? `${frameW} × ${frameH} mm` : '—'

  const requiredEmpty = findRequiredEmpty(tree, fieldDefs, hiddenFields)

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

// ── ValidationPanel ──────────────────────────────────────────────────────────

function ValidationPanel({ tree, derived, onSelectKey }) {
  const [rules, setRules] = useState([])
  const [lists, setLists] = useState({})
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [
        { data: ruleData, error: rErr },
        { data: listData, error: lErr },
        { data: valData, error: vErr },
      ] = await Promise.all([
        supabase.from('validation_rules').select('*').eq('is_active', true).eq('level', 'item').order('sort_order'),
        supabase.from('validation_lists').select('*'),
        supabase.from('validation_list_values').select('*'),
      ])
      if (cancelled) return
      if (!rErr) setRules(ruleData || [])
      if (!lErr && !vErr) {
        const map = {}
        for (const l of (listData || [])) {
          map[l.name] = (valData || []).filter(v => v.list_id === l.id).map(v => v.value)
        }
        setLists(map)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const variables = tree ? (computeVariables(tree, derived || {}) || {}) : {}
  const results = !loading && tree ? validateDrawing(tree, variables, rules, lists) : []
  const firedResults = results.filter(r => r.status === 'fired')
  const counts = countBySeverity(firedResults)

  return (
    <div style={{ borderTop: '1px solid #e8e6e0', padding: '10px 14px' }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: collapsed ? 0 : 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ fontSize: 9 }}>{collapsed ? '\u25B6' : '\u25BC'}</span>
        Validation
        {!loading && firedResults.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 600, marginLeft: 4 }}>
            {counts.errors > 0 && <span style={{ color: '#dc2626', marginRight: 4 }}>{counts.errors}E</span>}
            {counts.warnings > 0 && <span style={{ color: '#f59e0b', marginRight: 4 }}>{counts.warnings}W</span>}
            {counts.info > 0 && <span style={{ color: '#3b82f6' }}>{counts.info}I</span>}
          </span>
        )}
        {!loading && firedResults.length === 0 && (
          <span style={{ fontSize: 10, color: '#15803d', fontWeight: 500, marginLeft: 4 }}>OK</span>
        )}
      </div>
      {!collapsed && !loading && (
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {firedResults.length === 0 && (
            <div style={{ fontSize: 11, color: '#15803d', fontWeight: 500 }}>No validation issues</div>
          )}
          {firedResults.map((r, idx) => {
            const colours = r.severity === 'error'
              ? { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' }
              : r.severity === 'warning'
              ? { bg: '#fffbeb', color: '#92400e', border: '#fcd34d' }
              : { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' }
            const clickable = r.part_key && onSelectKey
            return (
              <div
                key={idx}
                onClick={clickable ? () => onSelectKey(r.part_key) : undefined}
                style={{
                  fontSize: 11, padding: '4px 6px', marginBottom: 2, borderRadius: 4,
                  background: colours.bg, border: `1px solid ${colours.border}`, color: colours.color,
                  lineHeight: 1.4,
                  cursor: clickable ? 'pointer' : 'default',
                }}
              >
                {r.part_label && <span style={{ fontWeight: 600, marginRight: 4, fontSize: 10 }}>[{r.part_label}]</span>}
                {r.message}
              </div>
            )
          })}
        </div>
      )}
      {loading && <div style={{ fontSize: 11, color: '#aaa' }}>Loading...</div>}
    </div>
  )
}

// ── GridPickerDialog ──────────────────────────────────────────────────────────
// A 1-15 × 1-15 cell grid where the user hovers/clicks to choose N columns × M rows.
// For mullion/transom: N cols × M rows → (N-1) vertical dividers + (M-1) horizontal dividers.
// For glazing bars: the same, but children of a glassPart.

function GridPickerDialog({ title, applyLabel = 'Apply', onApply, onClose, maxCols = 15, maxRows = 15, initialCols = 1, initialRows = 1 }) {
  const [hover, setHover] = useState({ cols: initialCols, rows: initialRows })

  const cellSize = 22
  const gap      = 2

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', border: '1px solid #d8d5cf', borderRadius: 10, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,.18)', minWidth: 340 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a', marginBottom: 12 }}>{title}</div>

        {/* Grid */}
        <div style={{ display: 'inline-grid', gap, gridTemplateColumns: `repeat(${maxCols}, ${cellSize}px)`, cursor: 'pointer', userSelect: 'none', marginBottom: 10 }}>
          {Array.from({ length: maxRows }, (_, r) =>
            Array.from({ length: maxCols }, (_, c) => {
              const col = c + 1, row = r + 1
              const active = col <= hover.cols && row <= hover.rows
              return (
                <div
                  key={`${r}-${c}`}
                  style={{ width: cellSize, height: cellSize, borderRadius: 3, background: active ? '#3d35a8' : '#e8e6e0', transition: 'background .08s' }}
                  onMouseEnter={() => setHover({ cols: col, rows: row })}
                  onClick={() => onApply(hover.cols, hover.rows)}
                />
              )
            })
          )}
        </div>

        <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>
          {hover.cols} × {hover.rows} — {hover.cols - 1} mullion{hover.cols - 1 !== 1 ? 's' : ''} + {hover.rows - 1} transom{hover.rows - 1 !== 1 ? 's' : ''}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onApply(hover.cols, hover.rows)}
            style={{ flex: 1, fontSize: 12, padding: '6px 0', border: 'none', borderRadius: 7, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
          >{applyLabel}</button>
          <button
            onClick={onClose}
            style={{ flex: 1, fontSize: 12, padding: '6px 0', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}
          >Cancel</button>
        </div>
      </div>
    </div>
  )
}

function BarGridPickerDialog({ title, onApply, onClose }) {
  const [hover, setHover] = useState({ cols: 1, rows: 1 })
  const maxCols = 15, maxRows = 15
  const cellSize = 22, gap = 2

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', border: '1px solid #d8d5cf', borderRadius: 10, padding: 20, boxShadow: '0 8px 32px rgba(0,0,0,.18)', minWidth: 340 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a', marginBottom: 12 }}>{title}</div>

        <div style={{ display: 'inline-grid', gap, gridTemplateColumns: `repeat(${maxCols}, ${cellSize}px)`, cursor: 'pointer', userSelect: 'none', marginBottom: 10 }}>
          {Array.from({ length: maxRows }, (_, r) =>
            Array.from({ length: maxCols }, (_, c) => {
              const col = c + 1, row = r + 1
              const active = col <= hover.cols && row <= hover.rows
              return (
                <div
                  key={`${r}-${c}`}
                  style={{ width: cellSize, height: cellSize, borderRadius: 3, background: active ? '#0369a1' : '#e8e6e0', transition: 'background .08s' }}
                  onMouseEnter={() => setHover({ cols: col, rows: row })}
                  onClick={() => onApply(hover.cols, hover.rows)}
                />
              )
            })
          )}
        </div>

        <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>
          {hover.cols} × {hover.rows} — {hover.cols - 1} vertical bar{hover.cols - 1 !== 1 ? 's' : ''} + {hover.rows - 1} horizontal bar{hover.rows - 1 !== 1 ? 's' : ''}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onApply(hover.cols, hover.rows)}
            style={{ flex: 1, fontSize: 12, padding: '6px 0', border: 'none', borderRadius: 7, background: '#0369a1', color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
          >Apply</button>
          <button
            onClick={onClose}
            style={{ flex: 1, fontSize: 12, padding: '6px 0', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', color: '#555', cursor: 'pointer', fontFamily: 'inherit' }}
          >Cancel</button>
        </div>
      </div>
    </div>
  )
}


// Remove a node by key (and its descendants) from the tree.
function removeNode(tree, key) {
  if (!tree) return tree
  return {
    ...tree,
    children: (tree.children ?? [])
      .filter(c => c.key !== key)
      .map(c => removeNode(c, key)),
  }
}

// ── Unsaved-changes navigation guard ─────────────────────────────────────────
// useBlocker requires a data router; BrowserRouter doesn't support it.
// Instead we wrap navigate so any in-app navigation while dirty asks first.

function useUnsavedChangesGuard(dirty, navigate) {
  return useCallback((to, opts) => {
    if (dirty && !window.confirm('You have unsaved changes. Leave anyway?')) return
    navigate(to, opts)
  }, [dirty, navigate])
}

// ── Error boundary ────────────────────────────────────────────────────────────

class DrawingBoardErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
          <div style={{ textAlign: 'center', maxWidth: 520, padding: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Drawing Board error</div>
            <div style={{ fontSize: 13, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 16, marginBottom: 16, fontFamily: 'monospace', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {error?.message ?? String(error)}
            </div>
            <button onClick={() => window.location.reload()} style={{ fontSize: 13, padding: '8px 20px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Main component ────────────────────────────────────────────────────────────

function DrawingBoard() {
  const { drawingId } = useParams()
  const navigate      = useNavigate()

  // ── Data & loading ──────────────────────────────────────────────────────────
  const [drawingMeta, setDrawingMeta]   = useState(null)  // { drawing_number, window_type, job_item_id }
  const [fieldDefs,   setFieldDefs]     = useState({})
  const [refOptions,  setRefOptions]    = useState({})
  const [profileValues, setProfileValues] = useState([])
  const [containment, setContainment]   = useState([])
  const [hiddenFields, setHiddenFields] = useState(() => new Set())
  const [loading,     setLoading]       = useState(true)
  const [loadError,   setLoadError]     = useState(null)

  // ── Editor state ────────────────────────────────────────────────────────────
  const [tree,        setTreeRaw]       = useState(null)
  const [selectedKey, setSelectedKey]   = useState(null)
  const [dirty,       setDirty]         = useState(false)
  const [saveStatus,  setSaveStatus]    = useState(null) // null | 'saving' | 'saved' | 'error'
  const [saveError,   setSaveError]     = useState(null)
  const [viewMode,    setViewMode]      = useState('internal')
  const [settings,    setSettings]      = useState({
    showOverallSL:    true,
    showIndividualSL: true,
    showGlazingRebate:false,
    showTextOnDwg:    true,
    showGlassLabels:  true,
    showActiveRulers: false,
    showSashCentricDims: false,
  })

  // ── Dialog state ─────────────────────────────────────────────────────────────
  const [dividerDialog, setDividerDialog] = useState(false)
  const [barDialog,     setBarDialog]     = useState(false)
  const [templateDialog, setTemplateDialog] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', family: 'sash', group_name: '' })
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateError, setTemplateError] = useState(null)
  const [templateGroups, setTemplateGroups] = useState([]) // existing group names for datalist

  // ── Ironmongery data (lazy-loaded when paintAndIronmongeryPart is selected) ──
  const [ironmongeryRules,    setIronmongeryRules]    = useState(null)
  const [ironmongeryProducts, setIronmongeryProducts] = useState(null)

  // ── History ─────────────────────────────────────────────────────────────────
  const undoStack  = useRef([])
  const redoStack  = useRef([])
  // Snapshot of the last-saved (or initially loaded) tree for dirty comparison
  const savedTreeRef = useRef(null)

  function setTree(newTree) { setTreeRaw(newTree) }

  function isDirtyVsSaved(candidate) {
    return JSON.stringify(candidate) !== JSON.stringify(savedTreeRef.current)
  }

  function commit(newTree) {
    undoStack.current = [...undoStack.current.slice(-49), tree]
    redoStack.current = []
    setTree(newTree)
    setDirty(isDirtyVsSaved(newTree))
  }

  function undo() {
    if (!undoStack.current.length) return
    const prev = undoStack.current[undoStack.current.length - 1]
    redoStack.current = [...redoStack.current, tree]
    undoStack.current = undoStack.current.slice(0, -1)
    setTree(prev)
    setDirty(isDirtyVsSaved(prev))
  }

  function redo() {
    if (!redoStack.current.length) return
    const next = redoStack.current[redoStack.current.length - 1]
    undoStack.current = [...undoStack.current, tree]
    redoStack.current = redoStack.current.slice(0, -1)
    setTree(next)
    setDirty(isDirtyVsSaved(next))
  }

  // ── Derived values (recompute whenever tree changes) ────────────────────────
  const derived  = tree ? computeDerived(tree) : {}
  const geometry = tree ? computeSashGeometry(tree, derived) : null

  // ── Lazy-load ironmongery data when paintAndIronmongeryPart is first selected ─
  const selectedNode = selectedKey ? findNodeByKey(tree, selectedKey) : null
  useEffect(() => {
    if (selectedNode?.part_type !== 'paintAndIronmongeryPart') return
    if (ironmongeryRules !== null) return  // already loaded
    async function loadIronmongery() {
      try {
        const [{ data: rules }, { data: products }] = await Promise.all([
          supabase
            .from('part_allocation_rules')
            .select('id, sort_order, group_name, loop_target, label, condition, qty_expr, product_short_name, finish_code, is_active')
            .eq('rule_family', 'default_ironmongery')
            .order('sort_order'),
          supabase
            .from('ironmongery_products')
            .select('short_name, name')
            .eq('is_active', true),
        ])
        setIronmongeryRules(rules ?? [])
        setIronmongeryProducts(products ?? [])
      } catch {
        setIronmongeryRules([])
        setIronmongeryProducts([])
      }
    }
    loadIronmongery()
  }, [selectedNode?.part_type, ironmongeryRules])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guarded navigate (in-app links while dirty) ──────────────────────────────
  const guardedNavigate = useUnsavedChangesGuard(dirty, navigate)

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
          loadProfile(FALLBACK_PROFILE_CODE),
          loadContainment(),
        ])
        if (!profile) throw new Error(`Profile with code "${FALLBACK_PROFILE_CODE}" not found in default_profiles`)

        const [pVals, rOpts] = await Promise.all([
          loadProfileValues(profile.id),
          loadReferenceOptions(collectCategories(fDefs)),
        ])

        setFieldDefs(fDefs)
        setRefOptions(rOpts)
        setProfileValues(pVals)
        setContainment(cont)
        setHiddenFields(new Set(profile.hidden_fields ?? []))

        // Load or build the tree
        const loadedTree = await loadDrawingParts(Number(drawingId))
        if (loadedTree) {
          savedTreeRef.current = loadedTree
          setTree(loadedTree)
          setSelectedKey(loadedTree.key)
          setDirty(false)
        } else {
          // No drawing_parts yet — build from profile; mark unsaved
          const { tree: newTree, warnings } = buildNewBoxSash({
            profile,
            fieldDefs: fDefs,
            profileValues: pVals,
            containment: cont,
            refOptions: rOpts,
          })
          if (warnings.length > 0) console.warn('buildNewBoxSash warnings:', warnings)
          savedTreeRef.current = null  // nothing saved yet
          setTree(newTree)
          setSelectedKey(newTree.key)
          setDirty(true)
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
      savedTreeRef.current = tree   // new clean baseline
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

  // Auto-apply defaults (e.g. default ironmongery on load) without marking dirty.
  // Updates both the tree and the saved baseline so isDirtyVsSaved stays false.
  const handleAutoApplyDefaults = useCallback((nodeKey, propertyName, newValue) => {
    if (!tree) return
    const newTree = updateNodeValues(tree, nodeKey, { [propertyName]: newValue })
    savedTreeRef.current = newTree
    setTree(newTree)
    setDirty(false)
  }, [tree])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selection / prev-next ─────────────────────────────────────────────────────
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

  // ── Dividers / bars / remove handlers ────────────────────────────────────────

  function handleApplyDividers(cols, rows) {
    if (!tree) return
    const frame = findFirst(tree, 'assemblyFramePart')
    if (!frame) return

    const currentCols = findAll(tree, 'mullionPart').length + 1
    const currentRows = findAll(tree, 'transomPart').length + 1
    const shrinkingToSingle = cols === 1 && rows === 1 && (currentCols > 1 || currentRows > 1)
    if (shrinkingToSingle) {
      const ok = window.confirm('Going back to 1 x 1 removes the dividers and the extra openings. Continue?')
      if (!ok) return
    }

    const pair = findFirst(tree, 'sashPairPart')
    const pairD = pair ? (derived[pair.key] ?? {}) : {}
    const fv = frame.values ?? {}
    const cillH = findFirst(tree, 'cillPart')?.values?.height ?? 0
    const iW = (pairD.internalWidth  ?? ((fv.width  ?? 0) - (fv.leftWidth  ?? 0) - (fv.rightWidth  ?? 0)))
    const iH = (pairD.internalHeight ?? ((fv.height ?? 0) - (fv.topHeight  ?? 0) - cillH))
    const newTree = applyDividers(tree, frame.key, cols, rows, iW, iH)
    commit(newTree)
    setDividerDialog(false)
  }

  function handleApplyBars(cols, rows) {
    if (!tree) return
    const glassNode = findNodeByKey(tree, selectedKey)
    if (!glassNode || glassNode.part_type !== 'glassPart') return
    const newTree = applyBars(tree, selectedKey, cols, rows)
    commit(newTree)
    setBarDialog(false)
  }

  function handleRemove() {
    if (!tree || !selectedKey) return
    const node = findNodeByKey(tree, selectedKey)
    if (!node) return
    const removable = ['mullionPart', 'transomPart', 'verticalGlazingBarPart', 'horizontalGlazingBarPart']
    if (!removable.includes(node.part_type)) return
    const newTree = removeNode(tree, selectedKey)
    setSelectedKey(null)
    commit(newTree)
  }

  // ── Save as template ─────────────────────────────────────────────────────────

  async function openTemplateDialog() {
    setTemplateForm({ name: '', family: 'sash', group_name: '' })
    setTemplateError(null)
    // Load existing group names for the datalist
    try {
      const all = await listTemplates()
      const groups = [...new Set(all.map(t => t.group_name).filter(Boolean))].sort()
      setTemplateGroups(groups)
    } catch {
      setTemplateGroups([])
    }
    setTemplateDialog(true)
  }

  async function handleSaveAsTemplate() {
    if (!tree) return
    if (!templateForm.name.trim()) { setTemplateError('Name is required'); return }
    setTemplateSaving(true)
    setTemplateError(null)
    try {
      await saveAsTemplate(drawingMeta, tree, {
        name: templateForm.name.trim(),
        family: templateForm.family,
        group_name: templateForm.group_name.trim(),
      })
      setTemplateDialog(false)
    } catch (e) {
      setTemplateError(e?.message ?? String(e))
    }
    setTemplateSaving(false)
  }

  // Determine what the selected node is so the toolbar can show relevant buttons
  const selType     = selectedNode?.part_type ?? null
  const canRemove   = ['mullionPart', 'transomPart', 'verticalGlazingBarPart', 'horizontalGlazingBarPart'].includes(selType)
  const canAddBars  = selType === 'glassPart'

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

  // Drawing sub-bar: back, title, dirty indicator, undo/redo, save
  const drawingSubBar = (
    <div style={{ height: 40, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 8, flexShrink: 0 }}>
      <button onClick={() => guardedNavigate(-1)} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer', color: '#555', fontFamily: 'inherit' }}>
        ← Back
      </button>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {loading ? 'Loading…' : topBarTitle}
      </div>
      {dirty && saveStatus !== 'saving' && (
        <span style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', padding: '2px 9px', borderRadius: 999, flexShrink: 0 }}>
          Unsaved
        </span>
      )}
      {saveStatus === 'saved' && (
        <span style={{ fontSize: 11, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 9px', borderRadius: 999, flexShrink: 0 }}>
          Saved
        </span>
      )}
      <button onClick={undo} disabled={!undoStack.current.length} title="Undo (Ctrl+Z)" style={{ fontSize: 12, padding: '4px 9px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: undoStack.current.length ? 'pointer' : 'default', color: undoStack.current.length ? '#555' : '#ccc', fontFamily: 'inherit' }}>
        ↩ Undo
      </button>
      <button onClick={redo} disabled={!redoStack.current.length} title="Redo (Ctrl+Y)" style={{ fontSize: 12, padding: '4px 9px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: redoStack.current.length ? 'pointer' : 'default', color: redoStack.current.length ? '#555' : '#ccc', fontFamily: 'inherit' }}>
        Redo ↪
      </button>
      <button
        onClick={handleSave}
        disabled={!dirty || saveStatus === 'saving' || loading}
        style={{
          fontSize: 12, padding: '4px 13px', border: 'none', borderRadius: 7, fontWeight: 600,
          background: !dirty || saveStatus === 'saving' || loading ? '#c4c0e8' : '#3d35a8',
          color: '#fff', cursor: !dirty || saveStatus === 'saving' || loading ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {saveStatus === 'saving' ? 'Saving…' : 'Save'}
      </button>
      <button
        onClick={openTemplateDialog}
        disabled={!tree || loading}
        style={{
          fontSize: 12, padding: '4px 13px', border: '1px solid #d8d5cf', borderRadius: 7,
          background: '#fff', color: !tree || loading ? '#ccc' : '#555',
          cursor: !tree || loading ? 'default' : 'pointer', fontFamily: 'inherit',
        }}
      >
        Save as template
      </button>
    </div>
  )

  return (
    <Layout hideSidebar subMenu={drawingSubBar}>
      {/* Save error banner */}
      {saveStatus === 'error' && saveError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '8px 16px', fontSize: 12, color: '#b91c1c', flexShrink: 0 }}>
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
              onAutoApplyDefaults={handleAutoApplyDefaults}
              onPrev={handlePrev}
              onNext={handleNext}
              prevDisabled={prevDisabled}
              nextDisabled={nextDisabled}
              hiddenFields={hiddenFields}
              tree={tree}
              ironmongeryRules={ironmongeryRules}
              ironmongeryProducts={ironmongeryProducts}
            />
          </div>

          {/* Centre: SVG elevation */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: '#f7f6f2' }}>
            {/* Toolbar */}
            <div style={{ padding: '5px 10px', borderBottom: '1px solid #e8e6e0', background: '#fff', display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* View mode */}
              {['internal', 'external'].map(m => (
                <button key={m} onClick={() => setViewMode(m)} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                  border: `1px solid ${viewMode === m ? '#3d35a8' : '#d8d5cf'}`,
                  background: viewMode === m ? '#f0eefc' : '#fff',
                  color: viewMode === m ? '#3d35a8' : '#555',
                  fontWeight: viewMode === m ? 600 : 400,
                }}>
                  {m === 'internal' ? 'Internal' : 'External'}
                </button>
              ))}

              <div style={{ width: 1, height: 20, background: '#e8e6e0', flexShrink: 0, margin: '0 2px' }} />

              {/* Transom / Mullion */}
              <button
                onClick={() => setDividerDialog(true)}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid #d8d5cf', background: '#fff', color: '#555' }}
              >
                Transom / Mullion…
              </button>

              {/* Glazing bar (only when a glassPart is selected) */}
              <button
                onClick={() => setBarDialog(true)}
                disabled={!canAddBars}
                title={canAddBars ? 'Add glazing bars to selected glass' : 'Select a Glazing part first'}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: canAddBars ? 'pointer' : 'default', border: `1px solid ${canAddBars ? '#0369a1' : '#d8d5cf'}`, background: canAddBars ? '#e0f2fe' : '#f7f6f2', color: canAddBars ? '#0369a1' : '#aaa' }}
              >
                Glazing bar…
              </button>

              {/* Remove */}
              <button
                onClick={handleRemove}
                disabled={!canRemove}
                title={canRemove ? `Remove ${PART_LABELS[selType] ?? selType}` : 'Select a mullion, transom or bar to remove'}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: canRemove ? 'pointer' : 'default', border: `1px solid ${canRemove ? '#fca5a5' : '#d8d5cf'}`, background: canRemove ? '#fef2f2' : '#f7f6f2', color: canRemove ? '#b91c1c' : '#aaa' }}
              >
                Remove
              </button>

              {/* Copy frame stub */}
              <button
                disabled
                title="Copy frame (multi-frame items — coming soon)"
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, cursor: 'default', border: '1px solid #d8d5cf', background: '#f7f6f2', color: '#aaa' }}
              >
                Copy frame
              </button>

              <div style={{ flex: 1 }} />

              {/* Settings toggles */}
              {[
                { key: 'showOverallSL',    label: 'Overall S/L' },
                { key: 'showIndividualSL', label: 'Indiv. S/L' },
                { key: 'showGlassLabels',  label: 'Glass labels' },
              ].map(({ key: sk, label }) => (
                <button
                  key={sk}
                  onClick={() => setSettings(s => ({ ...s, [sk]: !s[sk] }))}
                  style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${settings[sk] ? '#3d35a8' : '#d8d5cf'}`,
                    background: settings[sk] ? '#f0eefc' : '#fff',
                    color: settings[sk] ? '#3d35a8' : '#aaa',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* SVG */}
            <div style={{ flex: 1, overflow: 'hidden', padding: 12, display: 'flex', alignItems: 'stretch' }}>
              <SashElevation
                tree={tree}
                derived={derived}
                geometry={geometry}
                refOptions={refOptions}
                viewMode={viewMode}
                selectedKey={selectedKey}
                onSelectKey={setSelectedKey}
                settings={settings}
              />
            </div>
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
              hiddenFields={hiddenFields}
            />
            {/* Validation */}
            <ValidationPanel tree={tree} derived={derived} onSelectKey={setSelectedKey} />
          </div>

        </div>
      )}

      {/* Transom / Mullion grid picker dialog */}
      {dividerDialog && (
        <GridPickerDialog
          title="Transom / Mullion — choose grid"
          applyLabel="Apply to frame"
          onApply={handleApplyDividers}
          onClose={() => setDividerDialog(false)}
        />
      )}

      {/* Glazing bar grid picker dialog */}
      {barDialog && (
        <BarGridPickerDialog
          title="Glazing bars — choose grid"
          onApply={handleApplyBars}
          onClose={() => setBarDialog(false)}
        />
      )}

      {/* Save as template dialog */}
      {templateDialog && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setTemplateDialog(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Save as template</div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>Name *</label>
              <input
                value={templateForm.name}
                onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
                style={{ ...SI, width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>Family</label>
              <select
                value={templateForm.family}
                onChange={e => setTemplateForm(f => ({ ...f, family: e.target.value }))}
                style={{ ...SI, width: '100%' }}
              >
                <option value="sash">Sash</option>
                <option value="casement">Casement</option>
                <option value="door">Door</option>
                <option value="free_text">Other</option>
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>Group</label>
              <input
                value={templateForm.group_name}
                onChange={e => setTemplateForm(f => ({ ...f, group_name: e.target.value }))}
                list="template-groups-board"
                placeholder="e.g. Single Box Sash Windows"
                style={{ ...SI, width: '100%' }}
              />
              <datalist id="template-groups-board">
                {templateGroups.map(g => <option key={g} value={g} />)}
              </datalist>
            </div>
            {templateError && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 10 }}>{templateError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setTemplateDialog(false)} style={{ fontSize: 12, padding: '6px 16px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveAsTemplate} disabled={templateSaving} style={{ fontSize: 12, padding: '6px 16px', border: 'none', borderRadius: 7, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {templateSaving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  )
}

export default function DrawingBoardPage() {
  return (
    <DrawingBoardErrorBoundary>
      <DrawingBoard />
    </DrawingBoardErrorBoundary>
  )
}
