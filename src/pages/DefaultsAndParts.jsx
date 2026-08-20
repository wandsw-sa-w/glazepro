import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'

// ─── Shared UI primitives ──────────────────────────────────────────────────────

const labelStyle = {
  fontSize: 11,
  fontWeight: 500,
  color: '#888',
  marginBottom: 4,
  display: 'block',
}

// ─── SavedIndicator ─────────────────────────────────────────────────────────────

function SavedIndicator({ show }) {
  return (
    <span
      style={{
        fontSize: 11,
        color: '#2a7a40',
        background: '#eaf6ee',
        borderRadius: 6,
        padding: '2px 8px',
        marginLeft: 8,
        opacity: show ? 1 : 0,
        transition: 'opacity 0.4s',
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      Saved
    </span>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function DefaultsAndParts() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const unmatchedCount = useUnmatchedCount()

  // Part types
  const [partTypes, setPartTypes] = useState([])
  const [fieldCounts, setFieldCounts] = useState({})
  const [loadingParts, setLoadingParts] = useState(true)

  // Selected part type
  const [selected, setSelected] = useState(null)
  const [activeTab, setActiveTab] = useState('fields') // 'fields' | 'children'

  // Fields & Defaults tab state
  const [fields, setFields] = useState([])
  const [profiles, setProfiles] = useState([])
  const [values, setValues] = useState({}) // keyed by `${profileId}:${fieldKey}`
  const [loadingFields, setLoadingFields] = useState(false)
  const [search, setSearch] = useState('')
  const [savedKey, setSavedKey] = useState(null) // key that just saved
  const savedTimerRef = useRef(null)

  // Children tab state
  const [allPartTypes, setAllPartTypes] = useState([])
  const [children, setChildren] = useState([]) // rows from part_type_children
  const [childError, setChildError] = useState('')

  useEffect(() => { fetchPartTypes() }, [])
  useEffect(() => { fetchProfiles() }, [])

  async function fetchPartTypes() {
    setLoadingParts(true)
    const [{ data: types }, { data: defs }] = await Promise.all([
      supabase.from('part_types').select('*').order('sort_order'),
      supabase.from('default_field_definitions').select('part_type, field_key').eq('is_active', true),
    ])
    const countMap = {}
    ;(defs || []).forEach(d => {
      countMap[d.part_type] = (countMap[d.part_type] || 0) + 1
    })
    setPartTypes(types || [])
    setAllPartTypes(types || [])
    setFieldCounts(countMap)
    setLoadingParts(false)
  }

  async function fetchProfiles() {
    const { data, error } = await supabase
      .from('default_profiles')
      .select('*')
      .order('sort_order')
    // TODO: remove after diagnosing
    console.log('[fetchProfiles] result:', { rowCount: data?.length, rows: data, error })
    setProfiles(data || [])
  }

  async function selectPartType(pt) {
    setSelected(pt)
    setActiveTab('fields')
    setSearch('')
    setChildError('')
    await Promise.all([
      loadFields(pt.code),
      pt.is_container ? loadChildren(pt.code) : Promise.resolve(),
    ])
  }

  // ── Fields & Defaults ─────────────────────────────────────────────────────────

  async function loadFields(partTypeCode) {
    setLoadingFields(true)
    const { data: defs } = await supabase
      .from('default_field_definitions')
      .select('*')
      .eq('part_type', partTypeCode)
      .eq('is_active', true)
      .order('sort_order')
    const fieldKeys = (defs || []).map(d => d.field_key)
    let vals = []
    if (fieldKeys.length > 0) {
      const { data, error: valsError } = await supabase
        .from('default_profile_values')
        .select('*')
        .in('field_key', fieldKeys)
      // TODO: remove after diagnosing
      console.log('[loadFields] default_profile_values result:', { rowCount: data?.length, rows: data, error: valsError })
      vals = data || []
    }
    setFields(defs || [])
    const map = {}
    vals.forEach(v => {
      map[`${v.profile_id}:${v.field_key}`] = v
    })
    setValues(map)
    setLoadingFields(false)
  }

  function showSaved(key) {
    setSavedKey(key)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setSavedKey(null), 1800)
  }

  async function saveValue(profileId, field, patch) {
    const key = `${profileId}:${field.field_key}`
    const existing = values[key]

    let error
    if (existing) {
      const { error: e } = await supabase
        .from('default_profile_values')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      error = e
      if (!e) {
        setValues(prev => ({
          ...prev,
          [key]: { ...prev[key], ...patch },
        }))
      }
    } else {
      // Only insert if there's a non-empty value
      const hasContent = Object.values(patch).some(v => v !== null && v !== '' && v !== undefined)
      if (!hasContent) return
      const { data: inserted, error: e } = await supabase
        .from('default_profile_values')
        .insert([{
          profile_id: profileId,
          field_key: field.field_key,
          ...patch,
        }])
        .select()
        .single()
      error = e
      if (!e && inserted) {
        setValues(prev => ({ ...prev, [key]: inserted }))
      }
    }

    if (!error) showSaved(key)
    return error
  }

  async function handleValueBlur(profileId, field, rawValue) {
    const trimmed = rawValue.trim()
    const existing = values[`${profileId}:${field.field_key}`]
    const currentVal = existing?.default_value ?? ''
    if (trimmed === currentVal) return
    await saveValue(profileId, field, { default_value: trimmed || null })
  }

  async function handleVisibilityChange(field, newVis) {
    const { error } = await supabase
      .from('default_field_definitions')
      .update({ visibility: newVis, updated_at: new Date().toISOString() })
      .eq('id', field.id)
    if (!error) {
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, visibility: newVis } : f))
      showSaved(`vis:${field.id}`)
    }
  }

  const filteredFields = fields.filter(f => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (f.label || '').toLowerCase().includes(q) ||
      (f.property_name || '').toLowerCase().includes(q)
    )
  })

  // ── Children tab ──────────────────────────────────────────────────────────────

  async function loadChildren(parentCode) {
    const { data } = await supabase
      .from('part_type_children')
      .select('*')
      .eq('parent_code', parentCode)
      .order('sort_order')
    setChildren(data || [])
  }

  async function toggleChild(childCode) {
    setChildError('')
    const parentCode = selected.code
    const existing = children.find(c => c.child_code === childCode)

    if (existing) {
      const { error } = await supabase
        .from('part_type_children')
        .delete()
        .eq('parent_code', parentCode)
        .eq('child_code', childCode)
      if (error) { setChildError(error.message); return }
      setChildren(prev => prev.filter(c => c.child_code !== childCode))
    } else {
      const maxOrder = children.reduce((m, c) => Math.max(m, c.sort_order || 0), 0)
      const { data: inserted, error } = await supabase
        .from('part_type_children')
        .insert([{
          parent_code: parentCode,
          child_code: childCode,
          min_count: 0,
          max_count: null,
          sort_order: maxOrder + 1,
        }])
        .select()
        .single()
      if (error) { setChildError(error.message); return }
      setChildren(prev => [...prev, inserted])
    }
  }

  async function updateChildField(childCode, patch) {
    setChildError('')
    const parentCode = selected.code
    const { error } = await supabase
      .from('part_type_children')
      .update(patch)
      .eq('parent_code', parentCode)
      .eq('child_code', childCode)
    if (error) { setChildError(error.message); return }
    setChildren(prev => prev.map(c => c.child_code === childCode ? { ...c, ...patch } : c))
    showSaved(`child:${childCode}`)
  }

  async function moveChild(childCode, dir) {
    const idx = children.findIndex(c => c.child_code === childCode)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= children.length) return
    const a = children[idx]
    const b = children[swapIdx]
    const orderA = a.sort_order ?? idx
    const orderB = b.sort_order ?? swapIdx
    const now = new Date().toISOString()
    await Promise.all([
      supabase.from('part_type_children').update({ sort_order: orderB }).eq('parent_code', selected.code).eq('child_code', a.child_code),
      supabase.from('part_type_children').update({ sort_order: orderA }).eq('parent_code', selected.code).eq('child_code', b.child_code),
    ])
    const next = [...children]
    next[idx] = { ...a, sort_order: orderB }
    next[swapIdx] = { ...b, sort_order: orderA }
    next.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0))
    setChildren(next)
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const tickedSet = new Set(children.map(c => c.child_code))

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
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#555', fontWeight: 400, background: 'transparent', cursor: 'pointer' }}
        >
          <span>Reference Data</span>
        </div>
        <div
          onClick={() => navigate('/defaults')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#3d35a8', fontWeight: 500, background: '#f0eefc', cursor: 'pointer' }}
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
          <div style={{ fontSize: 15, fontWeight: 600 }}>Defaults &amp; Parts</div>
        </div>

        {/* Two-panel area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── Left panel – Part Types ────────────────────────────────── */}
          <div style={{ width: '28%', minWidth: 210, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e8e6e0', background: '#faf9f7', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e8e6e0', background: '#fff' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '.05em', textTransform: 'uppercase' }}>Part Types</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingParts ? (
                <div style={{ textAlign: 'center', color: '#aaa', padding: 32, fontSize: 13 }}>Loading…</div>
              ) : partTypes.map(pt => {
                const isSelected = selected?.code === pt.code
                const count = fieldCounts[pt.code] || 0
                return (
                  <div
                    key={pt.code}
                    onClick={() => selectPartType(pt)}
                    style={{
                      padding: '9px 14px',
                      borderBottom: '1px solid #ede9e3',
                      cursor: 'pointer',
                      background: isSelected ? '#f0eefc' : '#fff',
                      borderLeft: `3px solid ${isSelected ? '#3d35a8' : 'transparent'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#3d35a8' : '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pt.label}
                      </span>
                      {pt.is_singleton && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#e8f4fc', color: '#1a6a9a', fontWeight: 600, flexShrink: 0 }}>S</span>
                      )}
                      {pt.is_container && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#eaf6ee', color: '#2a7a40', fontWeight: 600, flexShrink: 0 }}>C</span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: isSelected ? '#e6e3f8' : '#f0eeeb', color: isSelected ? '#3d35a8' : '#888', fontWeight: 600, flexShrink: 0 }}>
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
            {/* Legend */}
            <div style={{ padding: '8px 14px', borderTop: '1px solid #e8e6e0', background: '#fff', display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 10, color: '#888' }}>
                <span style={{ display: 'inline-block', fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#e8f4fc', color: '#1a6a9a', fontWeight: 600, marginRight: 3 }}>S</span>
                Singleton
              </span>
              <span style={{ fontSize: 10, color: '#888' }}>
                <span style={{ display: 'inline-block', fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#eaf6ee', color: '#2a7a40', fontWeight: 600, marginRight: 3 }}>C</span>
                Container
              </span>
            </div>
          </div>

          {/* ── Right panel ────────────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {!selected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bbb', fontSize: 14 }}>
                Select a part type to view its fields and defaults
              </div>
            ) : (
              <>
                {/* Part type header + tabs */}
                <div style={{ padding: '14px 20px 0', borderBottom: '1px solid #e8e6e0', background: '#fff', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>{selected.label}</div>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#888', background: '#f5f4f0', padding: '2px 7px', borderRadius: 5 }}>{selected.code}</span>
                    {selected.is_singleton && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#e8f4fc', color: '#1a6a9a', fontWeight: 600 }}>Singleton</span>
                    )}
                    {selected.is_container && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: '#eaf6ee', color: '#2a7a40', fontWeight: 600 }}>Container</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 0 }}>
                    {['fields', ...(selected.is_container ? ['children'] : [])].map(tab => (
                      <div
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                          padding: '6px 16px',
                          fontSize: 13,
                          fontWeight: activeTab === tab ? 600 : 400,
                          color: activeTab === tab ? '#3d35a8' : '#888',
                          borderBottom: `2px solid ${activeTab === tab ? '#3d35a8' : 'transparent'}`,
                          cursor: 'pointer',
                          marginBottom: -1,
                          userSelect: 'none',
                        }}
                      >
                        {tab === 'fields' ? 'Fields & Defaults' : 'Allowed Children'}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
                  {activeTab === 'fields'
                    ? <FieldsTab
                        fields={filteredFields}
                        allFields={fields}
                        profiles={profiles}
                        values={values}
                        search={search}
                        onSearchChange={setSearch}
                        loadingFields={loadingFields}
                        savedKey={savedKey}
                        onValueBlur={handleValueBlur}
                        onVisibilityChange={handleVisibilityChange}
                      />
                    : <ChildrenTab
                        allPartTypes={allPartTypes.filter(pt => pt.is_active)}
                        children={children}
                        tickedSet={tickedSet}
                        savedKey={savedKey}
                        childError={childError}
                        onToggle={toggleChild}
                        onUpdateField={updateChildField}
                        onMove={moveChild}
                      />
                  }
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── FieldsTab ─────────────────────────────────────────────────────────────────

function FieldsTab({
  fields, allFields, profiles, values, search, onSearchChange,
  loadingFields, savedKey,
  onValueBlur, onVisibilityChange,
}) {
  return (
    <div style={{ padding: 20 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search fields…"
          style={{
            fontSize: 13, padding: '6px 10px', border: '1px solid #d8d5cf',
            borderRadius: 8, outline: 'none', background: '#fff', width: 220, boxSizing: 'border-box',
          }}
        />
        {search && (
          <span style={{ fontSize: 12, color: '#aaa' }}>{fields.length} of {allFields.length} fields</span>
        )}
      </div>

      {loadingFields ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 48, fontSize: 13 }}>Loading…</div>
      ) : allFields.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 48, fontSize: 13 }}>
          No fields defined for this part type.
        </div>
      ) : fields.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 48, fontSize: 13 }}>
          No fields match "{search}".
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#faf9f7', borderBottom: '1px solid #e8e6e0' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 600, color: '#888', fontSize: 11, minWidth: 180, position: 'sticky', left: 0, background: '#faf9f7', zIndex: 1 }}>
                  Field
                </th>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#888', fontSize: 11, minWidth: 130 }}>
                  Visibility
                </th>
                {profiles.map(p => (
                  <th key={p.id} style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#888', fontSize: 11, minWidth: 110, whiteSpace: 'nowrap' }}>
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((field, idx) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  profiles={profiles}
                  values={values}
                  savedKey={savedKey}
                  isLast={idx === fields.length - 1}
                  onValueBlur={onValueBlur}
                  onVisibilityChange={onVisibilityChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({ field, profiles, values, savedKey, isLast, onValueBlur, onVisibilityChange }) {
  return (
    <tr style={{ borderBottom: isLast ? 'none' : '1px solid #f0eeeb' }}>
      {/* Field name */}
      <td style={{ padding: '8px 14px', verticalAlign: 'middle', position: 'sticky', left: 0, background: '#fff', zIndex: 1, borderRight: '1px solid #f0eeeb' }}>
        <div style={{ fontSize: 13, color: '#222', fontWeight: 500 }}>{field.label}</div>
        <div style={{ fontSize: 10, color: '#aaa', fontFamily: 'monospace', marginTop: 2 }}>{field.property_name}</div>
        {field.unit && (
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 1 }}>{field.unit}</div>
        )}
      </td>

      {/* Visibility */}
      <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
          <select
            value={field.visibility || 'visible'}
            onChange={e => onVisibilityChange(field, e.target.value)}
            style={{
              fontSize: 12, padding: '4px 6px', border: '1px solid #d8d5cf',
              borderRadius: 6, background: '#fff', outline: 'none', cursor: 'pointer',
              color: field.visibility === 'hidden' ? '#aaa' : field.visibility === 'readonly' ? '#888' : '#333',
            }}
          >
            <option value="visible">Visible</option>
            <option value="readonly">Read-only</option>
            <option value="hidden">Hidden</option>
          </select>
          <SavedIndicator show={savedKey === `vis:${field.id}`} />
        </div>
      </td>

      {/* One cell per profile */}
      {profiles.map(profile => {
        const vkey = `${profile.id}:${field.field_key}`
        const row = values[vkey]
        return (
          <ProfileCell
            key={profile.id}
            profileId={profile.id}
            field={field}
            row={row}
            vkey={vkey}
            savedKey={savedKey}
            onValueBlur={onValueBlur}
          />
        )
      })}
    </tr>
  )
}

// ─── ProfileCell ───────────────────────────────────────────────────────────────

function ProfileCell({ profileId, field, row, vkey, savedKey, onValueBlur }) {
  const [localVal, setLocalVal] = useState(row?.default_value ?? '')

  // Keep local state in sync when row changes from outside
  useEffect(() => {
    setLocalVal(row?.default_value ?? '')
  }, [row?.default_value])

  const isSaved = savedKey === vkey

  return (
    <td style={{ padding: '5px 10px', verticalAlign: 'middle', minWidth: 110 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <input
          value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={() => onValueBlur(profileId, field, localVal)}
          placeholder="—"
          style={{
            fontSize: 12, padding: '4px 7px',
            border: `1px solid ${isSaved ? '#a8d5b5' : '#e8e6e0'}`,
            borderRadius: 6, outline: 'none', background: '#fff',
            width: '100%', boxSizing: 'border-box',
            transition: 'border-color 0.3s',
          }}
        />
        {row?.source_ref && (
          <span style={{ fontSize: 10, color: '#aaa', background: '#f5f4f0', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'monospace' }}>
            {row.source_ref}
          </span>
        )}
        <SavedIndicator show={isSaved} />
      </div>
    </td>
  )
}

// ─── ChildrenTab ───────────────────────────────────────────────────────────────

function ChildrenTab({ allPartTypes, children, tickedSet, savedKey, childError, onToggle, onUpdateField, onMove }) {
  // Local state for count inputs, synced from children prop
  const childMap = Object.fromEntries(children.map(c => [c.child_code, c]))

  return (
    <div style={{ padding: 20 }}>
      {childError && (
        <div style={{ fontSize: 12, color: '#8b2020', background: '#fceaea', borderRadius: 7, padding: '8px 12px', marginBottom: 14 }}>
          {childError}
        </div>
      )}

      <div style={{ fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 1.5 }}>
        Tick the part types that may appear as children of this container. Use the arrows to set display order.
      </div>

      <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 80px 80px 64px', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #e8e6e0', background: '#faf9f7' }}>
          <div />
          <div style={{ ...labelStyle, marginBottom: 0 }}>Part Type</div>
          <div style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>Min</div>
          <div style={{ ...labelStyle, marginBottom: 0, textAlign: 'center' }}>Max</div>
          <div />
        </div>

        {/* Ticked children first, in sort order */}
        {children.map((child, idx) => {
          const pt = allPartTypes.find(p => p.code === child.child_code)
          if (!pt) return null
          return (
            <ChildRow
              key={child.child_code}
              pt={pt}
              child={child}
              ticked
              idx={idx}
              total={children.length}
              savedKey={savedKey}
              onToggle={onToggle}
              onUpdateField={onUpdateField}
              onMove={onMove}
            />
          )
        })}

        {/* Unticked part types */}
        {allPartTypes
          .filter(pt => !tickedSet.has(pt.code))
          .map(pt => (
            <ChildRow
              key={pt.code}
              pt={pt}
              child={null}
              ticked={false}
              idx={-1}
              total={0}
              savedKey={savedKey}
              onToggle={onToggle}
              onUpdateField={onUpdateField}
              onMove={onMove}
            />
          ))
        }
      </div>
    </div>
  )
}

// ─── ChildRow ──────────────────────────────────────────────────────────────────

function ChildRow({ pt, child, ticked, idx, total, savedKey, onToggle, onUpdateField, onMove }) {
  const [localMin, setLocalMin] = useState(child?.min_count !== undefined && child?.min_count !== null ? String(child.min_count) : '')
  const [localMax, setLocalMax] = useState(child?.max_count !== undefined && child?.max_count !== null ? String(child.max_count) : '')

  useEffect(() => {
    setLocalMin(child?.min_count !== undefined && child?.min_count !== null ? String(child.min_count) : '')
    setLocalMax(child?.max_count !== undefined && child?.max_count !== null ? String(child.max_count) : '')
  }, [child?.min_count, child?.max_count])

  const isSaved = savedKey === `child:${pt.code}`

  function handleMinBlur() {
    if (!ticked) return
    const num = localMin === '' ? 0 : parseInt(localMin, 10)
    if (isNaN(num)) return
    if (num !== child?.min_count) onUpdateField(pt.code, { min_count: num })
  }

  function handleMaxBlur() {
    if (!ticked) return
    const num = localMax === '' ? null : parseInt(localMax, 10)
    if (localMax !== '' && isNaN(num)) return
    const currentMax = child?.max_count ?? null
    if (num !== currentMax) onUpdateField(pt.code, { max_count: num })
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr 80px 80px 64px',
        alignItems: 'center',
        padding: '9px 14px',
        borderBottom: '1px solid #f0eeeb',
        background: ticked ? '#fff' : '#faf9f7',
        opacity: ticked ? 1 : 0.7,
      }}
    >
      {/* Checkbox */}
      <div>
        <input
          type="checkbox"
          checked={ticked}
          onChange={() => onToggle(pt.code)}
          style={{ cursor: 'pointer', width: 15, height: 15 }}
        />
      </div>

      {/* Part type label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#222', fontWeight: ticked ? 500 : 400 }}>{pt.label}</span>
        {pt.is_singleton && (
          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: '#e8f4fc', color: '#1a6a9a', fontWeight: 600 }}>S</span>
        )}
        <SavedIndicator show={isSaved} />
      </div>

      {/* Min count */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {ticked ? (
          <input
            value={localMin}
            onChange={e => setLocalMin(e.target.value)}
            onBlur={handleMinBlur}
            placeholder="0"
            style={{
              fontSize: 12, padding: '4px 6px', border: '1px solid #d8d5cf',
              borderRadius: 6, outline: 'none', background: '#fff',
              width: 56, textAlign: 'center', boxSizing: 'border-box',
            }}
          />
        ) : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
      </div>

      {/* Max count */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {ticked ? (
          <input
            value={localMax}
            onChange={e => setLocalMax(e.target.value)}
            onBlur={handleMaxBlur}
            placeholder="∞"
            style={{
              fontSize: 12, padding: '4px 6px', border: '1px solid #d8d5cf',
              borderRadius: 6, outline: 'none', background: '#fff',
              width: 56, textAlign: 'center', boxSizing: 'border-box',
            }}
          />
        ) : <span style={{ color: '#ccc', fontSize: 12 }}>—</span>}
      </div>

      {/* Reorder arrows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
        {ticked && (
          <>
            <button
              onClick={() => onMove(pt.code, -1)}
              disabled={idx === 0}
              style={{
                fontSize: 9, lineHeight: 1, padding: '2px 5px',
                border: '1px solid #e8e6e0', borderRadius: 4,
                background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer',
                color: idx === 0 ? '#ccc' : '#666',
              }}
            >▲</button>
            <button
              onClick={() => onMove(pt.code, 1)}
              disabled={idx === total - 1}
              style={{
                fontSize: 9, lineHeight: 1, padding: '2px 5px',
                border: '1px solid #e8e6e0', borderRadius: 4,
                background: '#fff', cursor: idx === total - 1 ? 'not-allowed' : 'pointer',
                color: idx === total - 1 ? '#ccc' : '#666',
              }}
            >▼</button>
          </>
        )}
      </div>
    </div>
  )
}
