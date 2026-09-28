import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Layout, LeadsSubNav, SearchOverlay } from '../components/Layout'

const ACCENT = '#3d35a8'

// ── Reference lists ────────────────────────────────────────────────────────────

const STAGES = [
  'New', 'In contact with customer', 'Budget quote provided',
  'Appointment arranged', 'Pending', 'Won', 'Rejected', 'Lost',
  'Historical remedial', 'Contact failed', 'Appointment cancelled', 'Quoted',
]

const STAGE_COLOURS = {
  New: { bg: '#e6f0fb', color: '#1a5fa8' },
  'In contact with customer': { bg: '#faeeda', color: '#7a4a08' },
  'Budget quote provided': { bg: '#eeedfe', color: '#4a3ab0' },
  'Appointment arranged': { bg: '#e1f5ee', color: '#0a5a3c' },
  Pending: { bg: '#f5f4f0', color: '#666' },
  Won: { bg: '#d4edda', color: '#155724' },
  Rejected: { bg: '#fceaea', color: '#8b2020' },
  Lost: { bg: '#fceaea', color: '#8b2020' },
  'Historical remedial': { bg: '#f5f0e8', color: '#7a4a08' },
  'Contact failed': { bg: '#fceaea', color: '#8b2020' },
  'Appointment cancelled': { bg: '#fceaea', color: '#8b2020' },
  Quoted: { bg: '#eeedfe', color: '#4a3ab0' },
}

const SOURCES = [
  'Online presence', 'Recommendation', 'Repeat customer',
  'FRS presence', 'SRS presence', 'Physical presence', 'Historical remedial',
]

const SOURCE_COLOURS = {
  'Online presence': { bg: '#e6f0fb', color: '#1a5fa8' },
  'Recommendation': { bg: '#eaf3de', color: '#2e6010' },
  'Repeat customer': { bg: '#eeedfe', color: '#4a3ab0' },
  'FRS presence': { bg: '#faeeda', color: '#7a4a08' },
  'SRS presence': { bg: '#e1f5ee', color: '#0a5a3c' },
  'Physical presence': { bg: '#f5f0e8', color: '#7a4a08' },
  'Historical remedial': { bg: '#f5f4f0', color: '#666' },
}

const LEAD_TAGS = [
  'Awaiting deposit', 'Awaiting planning', 'Stained glass required',
  'PSA', 'Pre Order', 'Second Survey Required',
]

const LEAD_TAG_COLOURS = {
  'Awaiting deposit': { bg: '#faeeda', color: '#7a4a08' },
  'Awaiting planning': { bg: '#e6f0fb', color: '#1a5fa8' },
  'Stained glass required': { bg: '#eeedfe', color: '#4a3ab0' },
  PSA: { bg: '#fceaea', color: '#8b2020' },
  'Pre Order': { bg: '#e1f5ee', color: '#0a5a3c' },
  'Second Survey Required': { bg: '#f5f0e8', color: '#7a4a08' },
}

const PRIORITY_DOT = { High: '#e24b4a', Medium: '#ef9f27', Low: '#639922' }

const WINDOW_TYPES = ['Sash windows', 'Casement windows', 'Timber doors', 'Fixed lights']
const SECTORS = ['Residential', 'Commercial', 'Heritage', 'Landlord', 'Developer']

const TIME_SLOTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00',
]

// ── Date preset helpers ────────────────────────────────────────────────────────

function dateRangeFor(preset) {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  switch (preset) {
    case 'day':
      return { from: today, to: today }
    case 'week': {
      const d = new Date(now)
      const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1)
      return { from: d.toISOString().slice(0, 10), to: today }
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: d.toISOString().slice(0, 10), to: today }
    }
    case 'year': {
      const d = new Date(now.getFullYear(), 0, 1)
      return { from: d.toISOString().slice(0, 10), to: today }
    }
    default:
      return { from: '', to: '' }
  }
}

// ── Small shared components ────────────────────────────────────────────────────

