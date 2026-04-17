import { useState, useEffect, useRef, Fragment, useId } from 'react'
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

// ── Column config per rule family ──────────────────────────────────────────

const SHARED_TAIL = [
  { key: 'comment',     label: 'Comment', width: 180, type: 'text' },
  { key: 'is_active',   label: 'Active',  width: 60,  type: 'bool' },
]

function getColumns(ruleFamily) {
  if (ruleFamily === 'install_labour' || ruleFamily === 'manufacture_labour') {
    return [
      { key: 'name',        label: 'Name',        width: 160, type: 'text'        },
      { key: 'group_name',  label: 'Group',       width: 130, type: 'group_name'  },
      { key: 'loop_target', label: 'Loop Target', width: 140, type: 'loop_target' },
      { key: 'condition',   label: 'Condition',   width: 220, type: 'formula'     },
      { key: 'quantity',    label: 'Minutes',     width: 160, type: 'formula'     },
      ...SHARED_TAIL,
    ]
  }
  if (ruleFamily === 'parts') {
    return [
      { key: 'name',        label: 'Name',        width: 150, type: 'text'        },
      { key: 'group_name',  label: 'Group',       width: 130, type: 'group_name'  },
      { key: 'loop_target', label: 'Loop Target', width: 140, type: 'loop_target' },
      { key: 'condition',   label: 'Condition',   width: 200, type: 'formula'     },
      { key: 'part_code',   label: 'Part Code',   width: 130, type: 'text'        },
      { key: 'quantity',    label: 'Quantity',    width: 150, type: 'formula'     },
      ...SHARED_TAIL,
    ]
  }
  // price
  return [
    { key: 'name',        label: 'Name',        width: 150, type: 'text'        },
    { key: 'group_name',  label: 'Group',       width: 130, type: 'group_name'  },
    { key: 'level',       label: 'Level',       width: 80,  type: 'level'       },
    { key: 'loop_target', label: 'Loop Target', width: 140, type: 'loop_target' },
    { key: 'condition',   label: 'Condition',   width: 200, type: 'formula'     },
    { key: 'quantity',    label: 'Quantity',    width: 150, type: 'formula'     },
    { key: 'value',       label: 'Value (£)',   width: 150, type: 'formula'     },
    { key: 'markup',      label: 'Markup %',    width: 90,  type: 'number'      },
    ...SHARED_TAIL,
  ]
}

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
    is_active:   true,
    sort_order:  sortOrder,
    _unsaved:    true,
  }
}

// ── RuleEditor ─────────────────────────────────────────────────────────────

