import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// ─── Shared UI primitives (matching Ironmongery.jsx) ──────────────────────────

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: value ? '#3d35a8' : '#d8d5cf',
        position: 'relative', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 19 : 3,
        width: 14, height: 14, borderRadius: 7,
        background: '#fff', transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </div>
  )
}

const inputStyle = {
  fontSize: 13,
  padding: '6px 10px',
  border: '1px solid #d8d5cf',
  borderRadius: 8,
  outline: 'none',
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: 11,
  fontWeight: 500,
  color: '#888',
  marginBottom: 4,
  display: 'block',
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ReferenceData() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const unmatchedCount = useUnmatchedCount()

  // Categories
  const [categories, setCategories] = useState([])
  const [optionCounts, setOptionCounts] = useState({})
  const [loadingCats, setLoadingCats] = useState(true)

  // Selected category + its options
  const [selectedCat, setSelectedCat] = useState(null)
  const [options, setOptions] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' | 'edit'
  const [editingOption, setEditingOption] = useState(null)
  const [form, setForm] = useState({})
  const [codeEditedManually, setCodeEditedManually] = useState(false)
  const [codeUnlocked, setCodeUnlocked] = useState(false)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchCategories() }, [])

  async function fetchCategories() {
    setLoadingCats(true)
    const [{ data: cats }, { data: counts }] = await Promise.all([
      supabase.from('reference_categories').select('*').order('sort_order'),
      supabase.from('reference_options').select('category, is_active'),
    ])
    const countMap = {}
    ;(counts || []).forEach(o => {
      if (o.is_active) countMap[o.category] = (countMap[o.category] || 0) + 1
    })
    setCategories(cats || [])
    setOptionCounts(countMap)
    setLoadingCats(false)
  }

  async function fetchOptions(category) {
    setLoadingOptions(true)
    const { data } = await supabase
      .from('reference_options')
      .select('*')
      .eq('category', category)
      .order('sort_order')
    setOptions(data || [])
    setLoadingOptions(false)
  }

  async function refreshCategoryCount(category) {
    const { data } = await supabase
      .from('reference_options')
      .select('is_active')
      .eq('category', category)
    const active = (data || []).filter(o => o.is_active).length
    setOptionCounts(prev => ({ ...prev, [category]: active }))
  }

  function selectCategory(cat) {
    setSelectedCat(cat)
    fetchOptions(cat.category)
    setModalOpen(false)
  }

  // Group categories by group_name, preserving sort_order within each group
  function getGrouped() {
    const groupOrder = []
    const groupMap = {}
    categories.forEach(cat => {
      const g = cat.group_name || 'Other'
      if (!groupMap[g]) { groupMap[g] = []; groupOrder.push(g) }
      groupMap[g].push(cat)
    })
    return groupOrder.map(g => [g, groupMap[g]])
  }

  // Derived from current options list — used to build modal fields
  function getAppliesToValues() {
    const vals = new Set()
    options.forEach(o => {
      if (Array.isArray(o.applies_to)) o.applies_to.forEach(v => vals.add(v))
    })
    return [...vals].sort()
  }

  function getAttributeKeys() {
    const keys = new Set()
    options.forEach(o => {
      if (o.attributes && typeof o.attributes === 'object') {
        Object.keys(o.attributes).forEach(k => keys.add(k))
      }
    })
    return [...keys]
  }

  // Whether the applies_to / attributes fields should appear in the modal
  const showAppliesTo = options.some(o => Array.isArray(o.applies_to) && o.applies_to.length > 0)
  const showAttributes = options.some(o => o.attributes && Object.keys(o.attributes).length > 0)

  // ── Modal open helpers ───────────────────────────────────────────────────────

  function openCreate() {
    const attrKeys = getAttributeKeys()
    const attrs = {}
    attrKeys.forEach(k => { attrs[k] = '' })
    setModalMode('create')
    setEditingOption(null)
    setCodeEditedManually(false)
    setCodeUnlocked(false)
    setForm({ label: '', code: '', is_active: true, applies_to: [], attributes: attrs })
    setFormError('')
    setModalOpen(true)
  }

  function openEdit(option) {
    const attrKeys = getAttributeKeys()
    const existingAttrs = option.attributes || {}
    const attrs = {}
    attrKeys.forEach(k => { attrs[k] = existingAttrs[k] ?? '' })
    setModalMode('edit')
    setEditingOption(option)
    setCodeEditedManually(false)
    setCodeUnlocked(false)
    setForm({
      label: option.label,
      code: option.code,
      is_active: option.is_active,
      applies_to: option.applies_to || [],
      attributes: attrs,
    })
    setFormError('')
    setModalOpen(true)
  }

  // ── Form field helpers ───────────────────────────────────────────────────────

  // Accepts any field; auto-generates code from label on create (unless user typed a code)
  function setField(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'label' && modalMode === 'create' && !codeEditedManually) {
        next.code = slugify(value)
      }
      return next
    })
  }

  function setCodeManually(value) {
    setCodeEditedManually(true)
    setForm(prev => ({ ...prev, code: value }))
  }

  function toggleAppliesTo(val) {
    setForm(prev => {
      const current = prev.applies_to || []
      const next = current.includes(val)
        ? current.filter(v => v !== val)
        : [...current, val]
      return { ...prev, applies_to: next }
    })
  }

  function setAttrValue(key, value) {
    setForm(prev => ({
      ...prev,
      attributes: { ...prev.attributes, [key]: value },
    }))
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function saveOption() {
    setFormError('')
    const label = (form.label || '').trim()
    const code = (form.code || '').trim()

    if (!label) { setFormError('Label is required.'); return }
    if (!code) { setFormError('Code is required.'); return }
    if (!/^[a-z0-9_]+$/.test(code)) {
      setFormError('Code may only contain lowercase letters, numbers, and underscores.')
      return
    }

    // Local uniqueness checks before hitting the DB
    const otherId = editingOption?.id
    const labelConflict = options.find(o =>
      o.label.toLowerCase() === label.toLowerCase() && o.id !== otherId
    )
    if (labelConflict) {
      setFormError('An option with this label already exists in this category.')
      return
    }
    const codeConflict = options.find(o => o.code === code && o.id !== otherId)
    if (codeConflict) {
      setFormError('An option with this code already exists in this category.')
      return
    }

    // Build attributes — omit keys with empty/null values
    const attrKeys = getAttributeKeys()
    let attributes = {}
    if (showAttributes && attrKeys.length > 0) {
      const built = {}
      attrKeys.forEach(k => {
        const v = form.attributes?.[k]
        if (v !== '' && v !== null && v !== undefined) built[k] = v
      })
      attributes = Object.keys(built).length > 0 ? built : {}
    }

    const payload = {
      label,
      code,
      is_active: form.is_active,
      applies_to: showAppliesTo ? (form.applies_to || []) : [],
      attributes,
      updated_at: new Date().toISOString(),
    }

    setSaving(true)

    if (modalMode === 'create') {
      const maxOrder = options.reduce((m, o) => Math.max(m, o.sort_order || 0), 0)
      payload.category = selectedCat.category
      payload.sort_order = maxOrder + 1

      const { error } = await supabase.from('reference_options').insert([payload])
      if (error) {
        setSaving(false)
        if (error.code === '23505') {
          setFormError(error.message.toLowerCase().includes('label')
            ? 'An option with this label already exists in this category.'
            : 'An option with this code already exists in this category.')
        } else {
          setFormError(error.message)
        }
        return
      }
    } else {
      const { error } = await supabase.from('reference_options').update(payload).eq('id', editingOption.id)
      if (error) {
        setSaving(false)
        if (error.code === '23505') {
          setFormError(error.message.toLowerCase().includes('label')
            ? 'An option with this label already exists in this category.'
            : 'An option with this code already exists in this category.')
        } else {
          setFormError(error.message)
        }
        return
      }
    }

    setSaving(false)
    setModalOpen(false)
    await fetchOptions(selectedCat.category)
    await refreshCategoryCount(selectedCat.category)
  }

  // ── Inline active toggle ──────────────────────────────────────────────────────

  async function toggleActive(option) {
    const newVal = !option.is_active
    await supabase
      .from('reference_options')
      .update({ is_active: newVal, updated_at: new Date().toISOString() })
      .eq('id', option.id)
    setOptions(prev => prev.map(o => o.id === option.id ? { ...o, is_active: newVal } : o))
    setOptionCounts(prev => ({
      ...prev,
      [option.category]: newVal
        ? (prev[option.category] || 0) + 1
        : Math.max(0, (prev[option.category] || 0) - 1),
    }))
  }

  // ── Reordering ────────────────────────────────────────────────────────────────

  async function moveOption(index, dir) {
    const swapIdx = index + dir
    if (swapIdx < 0 || swapIdx >= options.length) return
    const a = options[index]
    const b = options[swapIdx]
    const now = new Date().toISOString()

    // If sort_orders are identical, separate them first
    const orderA = a.sort_order ?? index
    const orderB = b.sort_order ?? swapIdx

    await Promise.all([
      supabase.from('reference_options').update({ sort_order: orderB, updated_at: now }).eq('id', a.id),
      supabase.from('reference_options').update({ sort_order: orderA, updated_at: now }).eq('id', b.id),
    ])

    const next = [...options]
    next[index] = { ...a, sort_order: orderB }
    next[swapIdx] = { ...b, sort_order: orderA }
    next.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0))
    setOptions(next)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const grouped = getGrouped()
  const appliesToValues = getAppliesToValues()
  const attrKeys = getAttributeKeys()

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'inherit' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <div style={{ width: 215, background: '#fff', borderRight: '1px solid #e8e6e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>GlazePro</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Window management</div>
        </div>
        <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Workflow</div>
        {[
          ['Leads',            '/leads',            null],
          ['Quotes & orders',  null,                null],
          ['Production',       null,                null],
          ['Scheduling',       '/calendar',         null],
          ['Invoicing',        null,                null],
          ['Tasks',            '/tasks',            null],
          ['Unmatched emails', '/unmatched-emails', unmatchedCount || null],
        ].map(([item, path, badge]) => (
          <div
            key={item}
            onClick={path ? () => navigate(path) : undefined}
            style={{
              padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: path ? '#555' : '#aaa',
              fontWeight: 400,
              background: 'transparent',
              cursor: path ? 'pointer' : 'not-allowed',
              opacity: path ? 1 : 0.5,
            }}
          >
            <span>{item}</span>
            {badge > 0 && (
              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#fceaea', color: '#8b2020', fontWeight: 600, flexShrink: 0 }}>
                {badge}
              </span>
            )}
          </div>
        ))}
        <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Catalogue</div>
        <div
          onClick={() => navigate('/ironmongery')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#555', fontWeight: 400, background: 'transparent', cursor: 'pointer' }}
        >
          <span>Ironmongery</span>
        </div>
        <div
          onClick={() => navigate('/pricing')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#555', fontWeight: 400, background: 'transparent', cursor: 'pointer' }}
        >
          <span>Pricing</span>
        </div>
        <div
          onClick={() => navigate('/reference-data')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#3d35a8', fontWeight: 500, background: '#f0eefc', cursor: 'pointer' }}
        >
          <span>Reference Data</span>
        </div>
        <div
          onClick={() => navigate('/defaults')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#555', fontWeight: 400, background: 'transparent', cursor: 'pointer' }}
        >
          <span>Defaults &amp; Parts</span>
        </div>
        <div onClick={() => navigate('/settings')} style={{ margin: '4px 7px 2px', padding: '8px 11px', fontSize: 13, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#555', cursor: 'pointer' }}>
          <span>⚙</span><span>Settings</span>
        </div>
        <div style={{ marginTop: 'auto', padding: 13, borderTop: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <button
            onClick={signOut}
            style={{ fontSize: 11, padding: '5px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#555' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Reference Data</div>
        </div>

        {/* Two-panel area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── Left panel – Categories (30%) ──────────────────────────── */}
          <div style={{ width: '30%', minWidth: 220, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e8e6e0', background: '#faf9f7', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e8e6e0', background: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '.05em', textTransform: 'uppercase' }}>Categories</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingCats ? (
                <div style={{ textAlign: 'center', color: '#aaa', padding: 32, fontSize: 13 }}>Loading…</div>
              ) : grouped.map(([groupName, cats]) => (
                <div key={groupName}>
                  <div style={{ padding: '10px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>
                    {groupName}
                  </div>
                  {cats.map(cat => {
                    const isSelected = selectedCat?.category === cat.category
                    const count = optionCounts[cat.category] || 0
                    return (
                      <div
                        key={cat.category}
                        onClick={() => selectCategory(cat)}
                        style={{
                          padding: '9px 14px',
                          borderBottom: '1px solid #ede9e3',
                          cursor: 'pointer',
                          background: isSelected ? '#f0eefc' : '#fff',
                          borderLeft: `3px solid ${isSelected ? '#3d35a8' : 'transparent'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#3d35a8' : '#222' }}>
                          {cat.label}
                        </span>
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: isSelected ? '#e6e3f8' : '#f0eeeb', color: isSelected ? '#3d35a8' : '#888', fontWeight: 600, flexShrink: 0 }}>
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* ── Right panel – Options (70%) ─────────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
            {!selectedCat ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bbb', fontSize: 14 }}>
                Select a category to view options
              </div>
            ) : (
              <div style={{ padding: 24 }}>

                {/* Category header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#222' }}>{selectedCat.label}</div>
                    {selectedCat.description && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 3, lineHeight: 1.5 }}>{selectedCat.description}</div>
                    )}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      {selectedCat.is_multi && (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#e8f4fc', color: '#1a6a9a', fontWeight: 600 }}>Multi-select</span>
                      )}
                      {selectedCat.has_quantity && (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#eaf6ee', color: '#2a7a40', fontWeight: 600 }}>Has quantity</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={openCreate}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
                      border: '1px solid #3d35a8', background: '#3d35a8', color: '#fff',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    + Add Option
                  </button>
                </div>

                {/* Options table */}
                {loadingOptions ? (
                  <div style={{ textAlign: 'center', color: '#aaa', padding: 48, fontSize: 13 }}>Loading…</div>
                ) : options.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#aaa', padding: 48, fontSize: 13 }}>No options yet — add one above.</div>
                ) : (
                  <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
                    {/* Table header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 160px 70px 64px', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #e8e6e0', background: '#faf9f7' }}>
                      <div />
                      <div style={{ ...labelStyle, marginBottom: 0 }}>Label</div>
                      <div style={{ ...labelStyle, marginBottom: 0 }}>Code</div>
                      <div style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>Active</div>
                      <div />
                    </div>

                    {options.map((opt, idx) => (
                      <div
                        key={opt.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '44px 1fr 160px 70px 64px',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderBottom: idx < options.length - 1 ? '1px solid #f0eeeb' : 'none',
                          background: opt.is_active ? '#fff' : '#faf9f7',
                          opacity: opt.is_active ? 1 : 0.6,
                        }}
                      >
                        {/* Order arrows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <button
                            onClick={() => moveOption(idx, -1)}
                            disabled={idx === 0}
                            style={{
                              fontSize: 9, lineHeight: 1, padding: '2px 5px',
                              border: '1px solid #e8e6e0', borderRadius: 4,
                              background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer',
                              color: idx === 0 ? '#ccc' : '#666',
                            }}
                          >▲</button>
                          <button
                            onClick={() => moveOption(idx, 1)}
                            disabled={idx === options.length - 1}
                            style={{
                              fontSize: 9, lineHeight: 1, padding: '2px 5px',
                              border: '1px solid #e8e6e0', borderRadius: 4,
                              background: '#fff', cursor: idx === options.length - 1 ? 'not-allowed' : 'pointer',
                              color: idx === options.length - 1 ? '#ccc' : '#666',
                            }}
                          >▼</button>
                        </div>

                        {/* Label */}
                        <div style={{ fontSize: 13, color: '#222', fontWeight: 500, paddingRight: 8 }}>{opt.label}</div>

                        {/* Code */}
                        <div>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#777', background: '#f5f4f0', padding: '2px 7px', borderRadius: 5 }}>
                            {opt.code}
                          </span>
                        </div>

                        {/* Active toggle */}
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <Toggle value={opt.is_active} onChange={() => toggleActive(opt)} />
                        </div>

                        {/* Edit button */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openEdit(opt)}
                            style={{ fontSize: 11, padding: '4px 11px', borderRadius: 6, border: '1px solid #d8d5cf', background: '#fff', cursor: 'pointer', color: '#555', fontWeight: 500 }}
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Modal ───────────────────────────────────────────────────────────── */}
      {modalOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 14, padding: 28,
            width: 480, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,.18)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, color: '#222' }}>
              {modalMode === 'create' ? 'Add Option' : 'Edit Option'}
            </div>

            {/* Label */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>
                Label <span style={{ color: '#8b2020' }}>*</span>
              </label>
              <input
                style={inputStyle}
                value={form.label || ''}
                onChange={e => setField('label', e.target.value)}
                autoFocus
              />
            </div>

            {/* Code */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>
                  Code <span style={{ color: '#8b2020' }}>*</span>
                </label>
                {modalMode === 'edit' && !codeUnlocked && (
                  <button
                    onClick={() => setCodeUnlocked(true)}
                    style={{ fontSize: 10, color: '#3d35a8', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                  >
                    change code
                  </button>
                )}
              </div>
              {modalMode === 'edit' && !codeUnlocked ? (
                <div style={{ fontSize: 13, fontFamily: 'monospace', padding: '6px 10px', background: '#f5f4f0', borderRadius: 8, border: '1px solid #e8e6e0', color: '#555', letterSpacing: '.02em' }}>
                  {form.code}
                </div>
              ) : (
                <>
                  <input
                    style={inputStyle}
                    value={form.code || ''}
                    onChange={e => setCodeManually(e.target.value)}
                    placeholder="auto_generated_from_label"
                  />
                  {modalMode === 'edit' && codeUnlocked && (
                    <div style={{ fontSize: 11, color: '#8b2020', background: '#fceaea', borderRadius: 6, padding: '6px 10px', marginTop: 6, lineHeight: 1.4 }}>
                      Changing this code will break any pricing rule that references it.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Active */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Toggle value={form.is_active ?? true} onChange={val => setField('is_active', val)} />
              <span style={{ fontSize: 13, color: '#555', userSelect: 'none' }}>Active</span>
            </div>

            {/* Applies to — only for categories where at least one option has applies_to */}
            {showAppliesTo && appliesToValues.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Applies to</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {appliesToValues.map(val => (
                    <label
                      key={val}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#444', cursor: 'pointer', userSelect: 'none' }}
                    >
                      <input
                        type="checkbox"
                        checked={(form.applies_to || []).includes(val)}
                        onChange={() => toggleAppliesTo(val)}
                        style={{ cursor: 'pointer' }}
                      />
                      {val}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Attributes — only for categories where at least one option has attributes */}
            {showAttributes && attrKeys.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Attributes</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {attrKeys.map(key => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#888', minWidth: 100, flexShrink: 0 }}>{key}</div>
                      <input
                        style={{ ...inputStyle, flex: 1 }}
                        value={form.attributes?.[key] ?? ''}
                        onChange={e => setAttrValue(key, e.target.value)}
                        placeholder={`Value for "${key}"`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error message */}
            {formError && (
              <div style={{ fontSize: 12, color: '#8b2020', background: '#fceaea', borderRadius: 7, padding: '8px 12px', marginBottom: 14, lineHeight: 1.5 }}>
                {formError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setModalOpen(false)}
                style={{ fontSize: 13, padding: '8px 18px', borderRadius: 8, border: '1px solid #d8d5cf', background: '#fff', cursor: 'pointer', color: '#555' }}
              >
                Cancel
              </button>
              <button
                onClick={saveOption}
                disabled={saving}
                style={{
                  fontSize: 13, fontWeight: 600, padding: '8px 22px', borderRadius: 8,
                  border: 'none', background: saving ? '#c4c0e8' : '#3d35a8',
                  color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