function Chip({ text, colourMap }) {
  const c = (colourMap || {})[text] || { bg: '#f0eeea', color: '#666' }
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

function Toggle({ on, onChange, label }) {
  return (
    <div onClick={() => onChange(!on)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ width: 36, height: 20, borderRadius: 999, background: on ? ACCENT : '#d8d5cf', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: on ? 18 : 2, transition: 'left .2s' }} />
      </div>
      <span style={{ fontSize: 12, color: on ? ACCENT : '#888', fontWeight: on ? 500 : 400 }}>{label}</span>
    </div>
  )
}

function SegmentPicker({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = value === opt
        return (
          <div key={opt} onClick={() => onChange(opt)} style={{ fontSize: 12, padding: '6px 13px', borderRadius: 8, cursor: 'pointer', fontWeight: 500, border: `1px solid ${active ? '#b0a8f0' : '#d8d5cf'}`, background: active ? '#f0eefc' : '#fff', color: active ? ACCENT : '#555' }}>
            {opt}
          </div>
        )
      })}
    </div>
  )
}

function MultiPicker({ options, value, onChange }) {
  function toggle(opt) { onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]) }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = value.includes(opt)
        return (
          <div key={opt} onClick={() => toggle(opt)} style={{ fontSize: 12, padding: '6px 13px', borderRadius: 8, cursor: 'pointer', fontWeight: 500, border: `1px solid ${active ? '#b0a8f0' : '#d8d5cf'}`, background: active ? '#f0eefc' : '#fff', color: active ? ACCENT : '#555' }}>
            {opt}
          </div>
        )
      })}
    </div>
  )
}

function Field({ label, span, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: span ? '1 / -1' : undefined }}>
      <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  )
}

const iStyle = { fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }

function SectionHead({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0eeea' }}>
      {children}
    </div>
  )
}

// ── Sorting helpers ────────────────────────────────────────────────────────────