export default function RuleEditor({ fileId, ruleFamily, readOnly = false }) {
  const [rules,   setRules]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(new Set())

  const columns    = getColumns(ruleFamily)
  const groupNames = [...new Set(rules.map(r => r.group_name).filter(Boolean))]

  useEffect(() => {
    loadRules()
  }, [fileId, ruleFamily])

  async function loadRules() {
    setLoading(true)
    const { data, error } = await supabase
      .from('price_rules')
      .select('id, rule_family, level, name, group_name, loop_target, condition, quantity, value, markup, part_code, comment, is_active, sort_order')
      .eq('price_file_id', fileId)
      .eq('rule_family', ruleFamily)
      .order('sort_order', { ascending: true })
    if (!error) setRules(data || [])
    setLoading(false)
  }

  function addRule() {
    const maxOrder = rules.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0)
    const tempId   = `_new_${Date.now()}`
    setRules(rs => [...rs, { ...blankRule(ruleFamily, maxOrder + 10), id: tempId }])
  }

  async function removeRule(rule) {
    if (!rule._unsaved && rule.id && !String(rule.id).startsWith('_new_')) {
      await supabase.from('price_rules').delete().eq('id', rule.id)
    }
    setRules(rs => rs.filter(r => r.id !== rule.id))
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

  async function updateField(rule, field, value) {
    const updated = { ...rule, [field]: value }
    setRules(rs => rs.map(r => r.id === rule.id ? updated : r))

    const isNew = !rule.id || String(rule.id).startsWith('_new_')

    if (isNew) {
      const tempId = rule.id
      setSaving(s => new Set(s).add(tempId))
      const payload = {
        price_file_id: fileId,
        rule_family:   ruleFamily,
        level:         updated.level,
        name:          updated.name,
        group_name:    updated.group_name,
        loop_target:   updated.loop_target,
        condition:     updated.condition,
        quantity:      updated.quantity,
        value:         updated.value,
        markup:        updated.markup,
        part_code:     updated.part_code,
        comment:       updated.comment,
        is_active:     updated.is_active,
        sort_order:    updated.sort_order,
      }
      const { data, error } = await supabase
        .from('price_rules')
        .insert(payload)
        .select('id')
        .single()
      setSaving(s => { const n = new Set(s); n.delete(tempId); return n })
      if (!error && data) {
        setRules(rs => rs.map(r => r.id === tempId ? { ...updated, id: data.id, _unsaved: false } : r))
      }
    } else {
      const { error } = await supabase
        .from('price_rules')
        .update({ [field]: value })
        .eq('id', rule.id)
      if (error) console.error('Rule update error:', error)
    }
  }

  if (loading) {
    return <div style={{ color: '#aaa', fontSize: 13, padding: 24 }}>Loading rules…</div>
  }

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e8e6e0' }}>
              <th style={{ width: 36, padding: '6px 4px' }} />
              {columns.map(c => (
                <th key={c.key} style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', width: c.width }}>
                  {c.label}
                </th>
              ))}
              {!readOnly && <th style={{ width: 36 }} />}
            </tr>
          </thead>
          <tbody>
            {rules.map((rule, index) => {
              const prevGroupName  = index > 0 ? rules[index - 1].group_name : null
              const showGroupHeader = rule.group_name && rule.group_name !== prevGroupName
              return (
                <Fragment key={rule.id}>
                  {showGroupHeader && (
                    <tr style={{ background: '#faf9f7' }}>
                      <td />
                      <td colSpan={columns.length + (readOnly ? 0 : 1)} style={{ padding: '6px 8px', fontWeight: 600, color: '#444', fontSize: 12, borderBottom: '1px solid #e8e6e0' }}>
                        {rule.group_name}
                      </td>
                    </tr>
                  )}
                  <RuleRow
                    rule={rule}
                    columns={columns}
                    index={index}
                    total={rules.length}
                    readOnly={readOnly}
                    saving={saving.has(rule.id)}
                    groupNames={groupNames}
                    onUpdate={(field, value) => updateField(rule, field, value)}
                    onRemove={() => removeRule(rule)}
                    onMove={dir => moveRule(index, dir)}
                  />
                </Fragment>
              )
            })}
            {rules.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} style={{ padding: '24px 8px', color: '#bbb', textAlign: 'center' }}>
                  No rules yet. Add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button
          onClick={addRule}
          style={{ marginTop: 12, fontSize: 12, padding: '5px 14px', borderRadius: 6, border: '1px dashed #c8c5be', background: 'transparent', color: '#888', cursor: 'pointer' }}
        >
          + Add rule
        </button>
      )}
    </div>
  )
}

// ── RuleRow ────────────────────────────────────────────────────────────────

