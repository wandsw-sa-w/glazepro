import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

// ─── Constants ───────────────────────────────────────────────────────────────

const STAFF = ['Tom B', 'Dave K', 'Sarah W', 'John Smith']
const APPT_TYPES = ['Survey', 'Installation', 'Snagging', 'Other']
const TYPE_COLOUR = {
  Survey:       { bg: '#e6f0fb', color: '#1a5fa8', border: '#b0cff0' },
  Installation: { bg: '#e1f5ee', color: '#0a5a3c', border: '#a0d9c0' },
  Snagging:     { bg: '#faeeda', color: '#7a4a08', border: '#f0c880' },
  Other:        { bg: '#eeedfe', color: '#4a3ab0', border: '#c0b8f0' },
}
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SLOT_H = 28 // px per 30-min slot

// 07:30 → 17:30 in 30-min steps = 21 slots
const SLOTS = []
for (let min = 7 * 60 + 30; min <= 17 * 60 + 30; min += 30) {
  SLOTS.push(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`)
}
const START_MIN = 7 * 60 + 30
const TOTAL_H = SLOTS.length * SLOT_H

const EMPTY_FORM = {
  title: '', type: 'Survey', date: '', start_time: '',
  end_time: '', assigned_to: STAFF[0], lead_ref: '', notes: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonday(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d
}
function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function parseTime(str) {
  if (!str) return 0
  const [h, m] = str.split(':').map(Number)
  return h * 60 + m
}
function calcTop(timeStr) {
  return ((parseTime(timeStr) - START_MIN) / 30) * SLOT_H
}
function calcHeight(startStr, endStr) {
  const mins = parseTime(endStr) - parseTime(startStr)
  return Math.max((mins / 30) * SLOT_H, SLOT_H / 2)
}
function addOneHour(timeStr) {
  const min = parseTime(timeStr) + 60
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Calendar() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const filterRef = useRef(null)

  const [weekOffset, setWeekOffset] = useState(0)
  const [appointments, setAppointments] = useState([])
  const [filterStaff, setFilterStaff] = useState([...STAFF])
  const [showFilter, setShowFilter] = useState(false)
  const [modal, setModal] = useState(null)   // { mode: 'new'|'detail'|'edit', appt? }
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Derived
  const today = new Date()
  const monday = addDays(getMonday(today), weekOffset * 7)
  const weeks = [0, 1, 2, 3, 4, 5].map(i => addDays(monday, i * 7))
  const rangeEnd = addDays(monday, 6 * 7 + 6)
  const todayStr = formatDate(today)

  const fmtShort = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const fmtFull  = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const rangeLabel = `${fmtShort(monday)} – ${fmtFull(rangeEnd)}`

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function onMouseDown(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Fetch appointments whenever the visible range changes
  useEffect(() => { fetchAppointments() }, [weekOffset])

  async function fetchAppointments() {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .gte('date', formatDate(monday))
      .lte('date', formatDate(rangeEnd))
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    setAppointments(data || [])
  }

  async function saveAppointment() {
    if (!form.title.trim()) return
    setSaving(true)
    if (modal.mode === 'new') {
      await supabase.from('appointments').insert([{ ...form, created_at: new Date().toISOString() }])
    } else {
      await supabase.from('appointments').update(form).eq('id', modal.appt.id)
    }
    await fetchAppointments()
    closeModal()
    setSaving(false)
  }

  async function deleteAppointment(id) {
    await supabase.from('appointments').delete().eq('id', id)
    await fetchAppointments()
    closeModal()
  }

  function closeModal() { setModal(null); setForm(EMPTY_FORM) }

  function openNew(date, time) {
    setForm({ ...EMPTY_FORM, date, start_time: time, end_time: addOneHour(time) })
    setModal({ mode: 'new' })
  }

  function openDetail(appt) { setModal({ mode: 'detail', appt }) }

  function openEdit(appt) {
    setForm({
      title: appt.title || '', type: appt.type || 'Survey',
      date: appt.date || '', start_time: appt.start_time || '',
      end_time: appt.end_time || '', assigned_to: appt.assigned_to || STAFF[0],
      lead_ref: appt.lead_ref || '', notes: appt.notes || '',
    })
    setModal({ mode: 'edit', appt })
  }

  const iStyle = {
    fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf',
    borderRadius: 8, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit',
  }

  function FormField({ label, children }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{label}</label>
        {children}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'inherit' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 215, background: '#fff', borderRight: '1px solid #e8e6e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>GlazePro</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Window management</div>
        </div>
        <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Workflow</div>
        {[
          ['Lead capture', '/leads'],
          ['Calendar', '/calendar'],
          ['Quotes & orders', null],
          ['Production', null],
          ['Scheduling', null],
          ['Invoicing', null],
        ].map(([item, path]) => {
          const active = item === 'Calendar'
          return (
            <div
              key={item}
              onClick={path ? () => navigate(path) : undefined}
              style={{
                padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px',
                color: active ? '#3d35a8' : '#aaa',
                fontWeight: active ? 500 : 400,
                background: active ? '#f0eefc' : 'transparent',
                cursor: path ? 'pointer' : 'not-allowed',
                opacity: path ? 1 : 0.5,
              }}
            >
              {item}
            </div>
          )
        })}
        <div style={{ marginTop: 'auto', padding: 13, borderTop: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <button onClick={signOut} style={{ fontSize: 11, padding: '5px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#555' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Toolbar */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 8, flexShrink: 0 }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ fontSize: 12, padding: '6px 11px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500 }}>← Prev</button>
          <button
            onClick={() => setWeekOffset(0)}
            style={{ fontSize: 12, padding: '6px 11px', border: '1px solid #d8d5cf', borderRadius: 8, background: weekOffset === 0 ? '#f0eefc' : '#fff', color: weekOffset === 0 ? '#3d35a8' : '#555', cursor: 'pointer', fontWeight: 500 }}
          >
            Today
          </button>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ fontSize: 12, padding: '6px 11px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500 }}>Next →</button>

          <div style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#333' }}>{rangeLabel}</div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 8 }}>
            {APPT_TYPES.map(t => {
              const c = TYPE_COLOUR[t]
              return <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.color, fontWeight: 500, border: `1px solid ${c.border}` }}>{t}</span>
            })}
          </div>

          {/* Staff filter */}
          <div ref={filterRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFilter(v => !v)}
              style={{ fontSize: 12, padding: '6px 11px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
            >
              {filterStaff.length === STAFF.length ? 'All staff' : `${filterStaff.length} staff`} ▾
            </button>
            {showFilter && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '6px 0', zIndex: 50, minWidth: 160, boxShadow: '0 4px 16px rgba(0,0,0,.1)' }}>
                {STAFF.map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={filterStaff.includes(s)}
                      onChange={() => setFilterStaff(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                    />
                    {s}
                  </label>
                ))}
                <div style={{ borderTop: '1px solid #f0eeea', marginTop: 4, padding: '6px 14px', display: 'flex', gap: 10 }}>
                  <button onClick={() => setFilterStaff([...STAFF])} style={{ fontSize: 11, color: '#3d35a8', cursor: 'pointer', border: 'none', background: 'none', padding: 0, fontWeight: 500 }}>All</button>
                  <button onClick={() => setFilterStaff([])} style={{ fontSize: 11, color: '#888', cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}>None</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Calendar body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#f5f4f0' }}>
          {weeks.map((weekMon, wi) => (
            <div key={wi} style={{ marginBottom: 16, background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>

              {/* Week label row */}
              <div style={{ padding: '7px 14px', background: '#faf9f7', borderBottom: '1px solid #e8e6e0', fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: '.04em' }}>
                {weekMon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>

              <div style={{ display: 'flex' }}>

                {/* Time label gutter */}
                <div style={{ width: 46, flexShrink: 0, borderRight: '1px solid #f0eeea', position: 'relative' }}>
                  {/* Header spacer */}
                  <div style={{ height: 38, borderBottom: '1px solid #e8e6e0' }} />
                  {/* Time labels */}
                  <div style={{ position: 'relative', height: TOTAL_H }}>
                    {SLOTS.map((slot, si) => {
                      const show = slot === '07:30' || slot.endsWith(':00')
                      if (!show) return null
                      return (
                        <div key={slot} style={{ position: 'absolute', top: si * SLOT_H - 6, left: 0, right: 4, textAlign: 'right', fontSize: 9, color: '#c0bdb8', lineHeight: 1 }}>
                          {slot}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Day columns */}
                {DAY_NAMES.map((dayName, di) => {
                  const day = addDays(weekMon, di)
                  const dayStr = formatDate(day)
                  const isToday = dayStr === todayStr
                  const dayAppts = appointments.filter(a =>
                    a.date === dayStr &&
                    (filterStaff.length === 0 || filterStaff.includes(a.assigned_to))
                  )

                  return (
                    <div key={di} style={{ flex: 1, borderLeft: '1px solid #f0eeea', minWidth: 0 }}>

                      {/* Day header */}
                      <div style={{
                        height: 38, display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', borderBottom: '1px solid #e8e6e0',
                        background: isToday ? '#f0eefc' : 'transparent',
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: isToday ? '#3d35a8' : '#bbb' }}>{dayName}</span>
                        <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? '#3d35a8' : '#444', lineHeight: 1.2 }}>{day.getDate()}</span>
                      </div>

                      {/* Slots + appointments */}
                      <div style={{ position: 'relative', height: TOTAL_H }}>

                        {/* Click targets / slot lines */}
                        {SLOTS.map((slot, si) => (
                          <div
                            key={slot}
                            title={`New appointment ${dayStr} ${slot}`}
                            onClick={() => openNew(dayStr, slot)}
                            style={{
                              position: 'absolute', top: si * SLOT_H, height: SLOT_H, left: 0, right: 0,
                              borderBottom: `1px solid ${slot.endsWith(':00') ? '#eeece8' : '#f5f4f2'}`,
                              cursor: 'pointer',
                            }}
                          />
                        ))}

                        {/* Appointment blocks */}
                        {dayAppts.map(appt => {
                          const c = TYPE_COLOUR[appt.type] || TYPE_COLOUR.Other
                          const top = calcTop(appt.start_time)
                          const height = calcHeight(appt.start_time, appt.end_time)
                          if (top < 0 || top >= TOTAL_H) return null
                          return (
                            <div
                              key={appt.id}
                              onClick={e => { e.stopPropagation(); openDetail(appt) }}
                              style={{
                                position: 'absolute', top: top + 1, left: 2, right: 2,
                                height: Math.min(height - 2, TOTAL_H - top - 2),
                                background: c.bg, border: `1px solid ${c.border}`,
                                borderLeft: `3px solid ${c.color}`,
                                borderRadius: 4, padding: '2px 4px',
                                cursor: 'pointer', overflow: 'hidden', zIndex: 2,
                              }}
                            >
                              <div style={{ fontSize: 10, fontWeight: 700, color: c.color, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {appt.title}
                              </div>
                              {height >= SLOT_H && (
                                <div style={{ fontSize: 9, color: c.color, opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {appt.assigned_to}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 480, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0eeea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {modal.mode === 'new' ? 'New appointment' : modal.mode === 'edit' ? 'Edit appointment' : 'Appointment details'}
              </div>
              <button onClick={closeModal} style={{ fontSize: 22, color: '#aaa', cursor: 'pointer', border: 'none', background: 'none', lineHeight: 1 }}>×</button>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {modal.mode === 'detail' ? (
                // ── Detail view
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Type',        modal.appt.type],
                    ['Date',        modal.appt.date],
                    ['Start',       modal.appt.start_time],
                    ['End',         modal.appt.end_time],
                    ['Assigned to', modal.appt.assigned_to],
                    ['Lead ref',    modal.appt.lead_ref],
                    ['Notes',       modal.appt.notes],
                  ].map(([label, val]) => val ? (
                    <div key={label} style={{ display: 'flex', gap: 16, fontSize: 13, padding: '5px 0', borderBottom: '1px solid #f5f4f0' }}>
                      <span style={{ minWidth: 90, color: '#888', fontSize: 12, flexShrink: 0 }}>{label}</span>
                      <span style={{ fontWeight: 500 }}>{val}</span>
                    </div>
                  ) : null)}
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, padding: '5px 0', borderBottom: '1px solid #f5f4f0' }}>
                    <span style={{ minWidth: 90, color: '#888', fontSize: 12, flexShrink: 0 }}>Title</span>
                    <span style={{ fontWeight: 600 }}>{modal.appt.title}</span>
                  </div>
                </div>
              ) : (
                // ── New / Edit form
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Title</label>
                    <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Survey – 14 Elm Road" style={iStyle} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Type</label>
                    <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={{ ...iStyle, background: '#fff' }}>
                      {APPT_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Date</label>
                      <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={iStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Start</label>
                      <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} style={iStyle} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>End</label>
                      <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={iStyle} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Assigned to</label>
                    <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} style={{ ...iStyle, background: '#fff' }}>
                      {STAFF.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Lead reference <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span></label>
                    <input value={form.lead_ref} onChange={e => setForm(p => ({ ...p, lead_ref: e.target.value }))} placeholder="e.g. L123456" style={iStyle} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Notes</label>
                    <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ ...iStyle, resize: 'none' }} />
                  </div>
                </>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f0eeea', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
              {modal.mode === 'detail' ? (
                <>
                  <button
                    onClick={() => deleteAppointment(modal.appt.id)}
                    style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #e8d0d0', borderRadius: 8, background: '#fff', cursor: 'pointer', color: '#8b2020', fontWeight: 500 }}
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => openEdit(modal.appt)}
                    style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Edit
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={closeModal}
                    style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveAppointment}
                    disabled={saving || !form.title.trim()}
                    style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: saving || !form.title.trim() ? '#9993d4' : '#3d35a8', color: '#fff', cursor: saving || !form.title.trim() ? 'default' : 'pointer', fontWeight: 500 }}
                  >
                    {saving ? 'Saving…' : modal.mode === 'edit' ? 'Save changes' : 'Save'}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
