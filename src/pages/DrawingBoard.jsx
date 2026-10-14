import { Component, useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { Layout } from '../components/Layout'
import {
  loadFieldDefinitions, loadProfile, loadProfileById, loadProfileValues,
  loadReferenceOptions, loadContainment, loadDrawingParts, saveDrawingParts,
} from '../drawingBoard/api.js'
import { buildNewBoxSash } from '../drawingBoard/buildTree.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { applyOperationDefaults } from '../drawingBoard/applyOperationDefaults.js'
import { computeSashGeometry } from '../drawingBoard/sashGeometry.js'
import {
  COMPLETE_NEW_SASH_THICKNESS_MM, COMPLETE_NEW_THICKNESS_NOTE,
  isCompleteNewSashWindow, thicknessChangePatches, applyPatches,
  applyCompleteNewThickness, owningPair,
} from '../drawingBoard/sashThickness.js'
import {
  SASHES_REPLACED_NOTE, isSashWindow, sashesDisagreeing, applySashesReplaced,
} from '../drawingBoard/sashesReplaced.js'
import {
  INTERNAL_ENTRY_NOTE, JAMB_SIZE_FIELDS, sizeEntryMode, internalSizeOf,
  frameFromInternalSize, keepInternalSize,
} from '../drawingBoard/internalSize.js'
import {
  cillRepairApplies, showsFullCillReplacement, applyCillRules,
} from '../drawingBoard/cillReplacement.js'
import { applyFanlightBottomRails, isStormproofWindow,
  resizeCasementFrame,
  OPENING_KINDS, OPENING_KIND_LABELS, openingKindOf, openingKindsFor,
  openingMatrixIndex, isCasementFrameTree, changeOpening,
  openingOf, dividerSpacingFor, operationsFor,
  setFrenchMasterLeaf, FRENCH_MASTER_LEAVES, DEFAULT_FRENCH_MASTER_LEAF,
  actionFrameKey,
  setCasementOperation, casementProfileDefaults,
} from '../drawingBoard/casementOpenings.js'
import { setStormproof } from '../drawingBoard/stormproof.js'
import {
  setLeafMidRail, leafMidRailOf, leafMidRailOffsetFor, DEFAULT_LEAF_PANEL_HEIGHT_MM,
  changeOpeningToSingleDoor, addFlagFrame, removeFrame, isDoorTree,
  setLeafGrid, setLeafCellKind,
} from '../drawingBoard/doorOpenings.js'
import { DOOR_LEAF_TYPES, doorLeafSize, doorPanelSize, leafCells, leafHolding } from '../pricing/doorGeometry.js'
import { computeSashWeight } from '../pricing/sashWeight.js'
import { loadDrawingRunPrices } from '../quotes/drawingRunPrice.js'
import { SashElevation } from '../drawingBoard/renderElevation.jsx'
import {
  applyDividers, applyBars, frameGrid, splitOpening, removeDivider, makeDividersEqual,
} from '../drawingBoard/gridActions.js'
import { FRENCH_PAIR_PART, isPairPart, frameSizeLabel } from '../pricing/casementGeometry.js'
import { partLabel, PART_LABELS } from '../drawingBoard/partLabels.js'
import { findRequiredEmpty } from '../drawingBoard/requiredFields.js'
import { loadGlassCatalogue } from '../pricing/loadPricingContext.js'
import { saveAsTemplate, listTemplates, templateGlassNameWarnings } from '../drawingBoard/templates.js'
import { diffTrees } from '../drawingBoard/diffTrees.js'
import { insertDrawingHistory, loadDrawingHistory } from '../drawingBoard/drawingHistory.js'
import { FALLBACK_PROFILE_CODE } from '../drawingBoard/defaultProfile.js'
import { isFieldHidden, hiddenTag } from '../drawingBoard/fieldVisibility.js'
import { useCurrentUser } from '../hooks/useCurrentUser.js'
import { defaultIronmonger } from '../pricing/defaultIronmongery.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { validateDrawing, countBySeverity } from '../validation/validate.js'
import { PriceBreakdown } from '../components/PriceBreakdown.jsx'
import { hornKind, HORN_TYPE_DEFAULT_LENGTH_MM } from '../pricing/optionVocabulary.js'

// ── Constants ─────────────────────────────────────────────────────────────────

// Step BC board: PART_LABELS and partLabel moved to
// src/drawingBoard/partLabels.js so they could be tested — a coupled set
// showed its door leaf as "doorLeafPart", and nothing could catch that.

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


// ── InfoNoteIcon ─────────────────────────────────────────────────────────────

function InfoNoteIcon({ note }) {
  const [show, setShow] = useState(false)
  if (!note) return null
  return (
    <span
      style={{ position: 'relative', display: 'inline-block', marginLeft: 4, cursor: 'pointer' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow(s => !s)}
    >
      <span style={{ fontSize: 12, color: '#3d35a8', fontWeight: 600, userSelect: 'none' }} title={note}>
        {'\u24D8'}
      </span>
      {show && (
        <div style={{
          position: 'absolute', left: 0, top: '100%', zIndex: 100,
          background: '#fff', border: '1px solid #d8d5cf', borderRadius: 8,
          padding: '8px 12px', fontSize: 11, color: '#444', lineHeight: 1.5,
          boxShadow: '0 4px 16px rgba(0,0,0,.12)', minWidth: 200, maxWidth: 340,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {note}
        </div>
      )}
    </span>
  )
}

// ── PropertyField ─────────────────────────────────────────────────────────────

function HiddenBadge({ text }) {
  if (!text) return null
  return (
    <span style={{ fontSize: 9, fontWeight: 500, color: '#999', background: '#f0eeea', borderRadius: 4, padding: '1px 5px', marginLeft: 6, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

// ── PartSelect ────────────────────────────────────────────────────────────────
// A data_type 'part' field stores the parts_catalogue PART CODE (permanent),
// shown to the user by part name (an editable label). Options come from the
// catalogue filtered by the field's part_category (e.g. 'Glass').
function PartSelect({ value, onChange, partCategory, inputBorder }) {
  const [state, setState] = useState({ parts: null, error: null })

  useEffect(() => {
    let cancelled = false
    async function load() {
      let q = supabase.from('parts_catalogue').select('part_code, part_name').order('part_name')
      if (partCategory) q = q.eq('category', partCategory)
      const { data, error } = await q
      if (cancelled) return
      // A failed load must never be shown as an empty result
      if (error) setState({ parts: [], error: error.message })
      else setState({ parts: data ?? [], error: null })
    }
    load()
    return () => { cancelled = true }
  }, [partCategory])

  const { parts, error } = state
  if (parts === null) return <div style={{ fontSize: 11, color: '#aaa' }}>Loading parts…</div>

  const known = value != null && parts.some(p => p.part_code === value)
  return (
    <>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        style={{ ...SI, border: inputBorder }}
      >
        <option value="">— none —</option>
        {/* A stored value that is not a part code (e.g. a legacy glass NAME
            not yet converted by sql/step-u1-glass-part-codes.sql) is shown
            explicitly so it is never silently lost or reinterpreted. */}
        {value != null && !known && (
          <option value={value}>{value} (not a part code — re-select)</option>
        )}
        {parts.map(p => (
          <option key={p.part_code} value={p.part_code}>{p.part_name} ({p.part_code})</option>
        ))}
      </select>
      {error && <div style={{ fontSize: 10, color: '#b91c1c', marginTop: 2 }}>Parts failed to load: {error}</div>}
    </>
  )
}

function PropertyField({ field, value, derivedValue, onChange, refOptions, required, partType, hiddenTagText, locked = null, enterable = null, casementDrawing = false }) {
  const isRequired = required && (value === null || value === undefined || value === '')
  const inputBorder = isRequired ? '1px solid #e57373' : '1px solid #d8d5cf'

  if (field.role === 'derived') {
    // `enterable` (Step AL): a derived field the surveyor may TYPE — the
    // pair's Internal Width / Height, which set the frame. The field
    // definition still says 'derived' (its role lives in the database and
    // this step writes no SQL), so the board decides, per drawing, whether
    // it can be typed; the value shown is still the derived one.
    if (enterable) {
      return (
        <div style={{ marginBottom: 10 }}>
          <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>
            {field.label}
            {field.unit ? <span style={{ fontWeight: 400, color: '#aaa' }}> ({field.unit})</span> : null}
            <InfoNoteIcon note={field.info_note} />
            <HiddenBadge text={hiddenTagText} />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number"
              value={derivedValue ?? ''}
              onChange={e => enterable.onChange(e.target.value === '' ? null : Number(e.target.value))}
              style={{ ...SI, border: inputBorder, flex: 1 }}
            />
            {field.unit && <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{field.unit}</span>}
          </div>
          {enterable.note && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{enterable.note}</div>
          )}
        </div>
      )
    }
    return (
      <div style={{ marginBottom: 10 }}>
        <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#aaa', display: 'block', marginBottom: 3 }}>
          {field.label} {field.unit ? <span style={{ fontWeight: 400 }}>({field.unit})</span> : null}
          <InfoNoteIcon note={field.info_note} />
          <HiddenBadge text={hiddenTagText} />
        </label>
        <div style={{ fontSize: 12, padding: '6px 8px', background: '#f7f6f2', borderRadius: 6, color: '#888', border: '1px solid #e8e6e0' }}>
          {derivedValue !== null && derivedValue !== undefined ? String(derivedValue) : '—'}
        </div>
      </div>
    )
  }

  if (field.data_type === 'boolean') {
    // `locked` (Step AJ): the value is owned by another field, so the
    // toggle is read-only with the rule stated under it and a button to
    // apply it when the stored value disagrees (no silent edits).
    const toggle = locked ? undefined : () => onChange(!value)
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            onClick={toggle}
            style={{ width: 32, height: 18, borderRadius: 999, background: value ? (locked ? '#b9b4e3' : '#3d35a8') : '#d8d5cf', position: 'relative', cursor: locked ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background .15s' }}
          >
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 16 : 2, transition: 'left .15s' }} />
          </div>
          <label title={field.field_key} style={{ fontSize: 12, color: locked ? '#888' : '#555', cursor: locked ? 'default' : 'pointer', userSelect: 'none' }} onClick={toggle}>
            {field.label}
            <InfoNoteIcon note={field.info_note} />
            <HiddenBadge text={hiddenTagText} />
          </label>
        </div>
        {locked && (
          <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
            {locked.note}
            {locked.onFix && (
              <button
                onClick={locked.onFix}
                style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', border: '1px solid #d6d0f5', borderRadius: 5, background: '#f3f1fc', color: '#3d35a8', fontWeight: 600, cursor: 'pointer' }}
              >
                {locked.fixLabel}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (field.data_type === 'number') {
    // `locked` (Step AI): the value is fixed by a business rule — the input
    // is read-only, the rule is stated in one line underneath, and when the
    // stored value does not match, a button applies it (no silent edits).
    return (
      <div style={{ marginBottom: 10 }}>
        <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>
          {field.label}{field.is_required ? ' *' : ''}
          {field.unit ? <span style={{ fontWeight: 400, color: '#aaa' }}> ({field.unit})</span> : null}
          <InfoNoteIcon note={field.info_note} />
          <HiddenBadge text={hiddenTagText} />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="number"
            value={value ?? ''}
            readOnly={!!locked}
            onChange={locked ? undefined : e => onChange(e.target.value === '' ? null : Number(e.target.value))}
            style={{
              ...SI, border: inputBorder, flex: 1,
              ...(locked ? { background: '#f7f6f2', color: '#888', cursor: 'not-allowed' } : null),
            }}
          />
          {field.unit && <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{field.unit}</span>}
        </div>
        {locked && (
          <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
            {locked.note}
            {locked.onFix && (
              <button
                onClick={locked.onFix}
                style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', border: '1px solid #d6d0f5', borderRadius: 5, background: '#f3f1fc', color: '#3d35a8', fontWeight: 600, cursor: 'pointer' }}
              >
                {locked.fixLabel}
              </button>
            )}
          </div>
        )}
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
    // Step AP: on a casement or direct glazed drawing the only types of
    // work are Complete New and No Work — every other one is a sash-window
    // service (sash replacement, draught seal, bi-glass, cill only), and
    // the sash-only board rules (sashThickness, sashesReplaced,
    // internalSize, cillReplacement) are gated on isSashWindow so they
    // never run here.
    if (field.field_key === 'drawingItemPart.typeOfWork' && casementDrawing) {
      opts = opts.filter(o => o.code === 'complete_new' || o.code === 'no_work')
    }

    // All other reference fields: no applies_to filtering.

    return (
      <div style={{ marginBottom: 10 }}>
        <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>
          {field.label}{field.is_required ? ' *' : ''}
          <InfoNoteIcon note={field.info_note} />
          <HiddenBadge text={hiddenTagText} />
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
          <InfoNoteIcon note={field.info_note} />
          <HiddenBadge text={hiddenTagText} />
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
          <InfoNoteIcon note={field.info_note} />
          <HiddenBadge text={hiddenTagText} />
        </label>
        <PartSelect
          value={value}
          onChange={onChange}
          partCategory={field.part_category}
          inputBorder={inputBorder}
        />
      </div>
    )
  }

  // text (default)
  return (
    <div style={{ marginBottom: 10 }}>
      <label title={field.field_key} style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>
        {field.label}{field.is_required ? ' *' : ''}
        <InfoNoteIcon note={field.info_note} />
        <HiddenBadge text={hiddenTagText} />
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

export function IronmongeryPanel({ node, tree, derived, refOptions, onChangeField, onAutoApplyDefaults, ironmongeryRules, ironmongeryProducts, profileValueMap, profileCode = null }) {
  const lines      = node.values?.ironmongeryLines  ?? []
  // The STORED item finish — null means not set (no silent 'PB' default;
  // an unset finish is a visible warning, Step Z)
  const itemFinish = node.values?.ironmongeryFinish ?? null
  const finishOpts = refOptions?.['ironmongery_finish'] ?? []

  // Product name lookup: short_name → display name
  const productNameMap = {}
  for (const p of (ironmongeryProducts ?? [])) productNameMap[p.short_name] = p.name

  // Compute item variables for defaultIronmonger (no pf variables needed for boolean flags)
  function computeBaseVars() {
    // Step AY item 4: the drawing's profile CODE, so rule 12
    // (is_replacement_sashes_range) evaluates for real on a sashes-only
    // drawing instead of always being false. It arrives as a PROP: `profile`
    // is DrawingBoard's own state and is not in scope here, and the catch
    // below swallowed the ReferenceError, so every default ironmongery rule
    // was evaluated against NO variables at all (Step AY hotfix).
    try { return computeVariables(tree, derived, {}, { profileCode }) ?? {} }
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
    let defaultLines
    try {
      defaultLines = defaultIronmonger(tree, vars, ironmongeryRules ?? [], {}, profileValueMap ?? {})
    } catch (e) {
      // e.g. the drawing's profile is missing glass rebate/tolerance values,
      // which the sash-weight model requires — surface, never apply wrong defaults
      console.error('Default ironmongery could not be computed:', e?.message)
      return
    }
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
      {/* Step Z: the panel's own "Ironmongery Finish" select was removed —
          it duplicated the real field (paintAndIronmongeryPart.
          ironmongeryFinish), which the definition-driven field list below
          renders with its proper label, options and flags. The panel copy
          also displayed 'PB' when the field was actually empty. */}
      {itemFinish == null && (
        <div style={{ fontSize: 11, color: '#991b1b', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '5px 8px' }}>
          {'⚠'} No Ironmongery Finish set on this item — lines set to
          "Item finish" will not price until one is chosen below.
        </div>
      )}

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
                      {/* Empty = follow the item's ironmongery finish (Step Z);
                          the label shows what it currently resolves to */}
                      <option value="">{itemFinish ? `Item finish (${itemFinish})` : 'Item finish (⚠ not set)'}</option>
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

function PropertyEditor({ node, fieldDefs, derived, refOptions, onChangeField, onAutoApplyDefaults, onPrev, onNext, prevDisabled, nextDisabled, prevLabel, nextLabel, visibilityMap, boardMode, showHidden, tree, ironmongeryRules, ironmongeryProducts, onShowPriceBreakdown, profileValueMap, onSetCompleteNewThickness, onSetSashesReplaced, onChangeInternalSize, onMakeDividersEqual, onSetFrenchMasterLeaf, onSetLeafMidRail, onSetLeafGrid, onSetLeafCellKind, profileCode = null }) {
  if (!node) {
    return (
      <div style={{ padding: 16, color: '#aaa', fontSize: 12, textAlign: 'center', paddingTop: 48 }}>
        Select a part to edit its properties
      </div>
    )
  }

  // Step AM: the cill repair fields appear only where they apply — a cill
  // repair is a sash-window service and is not offered on a complete new
  // frame or on "No Work" (Integrate greys it out there), and Full Cill
  // Replacement appears only once Repair = New Cill, as Integrate reveals it.
  function cillFieldHidden(fieldKey) {
    if (fieldKey === 'cillPart.repair') return !cillRepairApplies(tree)
    if (fieldKey === 'cillPart.isBrickToBrickCill') return !showsFullCillReplacement(tree)
    return false
  }

  const fields = (fieldDefs[node.part_type] ?? []).filter(
    f => f.role !== 'config' &&
         !isFieldHidden(visibilityMap[f.field_key], boardMode, showHidden) &&
         !cillFieldHidden(f.field_key)
  )
  const derivedMap = derived?.[node.key] ?? {}

  // Step AI 1a/1c: on a COMPLETE NEW sash window the sash thickness is
  // always 45 mm, so the field is read-only with the rule stated under it.
  // A drawing that was saved at another thickness is NOT changed on load —
  // the button applies 45 through the hand-edit path instead.
  function lockedField(fieldKey, partNode) {
    if (fieldKey === 'sashPairPart.sashThickness') {
      if (!isCompleteNewSashWindow(tree)) return null
      const current = Number(partNode.values?.sashThickness)
      return {
        note: COMPLETE_NEW_THICKNESS_NOTE,
        fixLabel: `Set to ${COMPLETE_NEW_SASH_THICKNESS_MM} mm`,
        onFix: current !== COMPLETE_NEW_SASH_THICKNESS_MM ? onSetCompleteNewThickness : null,
      }
    }
    // Step AJ 1: a box sash window's To Be Replaced is owned by the type
    // of work. Read-only, with the button only when the saved value
    // disagrees (casements and doors keep their own editable toggle).
    if (fieldKey === 'topSashPart.toBeReplaced' || fieldKey === 'bottomSashPart.toBeReplaced') {
      if (!isSashWindow(tree)) return null
      const disagrees = sashesDisagreeing(tree).some(s => s.key === partNode.key)
      return {
        note: SASHES_REPLACED_NOTE,
        fixLabel: 'Set sashes to match type of work',
        onFix: disagrees ? onSetSashesReplaced : null,
      }
    }
    // Step AL 1: on a sash replacement the surveyor enters the SASH size,
    // so Frame Width / Height are read-only and derived from it. On a
    // complete new both are editable, as Integrate allows.
    if (fieldKey === 'assemblyFramePart.width' || fieldKey === 'assemblyFramePart.height') {
      if (sizeEntryMode(tree) !== 'internal') return null
      return { note: INTERNAL_ENTRY_NOTE, fixLabel: null, onFix: null }
    }
    return null
  }

  // Step AL 1: the pair's Internal Width / Height are typeable when the
  // drawing is entered by sash size (always on a sash replacement, and as
  // the alternative on a complete new). Multi-opening frames, casements and
  // doors keep frame-only entry.
  function enterableField(fieldKey) {
    const axis = fieldKey === 'sashPairPart.internalWidth'  ? 'width'
      :          fieldKey === 'sashPairPart.internalHeight' ? 'height' : null
    if (!axis) return null
    const mode = sizeEntryMode(tree)
    if (mode === 'frame_only') return null
    return {
      onChange: v => onChangeInternalSize(axis, v),
      note: mode === 'internal' ? INTERNAL_ENTRY_NOTE : null,
    }
  }

  // Step AW: Integrate's "Divider Spacing: Make Widths Equal / Make Heights
  // Equal" on an opening's panel. GlazePro had no equivalent: the picker
  // spaces dividers equally when it lays a grid out, and a resize re-spaces
  // the columns proportionally, but nothing could even them up afterwards.
  // Step AX: which leaf of a French pair carries the lock. Integrate has
  // this on the pair and defaults to the RIGHT leaf.
  const frenchMaster = isPairPart(node) && onSetFrenchMasterLeaf
    ? (node.values?.masterLeaf ?? DEFAULT_FRENCH_MASTER_LEAF)
    : null

  // Step BA: the mid rail of a door LEAF, and the panel under it. The
  // panel height is what the control edits — a surveyor thinks in the
  // panel, not in the glass above it, which is what Integrate stores.
  const leafMidRail = (() => {
    if (!onSetLeafMidRail || !tree || !DOOR_LEAF_TYPES.includes(node.part_type)) return null
    const rail = leafMidRailOf(node)
    if (!rail) return { has: false, panelHeight: null }
    return { has: true, panelHeight: doorPanelSize(tree, node).height }
  })()

  // Step BD item 2: the LEAF GRID. A front door leaf is divided like a
  // little frame — a 120 muntin and a mid rail, with a Tricoya panel or a
  // glass unit in each cell — and the surveyor sets that layout here. The
  // mid-rail control above is the one-rail case Step BA built for a French
  // door and is left alone; this is the whole grid.
  const leafGrid = (() => {
    if (!onSetLeafGrid || !tree || !DOOR_LEAF_TYPES.includes(node.part_type)) return null
    const cells = leafCells(tree, node)
    if (cells.length === 0) return null
    const columns = cells.filter(c => c.row === 0).length
    const rows = cells.filter(c => c.col === 0).length
    return { columns, rows, cells: cells.length }
  })()

  // A CELL of that grid: a panel or a glass unit, and which it is.
  const leafCell = (() => {
    if (!onSetLeafCellKind || !tree) return null
    if (node.part_type !== 'panelPart' && node.part_type !== 'glassPart') return null
    const leaf = leafHolding(tree, node)
    if (!leaf) return null
    return { kind: node.part_type === 'panelPart' ? 'panel' : 'glass' }
  })()

  const dividerSpacing = (() => {
    if (!tree || !onMakeDividersEqual || !isCasementFrameTree(tree)) return null
    // Step AY item 3: Integrate shows Divider Spacing on a French LEAF's
    // panel too, and a leaf is not itself an opening — the pair it belongs
    // to is.
    // Step BC board 2: in the node's OWN frame, and counting ITS dividers.
    // This asked the first frame's openings and counted every frame's
    // dividers, so on a coupled set the buttons appeared on frames with no
    // divider of their own and re-spaced a frame nobody was looking at.
    return dividerSpacingFor(tree, node)
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid #e8e6e0', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          {partLabel(node, tree)}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onPrev} disabled={prevDisabled} style={{ flex: 1, fontSize: 11, padding: '4px 0', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: prevDisabled ? 'default' : 'pointer', color: prevDisabled ? '#ccc' : '#555' }}>
            {prevLabel ? `\u2039 ${prevLabel}` : '\u2039 Part'}
          </button>
          <button onClick={onNext} disabled={nextDisabled} style={{ flex: 1, fontSize: 11, padding: '4px 0', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: nextDisabled ? 'default' : 'pointer', color: nextDisabled ? '#ccc' : '#555' }}>
            {nextLabel ? `${nextLabel} \u203A` : 'Part \u203A'}
          </button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {/* Price breakdown for pricePart — shows the latest STORED pricing run */}
        {node.part_type === 'pricePart' && onShowPriceBreakdown && (
          <button
            onClick={onShowPriceBreakdown}
            style={{ width: '100%', marginBottom: 12, fontSize: 12, padding: '6px 0', border: '1px solid #d6d0f5', borderRadius: 6, background: '#f3f1fc', color: '#3d35a8', fontWeight: 600, cursor: 'pointer' }}
          >
            {'£'} Price breakdown
          </button>
        )}
        {/* Step AX: Master leaf, on a French pair */}
        {frenchMaster && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e8e6e0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 6 }}>Master leaf</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {FRENCH_MASTER_LEAVES.map(side => (
                <button
                  key={side}
                  onClick={() => onSetFrenchMasterLeaf(node.key, side)}
                  disabled={frenchMaster === side}
                  title={side === 'right' ? 'The right leaf carries the lock (Integrate’s default)' : 'The left leaf carries the lock'}
                  style={{ flex: 1, fontSize: 11, padding: '5px 0', borderRadius: 6, fontFamily: 'inherit', textTransform: 'capitalize',
                    cursor: frenchMaster === side ? 'default' : 'pointer',
                    border: `1px solid ${frenchMaster === side ? '#3d35a8' : '#d8d5cf'}`,
                    background: frenchMaster === side ? '#f0eefc' : '#fff',
                    color: frenchMaster === side ? '#3d35a8' : '#555' }}
                >{side}</button>
              ))}
            </div>
          </div>
        )}
        {/* Step BA: a mid rail and a panel, on a door LEAF */}
        {leafMidRail && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e8e6e0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 6 }}>Mid rail and panel</div>
            {leafMidRail.has ? (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <label style={{ fontSize: 11, color: '#555' }}>Panel
                  <input
                    type="number"
                    defaultValue={leafMidRail.panelHeight ?? ''}
                    onBlur={e => onSetLeafMidRail(node.key, Number(e.target.value) || null)}
                    style={{ width: 64, marginLeft: 6, fontSize: 11, padding: '3px 4px', border: '1px solid #d8d5cf', borderRadius: 4 }}
                  />
                </label>
                <button
                  onClick={() => onSetLeafMidRail(node.key, null)}
                  title="Take the mid rail and its panel away — the glass runs the whole leaf"
                  style={{ flex: 1, fontSize: 11, padding: '5px 0', borderRadius: 6, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid #d8d5cf', background: '#fff', color: '#555' }}
                >Remove</button>
              </div>
            ) : (
              <button
                onClick={() => onSetLeafMidRail(node.key, DEFAULT_LEAF_PANEL_HEIGHT_MM)}
                title="Split the leaf: glass above, a raised-and-fielded panel below"
                style={{ width: '100%', fontSize: 11, padding: '5px 0', borderRadius: 6, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid #d8d5cf', background: '#fff', color: '#555' }}
              >Add mid rail and panel</button>
            )}
          </div>
        )}
        {/* Step BD: the leaf’s panel layout */}
        {leafGrid && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e8e6e0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 6 }}>Panel layout</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {[["columns", "Across", leafGrid.columns], ["rows", "Down", leafGrid.rows]].map(([axis, label, value]) => (
                <label key={axis} style={{ fontSize: 11, color: '#555' }}>{label}
                  <input
                    type="number" min={1} max={6}
                    value={value}
                    onChange={e => onSetLeafGrid(node.key, {
                      columns: leafGrid.columns, rows: leafGrid.rows,
                      [axis]: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
                    })}
                    style={{ width: 52, marginLeft: 6, fontSize: 11, padding: '3px 4px', border: '1px solid #d8d5cf', borderRadius: 4 }}
                  />
                </label>
              ))}
              <span style={{ fontSize: 11, color: '#888' }}>{leafGrid.cells} cells</span>
            </div>
          </div>
        )}
        {/* Step BD: what sits in this cell */}
        {leafCell && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e8e6e0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 6 }}>This cell</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['panel', 'Tricoya panel'], ['glass', 'Glass']].map(([kind, label]) => (
                <button key={kind}
                  onClick={() => onSetLeafCellKind(node.key, kind)}
                  disabled={leafCell.kind === kind}
                  style={{
                    flex: 1, fontSize: 11, padding: '5px 0', borderRadius: 6, fontFamily: 'inherit',
                    cursor: leafCell.kind === kind ? 'default' : 'pointer',
                    border: `1px solid ${leafCell.kind === kind ? '#3d35a8' : '#d8d5cf'}`,
                    background: leafCell.kind === kind ? '#f0eefc' : '#fff',
                    color: leafCell.kind === kind ? '#3d35a8' : '#555',
                  }}
                >{label}</button>
              ))}
            </div>
          </div>
        )}
        {/* Step AW: Divider Spacing, on an opening of a casement frame */}
        {dividerSpacing && (dividerSpacing.canWidths || dividerSpacing.canHeights) && (
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e8e6e0' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 6 }}>Divider Spacing</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['widths', 'Make Widths Equal', dividerSpacing.canWidths, 'Needs a mullion'],
                ['heights', 'Make Heights Equal', dividerSpacing.canHeights, 'Needs a transom']].map(([axis, label, can, why]) => (
                <button
                  key={axis}
                  onClick={() => onMakeDividersEqual(axis)}
                  disabled={!can}
                  title={can ? label : why}
                  style={{ flex: 1, fontSize: 11, padding: '5px 0', borderRadius: 6, fontFamily: 'inherit', cursor: can ? 'pointer' : 'default', border: '1px solid #d8d5cf', background: can ? '#fff' : '#f7f6f2', color: can ? '#555' : '#bbb' }}
                >{label}</button>
              ))}
            </div>
          </div>
        )}
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
            profileValueMap={profileValueMap}
            profileCode={profileCode}
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
            hiddenTagText={showHidden ? hiddenTag(visibilityMap[field.field_key], boardMode) : null}
            locked={lockedField(field.field_key, node)}
            enterable={enterableField(field.field_key)}
            casementDrawing={isCasementFrameTree(tree)}
          />
        ))}
      </div>
    </div>
  )
}

// ── ExplorerNode ──────────────────────────────────────────────────────────────

function ExplorerNode({ node, selectedKey, onSelect, depth = 0, tree = null }) {
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
        <span data-testid="part-label" style={{ fontSize: 12, color: isSelected ? '#3d35a8' : '#444', fontWeight: isSelected ? 500 : 400 }}>
          {partLabel(node, tree ?? node)}
        </span>
      </div>
      {open && hasChildren && node.children.map(child => (
        <ExplorerNode
          key={child.key}
          node={child}
          selectedKey={selectedKey}
          onSelect={onSelect}
          depth={depth + 1}
          tree={tree ?? node}
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

function Summary({ tree, fieldDefs, derived, refOptions, onSelectKey, drawingMeta, visibilityMap, boardMode, showHidden, pricingInfo, sashWeights, profile }) {
  const item  = findFirst(tree, 'drawingItemPart')
  const frame = findFirst(tree, 'assemblyFramePart')

  const towCode = item?.values?.typeOfWork
  const towLabel = towCode
    ? ((refOptions['type_of_work'] ?? []).find(o => o.code === towCode)?.label ?? towCode)
    : '\u2014'

  // Step BC follow-up: the SET's size, not the first frame's. A coupled
  // drawing read 693 \u00d7 1136 \u2014 a flag light \u2014 on a drawing that is a
  // 2287 \u00d7 2101 door set. The width carries the container's -47 coupling
  // overlaps and the height is the DOOR frame's.
  const frameSize = frameSizeLabel(tree)

  const requiredEmpty = findRequiredEmpty(tree, fieldDefs, visibilityMap, boardMode, showHidden)

  // Format net price
  const priceLabel = pricingInfo?.netPrice != null
    ? `\u00a3${Number(pricingInfo.netPrice).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'Not priced yet'

  // Window type from drawingMeta
  const windowType = drawingMeta?.window_type || '\u2014'

  // Quantity from item
  const qty = item?.values?.quantity ?? item?.values?.sheetQty ?? 1

  // Total weight from sash weights
  const totalWeight = sashWeights
    ? Object.values(sashWeights).reduce((sum, w) => sum + (w?.weight_in_kg ?? 0), 0)
    : null

  return (
    <div style={{ borderTop: '1px solid #e8e6e0', padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
        Summary
      </div>

      {/* Price / Price File / Item Type / Quantity / Weight */}
      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
        <span style={{ color: '#aaa' }}>Price (net): </span>
        <span style={{ fontWeight: 600 }}>{priceLabel}</span>
      </div>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
        <span style={{ color: '#aaa' }}>Price File: </span>{pricingInfo?.priceFileName || '\u2014'}
      </div>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
        <span style={{ color: '#aaa' }}>Item Type: </span>{windowType}
      </div>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
        <span style={{ color: '#aaa' }}>Quantity: </span>{qty}
      </div>
      {totalWeight != null && totalWeight > 0 && (
        <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
          <span style={{ color: '#aaa' }}>Weight: </span>{totalWeight.toFixed(1)} kg
        </div>
      )}

      <div style={{ borderTop: '1px solid #f0eeeb', marginTop: 8, paddingTop: 8 }} />

      <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
        {/* Step AQ item 6: the range is the DRAWING'S profile. This said
            "Box Sash" on every drawing, including a casement one. */}
        {/* Step AR item 3: the profile's LABEL, the same way Defaults &
            Parts names a profile (display_name || label). Step AQ used
            `name`, which these rows do not have, so it fell through to the
            code and read "casement" instead of "Casement". */}
        <span style={{ color: '#aaa' }}>Range: </span>
        {profile?.display_name || profile?.label || profile?.name || profile?.code || '—'}
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
              {PART_LABELS[issue.partType] ?? issue.partType} {'\u2192'} {issue.label}
            </button>
          ))}
        </div>
      )}

      {requiredEmpty.length === 0 && tree && (
        <div style={{ fontSize: 11, color: '#15803d', fontWeight: 500 }}>{'\u2713'} All required fields filled</div>
      )}
    </div>
  )
}

// ── ValidationPanel ──────────────────────────────────────────────────────────

export function ValidationPanel({ tree, derived, onSelectKey, profileCode = null }) {
  const [rules, setRules] = useState([])
  const [lists, setLists] = useState({})
  const [loading, setLoading] = useState(true)
  // Step AS: the glass catalogue, for the casement weight rule
  const [glassCatalogue, setGlassCatalogue] = useState(null)
  const [glassError, setGlassError] = useState(null)
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
      // Step AS: weighing a casement sash needs the glass, so rule 120
      // ("over 45 kg side hung") cannot be evaluated without the catalogue.
      // A failed load is surfaced, not swallowed: without it the rule comes
      // out unevaluable, which must not look like a passing check.
      try {
        const cat = await loadGlassCatalogue(supabase)
        if (!cancelled) setGlassCatalogue(cat)
      } catch (e) {
        if (!cancelled) setGlassError(e.message)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Step AY item 4: the profile CODE as a PROP — `profile` is
  // DrawingBoard's own state and is not in scope here. Reading it threw a
  // ReferenceError on every render of this panel, which took the whole
  // drawing board down (Step AY hotfix).
  const variables = tree
    ? (computeVariables(tree, derived || {}, {}, { profileCode }) || {})
    : {}
  const results = !loading && tree
    ? validateDrawing(tree, variables, rules, lists, { glassCatalogue })
    : []
  const firedResults = results.filter(r => r.status === 'fired')
  const unevaluable = results.filter(r => r.status === 'unevaluable')
  const counts = countBySeverity(firedResults)

  return (
    <div data-testid="validation-panel" data-loading={loading ? 'true' : 'false'} style={{ borderTop: '1px solid #e8e6e0', padding: '10px 14px' }}>
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
          {firedResults.length === 0 && unevaluable.length === 0 && (
            <div style={{ fontSize: 11, color: '#15803d', fontWeight: 500 }}>No validation issues</div>
          )}
          {/* Step AS: a check that could NOT be evaluated is shown, never
              hidden — the panel used to render fired results only, so a
              missing variable or a failed catalogue load looked like "OK". */}
          {glassError && (
            <div style={{ fontSize: 11, color: '#991b1b', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '5px 8px', marginBottom: 6 }}>
              {'⚠'} Could not load the glass catalogue, so sash weight checks
              did not run: {glassError}
            </div>
          )}
          {unevaluable.length > 0 && (
            <div style={{ fontSize: 11, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '5px 8px', marginBottom: 6 }}>
              {'⚠'} {unevaluable.length} check{unevaluable.length === 1 ? '' : 's'} could
              not be evaluated (missing: {[...new Set(unevaluable.flatMap(r => r.missing ?? []))].join(', ') || 'unknown'})
            </div>
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

// ── HistoryPanel ─────────────────────────────────────────────────────────────

function HistoryPanel({ entries, loading: historyLoading, error: historyError }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedIds, setExpandedIds] = useState(new Set())

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const EVENT_LABELS = {
    created: 'Created',
    saved: 'Saved',
    created_from_template: 'Created from template',
    copied: 'Copied',
  }

  function formatDateTime(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  }

  function formatChange(c) {
    if (c.field === '(added)') return `${c.part} added`
    if (c.field === '(removed)') return `${c.part} removed`
    const from = c.from ?? '(empty)'
    const to = c.to ?? '(empty)'
    return `${c.part} \u2014 ${c.field}: ${from} \u2192 ${to}`
  }

  return (
    <div style={{ borderTop: '1px solid #e8e6e0', padding: '10px 14px' }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: collapsed ? 0 : 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <span style={{ fontSize: 9 }}>{collapsed ? '\u25B6' : '\u25BC'}</span>
        History
        {!historyLoading && entries.length > 0 && (
          <span style={{ fontSize: 10, fontWeight: 500, color: '#888', marginLeft: 4 }}>{entries.length}</span>
        )}
      </div>
      {!collapsed && (
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {historyLoading && <div style={{ fontSize: 11, color: '#aaa' }}>Loading...</div>}
          {!historyLoading && historyError && (
            <div style={{ fontSize: 11, color: '#c00' }}>History could not be loaded: {historyError}</div>
          )}
          {!historyLoading && !historyError && entries != null && entries.length === 0 && (
            <div style={{ fontSize: 11, color: '#aaa' }}>No history yet</div>
          )}
          {!historyLoading && !historyError && (entries ?? []).map(entry => {
            const changes = Array.isArray(entry.changes) ? entry.changes : []
            const isExpanded = expandedIds.has(entry.id)
            const COLLAPSE_LIMIT = 3
            const needsCollapse = changes.length > COLLAPSE_LIMIT
            const visibleChanges = isExpanded ? changes : changes.slice(0, COLLAPSE_LIMIT)

            return (
              <div key={entry.id} style={{ marginBottom: 6, padding: '4px 6px', background: '#fafaf8', borderRadius: 5, border: '1px solid #eeece6' }}>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>
                  {formatDateTime(entry.created_at)}
                  <span style={{ marginLeft: 4 }}>{entry.user_name || 'Unknown user'}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: changes.length > 0 ? 3 : 0 }}>
                  {EVENT_LABELS[entry.event] ?? entry.event}
                  {entry.note && <span style={{ fontWeight: 400, color: '#888', marginLeft: 4 }}>{entry.note}</span>}
                </div>
                {visibleChanges.map((c, idx) => (
                  <div key={idx} style={{ fontSize: 10, color: '#666', lineHeight: 1.5, paddingLeft: 4 }}>
                    {formatChange(c)}
                  </div>
                ))}
                {needsCollapse && !isExpanded && (
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    style={{ fontSize: 10, color: '#3d35a8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', marginTop: 1 }}
                  >
                    show all ({changes.length})
                  </button>
                )}
                {needsCollapse && isExpanded && (
                  <button
                    onClick={() => toggleExpand(entry.id)}
                    style={{ fontSize: 10, color: '#3d35a8', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', marginTop: 1 }}
                  >
                    show less
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── DividerPaletteDialog ──────────────────────────────────────────────────────
// Step AW: Integrate's "Transom / Mullion" dialog, which Nathan prefers to the
// hover grid that was here before (he has used both).
//
// A palette of icon TILES: each tile is a little drawing of the layout — a
// square with its divider lines — with "columns x rows" under it. ONE CLICK on
// a tile applies it. There is no Apply button, no radio buttons and no
// drop-downs, just a close cross at the top right.
//
// What the palette offers depends on what is selected:
//
//   the FRAME  -> 1x1 ... 7x7, dividing the WHOLE frame (down the palette =
//                 columns 1-7, across = rows 1-7, so "1x2" is one column and
//                 two rows: a transom)
//   an OPENING -> just "1x2" and "2x1", splitting THAT opening, the new
//                 divider stopping at whatever bounds it
//
// The tile icon is the whole point of the dialog — a surveyor picks the shape
// they can see rather than reading two numbers — so it is drawn, not labelled:
// (cols - 1) vertical lines and (rows - 1) horizontal lines inside a square.

function DividerTile({ cols, rows, onPick, size = 30, current = false }) {
  const [hover, setHover] = useState(false)
  const pad = 0.5
  const line = (x1, y1, x2, y2, i) => (
    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3d35a8" strokeWidth={1} />
  )
  return (
    <button
      type="button"
      onClick={() => onPick(cols, rows)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${cols} column${cols === 1 ? '' : 's'} x ${rows} row${rows === 1 ? '' : 's'}`}
      aria-label={`${cols}x${rows}`}
      data-testid={`divider-tile-${cols}x${rows}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: 3, borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
        // Step AQ item 7 kept: the frame's CURRENT grid is marked, so the
        // palette says what the frame is on instead of only what it could be.
        border: `1px solid ${hover ? '#3d35a8' : (current ? '#c9c4ee' : 'transparent')}`,
        background: hover ? '#f0eefc' : (current ? '#f7f6fd' : 'transparent'),
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <rect x={pad} y={pad} width={size - 1} height={size - 1}
          fill="#fff" stroke="#8a8578" strokeWidth={1} />
        {Array.from({ length: cols - 1 }, (_, i) => {
          const x = pad + (size - 1) * (i + 1) / cols
          return line(x, pad, x, size - pad, `v${i}`)
        })}
        {Array.from({ length: rows - 1 }, (_, i) => {
          const y = pad + (size - 1) * (i + 1) / rows
          return line(pad, y, size - pad, y, `h${i}`)
        })}
      </svg>
      <span style={{ fontSize: 9, color: '#555', lineHeight: 1 }}>{cols}x{rows}</span>
    </button>
  )
}

function DividerPaletteDialog({ onPick, onClose, error = null, tiles = null, note = null, current = null, maxCols = 7, maxRows = 7 }) {
  // When `tiles` is given the palette shows exactly those, which is the
  // opening case ("1x2" and "2x1"). Otherwise the full square palette.
  const grid = tiles ?? Array.from({ length: maxCols }, (_, c) =>
    Array.from({ length: maxRows }, (_, r) => [c + 1, r + 1])).flat()
  const columnsInPalette = tiles ? grid.length : maxRows

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', border: '1px solid #d8d5cf', borderRadius: 10, padding: '14px 16px 16px', boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>Transom / Mullion</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: '#888', padding: 2, fontFamily: 'inherit' }}
          >{'×'}</button>
        </div>
        {note && <div style={{ fontSize: 11, color: '#888', marginBottom: 8, maxWidth: 260 }}>{note}</div>}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 12, color: '#991b1b', maxWidth: 260 }}>
            {'⚠'} {error}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columnsInPalette}, auto)`, gap: 2 }}>
          {grid.map(([c, r]) => (
            <DividerTile key={`${c}x${r}`} cols={c} rows={r} onPick={onPick}
              current={current != null && current.cols === c && current.rows === r} />
          ))}
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
// Instead we wrap navigate so any in-app navigation while dirty asks first
// using an in-page confirm dialog (no window.confirm).

function useUnsavedChangesGuard(dirty, navigate) {
  const [pending, setPending] = useState(null) // { to, opts } when waiting for confirm

  const guardedNavigate = useCallback((to, opts) => {
    if (dirty) {
      setPending({ to, opts })
      return
    }
    navigate(to, opts)
  }, [dirty, navigate])

  const confirm = useCallback(() => {
    if (pending) {
      navigate(pending.to, pending.opts)
      setPending(null)
    }
  }, [pending, navigate])

  const cancel = useCallback(() => { setPending(null) }, [])

  return { guardedNavigate, pending, confirm, cancel }
}

// ── ConfirmDialog ────────────────────────────────────────────────────────
// In-page confirm dialog (no window.confirm / alert)

function ConfirmDialog({ title, message, confirmLabel = 'Continue', cancelLabel = 'Cancel', onConfirm, onCancel, danger }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: '#1a1a1a' }}>{title}</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ fontSize: 12, padding: '6px 16px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>{cancelLabel}</button>
          <button onClick={onConfirm} style={{ fontSize: 12, padding: '6px 16px', border: 'none', borderRadius: 7, background: danger ? '#dc2626' : '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ── PhotosDrawer ─────────────────────────────────────────────────────────
// Side drawer showing lead_uploads thumbnails, large view, and upload.

function PhotosDrawer({ leadId, user, onClose }) {
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(true)
  const [largeUrl, setLargeUrl] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchUploads()
  }, [leadId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchUploads() {
    setLoading(true)
    const { data, error } = await supabase
      .from('lead_uploads')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    if (error) console.error('Failed to load uploads:', error.message)
    setUploads(data || [])
    setLoading(false)
  }

  async function handleUpload(e) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const filePath = `${leadId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('lead-files').upload(filePath, file)
      if (error) { console.error('Upload failed:', error.message); continue }
      const { error: insertErr } = await supabase.from('lead_uploads').insert([{
        lead_id: leadId,
        filename: file.name,
        file_path: filePath,
        uploaded_by: user?.email || null,
        file_size: file.size || null,
        created_at: new Date().toISOString(),
      }])
      if (insertErr) console.error('Insert failed:', insertErr.message)
    }
    await fetchUploads()
    setUploading(false)
    e.target.value = '' // reset file input
  }

  function getPublicUrl(filePath) {
    return supabase.storage.from('lead-files').getPublicUrl(filePath).data.publicUrl
  }

  function isImage(filename) {
    return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(filename)
  }

  return (
    <>
      <div style={{
        width: 320, borderLeft: '1px solid #e8e6e0', background: '#fff', display: 'flex',
        flexDirection: 'column', flexShrink: 0, position: 'relative', zIndex: 2,
      }}>
        {/* Header */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Photos ({uploads.length})
          </div>
          <label style={{
            fontSize: 11, padding: '3px 10px', border: '1px solid #3d35a8', borderRadius: 6,
            background: '#f0eefc', color: '#3d35a8', cursor: uploading ? 'default' : 'pointer',
            fontWeight: 500, opacity: uploading ? 0.6 : 1,
          }}>
            {uploading ? 'Uploading...' : 'Upload'}
            <input type="file" multiple accept="image/*" onChange={handleUpload} style={{ display: 'none' }} disabled={uploading} />
          </label>
          <button onClick={onClose} style={{ fontSize: 14, padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer', color: '#888' }}>X</button>
        </div>

        {/* Thumbnails */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {loading && <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: 20 }}>Loading...</div>}
          {!loading && uploads.length === 0 && (
            <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: 20 }}>No photos yet</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {uploads.filter(u => isImage(u.filename)).map(u => {
              const url = getPublicUrl(u.file_path)
              return (
                <div
                  key={u.id}
                  onClick={() => setLargeUrl(url)}
                  style={{
                    cursor: 'pointer', borderRadius: 8, overflow: 'hidden',
                    border: '1px solid #e8e6e0', aspectRatio: '1', background: '#f7f6f2',
                  }}
                >
                  <img src={url} alt={u.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )
            })}
          </div>
          {/* Non-image files */}
          {uploads.filter(u => !isImage(u.filename)).map(u => (
            <div key={u.id} style={{ fontSize: 11, padding: '6px 8px', borderBottom: '1px solid #f0ede6', color: '#555' }}>
              <a href={getPublicUrl(u.file_path)} target="_blank" rel="noreferrer" style={{ color: '#3d35a8', textDecoration: 'none' }}>{u.filename}</a>
            </div>
          ))}
        </div>
      </div>

      {/* Large image overlay */}
      {largeUrl && (
        <div
          onClick={() => setLargeUrl(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <img src={largeUrl} alt="Large view" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,.4)' }} />
        </div>
      )}
    </>
  )
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
  const { user }      = useAuth()
  const currentUser   = useCurrentUser()

  // ── Data & loading ──────────────────────────────────────────────────────────
  const [drawingMeta, setDrawingMeta]   = useState(null)  // { drawing_number, window_type, job_item_id }
  const [fieldDefs,   setFieldDefs]     = useState({})
  const [refOptions,  setRefOptions]    = useState({})
  const [profileValues, setProfileValues] = useState([])
  // The drawing's OWN profile (its range), for the Summary and anything else
  // that must not assume Box Sash — Step AQ item 6
  const [profile, setProfile] = useState(null)
  // Step AU: shown when a stormproof conversion cannot be made
  const [stormproofError, setStormproofError] = useState(null)
  const [containment, setContainment]   = useState([])
  const [visibilityMap, setVisibilityMap] = useState({})  // { fieldKey: 'shown'|'hidden_sales'|... }
  const [boardMode, setBoardMode] = useState(() => {
    try { return localStorage.getItem('glazepro_board_mode') || 'sales' } catch { return 'sales' }
  })
  const [showHidden, setShowHidden] = useState(false)
  const [loading,     setLoading]       = useState(true)
  const [loadError,   setLoadError]     = useState(null)

  // ── Lead / item / drawing navigation data ───────────────────────────────────
  const [leadId,      setLeadId]        = useState(null)
  const [leadNumber,  setLeadNumber]    = useState(null)
  const [jobItems,    setJobItems]      = useState([])   // non-deleted, sorted
  const [allDrawings, setAllDrawings]   = useState([])   // non-deleted, sorted

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

  // Sync board mode with user's fixed mode (sales/survey lock the toggle)
  useEffect(() => {
    const userMode = currentUser?.drawing_board_mode
    if (userMode === 'sales' || userMode === 'survey') {
      setBoardMode(userMode)
    }
  }, [currentUser?.drawing_board_mode])

  // ── Dialog state ─────────────────────────────────────────────────────────────
  const [dividerDialog, setDividerDialog] = useState(false)
  const [barDialog,     setBarDialog]     = useState(false)
  const [templateDialog, setTemplateDialog] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', family: 'sash', group_name: '' })
  const [templateSaving, setTemplateSaving] = useState(false)
  const [templateError, setTemplateError] = useState(null)
  const [templateGroups, setTemplateGroups] = useState([]) // existing group names for datalist
  const [resetDialog, setResetDialog]   = useState(false)
  const [photosOpen, setPhotosOpen]     = useState(false)
  const [switchDrawingOpen, setSwitchDrawingOpen] = useState(false)

  // ── Ironmongery data (lazy-loaded when paintAndIronmongeryPart is selected) ──
  const [ironmongeryRules,    setIronmongeryRules]    = useState(null)
  const [ironmongeryProducts, setIronmongeryProducts] = useState(null)

  // ── Drawing history (audit trail) ──────────────────────────────────────────
  const [historyEntries,  setHistoryEntries]  = useState(null) // null = not loaded; [] = loaded empty
  const [historyLoading,  setHistoryLoading]  = useState(false)
  const [historyWarning,  setHistoryWarning]  = useState(null)
  const [historyError,    setHistoryError]    = useState(null)

  // ── Pricing summary (loaded on mount + after save, no keystroke calls) ────
  const [pricingInfo,  setPricingInfo]  = useState(null) // { netPrice, priceFileName }
  const [breakdownOpen, setBreakdownOpen] = useState(false) // Price breakdown dialog
  const [copyDataStatus, setCopyDataStatus] = useState(null) // 'copied' | 'failed' | null

  // ── Undo/Redo ──────────────────────────────────────────────────────────────
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

  // Profile values keyed by short field name (numbers parsed) — the measured
  // sash-weight model needs the profile's glass rebate/tolerance, and the
  // opening layout needs the mullion thickness (thicknessInFrameHollow)
  const profileValueMap = (() => {
    const map = {}
    for (const pv of (profileValues || [])) {
      const key = pv.field_key?.split('.')?.pop() ?? pv.field_key
      const n = Number(pv.default_value)
      map[key] = isNaN(n) ? pv.default_value : n
    }
    return map
  })()

  // ── Derived values (recompute whenever tree changes) ────────────────────────
  // The profile value map sizes a multi-pair frame's openings (mullion
  // thickness from thicknessInFrameHollow — Step AD decision 3)
  const derived  = tree ? computeDerived(tree, profileValueMap) : {}
  const geometry = tree ? computeSashGeometry(tree, derived) : null

  // ── Sash weights (recompute whenever tree changes) ─────────────────────────
  const sashWeights = (() => {
    if (!tree) return null
    // Step AH 3a: EVERY sash in every pair — the summary weight on a
    // 3-opening frame showed only the first pair's total. Display only.
    const result = {}
    const sashes = [...findAll(tree, 'topSashPart'), ...findAll(tree, 'bottomSashPart')]
    try {
      for (const s of sashes) result[s.key] = computeSashWeight(s, tree, {}, profileValueMap)
    } catch { /* weight is optional — don't break the board */ }
    return Object.keys(result).length > 0 ? result : null
  })()

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
  const { guardedNavigate, pending: navPending, confirm: navConfirm, cancel: navCancel } = useUnsavedChangesGuard(dirty, navigate)

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
          .select('id, drawing_number, window_type, job_item_id, default_profile_id')
          .eq('id', Number(drawingId))
          .maybeSingle()
        if (dwgErr) throw dwgErr
        if (dwg) setDrawingMeta(dwg)

        // ── Load lead, job items, and all drawings for navigation ──
        if (dwg?.job_item_id) {
          // Get lead_id from the job_item
          const { data: ji, error: jiErr } = await supabase
            .from('job_items')
            .select('lead_id')
            .eq('id', dwg.job_item_id)
            .maybeSingle()
          if (jiErr) console.error('job_items lookup:', jiErr.message)
          if (ji?.lead_id) {
            setLeadId(ji.lead_id)

            // Load lead number
            const { data: leadRow, error: leadErr } = await supabase
              .from('leads')
              .select('lead_number')
              .eq('id', ji.lead_id)
              .maybeSingle()
            if (leadErr) console.error('lead lookup:', leadErr.message)
            if (leadRow) setLeadNumber(leadRow.lead_number)

            // Load all non-deleted job items for this lead
            const { data: items, error: itemsErr } = await supabase
              .from('job_items')
              .select('*')
              .eq('lead_id', ji.lead_id)
              .is('deleted_at', null)
              .order('sort_order', { ascending: true, nullsFirst: false })
              .order('item_number')
            if (itemsErr) console.error('job_items load:', itemsErr.message)
            setJobItems(items || [])

            // Load all non-deleted drawings for items on this lead
            const itemIds = (items || []).map(i => i.id)
            if (itemIds.length > 0) {
              const { data: dwgs, error: dwgsErr } = await supabase
                .from('drawings')
                .select('id, job_item_id, drawing_number, window_type, deleted_at')
                .in('job_item_id', itemIds)
                .is('deleted_at', null)
                .order('sort_order', { ascending: true, nullsFirst: false })
                .order('drawing_number')
              if (dwgsErr) console.error('drawings load:', dwgsErr.message)
              setAllDrawings(dwgs || [])
            } else {
              setAllDrawings([])
            }
          }
        }

        // Load all reference data in parallel.
        // Step AP: the profile is the DRAWING'S OWN (casement drawings need
        // the casement profile's frame, sash, mullion and direct-glazed
        // defaults); the 'sash' profile is only the fallback for a drawing
        // that has none. Before this, every drawing loaded 'sash', so a
        // casement drawing could not be built.
        const [fDefs, ownProfile, cont] = await Promise.all([
          loadFieldDefinitions(),
          loadProfileById(dwg?.default_profile_id),
          loadContainment(),
        ])
        const profile = ownProfile ?? await loadProfile(FALLBACK_PROFILE_CODE)
        if (!profile) throw new Error(`Profile with code "${FALLBACK_PROFILE_CODE}" not found in default_profiles`)

        const [pVals, rOpts] = await Promise.all([
          loadProfileValues(profile.id),
          loadReferenceOptions(collectCategories(fDefs)),
        ])

        setFieldDefs(fDefs)
        setRefOptions(rOpts)
        setProfileValues(pVals)
        setProfile(profile)
        setContainment(cont)

        // Load field visibility for this profile
        const { data: visRows, error: visErr } = await supabase
          .from('field_visibility')
          .select('field_key, visibility')
          .eq('profile_id', profile.id)
        if (visErr) throw new Error(`Failed to load field visibility: ${visErr.message}`)
        const vMap = {}
        for (const row of (visRows ?? [])) { vMap[row.field_key] = row.visibility }
        setVisibilityMap(vMap)

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

        // Load drawing history
        setHistoryLoading(true)
        const { data: hist, error: histLoadErr } = await loadDrawingHistory(Number(drawingId))
        setHistoryEntries(hist)
        setHistoryError(histLoadErr)
        setHistoryLoading(false)

        // Load pricing summary (latest run — no new pricing call)
        refreshPricingInfo()
      } catch (e) {
        setLoadError(e?.message ?? String(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [drawingId])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh pricing info (latest run — no new pricing call) ─────────────────
  async function refreshPricingInfo() {
    try {
      const runPrices = await loadDrawingRunPrices([Number(drawingId)], supabase)
      const runData = runPrices[String(drawingId)]
      let priceFileName = null
      if (runData?.priceFileId) {
        const { data: pf, error: pfErr } = await supabase
          .from('price_files')
          .select('name')
          .eq('id', runData.priceFileId)
          .maybeSingle()
        if (!pfErr && pf) priceFileName = pf.name
      }
      setPricingInfo({
        netPrice: runData?.sales ?? null,
        priceFileName,
      })
    } catch (e) {
      console.warn('Failed to load pricing info:', e)
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!tree) return
    setSaveStatus('saving'); setSaveError(null); setHistoryWarning(null)
    try {
      const previousTree = savedTreeRef.current
      await saveDrawingParts(Number(drawingId), tree)
      savedTreeRef.current = tree   // new clean baseline
      setDirty(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)

      // Record history (non-blocking — must not fail the save)
      try {
        const changes = previousTree
          // Step BC board 2: labelFor names a coupled set's frames A / B / C
          // in the history, where "Frame" three times over said nothing.
          ? diffTrees(previousTree, tree, {
            fieldDefs, refOptions, partLabels: PART_LABELS,
            labelFor: node => partLabel(node, tree),
          })
          : []
        const event = previousTree ? 'saved' : 'created'
        if (changes.length > 0 || !previousTree) {
          const authUser = (await supabase.auth.getUser()).data?.user
          const { error: histErr } = await insertDrawingHistory({
            drawingId: Number(drawingId),
            userId: authUser?.id ?? null,
            userName: currentUser?.full_name || authUser?.email || null,
            event,
            changes,
            note: (event === 'saved' && boardMode === 'survey') ? 'Survey mode' : null,
          })
          if (histErr) {
            console.warn('History insert failed:', histErr.message)
            setHistoryWarning('Changes saved but history recording failed')
            setTimeout(() => setHistoryWarning(null), 5000)
          } else {
            // Refresh history entries
            const { data: hist, error: histLoadErr } = await loadDrawingHistory(Number(drawingId))
            setHistoryEntries(hist)
            setHistoryError(histLoadErr)
          }
        }
      } catch (histE) {
        console.warn('History recording error:', histE)
        setHistoryWarning('Changes saved but history recording failed')
        setTimeout(() => setHistoryWarning(null), 5000)
      }

      // Refresh pricing summary after save
      refreshPricingInfo()
    } catch (e) {
      setSaveStatus('error')
      setSaveError(e?.message ?? String(e))
    }
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  function handleReset() {
    if (!savedTreeRef.current) return
    undoStack.current = [...undoStack.current.slice(-49), tree]
    redoStack.current = []
    setTree(savedTreeRef.current)
    setDirty(false)
    setResetDialog(false)
  }

  // ── Item / Drawing navigation ──────────────────────────────────────────────
  const currentItemId = drawingMeta?.job_item_id
  const currentItemIdx = jobItems.findIndex(i => i.id === currentItemId)
  const itemDrawings = allDrawings.filter(d => d.job_item_id === currentItemId)
  const currentDrawingIdx = itemDrawings.findIndex(d => d.id === Number(drawingId))

  function navigateToDrawing(id) {
    guardedNavigate(`/drawing-board/${id}`)
  }

  function handlePrevItem() {
    if (currentItemIdx <= 0) return
    const prevItem = jobItems[currentItemIdx - 1]
    const prevItemDrawings = allDrawings.filter(d => d.job_item_id === prevItem.id)
    if (prevItemDrawings.length > 0) navigateToDrawing(prevItemDrawings[0].id)
  }

  function handleNextItem() {
    if (currentItemIdx < 0 || currentItemIdx >= jobItems.length - 1) return
    const nextItem = jobItems[currentItemIdx + 1]
    const nextItemDrawings = allDrawings.filter(d => d.job_item_id === nextItem.id)
    if (nextItemDrawings.length > 0) navigateToDrawing(nextItemDrawings[0].id)
  }

  function handlePrevDrawing() {
    if (currentDrawingIdx <= 0) return
    navigateToDrawing(itemDrawings[currentDrawingIdx - 1].id)
  }

  function handleNextDrawing() {
    if (currentDrawingIdx < 0 || currentDrawingIdx >= itemDrawings.length - 1) return
    navigateToDrawing(itemDrawings[currentDrawingIdx + 1].id)
  }

  // ── Field change handler ──────────────────────────────────────────────────────
  const handleChangeField = useCallback((nodeKey, propertyName, newValue, fieldKey) => {
    if (!tree) return
    let patch = { [propertyName]: newValue }

    // Choosing a horn TYPE also fills in the horn LENGTH, as Integrate does
    // (step-y brief §1): Victorian → 75, no horn → 0, custom → cleared for
    // the user to type. New drawings therefore store the length.
    if (fieldKey === 'sashPairPart.topHornTypeShortName' || fieldKey === 'sashPairPart.bottomHornTypeShortName') {
      const lengthProp = fieldKey.endsWith('topHornTypeShortName') ? 'topHornLength' : 'bottomHornLength'
      const kind = hornKind(newValue)
      patch[lengthProp] = kind === 'custom' ? null : (HORN_TYPE_DEFAULT_LENGTH_MM[kind] ?? null)
    }

    // Changing the sash thickness (or the chamfer angle) on a pair whose
    // bottom rail is chamfered: Integrate re-stores the bottom rail and
    // the sash height so that (bottom rail + whole-mm allowance) and the
    // EXTERNAL sash height stay constant (docs/integrate-benchmarks-
    // thickness.txt, second visit; step-ab brief §3). Both adjusted
    // fields appear in the saved history entry via diffTrees. This runs
    // only on an actual edit — drawings that are not edited are never
    // touched. Step AI moved the arithmetic to sashThickness.js so the
    // 45 mm complete-new rule takes exactly this path.
    let chamferPatches = null
    if (fieldKey === 'sashPairPart.sashThickness' || fieldKey === 'bottomSashPart.chamferedBottomRailAngle') {
      const isThicknessEdit = fieldKey === 'sashPairPart.sashThickness'
      const pairNode = owningPair(tree, nodeKey)
      if (pairNode) {
        chamferPatches = thicknessChangePatches(tree, pairNode.key, isThicknessEdit
          ? { thickness: Number(newValue) }
          : { chamferAngle: Number(newValue ?? 0) })
      }
    }

    // Step AL §2: on a sash replacement the surveyor measured the SASHES,
    // so a change to the jambs, head or cill height — including the spiral
    // jambs an operation change stamps on — keeps the internal (sash) size
    // and recomputes the frame around it. A DELIBERATE DIFFERENCE from
    // Integrate, which keeps the overall frame and grows the sashes
    // (docs/integrate-differences.md difference 3). Read before the change.
    const keepsInternal = JAMB_SIZE_FIELDS.has(fieldKey) || OPERATION_FIELDS.has(fieldKey)
    const internalBefore = keepsInternal ? internalSizeOf(tree) : null

    // Step AR item 2: resizing a CASEMENT frame re-spaces its dividers the
    // way Integrate does — the width re-spaces mullions in their existing
    // proportions (N's 549/549 at 1199 became 749/749 at 1599) while the
    // height leaves transoms alone, so the fanlight keeps its row and the
    // bottom row takes the whole change (drawing 23: 356 kept, 503 -> 1022).
    // This replaces Step AP's "a resize leaves mullions where they are".
  if ((fieldKey === 'assemblyFramePart.width' || fieldKey === 'assemblyFramePart.height') &&
        isCasementDrawing) {
      const axis = fieldKey === 'assemblyFramePart.width' ? 'width' : 'height'
      // Step BC board: THE FRAME BEING EDITED. nodeKey is the frame whose
      // panel the surveyor typed into; this resized the first frame of the
      // drawing, so on a coupled set the wrong frame changed and the panel
      // went on showing the selected frame's own unchanged size.
      const { tree: resized } = resizeCasementFrame(tree, { [axis]: Number(newValue) }, nodeKey)
      commit(resized)
      return
    }

    let newTree = updateNodeValues(tree, nodeKey, patch)
    if (chamferPatches) newTree = applyPatches(newTree, chamferPatches)

    // If an operation field changed, apply frame/cill defaults as ONE step
    if (OPERATION_FIELDS.has(fieldKey)) {
      newTree = applyOperationDefaults(newTree, profileValues, refOptions)
    }

    if (internalBefore) newTree = keepInternalSize(newTree, internalBefore)

    // Step AI 1b: choosing "Complete New" makes it a complete new sash
    // window, which is ALWAYS 45 mm (Nathan, 9 Oct 2026). Setting it here
    // uses the same thicknessChangePatches path as a hand edit, so the
    // bottom rails and frame height shift identically and every changed
    // value appears in the drawing's history on save.
    // Step AJ 1: the type of work also owns the sashes' To Be Replaced —
    // a sash replacement always replaces both sashes.
    if (fieldKey === 'drawingItemPart.typeOfWork') {
      newTree = applyCompleteNewThickness(newTree).tree
      newTree = applySashesReplaced(newTree).tree
      // Step AM: "Cill Replacement Only" IS a new cill; and where a cill
      // repair is not offered (complete new, no work) a stored one is
      // cleared rather than left priced.
      newTree = applyCillRules(newTree).tree
    }

    commit(newTree)
  }, [tree, profileValues, refOptions])  // eslint-disable-line react-hooks/exhaustive-deps

  // Step AI 1c: "Set to 45 mm" beside the read-only thickness field on a
  // complete-new sash window saved at another thickness. Same path as a
  // hand edit (thicknessChangePatches), so the bottom rails and the frame
  // height shift the same way and the change is in the history on save.
  const handleSetCompleteNewThickness = useCallback(() => {
    if (!tree) return
    const { tree: newTree, pairsChanged } = applyCompleteNewThickness(tree)
    if (pairsChanged.length > 0) commit(newTree)
  }, [tree])  // eslint-disable-line react-hooks/exhaustive-deps

  // Step AJ 1: "Set sashes to match type of work" beside the read-only To
  // Be Replaced toggle, for a saved drawing whose sashes disagree with its
  // type of work. Same single path as the type-of-work change; nothing is
  // changed on load.
  const handleSetSashesReplaced = useCallback(() => {
    if (!tree) return
    const { tree: newTree, sashesChanged } = applySashesReplaced(tree)
    if (sashesChanged.length > 0) commit(newTree)
  }, [tree])  // eslint-disable-line react-hooks/exhaustive-deps

  // Step AP: change the selected opening's kind, or a casement sash's
  // operation. Both go through casementOpenings.js, the same module the
  // templates are built with, so the board and a template agree.
  const handleChangeOpeningKind = useCallback((kind) => {
    if (!tree || !selectedKey) return
    // Step AR item 3: the RAW default_profile_values rows, not
    // profileValueMap. The map is keyed by the short property name alone, so
    // every part type shares one namespace — asking it for
    // casementSashPart.bottomHeight returned the FRAME's bottomHeight. The
    // raw rows are matched on the full field_key.
    // Step BB: a SINGLE door is a door part, so it is built in
    // doorOpenings.js — casementOpenings.js knows nothing about doors and
    // the dispatch belongs here rather than a circular import.
    const { tree: next, changed } = kind === 'single_door'
      ? changeOpeningToSingleDoor(tree, selectedKey, profileValues)
      : changeOpening(tree, selectedKey, kind, profileValues)
    if (!changed) return
    // The replacement is a new node, so move the selection to it —
    // Step BC board: in the frame the opening was in, not the first.
    const frameKey = actionFrameKey(tree, selectedKey)
    const idx = (findNodeByKey(tree, frameKey)?.children ?? [])
      .findIndex(c => c.key === selectedKey)
    const replacement = (findNodeByKey(next, frameKey)?.children ?? [])[idx]
    commit(next)
    if (replacement) setSelectedKey(replacement.key)
  }, [tree, selectedKey, profileValues])  // eslint-disable-line react-hooks/exhaustive-deps

  // Step AU: stormproof is a WHOLE-WINDOW choice (Nathan, 13 Oct — a
  // stormproof window is stormproof throughout), which is also Integrate's
  // "Sash Type -> Storm Proof -> Set for all casement sashes". A conversion
  // the profile cannot supply changes nothing and says what is missing,
  // rather than converting the window to a frame of nulls.
  const handleSetStormproof = useCallback((on) => {
    if (!tree) return
    const { tree: next, changed, missing } = setStormproof(tree, on, profileValues, refOptions)
    if (missing.length > 0) {
      setStormproofError(
        'The drawing’s profile has no stormproof sections yet, so nothing was changed. ' +
        'Run sql/step-au1-stormproof.sql. Missing: ' + missing.join('; '))
      return
    }
    setStormproofError(null)
    if (changed.length > 0) commit(next)
  }, [tree, profileValues, refOptions])  // eslint-disable-line react-hooks/exhaustive-deps

  // Step BD item 2: the leaf’s panel layout, and one cell’s kind.
  const handleSetLeafGrid = useCallback((leafKey, layout) => {
    if (!tree) return
    commit(setLeafGrid(tree, leafKey, layout, profileValues ?? {}))
  }, [tree, profileValues])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetLeafCellKind = useCallback((cellKey, kind) => {
    if (!tree) return
    commit(setLeafCellKind(tree, cellKey, kind, profileValues ?? {}))
  }, [tree, profileValues])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetCasementOperation = useCallback((operation) => {
    if (!tree || !selectedKey) return
    const { tree: next, changed } = setCasementOperation(tree, selectedKey, operation)
    if (changed) commit(next)
  }, [tree, selectedKey])  // eslint-disable-line react-hooks/exhaustive-deps

  // Step AL §1: typing the pair's Internal Width / Height sets the frame —
  // overall = internal + jambs (width) / + head + cill height (height), as
  // Integrate does. The frame stays the stored source of truth, so the
  // change reaches history through the normal save diff.
  const handleChangeInternalSize = useCallback((axis, value) => {
    if (!tree) return
    commit(frameFromInternalSize(tree, { [axis]: value }))
  }, [tree])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-apply defaults (e.g. default ironmongery on load) without marking dirty.
  // Updates both the tree and the saved baseline so isDirtyVsSaved stays false.
  const handleAutoApplyDefaults = useCallback((nodeKey, propertyName, newValue) => {
    if (!tree) return
    const newTree = updateNodeValues(tree, nodeKey, { [propertyName]: newValue })
    savedTreeRef.current = newTree
    setTree(newTree)
    setDirty(false)
  }, [tree])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selection / prev-next (part navigation) ─────────────────────────────────
  const siblingsOfType = selectedNode ? findAll(tree, selectedNode.part_type) : []
  const siblingIdx = siblingsOfType.findIndex(n => n.key === selectedKey)
  const prevDisabled = siblingIdx <= 0
  const nextDisabled = siblingIdx >= siblingsOfType.length - 1
  const prevPartLabel = !prevDisabled ? partLabel(siblingsOfType[siblingIdx - 1]) : null
  const nextPartLabel = !nextDisabled ? partLabel(siblingsOfType[siblingIdx + 1]) : null

  function handlePrev() {
    if (!prevDisabled) setSelectedKey(siblingsOfType[siblingIdx - 1].key)
  }
  function handleNext() {
    if (!nextDisabled) setSelectedKey(siblingsOfType[siblingIdx + 1].key)
  }

  // ── Dividers / bars / remove handlers ────────────────────────────────────────

  const [dividerConfirmPending, setDividerConfirmPending] = useState(null) // { cols, rows }
  const [dividerError, setDividerError] = useState(null) // Step AE: e.g. missing thicknessInFrameHollow

  // Step AQ item 7: the grid the frame is already on, so the picker opens
  // showing it instead of "1 × 1 — 0 mullions" on a frame with a mullion.
  // Step BC board: the SELECTED frame's grid, on a coupled set.
  const currentFrameGrid = frameGrid(tree, actionFrameKey(tree, selectedKey))

  function handleApplyDividers(cols, rows) {
    if (!tree) return
    // Step BC board: the frame the selection is in, and ITS OWN divider
    // counts. findAll over the whole tree counted every frame's dividers,
    // so on a coupled set the picker thought a 1 x 1 pick was shrinking a
    // frame that already had none.
    const frame = findNodeByKey(tree, actionFrameKey(tree, selectedKey))
    if (!frame) return

    const own = type => (frame.children ?? []).filter(c => c.part_type === type).length
    const currentCols = own('mullionPart') + 1
    const currentRows = own('transomPart') + 1
    const shrinkingToSingle = cols === 1 && rows === 1 && (currentCols > 1 || currentRows > 1)
    if (shrinkingToSingle) {
      setDividerConfirmPending({ cols, rows })
      return
    }

    applyDividersNow(cols, rows, frame)
  }

  function applyDividersNow(cols, rows, frameOverride) {
    const frame = frameOverride ||
      findNodeByKey(tree, actionFrameKey(tree, selectedKey))
    if (!frame) return
    const fv = frame.values ?? {}
    // Step BC board: the frame's OWN cill, not the drawing's first.
    const cillH = (frame.children ?? []).find(c => c.part_type === 'cillPart')?.values?.height
      ?? findFirst(tree, 'cillPart')?.values?.height ?? 0
    // The WHOLE interior, from the frame values — since Step AD a pair's
    // derived internalWidth is its own OPENING, not the interior, so it
    // must not be used here (re-gridding a 2-opening frame would otherwise
    // lay the new grid out inside one opening).
    const iW = (fv.width  ?? 0) - (fv.leftWidth ?? 0) - (fv.rightWidth ?? 0)
    const iH = (fv.height ?? 0) - (fv.topHeight ?? 0) - cillH
    try {
      // Step AE item 1: a box sash mullion is hollow — thickness from the
      // profile value thicknessInFrameHollow; missing = visible error.
      // Step AP: which mullion the drawing's PROFILE uses — a casement
      // frame's is solid (thicknessInFrameSolid), a box sash frame's is
      // hollow. Decided from the drawing, not guessed from the tree.
      const mullionKind = isCasementFrameTree(tree) ? 'solid' : 'hollow'
      let newTree = applyDividers(tree, frame.key, cols, rows, iW, iH, profileValueMap, mullionKind)
      // Step AS item 3: the picker MOVES sashes between positions, so the
      // sash that lands in the top row becomes a fanlight (62 mm bottom
      // rail) and an old fanlight that loses its transom becomes ordinary
      // again (83). A rail the surveyor typed is never touched. The raw
      // profile rows, not profileValueMap — see Step AR item 3.
      if (mullionKind === 'solid') {
        newTree = applyFanlightBottomRails(newTree, profileValues).tree
      }
      setDividerError(null)
      commit(newTree)
      setDividerDialog(false)
    } catch (e) {
      setDividerError(e?.message ?? String(e))
    }
  }

  // Step AW: the palette's "1x2" and "2x1" tiles when an OPENING is selected
  // — split that opening, the new divider stopping at whatever bounds it. It
  // goes in the middle; the surveyor then types the exact Offset on the part.
  function handleSplitPick(cols, rows) {
    if (!tree || !splitTarget) return
    // Step BC board: the frame that holds the opening being split.
    const frame = findNodeByKey(tree, actionFrameKey(tree, splitTarget.key))
    if (!frame) return
    // "1x2" is one column and two rows, so it is a transom; "2x1" a mullion.
    const axis = rows > cols ? 'transom' : 'mullion'
    try {
      let newTree = splitOpening(tree, frame.key, splitTarget.key, axis, profileValueMap)
      // A new top-row opening is a fanlight and takes the fanlight bottom
      // rail, as the whole-frame palette's does. The raw profile rows, not
      // profileValueMap — see Step AR item 3.
      newTree = applyFanlightBottomRails(newTree, profileValues).tree
      setDividerError(null)
      commit(newTree)
      setDividerDialog(false)
    } catch (e) {
      setDividerError(e?.message ?? String(e))
    }
  }

  // Step AX: which leaf of a French pair carries the lock.
  function handleSetFrenchMasterLeaf(pairKey, side) {
    if (!tree) return
    const next = setFrenchMasterLeaf(tree, pairKey, side)
    if (next.changed) commit(next.tree)
  }

  // Step BA: a panelled door leaf. One action does the three things a
  // surveyor does to it — give the leaf a mid rail and a panel, move the
  // rail, or take both away (offset null). The rail’s position is
  // computed from the PANEL height, which is what a surveyor is thinking in:
  // Integrate stores the glass above instead.
  function handleSetLeafMidRail(leafKey, panelHeight) {
    if (!tree) return
    if (panelHeight == null) { commit(setLeafMidRail(tree, leafKey, { offset: null })); return }
    const leaf = findNodeByKey(tree, leafKey)
    if (!leaf) return
    const size = doorLeafSize(tree, leaf)
    const offset = leafMidRailOffsetFor(size.height, {
      head: leaf.values?.topHeight, bottomRail: leaf.values?.bottomHeight, panelHeight,
    })
    if (!(offset > 0)) return
    commit(setLeafMidRail(tree, leafKey, { offset }))
  }

  // ── Step BC board: flag frames ────────────────────────────────────────
  //
  // Integrate calls these "Copy selected frame to left / right"; what Nathan
  // sells beside a door is a FLAG light, so the board adds one of those
  // rather than a copy. A one-frame drawing becomes a coupled set the first
  // time a flag is added, and comes back out of the container when the last
  // flag is removed.
  function handleAddFlagFrame(side) {
    if (!tree) return
    const frameKey = actionFrameKey(tree, selectedKey)
    if (!frameKey) return
    const { tree: next, changed, missing } = addFlagFrame(tree, frameKey, side, profileValues)
    if (!changed) {
      setDividerError(missing?.length
        ? `The profile is missing ${missing.join(', ')} — no flag frame was added.`
        : 'No flag frame was added.')
      return
    }
    setDividerError(null)
    commit(next)
  }

  function handleRemoveFrame() {
    if (!tree) return
    const frameKey = actionFrameKey(tree, selectedKey)
    if (!frameKey) return
    const { tree: next, changed, reason } = removeFrame(tree, frameKey)
    if (!changed) {
      setDividerError(reason ? `That frame cannot be removed: it is ${reason}.` : 'That frame cannot be removed.')
      return
    }
    setDividerError(null)
    setSelectedKey(null)
    commit(next)
  }

  // Step AW: Integrate's "Divider Spacing" on an opening's panel.
  function handleMakeDividersEqual(axis) {
    if (!tree) return
    // Step BC board: the selected frame's own dividers.
    const frameKey = actionFrameKey(tree, selectedKey)
    if (!frameKey) return
    commit(makeDividersEqual(tree, frameKey, axis))
  }

  function handleDividerConfirm() {
    if (dividerConfirmPending) {
      applyDividersNow(dividerConfirmPending.cols, dividerConfirmPending.rows)
      setDividerConfirmPending(null)
    }
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
    // Step AW: removing a casement DIVIDER merges the openings it separated
    // and re-points any divider that stopped at it (Step AV's removeDivider).
    // Dropping the node alone would leave one opening per old slot and a
    // divider pointing at one that had gone. A glazing bar is still a plain
    // node removal, and so is a box sash divider, whose openings are its
    // sash pairs rather than frame cells.
    const isCasementDivider = isCasementFrameTree(tree) &&
      (node.part_type === 'mullionPart' || node.part_type === 'transomPart')
    // Step BC board: the divider's OWN frame, so removing a divider from
      // the third frame of a set does not re-point the first frame's.
    const frameKey = actionFrameKey(tree, selectedKey)
    const newTree = isCasementDivider && frameKey
      ? removeDivider(tree, frameKey, selectedKey)
      : removeNode(tree, selectedKey)
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
      // Step AE item 2: a template must never carry a glass NAME — it
      // saved, but tell its author visibly (pricing shows "Glass code not
      // found" later; this is the earlier, named warning).
      const glassWarnings = templateGlassNameWarnings(tree, templateForm.name.trim())
      if (glassWarnings.length > 0) {
        setTemplateError(`Template saved, BUT: ${glassWarnings.join(' | ')}`)
      } else {
        setTemplateDialog(false)
      }
    } catch (e) {
      setTemplateError(e?.message ?? String(e))
    }
    setTemplateSaving(false)
  }

  // Determine what the selected node is so the toolbar can show relevant buttons
  const selType     = selectedNode?.part_type ?? null
  const canRemove   = ['mullionPart', 'transomPart', 'verticalGlazingBarPart', 'horizontalGlazingBarPart'].includes(selType)
  const canAddBars  = selType === 'glassPart'

  // Step AP: casement / direct glazed openings. An opening is a
  // casementSashPart or a glassPart that is a direct child of the frame;
  // "Change to" swaps its kind in place and the operation buttons set a
  // casement sash's operation.
  const isCasementDrawing = tree ? isCasementFrameTree(tree) : false
  // Step BC board: the flag-frame buttons belong to a DOOR drawing — nothing
  // else in GlazePro is sold with flag lights — and they act on the frame the
  // selection is in, which is what their label says.
  const isDoorDrawing = tree ? isDoorTree(tree) : false
  const selectedFrameNode = tree ? findNodeByKey(tree, actionFrameKey(tree, selectedKey)) : null
  const selectedFrameLabel = selectedFrameNode ? partLabel(selectedFrameNode, tree) : 'Frame'
  // removeFrame refuses the door's frame and the last frame; the button says
  // so rather than failing when pressed.
  const canRemoveFrame = !!(tree && selectedFrameNode &&
    removeFrame(tree, selectedFrameNode.key).changed)
  // Step BC board 2: the opening in the selection's OWN frame. Asking the
  // first frame meant selecting Fanlight B1 — or anything outside frame A —
  // showed no "change to:" bar and no operation buttons at all.
  const selectedOperations = selectedNode ? operationsFor(selectedNode) : []
  const selectedOpeningKind = isCasementDrawing && selectedNode
    ? (openingOf(tree, selectedNode)?.key === selectedNode.key
      ? openingKindOf(selectedNode) : null)
    : null
  // Step AV: the label is the opening's CELL — with a spanning opening its
  // place in the list is not its cell (TC1's are A1, A2, B2).
  const selectedOpeningLabel = selectedOpeningKind
    ? openingMatrixIndex(tree, selectedNode)
    : null

  // Step AW: the opening the palette would SPLIT. Integrate offers its two
  // tiles when an opening's GLAZING is selected, and on this board the glass
  // of a casement sash is a child of the sash, so the selection is taken up
  // to the opening it belongs to — clicking the glass and clicking the sash
  // both split the same opening. Only a casement frame's dividers can stop
  // at each other, so a box sash always gets the whole-frame palette.
  // Step BC board 2: openingOf resolves the opening in the selection's own
  // frame, so the palette splits the opening the surveyor clicked rather
  // than nothing at all on any frame but the first.
  const splitTarget = (() => {
    if (!isCasementDrawing || !selectedNode) return null
    return openingOf(tree, selectedNode)
  })()

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

  // ── Helper function for item label in switch-drawing dropdown ──────────────
  function itemDisplayLabel(item) {
    return [item.floor_level, item.elevation, item.room_name].filter(Boolean).join(' \u00B7 ') || `Item ${item.item_number}`
  }

  const tbBtn = (active) => ({
    fontSize: 11, padding: '3px 10px', border: `1px solid ${active ? '#3d35a8' : '#d8d5cf'}`,
    borderRadius: 6, background: active ? '#f0eefc' : '#fff',
    color: active ? '#3d35a8' : '#555', cursor: 'pointer', fontFamily: 'inherit',
    fontWeight: active ? 600 : 400, textDecoration: 'none', whiteSpace: 'nowrap',
  })
  const tbSep = { width: 1, height: 20, background: '#e8e6e0', flexShrink: 0, margin: '0 2px' }
  const navBtn = (disabled) => ({
    fontSize: 12, padding: '2px 6px', border: '1px solid #d8d5cf', borderRadius: 5,
    background: '#fff', cursor: disabled ? 'default' : 'pointer',
    color: disabled ? '#ccc' : '#555', fontFamily: 'inherit',
  })

  // Drawing sub-bar: lead link, Overview, Matrix, Photos, Item nav, Drawing nav, Switch, Undo/Redo/Reset/Save
  const drawingSubBar = (
    <div style={{ height: 40, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6, flexShrink: 0, overflowX: 'auto' }}>
      {/* Lead number link */}
      {leadId && leadNumber && (
        <button onClick={() => guardedNavigate(`/leads/${leadId}`)} style={{ ...tbBtn(false), fontWeight: 600, color: '#3d35a8' }}>
          {leadNumber}
        </button>
      )}

      {/* Overview & Matrix links */}
      {leadId && (
        <>
          <button onClick={() => guardedNavigate(`/leads/${leadId}`)} style={tbBtn(false)}>Overview</button>
          <button onClick={() => guardedNavigate(`/leads/${leadId}/quotes`)} style={tbBtn(false)}>Matrix</button>
        </>
      )}

      {/* Photos */}
      {leadId && (
        <button onClick={() => setPhotosOpen(o => !o)} style={tbBtn(photosOpen)}>Photos</button>
      )}

      <div style={tbSep} />

      {/* Item navigation */}
      {jobItems.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          <button onClick={handlePrevItem} disabled={currentItemIdx <= 0} style={navBtn(currentItemIdx <= 0)}>{'\u2039'}</button>
          <span style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap' }}>
            Item {currentItemIdx >= 0 ? currentItemIdx + 1 : '?'} of {jobItems.length}
          </span>
          <button onClick={handleNextItem} disabled={currentItemIdx < 0 || currentItemIdx >= jobItems.length - 1} style={navBtn(currentItemIdx < 0 || currentItemIdx >= jobItems.length - 1)}>{'\u203A'}</button>
        </div>
      )}

      {/* Drawing navigation (within item) */}
      {itemDrawings.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          <button onClick={handlePrevDrawing} disabled={currentDrawingIdx <= 0} style={navBtn(currentDrawingIdx <= 0)}>{'\u2039'}</button>
          <span style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap' }}>
            Drawing {currentDrawingIdx >= 0 ? currentDrawingIdx + 1 : '?'} of {itemDrawings.length}
          </span>
          <button onClick={handleNextDrawing} disabled={currentDrawingIdx < 0 || currentDrawingIdx >= itemDrawings.length - 1} style={navBtn(currentDrawingIdx < 0 || currentDrawingIdx >= itemDrawings.length - 1)}>{'\u203A'}</button>
        </div>
      )}

      {/* Switch drawing dropdown */}
      {allDrawings.length > 1 && (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setSwitchDrawingOpen(o => !o)} style={tbBtn(switchDrawingOpen)}>
            Switch drawing {switchDrawingOpen ? '\u25B4' : '\u25BE'}
          </button>
          {switchDrawingOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 5000,
              background: '#fff', border: '1px solid #d8d5cf', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)',
              minWidth: 240, maxHeight: 320, overflowY: 'auto', padding: '6px 0',
            }}>
              {jobItems.map(item => {
                const itemDwgs = allDrawings.filter(d => d.job_item_id === item.id)
                if (itemDwgs.length === 0) return null
                return (
                  <div key={item.id}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', padding: '6px 12px 2px' }}>
                      Item {item.item_number}{[item.floor_level, item.elevation, item.room_name].filter(Boolean).length > 0 ? ` \u2014 ${[item.floor_level, item.elevation, item.room_name].filter(Boolean).join(' \u00B7 ')}` : ''}
                    </div>
                    {itemDwgs.map(d => (
                      <button
                        key={d.id}
                        onClick={() => { setSwitchDrawingOpen(false); navigateToDrawing(d.id) }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left', padding: '5px 12px 5px 20px',
                          fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                          background: d.id === Number(drawingId) ? '#f0eefc' : '#fff',
                          color: d.id === Number(drawingId) ? '#3d35a8' : '#333',
                          fontWeight: d.id === Number(drawingId) ? 600 : 400,
                        }}
                      >
                        Drawing {d.drawing_number}{d.window_type ? ` — ${d.window_type}` : ''}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Mode switch / label */}
      <div style={tbSep} />
      {(() => {
        const userMode = currentUser?.drawing_board_mode || 'switch'
        if (userMode === 'sales') {
          return <span style={{ fontSize: 11, color: '#555', fontWeight: 500, whiteSpace: 'nowrap' }}>Sales mode</span>
        }
        if (userMode === 'survey') {
          return <span style={{ fontSize: 11, color: '#555', fontWeight: 500, whiteSpace: 'nowrap' }}>Survey mode</span>
        }
        // switch — two-way toggle
        return (
          <div style={{ display: 'flex', gap: 0, flexShrink: 0 }}>
            {['sales', 'survey'].map(m => (
              <button
                key={m}
                onClick={() => {
                  setBoardMode(m)
                  try { localStorage.setItem('glazepro_board_mode', m) } catch { /* ignore */ }
                }}
                style={{
                  fontSize: 11, padding: '3px 10px', border: '1px solid #d8d5cf',
                  borderRadius: m === 'sales' ? '6px 0 0 6px' : '0 6px 6px 0',
                  background: boardMode === m ? '#f0eefc' : '#fff',
                  color: boardMode === m ? '#3d35a8' : '#555',
                  fontWeight: boardMode === m ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                  marginLeft: m === 'survey' ? -1 : 0,
                }}
              >
                {m === 'sales' ? 'Sales' : 'Survey'}
              </button>
            ))}
          </div>
        )
      })()}
      {/* Show hidden fields — available to any user who can switch modes */}
      {currentUser?.drawing_board_mode === 'switch' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 4 }}>
          <input type="checkbox" checked={showHidden} onChange={e => setShowHidden(e.target.checked)} />
          Show hidden
        </label>
      )}
      {/* Copy drawing data — the SAVED parts tree as JSON, for capturing real
          trees (switch-mode users only) */}
      {currentUser?.drawing_board_mode === 'switch' && (
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(JSON.stringify(savedTreeRef.current, null, 2))
              setCopyDataStatus('copied')
            } catch (e) {
              console.error('Copy drawing data failed:', e)
              setCopyDataStatus('failed')
            }
            setTimeout(() => setCopyDataStatus(null), 2500)
          }}
          title="Copy the saved parts tree (as last saved — not unsaved edits) to the clipboard as JSON"
          style={tbBtn(false)}
        >
          {copyDataStatus === 'copied' ? 'Copied ✓' : copyDataStatus === 'failed' ? 'Copy failed' : 'Copy drawing data'}
        </button>
      )}

      <div style={{ flex: 1 }} />

      {/* Status */}
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

      {/* Undo / Redo / Reset / Save */}
      <button onClick={undo} disabled={!undoStack.current.length} title="Undo (Ctrl+Z)" style={{ ...navBtn(!undoStack.current.length), fontSize: 11, padding: '3px 8px' }}>
        Undo
      </button>
      <button onClick={redo} disabled={!redoStack.current.length} title="Redo (Ctrl+Y)" style={{ ...navBtn(!redoStack.current.length), fontSize: 11, padding: '3px 8px' }}>
        Redo
      </button>
      <button
        onClick={() => setResetDialog(true)}
        disabled={!dirty}
        title="Reset to last saved state"
        style={{ ...navBtn(!dirty), fontSize: 11, padding: '3px 8px' }}
      >
        Reset
      </button>
      <button
        onClick={handleSave}
        disabled={!dirty || saveStatus === 'saving' || loading}
        style={{
          fontSize: 11, padding: '3px 12px', border: 'none', borderRadius: 6, fontWeight: 600,
          background: !dirty || saveStatus === 'saving' || loading ? '#c4c0e8' : '#3d35a8',
          color: '#fff', cursor: !dirty || saveStatus === 'saving' || loading ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {saveStatus === 'saving' ? 'Saving...' : 'Save'}
      </button>
      <button
        onClick={openTemplateDialog}
        disabled={!tree || loading}
        title="Save as template"
        style={{ fontSize: 11, padding: '3px 8px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', color: !tree || loading ? '#ccc' : '#555', cursor: !tree || loading ? 'default' : 'pointer', fontFamily: 'inherit' }}
      >
        Template
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
              prevLabel={prevPartLabel}
              nextLabel={nextPartLabel}
              visibilityMap={visibilityMap}
              boardMode={boardMode}
              showHidden={showHidden}
              tree={tree}
              ironmongeryRules={ironmongeryRules}
              ironmongeryProducts={ironmongeryProducts}
              onShowPriceBreakdown={() => setBreakdownOpen(true)}
              profileValueMap={profileValueMap}
              onSetCompleteNewThickness={handleSetCompleteNewThickness}
              onSetSashesReplaced={handleSetSashesReplaced}
              onChangeInternalSize={handleChangeInternalSize}
              onMakeDividersEqual={handleMakeDividersEqual}
              onSetFrenchMasterLeaf={handleSetFrenchMasterLeaf}
              onSetLeafMidRail={handleSetLeafMidRail}
              onSetLeafGrid={handleSetLeafGrid}
              onSetLeafCellKind={handleSetLeafCellKind}
              profileCode={profile?.code ?? null}
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

              {/* Step AP: Change to / operation, for a selected opening on a
                  casement or direct glazed frame (Integrate's "Change..."
                  list and its operation buttons) */}
              {selectedOpeningKind && (
                <>
                  <div style={{ width: 1, height: 20, background: '#e8e6e0', flexShrink: 0, margin: '0 2px' }} />
                  <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>
                    {selectedOpeningLabel} change to:
                  </span>
                  {openingKindsFor(tree).map(kind => (
                    <button
                      key={kind}
                      onClick={() => handleChangeOpeningKind(kind)}
                      disabled={kind === selectedOpeningKind}
                      title={OPENING_KIND_LABELS[kind]}
                      style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 6, flexShrink: 0,
                        cursor: kind === selectedOpeningKind ? 'default' : 'pointer',
                        border: `1px solid ${kind === selectedOpeningKind ? '#3d35a8' : '#d8d5cf'}`,
                        background: kind === selectedOpeningKind ? '#f0eefc' : '#fff',
                        color: kind === selectedOpeningKind ? '#3d35a8' : '#555',
                      }}
                    >
                      {OPENING_KIND_LABELS[kind]}
                    </button>
                  ))}
                  {/* Step BC board 3: the operations THIS part can take. The
                      bar drew Integrate's casement five on everything, so a
                      single garden door was offered top hung and bottom hung
                      — and because setCasementOperation did not know a door
                      leaf, none of the five did anything at all. */}
                  {selectedOperations.length > 0 && (
                    <>
                      <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>operation:</span>
                      {selectedOperations.map(op => {
                        const active = selectedNode?.values?.operation === op
                        return (
                          <button
                            key={op}
                            onClick={() => handleSetCasementOperation(op)}
                            style={{
                              fontSize: 11, padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                              cursor: active ? 'default' : 'pointer',
                              border: `1px solid ${active ? '#3d35a8' : '#d8d5cf'}`,
                              background: active ? '#f0eefc' : '#fff',
                              color: active ? '#3d35a8' : '#555',
                            }}
                          >
                            {op.replace(/_/g, ' ').replace('hand hung', 'hung')}
                          </button>
                        )
                      })}
                    </>
                  )}
                  <div style={{ width: 1, height: 20, background: '#e8e6e0', flexShrink: 0, margin: '0 2px' }} />
                </>
              )}

              {/* Step AU: stormproof, for the WHOLE window. Not beside the
                  per-opening buttons above, because it is not a per-opening
                  choice: a stormproof window is stormproof throughout. */}
              {isCasementDrawing && (
                <>
                  <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>sash type:</span>
                  {[['Flush', false], ['Stormproof', true]].map(([label, on]) => {
                    const active = isStormproofWindow(tree) === on
                    return (
                      <button
                        key={label}
                        onClick={() => handleSetStormproof(on)}
                        disabled={active}
                        title={on
                          ? 'Set the whole window stormproof (frame, cill and every casement sash)'
                          : 'Set the whole window back to flush'}
                        style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 6, flexShrink: 0,
                          cursor: active ? 'default' : 'pointer',
                          border: `1px solid ${active ? '#3d35a8' : '#d8d5cf'}`,
                          background: active ? '#f0eefc' : '#fff',
                          color: active ? '#3d35a8' : '#555',
                        }}
                      >{label}</button>
                    )
                  })}
                  <div style={{ width: 1, height: 20, background: '#e8e6e0', flexShrink: 0, margin: '0 2px' }} />
                </>
              )}

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

              {/* Step BC board: flag frames, in place of the old stub */}
              {isDoorDrawing && (
                <>
                  <div style={{ width: 1, height: 20, background: '#e8e6e0', flexShrink: 0, margin: '0 2px' }} />
                  <span style={{ fontSize: 11, color: '#888', flexShrink: 0 }}>
                    {selectedFrameLabel}:
                  </span>
                  {[['left', '+ Flag left'], ['right', '+ Flag right']].map(([side, label]) => (
                    <button
                      key={side}
                      onClick={() => handleAddFlagFrame(side)}
                      title={`Add a flag frame (693 × 1136, one fixed light) to the ${side} of ${selectedFrameLabel}`}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, flexShrink: 0, cursor: 'pointer', border: '1px solid #d8d5cf', background: '#fff', color: '#555' }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={handleRemoveFrame}
                    disabled={!canRemoveFrame}
                    title={canRemoveFrame
                      ? `Remove ${selectedFrameLabel} from the set`
                      : 'A set keeps its door frame and its last frame'}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, flexShrink: 0, cursor: canRemoveFrame ? 'pointer' : 'default', border: `1px solid ${canRemoveFrame ? '#fca5a5' : '#d8d5cf'}`, background: canRemoveFrame ? '#fef2f2' : '#f7f6f2', color: canRemoveFrame ? '#b91c1c' : '#aaa' }}
                  >
                    Remove frame
                  </button>
                </>
              )}

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

          {/* Photos drawer (between centre and right panels) */}
          {photosOpen && leadId && (
            <PhotosDrawer leadId={leadId} user={user} onClose={() => setPhotosOpen(false)} />
          )}

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
              <div data-testid="parts-tree">
                <ExplorerNode
                  node={tree}
                  selectedKey={selectedKey}
                  onSelect={setSelectedKey}
                  tree={tree}
                />
              </div>
            </div>
            {/* Summary */}
            <Summary
              tree={tree}
              fieldDefs={fieldDefs}
              derived={derived}
              refOptions={refOptions}
              onSelectKey={setSelectedKey}
              drawingMeta={drawingMeta}
              visibilityMap={visibilityMap}
              boardMode={boardMode}
              showHidden={showHidden}
              pricingInfo={pricingInfo}
              sashWeights={sashWeights}
              profile={profile}
            />
            {/* Validation */}
            <ValidationPanel tree={tree} derived={derived} onSelectKey={setSelectedKey}
              profileCode={profile?.code ?? null} />
            {/* History */}
            <HistoryPanel entries={historyEntries} loading={historyLoading} error={historyError} />
            {historyWarning && (
              <div style={{ padding: '4px 14px', fontSize: 11, color: '#b45309', background: '#fffbeb', borderTop: '1px solid #fcd34d' }}>
                {historyWarning}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Step AW: Integrate's Transom / Mullion tile palette */}
      {dividerDialog && (
        <DividerPaletteDialog
          onPick={splitTarget ? handleSplitPick : handleApplyDividers}
          onClose={() => { setDividerError(null); setDividerDialog(false) }}
          error={dividerError}
          // An opening selected: just the two tiles that split it. Only a
          // casement frame's dividers can stop at each other, so a box sash
          // always gets the whole-frame palette.
          tiles={splitTarget ? [[1, 2], [2, 1]] : null}
          current={splitTarget ? null : currentFrameGrid}
          note={splitTarget
            ? `Split ${openingMatrixIndex(tree, splitTarget) ?? 'this opening'} with a transom (1x2) or a mullion (2x1)`
            : (isCasementDrawing
              ? 'Divides the whole frame. A second row adds a transom: the top row is the fanlight'
              : 'Divides the whole frame')}
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

      {/* Divider shrink confirm dialog */}
      {dividerConfirmPending && (
        <ConfirmDialog
          title="Remove dividers"
          message="Going back to 1 x 1 removes the dividers and the extra openings. Continue?"
          confirmLabel="Continue"
          onConfirm={handleDividerConfirm}
          onCancel={() => setDividerConfirmPending(null)}
          danger
        />
      )}

      {/* Reset confirm dialog */}
      {resetDialog && (
        <ConfirmDialog
          title="Reset drawing"
          message="This will discard all unsaved changes and restore the drawing to its last saved state. This cannot be undone."
          confirmLabel="Reset"
          onConfirm={handleReset}
          onCancel={() => setResetDialog(false)}
          danger
        />
      )}

      {/* Unsaved-changes navigation confirm dialog */}
      {navPending && (
        <ConfirmDialog
          title="Unsaved changes"
          message="You have unsaved changes. Leave this drawing without saving?"
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={navConfirm}
          onCancel={navCancel}
          danger
        />
      )}

      {/* Close switch-drawing dropdown on outside click */}
      {switchDrawingOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 4999 }}
          onClick={() => setSwitchDrawingOpen(false)}
        />
      )}

      {/* Price breakdown dialog (latest stored pricing run) */}
      {breakdownOpen && (
        <PriceBreakdown drawingId={Number(drawingId)} onClose={() => setBreakdownOpen(false)} />
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