function RuleRow({ rule, columns, index, total, readOnly, saving, groupNames, onUpdate, onRemove, onMove }) {
  return (
    <tr style={{ borderBottom: '1px solid #f0ede8', opacity: rule.is_active ? 1 : 0.45 }}>
      <td style={{ padding: '2px 4px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
        {!readOnly && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <button onClick={() => onMove(-1)} disabled={index === 0}         style={arrowBtn}>▲</button>
            <button onClick={() => onMove(1)}  disabled={index === total - 1} style={arrowBtn}>▼</button>
          </div>
        )}
      </td>
      {columns.map(col => (
        <td key={col.key} style={{ padding: '3px 4px', verticalAlign: 'middle' }}>
          <CellEditor
            col={col}
            value={rule[col.key]}
            readOnly={readOnly || saving}
            groupNames={groupNames}
            onChange={v => onUpdate(col.key, v)}
          />
        </td>
      ))}
      {!readOnly && (
        <td style={{ padding: '2px 4px', verticalAlign: 'middle' }}>
          <button onClick={onRemove} style={{ fontSize: 14, color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }} title="Delete">×</button>
        </td>
      )}
    </tr>
  )
}

const arrowBtn = {
  fontSize: 9, color: '#bbb', background: 'none', border: 'none',
  cursor: 'pointer', padding: '1px 3px', lineHeight: 1,
}

// ── CellEditor ─────────────────────────────────────────────────────────────

function CellEditor({ col, value, readOnly, groupNames, onChange }) {
  const listId = useId()

  if (col.type === 'bool') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        disabled={readOnly}
        onChange={e => onChange(e.target.checked)}
        style={{ cursor: readOnly ? 'default' : 'pointer' }}
      />
    )
  }

  if (col.type === 'level') {
    return (
      <select
        value={value ?? 'item'}
        disabled={readOnly}
        onChange={e => onChange(e.target.value)}
        style={{ fontSize: 12, border: '1px solid #e0ddd8', borderRadius: 4, padding: '3px 6px', background: '#fff', cursor: readOnly ? 'default' : 'pointer' }}
      >
        <option value="item">Item</option>
        <option value="quote">Quote</option>
      </select>
    )
  }

  if (col.type === 'loop_target') {
    return (
      <select
        value={value ?? 'frame'}
        disabled={readOnly}
        onChange={e => onChange(e.target.value)}
        style={{ fontSize: 12, border: '1px solid #e0ddd8', borderRadius: 4, padding: '3px 6px', background: '#fff', cursor: readOnly ? 'default' : 'pointer' }}
      >
        {LOOP_TARGETS.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    )
  }

  if (col.type === 'group_name') {
    return (
      <>
        <datalist id={listId}>
          {groupNames.map(g => <option key={g} value={g} />)}
        </datalist>
        <input
          type="text"
          list={listId}
          value={value ?? ''}
          readOnly={readOnly}
          onChange={e => onChange(e.target.value)}
          style={{ ...inputStyle, width: col.width - 20 }}
        />
      </>
    )
  }

  if (col.type === 'number') {
    return (
      <input
        type="number"
        step="0.01"
        value={value ?? ''}
        readOnly={readOnly}
        onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        style={{ ...inputStyle, width: 80 }}
      />
    )
  }

  if (col.type === 'formula') {
    return <FormulaEditor value={value ?? ''} readOnly={readOnly} onChange={onChange} />
  }

  return (
    <input
      type="text"
      value={value ?? ''}
      readOnly={readOnly}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, width: col.width - 20 }}
    />
  )
}

const inputStyle = {
  fontSize: 12,
  border: '1px solid transparent',
  borderRadius: 4,
  padding: '3px 6px',
  background: 'transparent',
  outline: 'none',
  width: '100%',
}

// ── FormulaEditor ──────────────────────────────────────────────────────────

function FormulaEditor({ value, readOnly, onChange }) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const popRef   = useRef(null)

  const filtered = query
    ? VARIABLES.filter(v => v.name.includes(query.toLowerCase()))
    : VARIABLES

  const groups = VARIABLE_GROUPS.filter(g => filtered.some(v => v.group === g))

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
      if (!popRef.current?.contains(e.target) && e.target !== inputRef.current) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
      <input
        ref={inputRef}
        type="text"
        value={value ?? ''}
        readOnly={readOnly}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, flex: 1, minWidth: 0 }}
        onFocus={e => { e.currentTarget.style.borderColor = '#c5c0f0' }}
        onBlur={e  => { e.currentTarget.style.borderColor = 'transparent' }}
      />
      {!readOnly && (
        <button
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o); setQuery('') }}
          title="Insert variable"
          style={{ fontSize: 10, padding: '2px 5px', borderRadius: 4, border: '1px solid #ddd', background: '#faf9f7', cursor: 'pointer', color: '#888', flexShrink: 0, lineHeight: 1.2 }}
        >
          {'{x}'}
        </button>
      )}
      {open && (
        <div
          ref={popRef}
          style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 1000,
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
        </div>
      )}
    </div>
  )
}
