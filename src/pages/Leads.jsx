import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'
import { useCurrentUser } from '../hooks/useCurrentUser'

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

const SOURCE_COLOURS = {
  'Online presence': { bg: '#e6f0fb', color: '#1a5fa8' },
  'Recommendation': { bg: '#eaf3de', color: '#2e6010' },
  'Repeat customer': { bg: '#eeedfe', color: '#4a3ab0' },
  'FRS presence': { bg: '#faeeda', color: '#7a4a08' },
  'SRS presence': { bg: '#e1f5ee', color: '#0a5a3c' },
  'Physical presence': { bg: '#f5f0e8', color: '#7a4a08' },
  'Historical remedial': { bg: '#f5f4f0', color: '#666' },
}

const PRIORITY_DOT = { High: '#e24b4a', Medium: '#ef9f27', Low: '#639922' }

const WINDOW_TYPES = ['Sash windows', 'Casement windows', 'Timber doors', 'Fixed lights']
const SECTORS = ['Residential', 'Commercial', 'Heritage', 'Landlord', 'Developer']
const LEAD_TAGS = ['Awaiting deposit', 'Awaiting planning', 'Stained glass required', 'PSA', 'Pre Order', 'Second Survey Required']

const SORT_OPTIONS = [
  { label: 'Created date (newest first)', value: 'created_desc' },
  { label: 'Created date (oldest first)', value: 'created_asc' },
  { label: 'Last updated (newest first)', value: 'updated_desc' },
  { label: 'Last updated (oldest first)', value: 'updated_asc' },
]

const DEFAULT_FILTERS = { status: '', tags: [], dateFrom: '', dateTo: '', sort: 'created_desc' }
const TIME_SLOTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00',
]

// ─── Small shared components ────────────────────────────────────────────────

function Pill({ text, map }) {
  const c = map?.[text] ?? { bg: '#f0eeea', color: '#666' }
  return (
    <span style={{
      fontSize: 11, padding: '2px 9px', borderRadius: 999,
      fontWeight: 500, background: c.bg, color: c.color, whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  )
}

function Toggle({ on, onChange, label }) {
  return (
    <div
      onClick={() => onChange(!on)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
    >
      <div style={{
        width: 36, height: 20, borderRadius: 999,
        background: on ? '#3d35a8' : '#d8d5cf',
        position: 'relative', transition: 'background .2s', flexShrink: 0,
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 2, left: on ? 18 : 2, transition: 'left .2s',
        }} />
      </div>
      <span style={{ fontSize: 12, color: on ? '#3d35a8' : '#888', fontWeight: on ? 500 : 400 }}>
        {label}
      </span>
    </div>
  )
}

function SegmentPicker({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = value === opt
        return (
          <div
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              fontSize: 12, padding: '6px 13px', borderRadius: 8, cursor: 'pointer', fontWeight: 500,
              border: `1px solid ${active ? '#b0a8f0' : '#d8d5cf'}`,
              background: active ? '#f0eefc' : '#fff',
              color: active ? '#3d35a8' : '#555',
            }}
          >
            {opt}
          </div>
        )
      })}
    </div>
  )
}

