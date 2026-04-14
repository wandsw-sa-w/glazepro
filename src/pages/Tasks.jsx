import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'

const SORT_OPTIONS = [
  { label: 'Due date (soonest first)', value: 'due_asc' },
  { label: 'Due date (latest first)', value: 'due_desc' },
  { label: 'Created date (newest first)', value: 'created_desc' },
]

const DEFAULT_FILTERS = { status: 'incomplete', assignedTo: '', sort: 'due_asc' }

export default function Tasks() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { users } = useUsers()
  const unmatchedCount = useUnmatchedCount()

  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [showCompleted, setShowCompleted] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => { fetchTasks() }, [])

  async function fetchTasks() {
    setLoading(true)
    const { data } = await supabase
      .from('lead_tasks')
      .select('*, leads(lead_number, property_road, property_town)')
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function toggleComplete(task) {
    const nowCompleted = !task.completed
    await supabase.from('lead_tasks').update({
      completed: nowCompleted,
      completed_at: nowCompleted ? new Date().toISOString() : null,
    }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id
      ? { ...t, completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null }
      : t
    ))
  }

  async function deleteTask(id) {
    await supabase.from('lead_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const isOverdue = t => !t.completed && t.due_date && t.due_date < today
  const isDueToday = t => t.due_date === today

  // ── Metrics ──────────────────────────────────────────────────────────────────
  const total          = tasks.length
  const incomplete     = tasks.filter(t => !t.completed).length
  const overdueCount   = tasks.filter(isOverdue).length
  const completedToday = tasks.filter(t => t.completed && t.completed_at?.slice(0, 10) === today).length

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filtered = tasks.filter(t => {
    if (filters.status === 'incomplete' && t.completed)    return false
    if (filters.status === 'completed'  && !t.completed)   return false
    if (filters.status === 'overdue'    && !isOverdue(t))  return false
    if (filters.assignedTo && t.assigned_to !== filters.assignedTo) return false
    return true
  })

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const sorted = [...filtered].sort((a, b) => {
    if (filters.sort === 'due_asc' || filters.sort === 'due_desc') {
      const dir = filters.sort === 'due_asc' ? 1 : -1
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date) * dir
    }
    return (b.created_at || '').localeCompare(a.created_at || '')
  })

  const incompleteTasks = sorted.filter(t => !t.completed)
  const completedTasks  = sorted.filter(t =>  t.completed)

  const setFilter = (key, val) => setFilters(p => ({ ...p, [key]: val }))
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'inherit' }}>

      {/* Sidebar */}
      <div style={{ width: 215, background: '#fff', borderRight: '1px solid #e8e6e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>GlazePro</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Window management</div>
        </div>
        <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Workflow</div>
        {[
          ['Leads',             '/leads',              null],
          ['Quotes & orders',   null,                  null],
          ['Production',        null,                  null],
          ['Scheduling',        '/calendar',           null],
          ['Invoicing',         null,                  null],
          ['Tasks',             '/tasks',              null],
          ['Unmatched emails',  '/unmatched-emails',   unmatchedCount || null],
        ].map(([item, path, badge]) => {
          const active = item === 'Tasks'
          return (
            <div
              key={item}
              onClick={path ? () => navigate(path) : undefined}
              style={{
                padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                color: active ? '#3d35a8' : path ? '#555' : '#aaa',
                fontWeight: active ? 500 : 400,
                background: active ? '#f0eefc' : 'transparent',
                cursor: path ? 'pointer' : 'not-allowed',
                opacity: path ? 1 : 0.5,
              }}
            >
              <span>{item}</span>
              {badge > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#fceaea', color: '#8b2020', fontWeight: 600, flexShrink: 0 }}>{badge}</span>}
            </div>
          )
        })}
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

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Tasks</div>
        </div>

        {/* Toolbar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e8e6e0', padding: '10px 20px', display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#888' }}>Status</label>
            <select
              value={filters.status}
              onChange={e => setFilter('status', e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff', cursor: 'pointer', minWidth: 150 }}
            >
              <option value="">All tasks</option>
              <option value="incomplete">Incomplete</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#888' }}>Assigned to</label>
            <select
              value={filters.assignedTo}
              onChange={e => setFilter('assignedTo', e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff', cursor: 'pointer', minWidth: 160 }}
            >
              <option value="">All staff</option>
              {users.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 500, color: '#888' }}>Sort</label>
            <select
              value={filters.sort}
              onChange={e => setFilter('sort', e.target.value)}
              style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff', cursor: 'pointer', minWidth: 220 }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              style={{ fontSize: 12, padding: '6px 13px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500, color: '#555' }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>

          {/* Metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total tasks',     value: total,          accent: '#3d35a8', bg: '#f0eefc' },
              { label: 'Incomplete',      value: incomplete,     accent: '#7a4a08', bg: '#faeeda' },
              { label: 'Overdue',         value: overdueCount,   accent: '#8b2020', bg: '#fceaea' },
              { label: 'Completed today', value: completedToday, accent: '#0a5a3c', bg: '#e1f5ee' },
            ].map(m => (
              <div key={m.label} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 500, marginBottom: 8 }}>{m.label}</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: m.accent, lineHeight: 1 }}>{m.value}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: 60 }}>Loading tasks…</div>
          ) : (
            <>
              {/* Incomplete section */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#555', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Incomplete · {incompleteTasks.length}
                </div>
                {incompleteTasks.length === 0 ? (
                  <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 32, background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12 }}>
                    No incomplete tasks
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {incompleteTasks.map(task => {
                      const lead = task.leads
                      const overdue = isOverdue(task)
                      const dueToday = isDueToday(task)
                      const dueDateColor = overdue ? '#8b2020' : dueToday ? '#7a4a08' : '#0a5a3c'
                      const dueDateBg = overdue ? '#fceaea' : dueToday ? '#faeeda' : '#e1f5ee'
                      return (
                        <div key={task.id} style={{ background: '#fff', border: `1px solid ${overdue ? '#f0c8c8' : '#e8e6e0'}`, borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => toggleComplete(task)}
                              style={{ marginTop: 3, width: 15, height: 15, cursor: 'pointer', accentColor: '#3d35a8', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#222' }}>{task.subject}</span>
                                {task.assigned_to && (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#eeedfe', color: '#4a3ab0', fontWeight: 500 }}>
                                    {task.assigned_to}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: task.notes ? 6 : 0 }}>
                                {task.due_date && (
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500, background: dueDateBg, color: dueDateColor }}>
                                    {overdue ? 'Overdue · ' : dueToday ? 'Due today · ' : ''}
                                    {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                                {lead && (
                                  <span
                                    onClick={e => { e.stopPropagation(); navigate(`/leads/${task.lead_id}`) }}
                                    style={{ fontSize: 11, color: '#3d35a8', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}
                                  >
                                    {[lead.lead_number, lead.property_road, lead.property_town].filter(Boolean).join(' · ')}
                                  </span>
                                )}
                              </div>
                              {task.notes && (
                                <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>{task.notes}</div>
                              )}
                            </div>
                            <button
                              onClick={() => deleteTask(task.id)}
                              style={{ fontSize: 11, padding: '3px 9px', border: '1px solid #e8d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#8b2020', flexShrink: 0 }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Completed section */}
              {completedTasks.length > 0 && (
                <div>
                  <div
                    onClick={() => setShowCompleted(v => !v)}
                    style={{ fontSize: 12, fontWeight: 600, color: '#aaa', letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: showCompleted ? 10 : 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, userSelect: 'none' }}
                  >
                    <span style={{ fontSize: 9 }}>{showCompleted ? '▼' : '▶'}</span>
                    Completed · {completedTasks.length}
                  </div>
                  {showCompleted && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {completedTasks.map(task => {
                        const lead = task.leads
                        return (
                          <div key={task.id} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '12px 14px', opacity: 0.6 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => toggleComplete(task)}
                                style={{ marginTop: 3, width: 15, height: 15, cursor: 'pointer', accentColor: '#3d35a8', flexShrink: 0 }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: '#aaa', textDecoration: 'line-through' }}>{task.subject}</span>
                                  {task.assigned_to && (
                                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f5f4f0', color: '#888', fontWeight: 500 }}>
                                      {task.assigned_to}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: task.notes ? 6 : 0 }}>
                                  {task.due_date && (
                                    <span style={{ fontSize: 11, color: '#aaa' }}>
                                      {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  )}
                                  {task.completed_at && (
                                    <span style={{ fontSize: 11, color: '#aaa' }}>
                                      Completed {new Date(task.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                  )}
                                  {lead && (
                                    <span
                                      onClick={e => { e.stopPropagation(); navigate(`/leads/${task.lead_id}`) }}
                                      style={{ fontSize: 11, color: '#3d35a8', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                      {[lead.lead_number, lead.property_road, lead.property_town].filter(Boolean).join(' · ')}
                                    </span>
                                  )}
                                </div>
                                {task.notes && (
                                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>{task.notes}</div>
                                )}
                              </div>
                              <button
                                onClick={() => deleteTask(task.id)}
                                style={{ fontSize: 11, padding: '3px 9px', border: '1px solid #e8d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#8b2020', flexShrink: 0 }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