function SortHd({ label, col, sort, onSort, style }) {
  const active = sort.col === col
  return (
    <th
      onClick={() => onSort(col)}
      style={{ textAlign: 'left', padding: '9px 12px', fontSize: 11, color: active ? ACCENT : '#888', borderBottom: '1px solid #eeece8', fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
    >
      {label}
      {active && <span style={{ marginLeft: 4 }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )
}

// ── Filter panel ───────────────────────────────────────────────────────────────

function FilterPanel({ dateLeads, pending, setPending, onApply, onReset }) {
  const { tags, sources, statuses } = pending

  function tagCounts() {
    return Object.fromEntries(LEAD_TAGS.map(t => [t, dateLeads.filter(l => {
      const lt = l.lead_tags ? l.lead_tags.split(',').map(x => x.trim()).filter(Boolean) : []
      return lt.includes(t)
    }).length]))
  }
  function srcCounts() {
    return Object.fromEntries(SOURCES.map(s => [s, dateLeads.filter(l => l.source === s).length]))
  }
  function stsCounts() {
    return Object.fromEntries(STAGES.map(s => [s, dateLeads.filter(l => l.stage === s).length]))
  }

  const tc = tagCounts(), sc = srcCounts(), stc = stsCounts()

  function toggleItem(key, list, setFn) {
    return item => setPending(p => ({
      ...p,
      [key]: p[key].includes(item) ? p[key].filter(x => x !== item) : [...p[key], item],
    }))
  }

  function CheckCol({ title, items, counts, selected, onToggle }) {
    const allSelected = items.every(i => selected.includes(i))
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setPending(p => ({ ...p, [title.toLowerCase()]: items }))} style={{ fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', color: ACCENT, padding: 0, fontFamily: 'inherit' }}>All</button>
          <span style={{ color: '#ddd' }}>|</span>
          <button onClick={() => setPending(p => ({ ...p, [title.toLowerCase()]: [] }))} style={{ fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', color: '#888', padding: 0, fontFamily: 'inherit' }}>None</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map(item => (
            <label key={item} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: '#555' }}>
              <input
                type="checkbox"
                checked={selected.includes(item)}
                onChange={() => onToggle(item)}
                style={{ accentColor: ACCENT, cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ flex: 1 }}>{item}</span>
              <span style={{ fontSize: 11, color: '#aaa', minWidth: 20, textAlign: 'right' }}>{counts[item] || 0}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
        <CheckCol
          title="Tags"
          items={LEAD_TAGS}
          counts={tc}
          selected={tags}
          onToggle={toggleItem('tags', tags)}
        />
        <CheckCol
          title="Sources"
          items={SOURCES}
          counts={sc}
          selected={sources}
          onToggle={toggleItem('sources', sources)}
        />
        <CheckCol
          title="Statuses"
          items={STAGES}
          counts={stc}
          selected={statuses}
          onToggle={toggleItem('statuses', statuses)}
        />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #f0eeea' }}>
        <button
          onClick={onApply}
          style={{ fontSize: 12, padding: '7px 18px', border: 'none', borderRadius: 8, background: ACCENT, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
        >
          Apply
        </button>
        <button
          onClick={onReset}
          style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500, color: '#555', fontFamily: 'inherit' }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}

// ── Board (Kanban) view — kept from original ───────────────────────────────────

function BoardView({ leads }) {
  const navigate = useNavigate()
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 8 }}>
      {STAGES.map(stage => {
        const sl = leads.filter(l => l.stage === stage)
        return (
          <div key={stage} style={{ background: '#faf9f7', borderRadius: 12, padding: 12, minWidth: 220, flex: '0 0 220px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {stage}
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, fontWeight: 500, ...STAGE_COLOURS[stage] }}>{sl.length}</span>
            </div>
            {sl.length === 0 && <div style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '20px 0' }}>No leads</div>}
            {sl.map(lead => {
              const mc = getMainContact(lead)
              return (
                <div key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '12px 13px', marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[lead.priority] ?? '#ccc', flexShrink: 0 }} />
                    <div style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>{lead.lead_number}</div>
                  </div>
                  {mc && <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{[mc.title, mc.first_name, mc.last_name].filter(Boolean).join(' ')}</div>}
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
                    {lead.property_road && <div>{lead.property_road}</div>}
                    {lead.property_town && <div>{lead.property_town}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                    <Chip text={lead.source} colourMap={SOURCE_COLOURS} />
                    <span style={{ fontSize: 11, color: '#aaa' }}>{new Date(lead.created_at).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function getMainContact(lead) {
  if (!lead.lead_contacts?.length) return null
  const main = lead.lead_contacts.find(lc => lc.is_main_contact) || lead.lead_contacts[0]
  return main?.contacts
}

// ── New lead modal — kept from original ───────────────────────────────────────

const EMPTY_FORM = {
  contact_title: '', contact_first_name: '', contact_last_name: '',
  contact_phone: '', contact_email: '',
  property_postcode: '', property_road: '', property_address_2: '',
  property_town: '', property_address: '', contact_address: '',
  same_address: true, listed_building: false, conservation_area: false,
  window_types: [], estimated_units: '', sector: '', description: '',
  source: 'Online presence', priority: 'Medium', assigned_to: '', notes: '', stage: 'New',
  survey_date: '', survey_time: '', surveyor: '',
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Leads() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { users } = useUsers()
  const currentUser = useCurrentUser()

  // View: 'list' | 'board'
  const viewMode = searchParams.get('view') || 'list'

  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pcLoading, setPcLoading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showSearch, setShowSearch] = useState(false)

  // Date preset: 'day'|'week'|'month'|'year'|'range', default year
  const [datePreset, setDatePreset] = useState('year')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')

  // Filter panel open/closed (default open)
  const [filterOpen, setFilterOpen] = useState(true)

  // Pending (panel draft) vs applied filter state
  const emptyFilters = { tags: [], sources: [], statuses: [] }
  const [pendingFilters, setPendingFilters] = useState(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters)

  // Sort
  const [sort, setSort] = useState({ col: 'created_at', dir: 'desc' })

  // Pagination
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 100

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))

  useEffect(() => { fetchLeads() }, [])

  // Open modal if ?new=1
  useEffect(() => {
    if (searchParams.get('new') === '1') setShowModal(true)
    if (searchParams.get('search') === '1') setShowSearch(true)
  }, [])

  async function fetchLeads() {
    setLoading(true)
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        lead_contacts(id, is_main_contact, contact_id, contacts(title, first_name, last_name, phone, email)),
        quotes(id, status, created_at)
      `)
      .order('created_at', { ascending: false })
    if (!error) setLeads(data || [])
    setLoading(false)
  }

  // ── Date filtering ──────────────────────────────────────────────────────────

  const { from: dateFrom, to: dateTo } = useMemo(() => {
    if (datePreset === 'range') return { from: rangeFrom, to: rangeTo }
    return dateRangeFor(datePreset)
  }, [datePreset, rangeFrom, rangeTo])

  const dateFilteredLeads = useMemo(() => {
    if (!dateFrom) return leads
    return leads.filter(l => {
      const d = l.created_at?.slice(0, 10)
      return d >= dateFrom && d <= dateTo
    })
  }, [leads, dateFrom, dateTo])

  // ── Checkbox + sort filtering ───────────────────────────────────────────────

  const tableLeads = useMemo(() => {
    let result = [...dateFilteredLeads]
    const { tags, sources, statuses } = appliedFilters
    if (tags.length > 0) {
      result = result.filter(l => {
        const lt = l.lead_tags ? l.lead_tags.split(',').map(t => t.trim()).filter(Boolean) : []
        return tags.some(tag => lt.includes(tag))
      })
    }
    if (sources.length > 0) result = result.filter(l => sources.includes(l.source))
    if (statuses.length > 0) result = result.filter(l => statuses.includes(l.stage))

    // Sort
    result.sort((a, b) => {
      let av = a[sort.col], bv = b[sort.col]
      if (!av && !bv) return 0
      if (!av) return 1
      if (!bv) return -1
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      return sort.dir === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1)
    })

    return result
  }, [dateFilteredLeads, appliedFilters, sort])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(tableLeads.length / PAGE_SIZE))
  const pageLeads = tableLeads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSort(col) {
    setSort(prev => ({ col, dir: prev.col === col && prev.dir === 'desc' ? 'asc' : 'desc' }))
    setPage(0)
  }

  // ── Postcode lookup ─────────────────────────────────────────────────────────

  async function lookupPostcode() {
    const pc = form.property_postcode.trim().replace(/\s/g, '')
    if (!pc) return
    setPcLoading(true)
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${pc}`)
      const json = await res.json()
      if (json.status === 200) {
        const road = json.result.thoroughfare || json.result.dependent_thoroughfare || ''
        const town = json.result.post_town || json.result.admin_district || ''
        setForm(p => ({
          ...p, property_road: road, property_town: town,
          property_address: [road, town, json.result.postcode].filter(Boolean).join(', '),
        }))
      } else {
        alert('Postcode not found — please check and try again.')
      }
    } catch { alert('Postcode lookup failed — please check your connection.') }
    setPcLoading(false)
  }

  // ── Save new lead ───────────────────────────────────────────────────────────

  async function saveLead() {
    if (!form.contact_first_name.trim() && !form.contact_last_name.trim()) {
      alert('Please enter at least a first or last name for the contact.')
      return
    }
    setSaving(true)
    try {
      const leadNumber = 'L' + Date.now().toString().slice(-6)
      const { data: leadRows, error: le } = await supabase.from('leads').insert([{
        lead_number: leadNumber,
        property_address: form.property_address,
        property_address_2: form.property_address_2,
        property_postcode: form.property_postcode,
        property_road: form.property_road,
        property_town: form.property_town,
        contact_address: form.same_address ? form.property_address : form.contact_address,
        same_address: form.same_address,
        listed_building: form.listed_building,
        conservation_area: form.conservation_area,
        window_types: form.window_types.join(', '),
        estimated_units: form.estimated_units ? parseInt(form.estimated_units, 10) : null,
        description: form.description,
        sector: form.sector,
        source: form.source,
        priority: form.priority,
        stage: form.stage || 'New',
        assigned_to: form.assigned_to,
        notes: form.notes,
        survey_date: form.survey_date || null,
        survey_time: form.survey_time || null,
        surveyor: form.surveyor || null,
        created_at: new Date().toISOString(),
      }]).select()
      if (le) throw le

      const { data: contactRows, error: ce } = await supabase.from('contacts').insert([{
        title: form.contact_title, first_name: form.contact_first_name, last_name: form.contact_last_name,
        phone: form.contact_phone, email: form.contact_email, created_at: new Date().toISOString(),
      }]).select()
      if (ce) throw ce

      const { error: lke } = await supabase.from('lead_contacts').insert([{
        lead_id: leadRows[0].id, contact_id: contactRows[0].id, is_main_contact: true,
        created_at: new Date().toISOString(),
      }])
      if (lke) throw lke

      await fetchLeads()
      setShowModal(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      alert('Error saving lead: ' + err.message)
    }
    setSaving(false)
  }

  // ── Totals ──────────────────────────────────────────────────────────────────

  const quotedTotal = useMemo(() => {
    // Placeholder — total_amount not yet on quotes table
    return null
  }, [tableLeads])

  // ── Render ──────────────────────────────────────────────────────────────────

  const PRESET_LABELS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['range', 'Range']]

  return (
    <Layout
      subMenu={
        <LeadsSubNav
          activeView={viewMode}
          onAddNew={() => setShowModal(true)}
          onSearch={() => setShowSearch(true)}
        />
      }
    >
      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}

      {/* Page header */}
      <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', flex: 1 }}>Leads</div>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 500, background: '#e6f0fb', color: '#1a5fa8' }}>
          {leads.filter(l => l.stage === 'New').length} new
        </span>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 500, background: '#eaf3de', color: '#2e6010' }}>
          {leads.length} total
        </span>
        <button
          onClick={() => setShowModal(true)}
          style={{ fontSize: 12, padding: '7px 15px', border: 'none', borderRadius: 8, background: ACCENT, color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
        >
          + New lead
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 20, overflowY: 'auto', background: '#f5f4f0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#aaa', marginTop: 60 }}>Loading leads…</div>
        ) : viewMode === 'board' ? (
          <BoardView leads={leads} />
        ) : (
          /* ── LIST VIEW ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Date preset strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {PRESET_LABELS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setDatePreset(key); setPage(0) }}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: datePreset === key ? 700 : 400,
                    border: `1px solid ${datePreset === key ? ACCENT : '#d8d5cf'}`,
                    borderRadius: 8, cursor: 'pointer',
                    background: datePreset === key ? '#f0eefc' : '#fff',
                    color: datePreset === key ? ACCENT : '#555',
                    fontFamily: 'inherit',
                  }}
                >
                  {label}
                </button>
              ))}
              {datePreset === 'range' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                  <input type="date" value={rangeFrom} onChange={e => { setRangeFrom(e.target.value); setPage(0) }} style={{ fontSize: 12, padding: '5px 8px', border: '1px solid #d8d5cf', borderRadius: 7, outline: 'none' }} />
                  <span style={{ fontSize: 12, color: '#888' }}>to</span>
                  <input type="date" value={rangeTo} onChange={e => { setRangeTo(e.target.value); setPage(0) }} style={{ fontSize: 12, padding: '5px 8px', border: '1px solid #d8d5cf', borderRadius: 7, outline: 'none' }} />
                </div>
              )}
              <button
                onClick={() => setFilterOpen(v => !v)}
                style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 12px', border: '1px solid #d8d5cf', borderRadius: 8, background: filterOpen ? '#f0eefc' : '#fff', cursor: 'pointer', color: filterOpen ? ACCENT : '#555', fontWeight: filterOpen ? 600 : 400, fontFamily: 'inherit' }}
              >
                {filterOpen ? '▲ Filters' : '▼ Filters'}
              </button>
            </div>

            {/* Filter panel */}
            {filterOpen && (
              <FilterPanel
                dateLeads={dateFilteredLeads}
                pending={pendingFilters}
                setPending={p => { setPendingFilters(p); setPage(0) }}
                onApply={() => { setAppliedFilters(pendingFilters); setPage(0) }}
                onReset={() => { setPendingFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(0) }}
              />
            )}

            {/* Table */}
            <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
              {/* Table header summary */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #eeece8', display: 'flex', alignItems: 'center', gap: 12, background: '#faf9f7' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>
                  {tableLeads.length} lead{tableLeads.length !== 1 ? 's' : ''}
                </span>
                {quotedTotal != null && (
                  <span style={{ fontSize: 12, color: '#888' }}>Total quoted: <strong>£{quotedTotal.toLocaleString('en-GB')}</strong></span>
                )}
              </div>

              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#faf9f7' }}>
                    <SortHd label="Lead No" col="lead_number" sort={sort} onSort={handleSort} />
                    <SortHd label="Customer" col="customer_name" sort={sort} onSort={handleSort} />
                    <th style={{ textAlign: 'left', padding: '9px 12px', fontSize: 11, color: '#888', borderBottom: '1px solid #eeece8', fontWeight: 600 }}>Tags</th>
                    <SortHd label="Sales visit" col="survey_date" sort={sort} onSort={handleSort} />
                    <SortHd label="Source" col="source" sort={sort} onSort={handleSort} />
                    <SortHd label="Status" col="stage" sort={sort} onSort={handleSort} />
                    <th style={{ textAlign: 'right', padding: '9px 12px', fontSize: 11, color: '#888', borderBottom: '1px solid #eeece8', fontWeight: 600 }}>Latest quoted</th>
                  </tr>
                </thead>
                <tbody>
                  {pageLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '44px 12px', textAlign: 'center', color: '#aaa' }}>
                        {leads.length === 0 ? 'No leads yet — add your first one above' : 'No leads match the current filters'}
                      </td>
                    </tr>
                  ) : pageLeads.map((lead, idx) => {
                    const contact = getMainContact(lead)
                    const leadTags = lead.lead_tags ? lead.lead_tags.split(',').map(t => t.trim()).filter(Boolean) : []
                    const latestQuote = (lead.quotes || [])
                      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
                    const isEven = idx % 2 === 0
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        style={{ cursor: 'pointer', background: isEven ? '#fff' : '#faf9f8' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f4f2ff' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isEven ? '#fff' : '#faf9f8' }}
                      >
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', fontWeight: 700, color: ACCENT }}>
                          {lead.lead_number}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', fontWeight: 500 }}>
                          {contact ? [contact.title, contact.first_name, contact.last_name].filter(Boolean).join(' ') : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {leadTags.map(tag => <Chip key={tag} text={tag} colourMap={LEAD_TAG_COLOURS} />)}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: lead.survey_date ? '#555' : '#ccc', whiteSpace: 'nowrap' }}>
                          {lead.survey_date ? new Date(lead.survey_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}>
                          <Chip text={lead.source || '—'} colourMap={SOURCE_COLOURS} />
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}>
                          <Chip text={lead.stage || '—'} colourMap={STAGE_COLOURS} />
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', textAlign: 'right', color: '#888' }}>
                          —
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid #eeece8', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    style={{ fontSize: 12, padding: '5px 12px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: page === 0 ? 'default' : 'pointer', opacity: page === 0 ? 0.4 : 1, fontFamily: 'inherit' }}
                  >← Prev</button>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    Page {page + 1} of {totalPages} · {tableLeads.length} leads
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    style={{ fontSize: 12, padding: '5px 12px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: page >= totalPages - 1 ? 'default' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1, fontFamily: 'inherit' }}
                  >Next →</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── New lead modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0eeea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Log new lead</div>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }} style={{ fontSize: 22, color: '#aaa', cursor: 'pointer', border: 'none', background: 'none', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Primary contact */}
              <div>
                <SectionHead>Primary contact</SectionHead>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <Field label="Title">
                    <select value={form.contact_title} onChange={e => set('contact_title', e.target.value)} style={{ ...iStyle, background: '#fff' }}>
                      <option value="">—</option>
                      {['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="First name"><input value={form.contact_first_name} onChange={e => set('contact_first_name', e.target.value)} placeholder="e.g. Tom" style={iStyle} /></Field>
                  <Field label="Last name"><input value={form.contact_last_name} onChange={e => set('contact_last_name', e.target.value)} placeholder="e.g. Harrison" style={iStyle} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <Field label="Phone"><input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="07700 900000" style={iStyle} /></Field>
                  <Field label="Email"><input value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="name@email.com" style={iStyle} /></Field>
                </div>
                <div style={{ padding: '10px 12px', background: '#f5f4f0', borderRadius: 8, fontSize: 12, color: '#888' }}>
                  Additional contacts can be added from the lead detail page after saving.
                </div>
              </div>
              {/* Property details */}
              <div>
                <SectionHead>Property details</SectionHead>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
                  <Field label="Property postcode">
                    <input value={form.property_postcode} onChange={e => set('property_postcode', e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupPostcode()} placeholder="e.g. SW1A 1AA" style={iStyle} />
                  </Field>
                  <Field label={'\u00a0'}>
                    <button onClick={lookupPostcode} disabled={pcLoading} style={{ ...iStyle, background: '#fff', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                      {pcLoading ? 'Looking up…' : 'Lookup ↗'}
                    </button>
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <Field label="Road / street"><input value={form.property_road} onChange={e => set('property_road', e.target.value)} placeholder="e.g. 14 Elm Road" style={iStyle} /></Field>
                  <Field label="Address line 2"><input value={form.property_address_2} onChange={e => set('property_address_2', e.target.value)} placeholder="e.g. Flat 3" style={iStyle} /></Field>
                  <Field label="Town / city"><input value={form.property_town} onChange={e => set('property_town', e.target.value)} placeholder="e.g. London" style={iStyle} /></Field>
                  <Field label="Postcode"><input value={form.property_postcode} onChange={e => set('property_postcode', e.target.value)} placeholder="e.g. SW1A 1AA" style={iStyle} /></Field>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Toggle on={form.listed_building} onChange={v => set('listed_building', v)} label="Listed building" />
                  <Toggle on={form.conservation_area} onChange={v => set('conservation_area', v)} label="Conservation area" />
                  <Toggle on={!form.same_address} onChange={v => set('same_address', !v)} label="Contact address differs from property address" />
                  {!form.same_address && (
                    <input value={form.contact_address} onChange={e => set('contact_address', e.target.value)} placeholder="Contact's billing / home address" style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }} />
                  )}
                </div>
              </div>
              {/* Enquiry details */}
              <div>
                <SectionHead>Enquiry details</SectionHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field label="Window / door types required">
                    <MultiPicker options={WINDOW_TYPES} value={form.window_types} onChange={v => set('window_types', v)} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Estimated units"><input type="number" min="1" value={form.estimated_units} onChange={e => set('estimated_units', e.target.value)} placeholder="e.g. 6" style={iStyle} /></Field>
                    <Field label="Sector">
                      <select value={form.sector} onChange={e => set('sector', e.target.value)} style={{ ...iStyle, background: '#fff' }}>
                        <option value="">Select sector</option>
                        {SECTORS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Description" span>
                    <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="e.g. 6 sash windows like-for-like…" style={{ ...iStyle, resize: 'none', fontFamily: 'inherit' }} />
                  </Field>
                </div>
              </div>
              {/* Lead details */}
              <div>
                <SectionHead>Lead details</SectionHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field label="Source">
                    <SegmentPicker options={SOURCES} value={form.source} onChange={v => set('source', v)} />
                  </Field>
                  <Field label="Priority">
                    <SegmentPicker options={['High', 'Medium', 'Low']} value={form.priority} onChange={v => set('priority', v)} />
                  </Field>
                  <Field label="Assigned to">
                    <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} style={{ ...iStyle, background: '#fff' }}>
                      <option value="">— Select —</option>
                      {users.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                    </select>
                  </Field>
                  <Field label="Notes" span>
                    <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any extra context…" style={{ ...iStyle, resize: 'none', fontFamily: 'inherit' }} />
                  </Field>
                </div>
              </div>
              {/* Survey booking */}
              <div>
                <SectionHead>Survey booking (optional)</SectionHead>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <Field label="Date"><input type="date" value={form.survey_date} onChange={e => set('survey_date', e.target.value)} style={iStyle} /></Field>
                  <Field label="Time">
                    <select value={form.survey_time} onChange={e => set('survey_time', e.target.value)} style={{ ...iStyle, background: '#fff' }}>
                      <option value="">Select time</option>
                      {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Surveyor">
                    <select value={form.surveyor} onChange={e => set('surveyor', e.target.value)} style={{ ...iStyle, background: '#fff' }}>
                      <option value="">Select surveyor</option>
                      {users.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f0eeea', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }} style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={saveLead} disabled={saving} style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: saving ? '#9993d4' : ACCENT, color: '#fff', cursor: saving ? 'default' : 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'Save lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