function MultiPicker({ options, value, onChange }) {
  function toggle(opt) {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const active = value.includes(opt)
        return (
          <div
            key={opt}
            onClick={() => toggle(opt)}
            style={{
              fontSize: 12, padding: '6px 13px', borderRadius: 8, cursor: 'pointer', fontWeight: 500,
              border: `1px solid ${active ? '#b0a8f0' : '#d8d5cf'}`,
              background: active ? '#f0eefc' : '#fff',
              color: active ? '#3d35a8' : '#555',
            }}
          >
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

const iStyle = {
  fontSize: 13, padding: '8px 11px',
  border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none',
}

function SectionHead({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: '#aaa',
      letterSpacing: '.06em', textTransform: 'uppercase',
      marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0eeea',
    }}>
      {children}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

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

export default function Leads() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { users } = useUsers()
  const unmatchedCount = useUnmatchedCount()
  const currentUser = useCurrentUser()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('board')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pcLoading, setPcLoading] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [showTagsDropdown, setShowTagsDropdown] = useState(false)

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }))

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    setLoading(true)
    const { data, error } = await supabase
      .from('leads')
      .select('*, lead_contacts(id, is_main_contact, contact_id, contacts(title, first_name, last_name, phone, email))')
      .order('created_at', { ascending: false })
    if (error) console.log('fetchLeads error:', error)
    if (!error) setLeads(data || [])
    setLoading(false)
  }

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
          ...p,
          property_road: road,
          property_town: town,
          property_address: [road, town, json.result.postcode].filter(Boolean).join(', '),
        }))
      } else {
        alert('Postcode not found — please check and try again.')
      }
    } catch {
      alert('Postcode lookup failed — please check your connection.')
    }
    setPcLoading(false)
  }

  async function saveLead() {
    if (!form.contact_first_name.trim() && !form.contact_last_name.trim()) {
      alert('Please enter at least a first or last name for the contact.')
      return
    }
    setSaving(true)
    try {
      const leadNumber = form.lead_number || ('L' + Date.now().toString().slice(-6))
      console.log('Inserting lead:', { stage: form.stage, priority: form.priority, source: form.source })
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
        title: form.contact_title,
        first_name: form.contact_first_name,
        last_name: form.contact_last_name,
        phone: form.contact_phone,
        email: form.contact_email,
        created_at: new Date().toISOString(),
      }]).select()
      if (ce) throw ce

      const { error: lke } = await supabase.from('lead_contacts').insert([{
        lead_id: leadRows[0].id,
        contact_id: contactRows[0].id,
        is_main_contact: true,
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

  function getMainContact(lead) {
    if (!lead.lead_contacts?.length) return null
    const main = lead.lead_contacts.find(lc => lc.is_main_contact) || lead.lead_contacts[0]
    return main?.contacts
  }

  const filteredLeads = (() => {
    let result = [...leads]
    if (filters.status) result = result.filter(l => l.stage === filters.status)
    if (filters.tags.length > 0) {
      result = result.filter(l => {
        const lt = l.lead_tags ? l.lead_tags.split(',').map(t => t.trim()).filter(Boolean) : []
        return filters.tags.some(tag => lt.includes(tag))
      })
    }
    if (filters.dateFrom) result = result.filter(l => l.created_at >= filters.dateFrom)
    if (filters.dateTo)   result = result.filter(l => l.created_at <= filters.dateTo + 'T23:59:59')
    switch (filters.sort) {
      case 'created_asc':  result.sort((a, b) => a.created_at.localeCompare(b.created_at)); break
      case 'created_desc': result.sort((a, b) => b.created_at.localeCompare(a.created_at)); break
      case 'updated_desc': result.sort((a, b) => (b.last_updated_at || b.created_at).localeCompare(a.last_updated_at || a.created_at)); break
      case 'updated_asc':  result.sort((a, b) => (a.last_updated_at || a.created_at).localeCompare(b.last_updated_at || b.created_at)); break
      default: break
    }
    return result
  })()

  const setFilter = (key, val) => setFilters(p => ({ ...p, [key]: val }))
  const activeFilterCount = (filters.status ? 1 : 0) + filters.tags.length + (filters.dateFrom || filters.dateTo ? 1 : 0) + (filters.sort !== 'created_desc' ? 1 : 0)

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'inherit' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 215, background: '#fff', borderRight: '1px solid #e8e6e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>GlazePro</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Window management</div>
        </div>
        <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>
          Workflow
        </div>
        {[
          ['Leads',             '/leads',              null],
          ['Quotes & orders',   null,                  null],
          ['Production',        null,                  null],
          ['Scheduling',        '/calendar',           null],
          ['Invoicing',         null,                  null],
          ['Tasks',             '/tasks',              null],
          ['Unmatched emails',  '/unmatched-emails',   unmatchedCount || null],
        ].map(([item, path, badge]) => {
          const active = item === 'Leads'
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

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Leads</div>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 500, background: '#e6f0fb', color: '#1a5fa8' }}>
            {leads.filter(l => l.stage === 'New').length} new
          </span>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 500, background: '#eaf3de', color: '#2e6010' }}>
            {leads.length} total
          </span>
          <button
            onClick={() => setShowModal(true)}
            style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
          >
            + New lead
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '0 20px', background: '#fff', borderBottom: '1px solid #e8e6e0', flexShrink: 0 }}>
          {[['board', 'Lead board'], ['list', 'List view']].map(([id, label]) => (
            <div
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '12px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 500,
                color: tab === id ? '#3d35a8' : '#888',
                borderBottom: tab === id ? '2px solid #3d35a8' : '2px solid transparent',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#aaa', marginTop: 60 }}>Loading leads…</div>
          ) : tab === 'board' ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'start', overflowX: 'auto', paddingBottom: 8 }}>
              {STAGES.map(stage => {
                const stageLeads = leads.filter(l => l.stage === stage)
                return (
                  <div key={stage} style={{ background: '#faf9f7', borderRadius: 12, padding: 12, minWidth: 220, flex: '0 0 220px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {stage}
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, fontWeight: 500, ...STAGE_COLOURS[stage] }}>
                        {stageLeads.length}
                      </span>
                    </div>
                    {stageLeads.length === 0 && (
                      <div style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '20px 0' }}>No leads</div>
                    )}
                    {stageLeads.map(lead => {
                      const contact = getMainContact(lead)
                      return (
                        <div
                          key={lead.id}
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '12px 13px', marginBottom: 8, cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_DOT[lead.priority] ?? '#ccc', flexShrink: 0 }} />
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#3d35a8' }}>{lead.lead_number}</div>
                          </div>
                          {contact && (
                            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>
                              {[contact.title, contact.first_name, contact.last_name].filter(Boolean).join(' ')}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
                            {lead.property_road && <div>{lead.property_road}</div>}
                            {lead.property_town && <div>{lead.property_town}</div>}
                            {lead.window_types && <div style={{ marginTop: 2 }}>{lead.window_types}</div>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                            <Pill text={lead.source} map={SOURCE_COLOURS} />
                            <span style={{ fontSize: 11, color: '#aaa' }}>
                              {new Date(lead.created_at).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : (
            /* List view */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Filter toolbar */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>

                {/* Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#888' }}>Status</label>
                  <select
                    value={filters.status}
                    onChange={e => setFilter('status', e.target.value)}
                    style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff', cursor: 'pointer', minWidth: 170 }}
                  >
                    <option value="">All statuses</option>
                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Tags multi-select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#888' }}>Tags</label>
                  <button
                    onClick={() => setShowTagsDropdown(v => !v)}
                    onBlur={() => setTimeout(() => setShowTagsDropdown(false), 150)}
                    style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff', cursor: 'pointer', minWidth: 160, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {filters.tags.length === 0 ? 'All tags' : filters.tags.length === 1 ? filters.tags[0] : `${filters.tags.length} tags`}
                    </span>
                    <span style={{ flexShrink: 0, fontSize: 10 }}>▾</span>
                  </button>
                  {showTagsDropdown && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 3px)', left: 0, background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, zIndex: 50, minWidth: 220, boxShadow: '0 4px 16px rgba(0,0,0,.1)', padding: '6px 0' }}>
                      {LEAD_TAGS.map(tag => {
                        const checked = filters.tags.includes(tag)
                        return (
                          <label
                            key={tag}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => setFilter('tags', checked ? filters.tags.filter(t => t !== tag) : [...filters.tags, tag])}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}
                          >
                            <input type="checkbox" checked={checked} onChange={() => {}} style={{ accentColor: '#3d35a8', cursor: 'pointer' }} />
                            {tag}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Date range */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#888' }}>Created from</label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={e => setFilter('dateFrom', e.target.value)}
                    style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#888' }}>To</label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={e => setFilter('dateTo', e.target.value)}
                    style={{ fontSize: 12, padding: '6px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}
                  />
                </div>

                {/* Sort */}
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

                {/* Clear */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    style={{ fontSize: 12, padding: '6px 13px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500, color: '#555', alignSelf: 'flex-end' }}
                  >
                    Clear filters
                  </button>
                )}

                <div style={{ marginLeft: 'auto', alignSelf: 'flex-end', fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>
                  {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Table */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#faf9f7' }}>
                      {['Lead no.', 'Contact', 'Property', 'Window types', 'Source', 'Priority', 'Status', 'Created', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 11, color: '#888', borderBottom: '1px solid #eeece8', fontWeight: 500 }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '40px 12px', textAlign: 'center', color: '#aaa' }}>
                          {leads.length === 0 ? 'No leads yet — add your first one' : 'No leads match the current filters'}
                        </td>
                      </tr>
                    ) : filteredLeads.map(lead => {
                      const contact = getMainContact(lead)
                      return (
                        <tr key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)} style={{ cursor: 'pointer' }}>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', fontWeight: 600, color: '#3d35a8' }}>{lead.lead_number}</td>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', fontWeight: 500 }}>
                            {contact ? [contact.title, contact.first_name, contact.last_name].filter(Boolean).join(' ') : '—'}
                          </td>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: '#555' }}>
                            {[lead.property_road, lead.property_town].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: '#555' }}>{lead.window_types || '—'}</td>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}><Pill text={lead.source} map={SOURCE_COLOURS} /></td>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: PRIORITY_DOT[lead.priority], fontWeight: 500 }}>{lead.priority}</td>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}><Pill text={lead.stage} map={STAGE_COLOURS} /></td>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: '#888', whiteSpace: 'nowrap' }}>
                            {new Date(lead.created_at).toLocaleDateString('en-GB')}
                          </td>
                          <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}>
                            <button
                              onClick={e => { e.stopPropagation(); navigate(`/leads/${lead.id}`) }}
                              style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── New lead modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

            {/* Modal header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0eeea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Log new lead</div>
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                style={{ fontSize: 22, color: '#aaa', cursor: 'pointer', border: 'none', background: 'none', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Scrollable body */}
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
                  <Field label="First name">
                    <input value={form.contact_first_name} onChange={e => set('contact_first_name', e.target.value)} placeholder="e.g. Tom" style={iStyle} />
                  </Field>
                  <Field label="Last name">
                    <input value={form.contact_last_name} onChange={e => set('contact_last_name', e.target.value)} placeholder="e.g. Harrison" style={iStyle} />
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <Field label="Phone">
                    <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="07700 900000" style={iStyle} />
                  </Field>
                  <Field label="Email">
                    <input value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="name@email.com" style={iStyle} />
                  </Field>
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
                    <input
                      value={form.property_postcode}
                      onChange={e => set('property_postcode', e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && lookupPostcode()}
                      placeholder="e.g. SW1A 1AA"
                      style={iStyle}
                    />
                  </Field>
                  <Field label={'\u00a0'}>
                    <button
                      onClick={lookupPostcode}
                      disabled={pcLoading}
                      style={{ ...iStyle, background: '#fff', cursor: 'pointer', fontWeight: 500, whiteSpace: 'nowrap' }}
                    >
                      {pcLoading ? 'Looking up…' : 'Lookup \u2197'}
                    </button>
                  </Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <Field label="Road / street">
                    <input value={form.property_road} onChange={e => set('property_road', e.target.value)} placeholder="e.g. 14 Elm Road" style={iStyle} />
                  </Field>
                  <Field label="Address line 2">
                    <input value={form.property_address_2} onChange={e => set('property_address_2', e.target.value)} placeholder="e.g. Flat 3, Rosewood House" style={iStyle} />
                  </Field>
                  <Field label="Town / city">
                    <input value={form.property_town} onChange={e => set('property_town', e.target.value)} placeholder="e.g. London" style={iStyle} />
                  </Field>
                  <Field label="Postcode">
                    <input value={form.property_postcode} onChange={e => set('property_postcode', e.target.value)} placeholder="e.g. SW1A 1AA" style={iStyle} />
                  </Field>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Toggle on={form.listed_building} onChange={v => set('listed_building', v)} label="Listed building" />
                  <Toggle on={form.conservation_area} onChange={v => set('conservation_area', v)} label="Conservation area" />
                  <Toggle on={!form.same_address} onChange={v => set('same_address', !v)} label="Contact address differs from property address" />
                  {!form.same_address && (
                    <input
                      value={form.contact_address}
                      onChange={e => set('contact_address', e.target.value)}
                      placeholder="Contact's billing / home address"
                      style={{ ...iStyle, width: '100%', boxSizing: 'border-box' }}
                    />
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
                    <Field label="Estimated units">
                      <input type="number" min="1" value={form.estimated_units} onChange={e => set('estimated_units', e.target.value)} placeholder="e.g. 6" style={iStyle} />
                    </Field>
                    <Field label="Sector">
                      <select value={form.sector} onChange={e => set('sector', e.target.value)} style={{ ...iStyle, background: '#fff' }}>
                        <option value="">Select sector</option>
                        {SECTORS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Description" span>
                    <textarea
                      value={form.description}
                      onChange={e => set('description', e.target.value)}
                      rows={3}
                      placeholder="e.g. 6 sash windows like-for-like, Victorian terrace, painted white…"
                      style={{ ...iStyle, resize: 'none', fontFamily: 'inherit' }}
                    />
                  </Field>
                </div>
              </div>

              {/* Lead details */}
              <div>
                <SectionHead>Lead details</SectionHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Field label="Source">
                    <SegmentPicker options={['Online presence', 'Recommendation', 'Repeat customer', 'FRS presence', 'SRS presence', 'Physical presence', 'Historical remedial']} value={form.source} onChange={v => set('source', v)} />
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
                    <textarea
                      value={form.notes}
                      onChange={e => set('notes', e.target.value)}
                      rows={2}
                      placeholder="Any extra context…"
                      style={{ ...iStyle, resize: 'none', fontFamily: 'inherit' }}
                    />
                  </Field>
                </div>
              </div>

              {/* Survey booking */}
              <div>
                <SectionHead>Survey booking (optional)</SectionHead>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <Field label="Date">
                    <input type="date" value={form.survey_date} onChange={e => set('survey_date', e.target.value)} style={iStyle} />
                  </Field>
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

            {/* Modal footer */}
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f0eeea', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
              <button
                onClick={() => { setShowModal(false); setForm(EMPTY_FORM) }}
                style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500 }}
              >
                Cancel
              </button>
              <button
                onClick={saveLead}
                disabled={saving}
                style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: saving ? '#9993d4' : '#3d35a8', color: '#fff', cursor: saving ? 'default' : 'pointer', fontWeight: 500 }}
              >
                {saving ? 'Saving…' : 'Save lead'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
