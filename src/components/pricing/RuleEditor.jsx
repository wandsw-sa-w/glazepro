import { useState, useEffect, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../supabase'

// ── Loop targets ───────────────────────────────────────────────────────────

const LOOP_TARGETS = [
  'frame',
  'sash',
  'sliding_sash',
  'casement_sash',
  'door_leaf',
  'direct_glazed_unit',
  'panel',
  'ironmongery_part',
  'component',
  'glass_unit',
  'drawing_poa',
]

// ── Variable catalogue ─────────────────────────────────────────────────────

const VARIABLES = [
  // Window type
  { name: 'is_box_sash',              type: 'boolean', group: 'Window Type' },
  { name: 'is_spiral_sash',           type: 'boolean', group: 'Window Type' },
  { name: 'is_flush_casement',        type: 'boolean', group: 'Window Type' },
  { name: 'is_stormproof_casement',   type: 'boolean', group: 'Window Type' },
  { name: 'is_front_door',            type: 'boolean', group: 'Window Type' },
  { name: 'is_single_door',           type: 'boolean', group: 'Window Type' },
  { name: 'is_french_door',           type: 'boolean', group: 'Window Type' },
  { name: 'is_bifolding_door',        type: 'boolean', group: 'Window Type' },
  { name: 'is_sash_window',           type: 'boolean', group: 'Window Type' },
  { name: 'is_casement_window',       type: 'boolean', group: 'Window Type' },
  { name: 'is_door',                  type: 'boolean', group: 'Window Type' },
  // Service type
  { name: 'is_complete_new',            type: 'boolean', group: 'Service Type' },
  { name: 'is_sash_replacement',        type: 'boolean', group: 'Service Type' },
  { name: 'is_sash_replacement_35',     type: 'boolean', group: 'Service Type' },
  { name: 'is_sash_replacement_40',     type: 'boolean', group: 'Service Type' },
  { name: 'is_sash_replacement_45',     type: 'boolean', group: 'Service Type' },
  { name: 'is_sash_replacement_50',     type: 'boolean', group: 'Service Type' },
  { name: 'sash_replacement_thickness', type: 'number',  group: 'Service Type' },
  // Material
  { name: 'is_frame_redwood', type: 'boolean', group: 'Material' },
  { name: 'is_frame_accoya',  type: 'boolean', group: 'Material' },
  { name: 'is_sash_redwood',  type: 'boolean', group: 'Material' },
  { name: 'is_sash_accoya',   type: 'boolean', group: 'Material' },
  { name: 'is_cill_hardwood', type: 'boolean', group: 'Material' },
  { name: 'is_cill_accoya',   type: 'boolean', group: 'Material' },
  // Finish
  { name: 'is_painted',               type: 'boolean', group: 'Finish' },
  { name: 'is_colour_match',          type: 'boolean', group: 'Finish' },
  { name: 'is_internal_clean_white',  type: 'boolean', group: 'Finish' },
  { name: 'is_internal_white_gloss',  type: 'boolean', group: 'Finish' },
  { name: 'is_internal_white_satin',  type: 'boolean', group: 'Finish' },
  { name: 'is_external_clean_white',  type: 'boolean', group: 'Finish' },
  { name: 'is_external_white_gloss',  type: 'boolean', group: 'Finish' },
  { name: 'is_external_white_satin',  type: 'boolean', group: 'Finish' },
  // Dimensions (mm)
  { name: 'frame_width',        type: 'number', group: 'Dimensions' },
  { name: 'frame_height',       type: 'number', group: 'Dimensions' },
  { name: 'sash_width',         type: 'number', group: 'Dimensions' },
  { name: 'sash_height',        type: 'number', group: 'Dimensions' },
  { name: 'top_sash_height',    type: 'number', group: 'Dimensions' },
  { name: 'bottom_sash_height', type: 'number', group: 'Dimensions' },
  { name: 'working_width',      type: 'number', group: 'Dimensions' },
  { name: 'working_height',     type: 'number', group: 'Dimensions' },
  { name: 'frame_width_m',      type: 'number', group: 'Dimensions' },
  { name: 'frame_height_m',     type: 'number', group: 'Dimensions' },
  { name: 'sash_width_m',       type: 'number', group: 'Dimensions' },
  { name: 'frame_perimeter_mm', type: 'number', group: 'Dimensions' },
  // Geometry
  { name: 'frame_area_m2',       type: 'number', group: 'Geometry' },
  { name: 'working_area_m2',     type: 'number', group: 'Geometry' },
  { name: 'sash_area_m2',        type: 'number', group: 'Geometry' },
  { name: 'top_sash_area_m2',    type: 'number', group: 'Geometry' },
  { name: 'bottom_sash_area_m2', type: 'number', group: 'Geometry' },
  // Timber volumes
  { name: 'frame_excl_cill_volume_m3', type: 'number', group: 'Timber Volume' },
  { name: 'cill_volume_m3',            type: 'number', group: 'Timber Volume' },
  { name: 'total_sash_volume_m3',      type: 'number', group: 'Timber Volume' },
  { name: 'bottom_sash_volume_mm3',    type: 'number', group: 'Timber Volume' },
  { name: 'top_sash_volume_mm3',       type: 'number', group: 'Timber Volume' },
  { name: 'accoya_frame_volume_m3',    type: 'number', group: 'Timber Volume' },
  { name: 'redwood_frame_volume_m3',   type: 'number', group: 'Timber Volume' },
  { name: 'accoya_cill_volume_m3',     type: 'number', group: 'Timber Volume' },
  { name: 'hardwood_cill_volume_m3',   type: 'number', group: 'Timber Volume' },
  { name: 'accoya_sash_volume_m3',     type: 'number', group: 'Timber Volume' },
  { name: 'redwood_sash_volume_m3',    type: 'number', group: 'Timber Volume' },
  // Sash operation
  { name: 'is_top_sash_cord_hung',      type: 'boolean', group: 'Sash Operation' },
  { name: 'is_top_sash_spiral_hung',    type: 'boolean', group: 'Sash Operation' },
  { name: 'is_top_sash_fixed',          type: 'boolean', group: 'Sash Operation' },
  { name: 'is_bottom_sash_cord_hung',   type: 'boolean', group: 'Sash Operation' },
  { name: 'is_bottom_sash_spiral_hung', type: 'boolean', group: 'Sash Operation' },
  { name: 'is_bottom_sash_fixed',       type: 'boolean', group: 'Sash Operation' },
  { name: 'has_cord_hung_sash',         type: 'boolean', group: 'Sash Operation' },
  { name: 'has_spiral_hung_sash',       type: 'boolean', group: 'Sash Operation' },
  { name: 'opening_sash_count',         type: 'number',  group: 'Sash Operation' },
  { name: 'fixed_sash_count',           type: 'number',  group: 'Sash Operation' },
  { name: 'total_sash_count',           type: 'number',  group: 'Sash Operation' },
  // Glass
  { name: 'has_glazing_bars',              type: 'boolean', group: 'Glass' },
  { name: 'total_glazing_bar_count',       type: 'number',  group: 'Glass' },
  { name: 'top_sash_glazing_bar_count',    type: 'number',  group: 'Glass' },
  { name: 'bottom_sash_glazing_bar_count', type: 'number',  group: 'Glass' },
  { name: 'top_sash_pane_count',           type: 'number',  group: 'Glass' },
  { name: 'bottom_sash_pane_count',        type: 'number',  group: 'Glass' },
  { name: 'total_pane_count',              type: 'number',  group: 'Glass' },
  { name: 'has_special_glass',             type: 'boolean', group: 'Glass' },
  { name: 'has_sandblasted_glass',         type: 'boolean', group: 'Glass' },
  { name: 'has_antique_cathedral_glass',   type: 'boolean', group: 'Glass' },
  { name: 'has_pilkington_k_glass',        type: 'boolean', group: 'Glass' },
  // Horn
  { name: 'has_victorian_horn', type: 'boolean', group: 'Horn' },
  { name: 'horn_count',         type: 'number',  group: 'Horn' },
  // Floor
  { name: 'is_ground_floor', type: 'boolean', group: 'Floor' },
  { name: 'is_first_floor',  type: 'boolean', group: 'Floor' },
  { name: 'is_second_floor', type: 'boolean', group: 'Floor' },
  { name: 'is_third_floor',  type: 'boolean', group: 'Floor' },
  { name: 'is_basement',     type: 'boolean', group: 'Floor' },
  { name: 'is_loft',         type: 'boolean', group: 'Floor' },
  { name: 'is_upper_floor',  type: 'boolean', group: 'Floor' },
  // Options
  { name: 'has_trickle_vent',      type: 'boolean', group: 'Options' },
  { name: 'needs_draughtproofing', type: 'boolean', group: 'Options' },
  { name: 'is_doc_l',              type: 'boolean', group: 'Options' },
  // Ironmongery
  { name: 'pulley_qty',       type: 'number', group: 'Ironmongery' },
  { name: 'trickle_vent_qty', type: 'number', group: 'Ironmongery' },
  { name: 'ironmongery_cost', type: 'number', group: 'Ironmongery' },
  // Labour pass outputs
  { name: 'total_install_minutes',     type: 'number', group: 'Labour' },
  { name: 'total_manufacture_minutes', type: 'number', group: 'Labour' },
  { name: 'total_parts_cost',          type: 'number', group: 'Labour' },
]

const VARIABLE_GROUPS = [...new Set(VARIABLES.map(v => v.group))]

// ── Blank rule factory ─────────────────────────────────────────────────────

function blankRule(ruleFamily, sortOrder) {
  return {
    id:          null,
    rule_family: ruleFamily,
    level:       ruleFamily === 'price' ? 'item' : null,
    name:        '',
    group_name:  '',
    loop_target: 'frame',
    condition:   'true',
    quantity:    '0',
    value:       ruleFamily === 'price' ? '0' : null,
    markup:      ruleFamily === 'price' ? 0   : null,
    part_code:   ruleFamily === 'parts' ? ''  : null,
    comment:     '',
    output_unit: ruleFamily === 'price' ? 'gbp' : ruleFamily === 'parts' ? 'quantity' : 'minutes',
    is_active:   true,
    sort_order:  sortOrder,
    _unsaved:    true,
  }
}

// ── RuleEditor ─────────────────────────────────────────────────────────────

export default function RuleEditor({ fileId, ruleFamily, readOnly = false }) {
  const [rules,       setRules]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [editingRule, setEditingRule] = useState(null)

  const groupNames = [...new Set(rules.map(r => r.group_name).filter(Boolean))]

  useEffect(() => {
    loadRules()
  }, [fileId, ruleFamily])

  async function loadRules() {
    setLoading(true)
    const { data, error } = await supabase
      .from('price_rules')
      .select('id, rule_family, level, name, group_name, loop_target, condition, quantity, value, markup, part_code, comment, is_active, sort_order, output_unit')
      .eq('price_file_id', fileId)
      .eq('rule_family', ruleFamily)
      .order('sort_order', { ascending: true })
    if (!error) setRules(data || [])
    setLoading(false)
  }

  function addRule() {
    const maxOrder = rules.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0)
    const tempId   = `_new_${Date.now()}`
    const rule     = { ...blankRule(ruleFamily, maxOrder + 10), id: tempId }
    setRules(rs => [...rs, rule])
    setEditingRule(rule)
  }

  async function saveRule(ruleData) {
    const isNew = ruleData._unsaved === true
    const payload = {
      rule_family: ruleFamily,
      level:       ruleData.level,
      name:        ruleData.name,
      group_name:  ruleData.group_name,
      loop_target: ruleData.loop_target,
      condition:   ruleData.condition,
      quantity:    ruleData.quantity,
      value:       ruleData.value,
      markup:      ruleData.markup,
      part_code:   ruleData.part_code,
      comment:     ruleData.comment,
      output_unit: ruleData.output_unit,
      is_active:   ruleData.is_active,
      sort_order:  ruleData.sort_order,
    }

    if (isNew) {
      const { data, error } = await supabase
        .from('price_rules')
        .insert({ ...payload, price_file_id: fileId })
        .select('id')
        .single()
      if (error) { console.error('Insert error:', error); return false }
      setRules(rs => rs.map(r => r.id === ruleData.id ? { ...ruleData, id: data.id, _unsaved: false } : r))
    } else {
      const { error } = await supabase
        .from('price_rules')
        .update(payload)
        .eq('id', ruleData.id)
      if (error) { console.error('Update error:', error); return false }
      setRules(rs => rs.map(r => r.id === ruleData.id ? { ...ruleData } : r))
    }
    return true
  }

  async function deleteRule(rule) {
    if (!rule._unsaved) {
      await supabase.from('price_rules').delete().eq('id', rule.id)
    }
    setRules(rs => rs.filter(r => r.id !== rule.id))
    setEditingRule(null)
  }

  async function toggleActive(rule) {
    const next = !rule.is_active
    setRules(rs => rs.map(r => r.id === rule.id ? { ...r, is_active: next } : r))
    if (!rule._unsaved) {
      await supabase.from('price_rules').update({ is_active: next }).eq('id', rule.id)
    }
  }

  async function moveRule(index, direction) {
    const next = [...rules]
    const swap = index + direction
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    next.forEach((r, i) => { r.sort_order = (i + 1) * 10 })
    setRules(next)
    const updates = next
      .filter(r => r.id && !String(r.id).startsWith('_new_'))
      .map(r => supabase.from('price_rules').update({ sort_order: r.sort_order }).eq('id', r.id))
    await Promise.all(updates)
  }

  function handleCancel(rule) {
    if (rule._unsaved) {
      setRules(rs => rs.filter(r => r.id !== rule.id))
    }
    setEditingRule(null)
  }

  if (loading) {
    return <div style={{ color: '#aaa', fontSize: 13, padding: 24 }}>Loading rules…</div>
  }

  const addBtn = (
    <button
      onClick={addRule}
      style={{ fontSize: 12, padding: '5px 14px', borderRadius: 6, border: '1px dashed #c8c5be', background: 'transparent', color: '#888', cursor: 'pointer' }}
    >
      + Add rule
    </button>
  )

  return (
    <div style={{ fontSize: 13 }}>
      {!readOnly && <div style={{ marginBottom: 12 }}>{addBtn}</div>}

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e8e6e0' }}>
            <th style={{ width: 36, padding: '6px 4px' }} />
            <th style={{ width: 44, padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>On</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Name</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Group</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Loop Target</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Condition</th>
            <th style={{ width: 36, padding: '6px 4px' }} />
            {!readOnly && <th style={{ width: 36, padding: '6px 4px' }} />}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, index) => (
            <tr
              key={rule.id}
              style={{ borderBottom: '1px solid #f0ede8', opacity: rule.is_active ? 1 : 0.45 }}
            >
              <td style={{ padding: '2px 4px', verticalAlign: 'middle' }}>
                {!readOnly && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <button onClick={() => moveRule(index, -1)} disabled={index === 0}            style={arrowBtn}>▲</button>
                    <button onClick={() => moveRule(index,  1)} disabled={index === rules.length - 1} style={arrowBtn}>▼</button>
                  </div>
                )}
              </td>
              <td style={{ padding: '3px 8px', verticalAlign: 'middle' }}>
                <input
                  type="checkbox"
                  checked={!!rule.is_active}
                  disabled={readOnly}
                  onChange={() => toggleActive(rule)}
                  style={{ cursor: readOnly ? 'default' : 'pointer' }}
                />
              </td>
              <td style={{ padding: '3px 8px', verticalAlign: 'middle', color: '#222', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rule.name || <span style={{ color: '#bbb' }}>Unnamed</span>}
              </td>
              <td style={{ padding: '3px 8px', verticalAlign: 'middle', color: '#666', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rule.group_name || '—'}
              </td>
              <td style={{ padding: '3px 8px', verticalAlign: 'middle', color: '#666', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rule.loop_target || '—'}
              </td>
              <td style={{ padding: '3px 8px', verticalAlign: 'middle', maxWidth: 260 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                  {rule.condition ? (rule.condition.length > 60 ? rule.condition.slice(0, 60) + '…' : rule.condition) : '—'}
                </span>
              </td>
              <td style={{ padding: '2px 4px', verticalAlign: 'middle' }}>
                <button
                  onClick={() => setEditingRule(rule)}
                  title="Edit"
                  style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                >
                  ✏
                </button>
              </td>
              {!readOnly && (
                <td style={{ padding: '2px 4px', verticalAlign: 'middle' }}>
                  <button
                    onClick={() => deleteRule(rule)}
                    title="Delete"
                    style={{ fontSize: 15, color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                  >
                    ×
                  </button>
                </td>
              )}
            </tr>
          ))}
          {rules.length === 0 && (
            <tr>
              <td colSpan={8} style={{ padding: '24px 8px', color: '#bbb', textAlign: 'center' }}>
                No rules yet. Add one above.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!readOnly && <div style={{ marginTop: 12 }}>{addBtn}</div>}

      {editingRule && (
        <RuleModal
          rule={editingRule}
          ruleFamily={ruleFamily}
          groupNames={groupNames}
          readOnly={readOnly}
          onSave={async (ruleData) => {
            const ok = await saveRule(ruleData)
            if (ok) setEditingRule(null)
          }}
          onCancel={() => handleCancel(editingRule)}
          onDelete={() => deleteRule(editingRule)}
        />
      )}
    </div>
  )
}

const arrowBtn = {
  fontSize: 9, color: '#bbb', background: 'none', border: 'none',
  cursor: 'pointer', padding: '1px 3px', lineHeight: 1,
}

// ── RuleModal ──────────────────────────────────────────────────────────────

function RuleModal({ rule, ruleFamily, groupNames, readOnly, onSave, onCancel, onDelete }) {
  const [draft,   setDraft]   = useState({ ...rule })
  const [saving,  setSaving]  = useState(false)
  const listId = useId()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  function set(field, value) {
    setDraft(d => ({ ...d, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
  }

  const isPrice    = ruleFamily === 'price'
  const isParts    = ruleFamily === 'parts'
  const isLabour   = ruleFamily === 'install_labour' || ruleFamily === 'manufacture_labour'

  return createPortal(
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 620, maxHeight: '90vh', overflow: 'auto',
          background: '#fff', borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Modal header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>
            {rule._unsaved ? 'New Rule' : 'Edit Rule'}
          </div>
          <button onClick={onCancel} style={{ fontSize: 18, color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        {/* Fields */}
        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Name">
              <input
                type="text"
                value={draft.name ?? ''}
                readOnly={readOnly}
                onChange={e => set('name', e.target.value)}
                style={modalInput}
              />
            </Field>
            <Field label="Group">
              <>
                <datalist id={listId}>
                  {groupNames.map(g => <option key={g} value={g} />)}
                </datalist>
                <input
                  type="text"
                  list={listId}
                  value={draft.group_name ?? ''}
                  readOnly={readOnly}
                  onChange={e => set('group_name', e.target.value)}
                  style={modalInput}
                />
              </>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isPrice ? '1fr 1fr' : '1fr', gap: 14 }}>
            <Field label="Loop Target">
              <select
                value={draft.loop_target ?? 'frame'}
                disabled={readOnly}
                onChange={e => set('loop_target', e.target.value)}
                style={modalSelect}
              >
                {LOOP_TARGETS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            {isPrice && (
              <Field label="Level">
                <select
                  value={draft.level ?? 'item'}
                  disabled={readOnly}
                  onChange={e => set('level', e.target.value)}
                  style={modalSelect}
                >
                  <option value="item">Item</option>
                  <option value="quote">Quote</option>
                </select>
              </Field>
            )}
          </div>

          <Field label="Condition">
            <FormulaEditor
              value={draft.condition ?? ''}
              rows={3}
              readOnly={readOnly}
              onChange={v => set('condition', v)}
            />
          </Field>

          <Field label={isLabour ? 'Minutes' : isParts ? 'Quantity' : 'Quantity'}>
            <FormulaEditor
              value={draft.quantity ?? ''}
              rows={2}
              readOnly={readOnly}
              onChange={v => set('quantity', v)}
            />
          </Field>

          {isPrice && (
            <Field label="Value (£)">
              <FormulaEditor
                value={draft.value ?? ''}
                rows={2}
                readOnly={readOnly}
                onChange={v => set('value', v)}
              />
            </Field>
          )}

          {isPrice && (
            <Field label="Markup %">
              <input
                type="number"
                step="0.01"
                value={draft.markup ?? ''}
                readOnly={readOnly}
                onChange={e => set('markup', e.target.value === '' ? null : parseFloat(e.target.value))}
                style={{ ...modalInput, width: 120 }}
              />
            </Field>
          )}

          {isParts && (
            <Field label="Part Code">
              <input
                type="text"
                value={draft.part_code ?? ''}
                readOnly={readOnly}
                onChange={e => set('part_code', e.target.value)}
                style={modalInput}
              />
            </Field>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 14 }}>
            <Field label="Sort Order">
              <input
                type="number"
                step="1"
                value={draft.sort_order ?? ''}
                readOnly={readOnly}
                onChange={e => set('sort_order', e.target.value === '' ? null : parseInt(e.target.value, 10))}
                style={{ ...modalInput, width: 80 }}
              />
            </Field>
            <Field label="Active">
              <div style={{ paddingTop: 4 }}>
                <input
                  type="checkbox"
                  checked={!!draft.is_active}
                  disabled={readOnly}
                  onChange={e => set('is_active', e.target.checked)}
                  style={{ cursor: readOnly ? 'default' : 'pointer', width: 16, height: 16 }}
                />
              </div>
            </Field>
          </div>

          <Field label="Comment">
            <textarea
              value={draft.comment ?? ''}
              readOnly={readOnly}
              rows={2}
              onChange={e => set('comment', e.target.value)}
              style={{ ...modalInput, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
          </Field>

        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {!readOnly && !rule._unsaved && (
              <button
                onClick={onDelete}
                style={{ fontSize: 13, padding: '6px 14px', borderRadius: 7, border: '1px solid #f5c0c0', background: '#fff', color: '#c0392b', cursor: 'pointer' }}
              >
                Delete
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onCancel}
              style={{ fontSize: 13, padding: '6px 14px', borderRadius: 7, border: '1px solid #e0ddd8', background: '#fff', color: '#555', cursor: 'pointer' }}
            >
              Cancel
            </button>
            {!readOnly && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ fontSize: 13, padding: '6px 16px', borderRadius: 7, border: 'none', background: '#3d35a8', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontWeight: 500 }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

const modalInput = {
  fontSize: 13,
  border: '1px solid #e0ddd8',
  borderRadius: 6,
  padding: '6px 10px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const modalSelect = {
  fontSize: 13,
  border: '1px solid #e0ddd8',
  borderRadius: 6,
  padding: '6px 10px',
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
  cursor: 'pointer',
}

// ── Field ──────────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

// ── FormulaEditor ──────────────────────────────────────────────────────────

function FormulaEditor({ value, rows = 2, readOnly, onChange }) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [popPos,  setPopPos]  = useState({ top: 0, left: 0 })
  const inputRef  = useRef(null)
  const buttonRef = useRef(null)
  const popRef    = useRef(null)

  const filtered = query
    ? VARIABLES.filter(v => v.name.includes(query.toLowerCase()))
    : VARIABLES

  const groups = VARIABLE_GROUPS.filter(g => filtered.some(v => v.group === g))

  function openPicker() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPopPos({ top: rect.bottom + 4, left: rect.left })
    }
    setOpen(o => !o)
    setQuery('')
  }

  function insertVariable(varName) {
    const el = inputRef.current
    if (!el) { onChange((value ?? '') + varName); setOpen(false); return }
    const start = el.selectionStart ?? (value ?? '').length
    const end   = el.selectionEnd   ?? start
    const next  = (value ?? '').slice(0, start) + varName + (value ?? '').slice(end)
    onChange(next)
    setOpen(false)
    setQuery('')
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + varName.length
      el.setSelectionRange(pos, pos)
    })
  }

  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (!popRef.current?.contains(e.target) && e.target !== buttonRef.current) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const popover = open && createPortal(
    <div
      ref={popRef}
      style={{
        position: 'fixed', top: popPos.top, left: popPos.left, zIndex: 9999,
        background: '#fff', border: '1px solid #e0ddd8', borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,.1)',
        width: 280, maxHeight: 340, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #f0ede8' }}>
        <input
          autoFocus
          type="text"
          placeholder="Search variables…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ width: '100%', fontSize: 12, border: '1px solid #ddd', borderRadius: 5, padding: '4px 8px', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {groups.map(group => (
          <div key={group}>
            <div style={{ padding: '5px 8px 2px', fontSize: 10, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>{group}</div>
            {filtered.filter(v => v.group === group).map(v => (
              <div
                key={v.name}
                onMouseDown={e => { e.preventDefault(); insertVariable(v.name) }}
                style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: 12, color: '#222', fontFamily: 'monospace' }}>{v.name}</span>
                <span style={{ fontSize: 10, color: v.type === 'boolean' ? '#6a5acd' : '#2a7a40', marginLeft: 8 }}>{v.type}</span>
              </div>
            ))}
          </div>
        ))}
        {groups.length === 0 && (
          <div style={{ padding: 16, color: '#bbb', fontSize: 12, textAlign: 'center' }}>No matches</div>
        )}
      </div>
    </div>,
    document.body
  )

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
      <textarea
        ref={inputRef}
        rows={rows}
        value={value ?? ''}
        readOnly={readOnly}
        onChange={e => onChange(e.target.value)}
        style={{
          flex: 1,
          fontSize: 12,
          fontFamily: 'monospace',
          border: '1px solid #e0ddd8',
          borderRadius: 6,
          padding: '6px 10px',
          outline: 'none',
          resize: 'vertical',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#c5c0f0' }}
        onBlur={e  => { e.currentTarget.style.borderColor = '#e0ddd8' }}
      />
      {!readOnly && (
        <button
          ref={buttonRef}
          onMouseDown={e => { e.preventDefault(); openPicker() }}
          title="Insert variable"
          style={{ fontSize: 10, padding: '5px 7px', borderRadius: 5, border: '1px solid #ddd', background: '#faf9f7', cursor: 'pointer', color: '#888', flexShrink: 0, lineHeight: 1.2, marginTop: 1 }}
        >
          {'{x}'}
        </button>
      )}
      {popover}
    </div>
  )
}
