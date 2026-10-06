import { useState, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'
import { validateDrawing, validateQuote, countBySeverity } from '../validation/validate.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { computeVariables, computeQuoteVariables } from '../pricing/computeVariables.js'
import { loadDrawingParts } from '../drawingBoard/api.js'

// ── Constants ────────────────────────────────────────────────────────────────

const SEVERITIES = ['error', 'warning', 'information']
const LEVELS = ['item', 'quote']

const LOOP_TARGETS = [
  null,
  'frame',
  'sash',
  'sliding_sash',
  'casement_sash',
  'door_leaf',
  'direct_glazed_unit',
  'panel',
  'ironmongery_part',
  'ironmongery_set',
  'surround',
  'component',
  'glass_unit',
]

const SEVERITY_COLOUR = {
  error:       { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5', dot: '#dc2626' },
  warning:     { bg: '#fffbeb', color: '#92400e', border: '#fcd34d', dot: '#f59e0b' },
  information: { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd', dot: '#3b82f6' },
}

const FILTER_OPTIONS = ['all', 'active', 'inactive', 'blocked']

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

// ── Main component ───────────────────────────────────────────────────────────

export default function ValidationRules() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const unmatchedCount = useUnmatchedCount()

  // ── Data state ─────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState([])
  const [rules, setRules] = useState([])
  const [lists, setLists] = useState([])
  const [listValues, setListValues] = useState([])
  const [loading, setLoading] = useState(true)

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editingRule, setEditingRule] = useState(null)
  const [activeTab, setActiveTab] = useState('rules') // 'rules' | 'lists' | 'test'

  // ── Test Record state ──────────────────────────────────────────────────────
  const [testQuoteId, setTestQuoteId] = useState('')
  const [testResults, setTestResults] = useState(null)
  const [testRunning, setTestRunning] = useState(false)
  const [quoteOptions, setQuoteOptions] = useState([]) // [{id, label}]
  const [quoteSearch, setQuoteSearch] = useState('')
  const [quoteDropdownOpen, setQuoteDropdownOpen] = useState(false)

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => { loadData() }, [])

  // ── Load quote options when Test tab is active ────────────────────────────
  useEffect(() => {
    if (activeTab !== 'test') return
    let cancelled = false
    async function loadQuotes() {
      const { data: rows, error } = await supabase
        .from('quotes')
        .select('id, quote_number, lead_id, leads!inner(lead_number)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (cancelled || error) return
      const opts = (rows || []).map(r => ({
        id: r.id,
        label: `${r.leads?.lead_number || '?'} / ${r.quote_number}`,
      }))
      setQuoteOptions(opts)
      // Default to L507712 Q1 if it exists and nothing selected yet
      if (!testQuoteId) {
        const defaultOpt = opts.find(o => o.label.includes('L507712') && o.label.includes('Q1'))
        if (defaultOpt) setTestQuoteId(defaultOpt.id)
      }
    }
    loadQuotes()
    return () => { cancelled = true }
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    const [
      { data: groupData, error: gErr },
      { data: ruleData, error: rErr },
      { data: listData, error: lErr },
      { data: valData, error: vErr },
    ] = await Promise.all([
      supabase.from('validation_groups').select('*').order('sort_order'),
      supabase.from('validation_rules').select('*').order('sort_order'),
      supabase.from('validation_lists').select('*').order('name'),
      supabase.from('validation_list_values').select('*'),
    ])
    if (!gErr) setGroups(groupData || [])
    if (!rErr) setRules(ruleData || [])
    if (!lErr) setLists(listData || [])
    if (!vErr) setListValues(valData || [])
    setLoading(false)
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const groupRuleCounts = {}
  for (const r of rules) {
    groupRuleCounts[r.group_id] = (groupRuleCounts[r.group_id] || 0) + 1
  }

  const filteredRules = rules.filter(r => {
    if (selectedGroupId != null && r.group_id !== selectedGroupId) return false
    if (filter === 'active' && !r.is_active) return false
    if (filter === 'inactive' && r.is_active) return false
    if (filter === 'blocked' && !r.blocked_reason) return false
    if (search) {
      const q = search.toLowerCase()
      const matches = (r.name || '').toLowerCase().includes(q)
        || (r.condition || '').toLowerCase().includes(q)
        || (r.message || '').toLowerCase().includes(q)
      if (!matches) return false
    }
    return true
  }).sort((a, b) => a.sort_order - b.sort_order)

  const listsMap = {}
  for (const l of lists) {
    listsMap[l.name] = listValues
      .filter(v => v.list_id === l.id)
      .map(v => v.value)
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  function addRule() {
    const maxOrder = rules.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0)
    const tempId = `_new_${Date.now()}`
    const rule = {
      id: tempId,
      group_id: selectedGroupId || groups[0]?.id || null,
      name: '',
      sort_order: maxOrder + 10,
      loop_target: null,
      level: 'item',
      severity: 'warning',
      condition: 'true',
      message: '',
      comment: null,
      is_active: true,
      blocked_reason: null,
      _unsaved: true,
    }
    setRules(rs => [...rs, rule])
    setEditingRule(rule)
  }

  async function saveRule(ruleData) {
    const isNew = ruleData._unsaved === true
    const payload = {
      group_id:       ruleData.group_id,
      name:           ruleData.name,
      sort_order:     ruleData.sort_order,
      loop_target:    ruleData.loop_target || null,
      level:          ruleData.level,
      severity:       ruleData.severity,
      condition:      ruleData.condition,
      message:        ruleData.message,
      comment:        ruleData.comment || null,
      is_active:      ruleData.is_active,
      blocked_reason: ruleData.blocked_reason || null,
      updated_at:     new Date().toISOString(),
    }

    if (isNew) {
      const { data, error } = await supabase
        .from('validation_rules')
        .insert(payload)
        .select('id')
        .single()
      if (error) { console.error('Insert error:', error); return false }
      setRules(rs => rs.map(r => r.id === ruleData.id ? { ...ruleData, id: data.id, _unsaved: false } : r))
    } else {
      const { error } = await supabase
        .from('validation_rules')
        .update(payload)
        .eq('id', ruleData.id)
      if (error) { console.error('Update error:', error); return false }
      setRules(rs => rs.map(r => r.id === ruleData.id ? { ...ruleData } : r))
    }
    return true
  }

  async function deleteRule(rule) {
    if (!rule._unsaved) {
      const { error } = await supabase.from('validation_rules').delete().eq('id', rule.id)
      if (error) { console.error('Delete error:', error); return }
    }
    setRules(rs => rs.filter(r => r.id !== rule.id))
    setEditingRule(null)
  }

  async function toggleActive(rule) {
    const next = !rule.is_active
    setRules(rs => rs.map(r => r.id === rule.id ? { ...r, is_active: next } : r))
    if (!rule._unsaved) {
      const { error } = await supabase
        .from('validation_rules')
        .update({ is_active: next, updated_at: new Date().toISOString() })
        .eq('id', rule.id)
      if (error) console.error('Toggle error:', error)
    }
  }

  function handleCancel(rule) {
    if (rule._unsaved) {
      setRules(rs => rs.filter(r => r.id !== rule.id))
    }
    setEditingRule(null)
  }

  // ── Test Record ────────────────────────────────────────────────────────────
  async function runTestRecord() {
    if (!testQuoteId) return
    setTestRunning(true)
    setTestResults(null)
    try {
      // Load the quote's selected drawings
      const { data: qdRows, error: qdErr } = await supabase
        .from('quote_drawings')
        .select('job_item_id, drawing_id')
        .eq('quote_id', testQuoteId)
      if (qdErr) throw qdErr

      const drawingIds = (qdRows || []).map(r => r.drawing_id).filter(Boolean)

      // Load item info for labels
      const jobItemIds = (qdRows || []).map(r => r.job_item_id).filter(Boolean)
      let jobItemMap = {}
      if (jobItemIds.length > 0) {
        const { data: jiRows } = await supabase
          .from('job_items')
          .select('id, item_number')
          .in('id', jobItemIds)
        for (const ji of (jiRows || [])) jobItemMap[ji.id] = ji
      }

      // Build a drawingId→itemNumber map
      const drawingItemLabel = {}
      for (const qd of (qdRows || [])) {
        const ji = jobItemMap[qd.job_item_id]
        drawingItemLabel[qd.drawing_id] = ji ? `Item ${ji.item_number}` : `Item ?`
      }

      const itemRules = rules.filter(r => r.level === 'item' && r.is_active)
      const quoteRules = rules.filter(r => r.level === 'quote' && r.is_active)

      const allResults = []
      const itemVarsList = []

      for (const dwgId of drawingIds) {
        let tree = null
        try { tree = await loadDrawingParts(dwgId) } catch { /* skip */ }
        if (!tree) continue

        const derived = computeDerived(tree)
        const vars = computeVariables(tree, derived) || {}
        itemVarsList.push(vars)
        const results = validateDrawing(tree, vars, itemRules, listsMap)
        // Tag each result with the item label
        for (const r of results) {
          r._itemLabel = drawingItemLabel[dwgId] || `Drawing ${dwgId}`
        }
        allResults.push(...results)
      }

      // Quote-level rules
      const quoteVars = computeQuoteVariables(itemVarsList)
      const quoteResults = validateQuote(quoteVars, allResults, quoteRules, listsMap)
      for (const r of quoteResults) r._itemLabel = 'Quote'
      allResults.push(...quoteResults)

      setTestResults(allResults)
    } catch (e) {
      console.error('runTestRecord error:', e)
      setTestResults([])
    }
    setTestRunning(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
        <div style={{ fontSize: 14, color: '#aaa' }}>Loading validation rules...</div>
      </div>
    )
  }

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
              color: path ? '#555' : '#aaa', fontWeight: 400,
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
        {[
          ['Ironmongery',      '/ironmongery'],
          ['Pricing',          '/pricing'],
          ['Reference Data',   '/reference-data'],
          ['Defaults & Parts', '/defaults'],
          ['Validation Rules', '/validation'],
        ].map(([label, path]) => {
          const active = path === '/validation'
          return (
            <div
              key={label}
              onClick={() => navigate(path)}
              style={{
                padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px',
                display: 'flex', alignItems: 'center',
                color: active ? '#3d35a8' : '#555', fontWeight: active ? 500 : 400,
                background: active ? '#f0eefc' : 'transparent', cursor: 'pointer',
              }}
            >
              <span>{label}</span>
            </div>
          )
        })}
        <div
          onClick={() => navigate('/settings')}
          style={{ margin: '4px 7px 2px', padding: '8px 11px', fontSize: 13, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#555', cursor: 'pointer' }}
        >
          <span>Settings</span>
        </div>
        <div style={{ marginTop: 'auto', padding: 13, borderTop: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <button onClick={signOut} style={{ fontSize: 11, padding: '5px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#555' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0, justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Validation Rules</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {['rules', 'lists', 'test'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontSize: 12, padding: '5px 14px', borderRadius: 6,
                  border: activeTab === tab ? '1px solid #3d35a8' : '1px solid #d8d5cf',
                  background: activeTab === tab ? '#f0eefc' : '#fff',
                  color: activeTab === tab ? '#3d35a8' : '#555',
                  cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'test' ? 'Test Record' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content area */}
        {activeTab === 'rules' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* ── Left panel: Groups ──────────────────────────────────────── */}
            <div style={{ width: '28%', minWidth: 200, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e8e6e0', background: '#faf9f7', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ padding: 12, borderBottom: '1px solid #e8e6e0', background: '#fff' }}>
                <button
                  onClick={() => setSelectedGroupId(null)}
                  style={{
                    fontSize: 12, fontWeight: selectedGroupId == null ? 600 : 400,
                    padding: '7px 12px', borderRadius: 8,
                    border: '1px solid #d8d5cf', background: selectedGroupId == null ? '#f0eefc' : '#fff',
                    color: selectedGroupId == null ? '#3d35a8' : '#555',
                    cursor: 'pointer', width: '100%',
                  }}
                >
                  All Groups ({rules.length})
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {groups.map(group => {
                  const count = groupRuleCounts[group.id] || 0
                  const isSelected = selectedGroupId === group.id
                  return (
                    <div
                      key={group.id}
                      onClick={() => setSelectedGroupId(group.id)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #ede9e3',
                        cursor: 'pointer',
                        background: isSelected ? '#f0eefc' : '#fff',
                        borderLeft: `3px solid ${isSelected ? '#3d35a8' : 'transparent'}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#3d35a8' : '#222' }}>
                        {group.name}
                      </span>
                      <span style={{ fontSize: 11, color: '#999', fontWeight: 500 }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Right panel: Rules ──────────────────────────────────────── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

              {/* Controls bar */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #e8e6e0', background: '#fff', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={addRule}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 7,
                    border: '1px solid #3d35a8', background: '#3d35a8', color: '#fff', cursor: 'pointer',
                  }}
                >
                  + Add Rule
                </button>
                <select
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  style={{ ...inputStyle, width: 120, fontSize: 12, cursor: 'pointer' }}
                >
                  {FILTER_OPTIONS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="Search rules..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ ...inputStyle, width: 200, fontSize: 12 }}
                />
                <span style={{ fontSize: 11, color: '#999', marginLeft: 'auto' }}>
                  {filteredRules.length} rule{filteredRules.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Rules list */}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filteredRules.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#aaa', padding: 48, fontSize: 13 }}>
                    No rules match the current filter.
                  </div>
                ) : filteredRules.map(rule => {
                  const sev = SEVERITY_COLOUR[rule.severity] || SEVERITY_COLOUR.information
                  const groupName = groups.find(g => g.id === rule.group_id)?.name || ''
                  return (
                    <div
                      key={rule.id}
                      onClick={() => setEditingRule(rule)}
                      style={{
                        padding: '10px 16px',
                        borderBottom: '1px solid #f0ede8',
                        cursor: 'pointer',
                        opacity: rule.is_active ? 1 : 0.5,
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                      }}
                    >
                      {/* Severity dot */}
                      <div style={{
                        width: 8, height: 8, borderRadius: 4,
                        background: sev.dot, flexShrink: 0, marginTop: 5,
                      }} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Name + active state */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#222' }}>
                            {rule.name || '(unnamed)'}
                          </span>
                          {rule.blocked_reason && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#fef2f2', color: '#991b1b', fontWeight: 500 }}>
                              Blocked
                            </span>
                          )}
                          {!rule.is_active && !rule.blocked_reason && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f5f4f0', color: '#888', fontWeight: 500 }}>
                              Inactive
                            </span>
                          )}
                        </div>

                        {/* Condition */}
                        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
                          {rule.condition.length > 80 ? rule.condition.slice(0, 80) + '...' : rule.condition}
                        </div>

                        {/* Meta: sort, loop, group */}
                        <div style={{ fontSize: 10, color: '#999', display: 'flex', gap: 10 }}>
                          <span>#{rule.sort_order}</span>
                          {rule.loop_target && <span>loop: {rule.loop_target}</span>}
                          {selectedGroupId == null && <span>{groupName}</span>}
                        </div>

                        {/* Blocked reason */}
                        {rule.blocked_reason && (
                          <div style={{ fontSize: 10, color: '#991b1b', marginTop: 2 }}>
                            {rule.blocked_reason}
                          </div>
                        )}
                      </div>

                      {/* Active toggle */}
                      <div
                        onClick={e => { e.stopPropagation(); toggleActive(rule) }}
                        style={{ flexShrink: 0, paddingTop: 2 }}
                      >
                        <input type="checkbox" checked={rule.is_active} readOnly style={{ cursor: 'pointer' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Lists tab ────────────────────────────────────────────────────── */}
        {activeTab === 'lists' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Validation Lists</div>
            {lists.length === 0 ? (
              <div style={{ color: '#aaa', fontSize: 13 }}>No lists defined.</div>
            ) : lists.map(list => {
              const values = listValues.filter(v => v.list_id === list.id)
              return (
                <div key={list.id} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 4 }}>{list.name}</div>
                  {list.description && <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{list.description}</div>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {values.map(v => (
                      <span key={v.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#f5f3ff', color: '#4a3ab0', fontWeight: 500 }}>
                        {v.value}
                      </span>
                    ))}
                    {values.length === 0 && <span style={{ fontSize: 11, color: '#aaa' }}>No values</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Test Record tab ──────────────────────────────────────────────── */}
        {activeTab === 'test' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Test Record</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
              {/* Searchable quote dropdown */}
              <div style={{ position: 'relative', width: 300 }}>
                <input
                  type="text"
                  placeholder="Search quotes (e.g. L507712 / Q1)..."
                  value={quoteSearch}
                  onChange={e => { setQuoteSearch(e.target.value); setQuoteDropdownOpen(true) }}
                  onFocus={() => setQuoteDropdownOpen(true)}
                  style={{ ...inputStyle, width: '100%' }}
                />
                {testQuoteId && !quoteSearch && (
                  <div style={{ position: 'absolute', top: 7, left: 11, fontSize: 13, color: '#333', pointerEvents: 'none' }}>
                    {quoteOptions.find(o => o.id === testQuoteId)?.label || testQuoteId}
                  </div>
                )}
                {quoteDropdownOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, width: '100%', zIndex: 20,
                    background: '#fff', border: '1px solid #d8d5cf', borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', marginTop: 2,
                  }}>
                    {quoteOptions
                      .filter(o => !quoteSearch || o.label.toLowerCase().includes(quoteSearch.toLowerCase()))
                      .slice(0, 30)
                      .map(o => (
                        <div
                          key={o.id}
                          onClick={() => { setTestQuoteId(o.id); setQuoteSearch(''); setQuoteDropdownOpen(false) }}
                          style={{
                            padding: '6px 10px', fontSize: 12, cursor: 'pointer',
                            background: o.id === testQuoteId ? '#f0eefc' : 'transparent',
                            fontWeight: o.id === testQuoteId ? 600 : 400,
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f5f4f0'}
                          onMouseLeave={e => e.currentTarget.style.background = o.id === testQuoteId ? '#f0eefc' : 'transparent'}
                        >
                          {o.label}
                        </div>
                      ))}
                    {quoteOptions.filter(o => !quoteSearch || o.label.toLowerCase().includes(quoteSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '6px 10px', fontSize: 11, color: '#aaa' }}>No matches</div>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={runTestRecord}
                disabled={testRunning || !testQuoteId}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '7px 16px', borderRadius: 7,
                  border: 'none', background: testRunning || !testQuoteId ? '#c4c0e8' : '#3d35a8',
                  color: '#fff', cursor: testRunning || !testQuoteId ? 'default' : 'pointer',
                }}
              >
                {testRunning ? 'Running...' : 'Run'}
              </button>
            </div>

            {/* Click-away listener for dropdown */}
            {quoteDropdownOpen && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setQuoteDropdownOpen(false)} />
            )}

            {testResults && (
              <div>
                {(() => {
                  const fired = testResults.filter(r => r.status === 'fired')
                  const counts = countBySeverity(fired)
                  const passed = testResults.filter(r => r.status === 'passed').length
                  const uneval = testResults.filter(r => r.status === 'unevaluable').length
                  return (
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12 }}>
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>{counts.errors} error{counts.errors !== 1 ? 's' : ''}</span>
                      <span style={{ color: '#f59e0b', fontWeight: 600 }}>{counts.warnings} warning{counts.warnings !== 1 ? 's' : ''}</span>
                      <span style={{ color: '#3b82f6', fontWeight: 600 }}>{counts.info} info</span>
                      <span style={{ color: '#15803d', fontWeight: 500 }}>{passed} passed</span>
                      {uneval > 0 && <span style={{ color: '#92400e', fontWeight: 500 }}>{uneval} could not evaluate</span>}
                    </div>
                  )
                })()}
                {testResults.map((r, idx) => {
                  const sev = SEVERITY_COLOUR[r.severity] || SEVERITY_COLOUR.information
                  const ruleDef = rules.find(rule => rule.id === r.rule_id)
                  return (
                    <div key={idx} style={{
                      padding: '8px 12px', marginBottom: 4, borderRadius: 6,
                      background: r.status === 'fired' ? sev.bg : r.status === 'unevaluable' ? '#fef9c3' : '#f5f4f0',
                      border: `1px solid ${r.status === 'fired' ? sev.border : '#e8e6e0'}`,
                      fontSize: 12,
                    }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: r.status === 'fired' ? sev.color : '#555' }}>
                          {ruleDef?.name || `Rule #${r.rule_id}`}
                        </span>
                        {r._itemLabel && (
                          <span style={{ fontSize: 10, color: '#888', background: '#f0eefc', padding: '1px 5px', borderRadius: 3 }}>
                            {r._itemLabel}
                          </span>
                        )}
                        {r.part_label && (
                          <span style={{ fontSize: 10, color: '#888' }}>
                            {r.part_label}
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: r.status === 'fired' ? sev.color : r.status === 'unevaluable' ? '#92400e' : '#15803d', fontWeight: 500 }}>
                          {r.status === 'fired' ? 'Fired' : r.status === 'unevaluable' ? 'Could not evaluate' : 'Passed'}
                        </span>
                      </div>
                      {r.status === 'fired' && <div style={{ color: sev.color }}>{r.message}</div>}
                      {r.status === 'unevaluable' && r.missing.length > 0 && (
                        <div style={{ color: '#92400e', fontSize: 11 }}>Missing: {r.missing.join(', ')}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      {editingRule && (
        <RuleModal
          rule={editingRule}
          groups={groups}
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

// ── Rule Edit Modal ──────────────────────────────────────────────────────────

function RuleModal({ rule, groups, onSave, onCancel, onDelete }) {
  const [draft, setDraft] = useState({ ...rule })
  const [saving, setSaving] = useState(false)

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

  const modalInput = {
    fontSize: 13, border: '1px solid #e0ddd8', borderRadius: 6,
    padding: '6px 10px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
  }

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
          width: 640, maxHeight: '90vh', overflow: 'auto',
          background: '#fff', borderRadius: 12,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>
            {rule._unsaved ? 'New Validation Rule' : 'Edit Validation Rule'}
          </div>
          <button onClick={onCancel} style={{ fontSize: 18, color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>x</button>
        </div>

        {/* Fields */}
        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Name</label>
              <input type="text" value={draft.name ?? ''} onChange={e => set('name', e.target.value)} style={modalInput} />
            </div>
            <div>
              <label style={labelStyle}>Group</label>
              <select value={draft.group_id ?? ''} onChange={e => set('group_id', Number(e.target.value))} style={{ ...modalInput, cursor: 'pointer' }}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Severity</label>
              <select value={draft.severity} onChange={e => set('severity', e.target.value)} style={{ ...modalInput, cursor: 'pointer' }}>
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Level</label>
              <select value={draft.level} onChange={e => set('level', e.target.value)} style={{ ...modalInput, cursor: 'pointer' }}>
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Loop Target</label>
              <select value={draft.loop_target ?? ''} onChange={e => set('loop_target', e.target.value || null)} style={{ ...modalInput, cursor: 'pointer' }}>
                <option value="">-- per item --</option>
                {LOOP_TARGETS.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Condition</label>
            <textarea
              value={draft.condition ?? ''}
              onChange={e => set('condition', e.target.value)}
              rows={3}
              style={{ ...modalInput, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
            />
          </div>

          <div>
            <label style={labelStyle}>Message</label>
            <textarea
              value={draft.message ?? ''}
              onChange={e => set('message', e.target.value)}
              rows={2}
              style={{ ...modalInput, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 14 }}>
            <div>
              <label style={labelStyle}>Sort Order</label>
              <input type="number" value={draft.sort_order ?? ''} onChange={e => set('sort_order', parseInt(e.target.value, 10) || 0)} style={{ ...modalInput, width: 80 }} />
            </div>
            <div>
              <label style={labelStyle}>Active</label>
              <div style={{ paddingTop: 4 }}>
                <input type="checkbox" checked={!!draft.is_active} onChange={e => set('is_active', e.target.checked)} style={{ cursor: 'pointer', width: 16, height: 16 }} />
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Comment</label>
            <textarea
              value={draft.comment ?? ''}
              onChange={e => set('comment', e.target.value)}
              rows={2}
              style={{ ...modalInput, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          {draft.blocked_reason && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 11, color: '#991b1b' }}>
              Blocked: {draft.blocked_reason}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {!rule._unsaved && (
              <button onClick={onDelete} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 7, border: '1px solid #f5c0c0', background: '#fff', color: '#c0392b', cursor: 'pointer' }}>
                Delete
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={{ fontSize: 13, padding: '6px 14px', borderRadius: 7, border: '1px solid #e0ddd8', background: '#fff', color: '#555', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ fontSize: 13, padding: '6px 16px', borderRadius: 7, border: 'none', background: '#3d35a8', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontWeight: 500 }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
