import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { Layout, LeadsSubNav } from '../components/Layout'
import { computeQuoteTotals } from '../quotes/quoteTotals'

const stageColours = {
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

const STAGES = [
  'New', 'In contact with customer', 'Budget quote provided',
  'Appointment arranged', 'Pending', 'Won', 'Rejected', 'Lost',
  'Historical remedial', 'Contact failed', 'Appointment cancelled', 'Quoted',
]
const CONTACT_TAGS = ['Homeowner', 'Landlord', 'Tenant', 'Builder', 'Architect', 'Developer', 'Agent', 'Other']
const LEAD_TAGS = ['Awaiting deposit', 'Awaiting planning', 'Stained glass required', 'PSA', 'Pre Order', 'Second Survey Required']
const LEAD_TAG_COLOURS = {
  'Awaiting deposit': { bg: '#faeeda', color: '#7a4a08' },
  'Awaiting planning': { bg: '#e6f0fb', color: '#1a5fa8' },
  'Stained glass required': { bg: '#eeedfe', color: '#4a3ab0' },
  'PSA': { bg: '#fceaea', color: '#8b2020' },
  'Pre Order': { bg: '#e1f5ee', color: '#0a5a3c' },
  'Second Survey Required': { bg: '#f5f0e8', color: '#7a4a08' },
}
const TIME_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00']
const NOTE_TYPES = ['Internal note', 'Phone out', 'Phone in', 'In person']
const NOTE_TYPE_COLOURS = {
  'Internal note': { bg: '#f5f4f0', color: '#666' },
  'Phone out':     { bg: '#e6f0fb', color: '#1a5fa8' },
  'Phone in':      { bg: '#e1f5ee', color: '#0a5a3c' },
  'In person':     { bg: '#eeedfe', color: '#4a3ab0' },
  'Email out':     { bg: '#fff0e8', color: '#a04010' },
  'Email in':      { bg: '#fff0e8', color: '#a04010' },
}
const APPT_TYPE_COLOURS = {
  Survey:       { bg: '#e6f0fb', color: '#1a5fa8' },
  Sales:        { bg: '#faeeda', color: '#7a4a08' },
  Installation: { bg: '#e1f5ee', color: '#0a5a3c' },
  Snagging:     { bg: '#faeeda', color: '#7a4a08' },
  Other:        { bg: '#eeedfe', color: '#4a3ab0' },
}
const METHOD_OF_CONTACT_OPTIONS = ['Phone', 'Email', 'Web form', 'Walk-in', 'Referral']
const PRODUCT_TYPE_OPTIONS = ['Sash', 'Casement', 'Door', 'Mixed']
const HQ_LATLNG = { lat: 51.4780, lng: -0.1966 } // 461 Fulham Road, London SW6 1HL
const LONDON_LATLNG = { lat: 51.5080, lng: -0.1281 } // Trafalgar Square, central London reference point

function haversineMiles(a, b) {
  if (!a || !b) return null
  const R = 3958.8 // miles
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function fmtGBP(n) {
  if (n == null) return '—'
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatBytes(n) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function Stars({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={() => onChange && onChange(n === value ? null : n)}
          style={{ fontSize: 15, cursor: onChange ? 'pointer' : 'default', color: value >= n ? '#e0a020' : '#ddd' }}
        >★</span>
      ))}
    </div>
  )
}

function Pill({ text, colourMap }) {
  const c = colourMap?.[text] || { bg: '#f5f4f0', color: '#666' }
  return <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color }}>{text}</span>
}

function Toggle({ value, onChange, label }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ width: 36, height: 20, borderRadius: 999, background: value ? '#3d35a8' : '#d8d5cf', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left .2s' }} />
      </div>
      <span style={{ fontSize: 12, color: value ? '#3d35a8' : '#888' }}>{label}</span>
    </div>
  )
}

function stripQuoted(body) {
  if (!body) return body
  // Strip everything from our reply separator onwards
  const sepIdx = body.indexOf('\n\n---\n')
  if (sepIdx !== -1) return body.slice(0, sepIdx).trim()
  // Also strip "On [date], From:" / "On [date], To:" style headers
  const onMatch = body.search(/\nOn [\d\w].*?(From:|To:)/s)
  if (onMatch !== -1) return body.slice(0, onMatch).trim()
  return body.trim()
}

function highlight(text, term) {
  if (!term || !text) return text
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    new RegExp(`^${escaped}$`, 'i').test(part)
      ? <mark key={i} style={{ background: '#fff176', color: 'inherit', padding: 0, borderRadius: 2 }}>{part}</mark>
      : part
  )
}

export default function LeadDetail() {
  const { id: leadId } = useParams()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { users } = useUsers()
  const unmatchedCount = useUnmatchedCount()
  const currentUser = useCurrentUser()
  const [lead, setLead] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({ title: '', first_name: '', last_name: '', phone: '', email: '', notes: '', tags: [] })
  const [editingContactId, setEditingContactId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [uploads, setUploads] = useState([])
  const [uploadFileList, setUploadFileList] = useState([])
  const [uploading, setUploading] = useState(false)
  const [leadNotes, setLeadNotes] = useState([])
  const [noteForm, setNoteForm] = useState({ subject: '', type: 'Internal note', notes: '', file: null })
  const [savingNote, setSavingNote] = useState(false)
  const [showCompose, setShowCompose] = useState(false)
  const [emailForm, setEmailForm] = useState({ to: '', cc: '', subject: '', body: '' })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendResult, setSendResult] = useState(null) // { ok: true } | { error: '...' } | null
  // Per-note inline reply state: { [noteId]: { open, to, subject, body, sending, result } }
  const [replyState, setReplyState] = useState({})
  const [noteSearch, setNoteSearch] = useState('')
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState({ subject: '', due_date: '', assigned_to: '', notes: '' })
  const [savingTask, setSavingTask] = useState(false)
  const [leadAppointments, setLeadAppointments] = useState([])
  const [coords, setCoords] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [enquiryNotes, setEnquiryNotes] = useState('')
  const [geoClusterLoading, setGeoClusterLoading] = useState(false)
  const [geoClusterSlots, setGeoClusterSlots] = useState(null)
  const [geoClusterError, setGeoClusterError] = useState(null)
  const confirmButtonRef = useRef(null)
  const [surveyDate, setSurveyDate] = useState('')
  const [surveyTime, setSurveyTime] = useState('')
  const [surveyorVal, setSurveyorVal] = useState('')
  const [confirmingBooking, setConfirmingBooking] = useState(false)
  const [surveyBookedMsg, setSurveyBookedMsg] = useState(false)
  const [quotes, setQuotes] = useState([])
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [quoteDrawings, setQuoteDrawings] = useState([]) // quote_drawings rows for this lead's quotes
  const [jobItems, setJobItems] = useState([])
  const [drawings, setDrawings] = useState([])
  const [jobItemsLoading, setJobItemsLoading] = useState(false)
  const [leadHistory, setLeadHistory] = useState([])
  const [editingField, setEditingField] = useState(null)
  const [fieldDraft, setFieldDraft] = useState('')
  const [showSameLocation, setShowSameLocation] = useState(false)
  const [sameLocationLeads, setSameLocationLeads] = useState([])
  const [copyingLead, setCopyingLead] = useState(false)
  const [deletingLead, setDeletingLead] = useState(false)
  const [placeId, setPlaceId] = useState(null)
  const [mapType, setMapType] = useState('roadmap')
  const [trackingDraft, setTrackingDraft] = useState(null)
  const [savingTracking, setSavingTracking] = useState(false)
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
    return new Date(d.getFullYear(), d.getMonth(), diff)
  })
  const [outputQuoteId, setOutputQuoteId] = useState('')

  useEffect(() => { fetchLead(); fetchUploads() }, [leadId])

  useEffect(() => {
    if (activeTab === 'tracking') fetchLeadAppointments()
    if (activeTab === 'correspondence') { fetchTasks(); fetchLeadNotes() }
    if (activeTab === 'quotes' || activeTab === 'output') { fetchJobItemsAndDrawings(); fetchQuotes() }
    if (activeTab === 'general') fetchLeadHistory()
  }, [activeTab, leadId])

  // Initialise tracking panel drafts from the lead
  useEffect(() => {
    if (lead) {
      setTrackingDraft({
        assigned_to: lead.assigned_to || '',
        admin_notes: lead.admin_notes || '',
        sales_date: lead.sales_date || '',
        survey_date_t: lead.survey_date || '',
        survey_notes: lead.survey_notes || '',
        installation_date: lead.installation_date || '',
        installation_notes: lead.installation_notes || '',
      })
    }
  }, [lead?.id])

  useEffect(() => {
    if (activeTab !== 'location' || !lead) return
    const fullAddress = [lead.property_road, lead.property_town, lead.property_postcode].filter(Boolean).join(', ')
    if (!fullAddress) return
    setCoords(null)
    setPlaceId(null)
    setGeoLoading(true)
    fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}`)
      .then(r => r.json())
      .then(data => {
        if (data.results?.[0]?.geometry?.location) {
          setCoords(data.results[0].geometry.location)
          setPlaceId(data.results[0].place_id || null)
        }
      })
      .finally(() => setGeoLoading(false))
  }, [activeTab, lead])

  // Initialise survey controlled fields from lead when first loaded (keyed on lead id)
  useEffect(() => {
    if (lead) {
      setSurveyDate(lead.survey_date || '')
      setSurveyTime(lead.survey_time || '')
      setSurveyorVal(lead.surveyor || '')
    }
  }, [lead?.id])

  async function fetchLead() {
    setLoading(true)
    const { data } = await supabase
      .from('leads')
      .select(`*, lead_contacts(id, is_main_contact, contact_id, contacts(*))`)
      .eq('id', leadId)
      .single()
    if (data) {
      setLead(data)
      setContacts(data.lead_contacts || [])
      setEnquiryNotes(data.description || '')
    }
    setLoading(false)
  }

  async function updateLead(updates) {
    setSaving(true)
    await supabase.from('leads').update({ ...updates, last_updated_at: new Date().toISOString() }).eq('id', leadId)
    await fetchLead()
    setSaving(false)
  }

  async function fetchLeadHistory() {
    const { data, error } = await supabase
      .from('lead_history')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error) setLeadHistory(data || [])
  }

  async function saveFieldEdit() {
    if (!editingField) return
    await updateLead({ [editingField]: fieldDraft })
    setEditingField(null)
    setFieldDraft('')
  }

  async function toggleSameLocation() {
    if (showSameLocation) { setShowSameLocation(false); return }
    setShowSameLocation(true)
    if (!lead?.property_postcode) { setSameLocationLeads([]); return }
    const { data } = await supabase
      .from('leads')
      .select('id, lead_number, property_postcode')
      .eq('property_postcode', lead.property_postcode)
      .neq('id', leadId)
      .is('deleted_at', null)
    setSameLocationLeads(data || [])
  }

  async function copyLead() {
    if (!lead) return
    setCopyingLead(true)
    const { id, lead_number, created_at, deleted_at, ...rest } = lead
    const newNumber = `L${Date.now()}`
    const { data: newLead, error } = await supabase
      .from('leads')
      .insert({ ...rest, lead_number: newNumber, created_at: new Date().toISOString() })
      .select('id')
      .single()
    setCopyingLead(false)
    if (!error && newLead) navigate(`/leads/${newLead.id}`)
    else if (error) console.error('Error copying lead:', error)
  }

  async function deleteLead() {
    if (!lead) return
    const ok = window.confirm(`Delete lead ${lead.lead_number}? This can be undone by a database admin.`)
    if (!ok) return
    setDeletingLead(true)
    const { error } = await supabase.from('leads').update({ deleted_at: new Date().toISOString() }).eq('id', leadId)
    setDeletingLead(false)
    if (!error) navigate('/leads')
    else console.error('Error deleting lead:', error)
  }

  function updateTrackingDraft(field, value) {
    setTrackingDraft(prev => ({ ...prev, [field]: value }))
  }

  async function saveTracking() {
    if (!trackingDraft) return
    setSavingTracking(true)
    await updateLead({
      assigned_to: trackingDraft.assigned_to,
      admin_notes: trackingDraft.admin_notes,
      sales_date: trackingDraft.sales_date || null,
      survey_date: trackingDraft.survey_date_t || null,
      survey_notes: trackingDraft.survey_notes,
      installation_date: trackingDraft.installation_date || null,
      installation_notes: trackingDraft.installation_notes,
    })
    setSavingTracking(false)
  }

  async function addTrackingAppointment(type, date) {
    if (!date) { alert('Set a date first'); return }
    const { error } = await supabase.from('appointments').insert({
      type,
      lead_id: leadId,
      date,
      title: lead?.lead_number || '',
      status: 'Confirmed',
      created_at: new Date().toISOString(),
    })
    if (error) console.error('Error creating appointment:', error)
    else fetchLeadAppointments()
  }

  async function findGeoSlots() {
    setGeoClusterLoading(true)
    setGeoClusterSlots(null)
    setGeoClusterError(null)
    const today = new Date()
    const sixWeeks = new Date()
    sixWeeks.setDate(today.getDate() + 42)
    try {
      const res = await fetch('https://ubmxstufxyeimaywcevk.supabase.co/functions/v1/geo-cluster', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer sb_publishable_YbIHzqpnFXin94E1bpVUug_c_B-UvTw`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          property_postcode: lead.property_postcode,
          property_road: lead.property_road,
          property_town: lead.property_town,
          date_range_start: today.toISOString().slice(0, 10),
          date_range_end: sixWeeks.toISOString().slice(0, 10),
        }),
      })
      const data = await res.json()
      console.log('geo-cluster response:', data, 'recommendations:', data.recommendations?.length, 'all_slots:', data.all_slots?.length)
      if (!res.ok) {
        setGeoClusterError(data.error || data.message || `Error ${res.status}`)
      } else {
        const recommendations = data.recommendations || []
        const all_slots = data.all_slots || data.slots || (Array.isArray(data) ? data : [])
        setGeoClusterSlots({ recommendations, all_slots })
      }
    } catch (err) {
      setGeoClusterError(err.message || 'Network error')
    } finally {
      setGeoClusterLoading(false)
    }
  }

  function applySlot(slot) {
    setSurveyBookedMsg(false)
    setSurveyDate(slot.date || '')
    setSurveyTime(slot.time || '')
    setSurveyorVal(slot.surveyor || slot.surveyor_name || '')
    setTimeout(() => {
  confirmButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}, 100)
  }

  async function confirmSurveyBooking() {
    setConfirmingBooking(true)

    // Compute a 1-hour end time for the appointment
    const [hh, mm] = surveyTime.split(':').map(Number)
    const endTotal = hh * 60 + mm + 60
    const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`

    // 1. Update the lead with survey details and status
    const { error: leadError } = await supabase.from('leads').update({
      survey_date: surveyDate,
      survey_time: surveyTime,
      surveyor: surveyorVal,
      stage: 'Appointment arranged',
      last_updated_at: new Date().toISOString(),
    }).eq('id', leadId)
    if (leadError) console.log('Error updating lead:', leadError)

    // 2. Create the appointment record
    const { error: aptError } = await supabase.from('appointments').insert({
      type: 'Survey',
      lead_id: leadId,
      date: surveyDate,
      start_time: surveyTime,
      end_time: endTime,
      assigned_to: surveyorVal,
      status: 'Confirmed',
      title: lead.lead_number || '',
      created_at: new Date().toISOString(),
    })
    if (aptError) console.log('Error creating appointment:', aptError)

    // 3. Refresh lead and clear geo results
    await fetchLead()
    setGeoClusterSlots(null)
    setGeoClusterError(null)

    // 4. Show success banner
    setSurveyBookedMsg(true)
    setTimeout(() => setSurveyBookedMsg(false), 5000)

    setConfirmingBooking(false)
  }

  async function toggleLeadTag(tag) {
    const current = lead.lead_tags ? lead.lead_tags.split(',').map(t => t.trim()).filter(Boolean) : []
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag]
    await supabase.from('leads').update({ lead_tags: next.join(', ') }).eq('id', leadId)
    setLead(p => ({ ...p, lead_tags: next.join(', ') }))
  }

  async function fetchUploads() {
    const { data } = await supabase
      .from('lead_uploads')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    setUploads(data || [])
  }

  async function handleUpload() {
    if (!uploadFileList.length) return
    setUploading(true)
    for (const item of uploadFileList) {
      const ext = item.file.name.split('.').pop()
      const filePath = `${leadId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('lead-files').upload(filePath, item.file)
      if (error) { console.error('Upload failed:', error.message); continue }
      await supabase.from('lead_uploads').insert([{
        lead_id: leadId,
        filename: item.file.name,
        file_path: filePath,
        notes: item.notes,
        uploaded_by: user?.email || null,
        file_size: item.file.size || null,
        created_at: new Date().toISOString(),
      }])
    }
    await fetchUploads()
    setUploadFileList([])
    setUploading(false)
  }

  async function updateUploadField(uploadId, field, value) {
    setUploads(prev => prev.map(u => u.id === uploadId ? { ...u, [field]: value } : u))
    await supabase.from('lead_uploads').update({ [field]: value }).eq('id', uploadId)
  }

  async function fetchLeadAppointments() {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', leadId)
      .order('date', { ascending: false })
    setLeadAppointments(data || [])
  }

  async function fetchQuotes() {
    setQuotesLoading(true)
    const { data } = await supabase
      .from('quotes')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    setQuotes(data || [])
    const quoteIds = (data || []).map(q => q.id)
    if (quoteIds.length > 0) {
      const { data: qds } = await supabase
        .from('quote_drawings')
        .select('quote_id, job_item_id, drawing_id')
        .in('quote_id', quoteIds)
      setQuoteDrawings(qds || [])
    } else {
      setQuoteDrawings([])
    }
    setQuotesLoading(false)
  }

  async function fetchJobItemsAndDrawings() {
    setJobItemsLoading(true)
    const { data: items } = await supabase
      .from('job_items')
      .select('*')
      .eq('lead_id', leadId)
      .order('item_number', { ascending: true })
    setJobItems(items || [])
    if (items && items.length > 0) {
      const { data: dwgs } = await supabase
        .from('drawings')
        .select('*')
        .in('job_item_id', items.map(i => i.id))
        .order('drawing_number', { ascending: true })
      setDrawings(dwgs || [])
    } else {
      setDrawings([])
    }
    setJobItemsLoading(false)
  }

  async function fetchTasks() {
    const { data } = await supabase
      .from('lead_tasks')
      .select('*')
      .eq('lead_id', leadId)
      .order('due_date', { ascending: true })
    setTasks(data || [])
  }

  async function saveTask() {
    if (!newTask.subject.trim()) return
    setSavingTask(true)
    await supabase.from('lead_tasks').insert([{
      lead_id: leadId,
      subject: newTask.subject,
      due_date: newTask.due_date || null,
      assigned_to: newTask.assigned_to,
      notes: newTask.notes,
      completed: false,
      created_at: new Date().toISOString(),
    }])
    await fetchTasks()
    setNewTask({ subject: '', due_date: '', assigned_to: '', notes: '' })
    setSavingTask(false)
  }

  async function toggleTaskComplete(task) {
    await supabase.from('lead_tasks').update({ completed: !task.completed }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))
  }

  async function deleteTask(id) {
    await supabase.from('lead_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function fetchLeadNotes() {
    const { data } = await supabase
      .from('lead_notes')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
    setLeadNotes(data || [])
  }

  async function saveLeadNote() {
    if (!noteForm.subject.trim() && !noteForm.notes.trim()) return
    setSavingNote(true)
    let filePath = null
    let filename = null
    if (noteForm.file) {
      const ext = noteForm.file.name.split('.').pop()
      filePath = `${leadId}/notes/${Date.now()}.${ext}`
      filename = noteForm.file.name
      const { error } = await supabase.storage.from('lead-files').upload(filePath, noteForm.file)
      if (error) { alert('File upload failed: ' + error.message); setSavingNote(false); return }
    }
    await supabase.from('lead_notes').insert([{
      lead_id: leadId,
      subject: noteForm.subject,
      type: noteForm.type,
      notes: noteForm.notes,
      file_path: filePath,
      filename,
      author: user?.email || 'Unknown',
      created_at: new Date().toISOString(),
    }])
    await fetchLeadNotes()
    setNoteForm({ subject: '', type: 'Internal note', notes: '', file: null })
    setSavingNote(false)
  }

  function openCompose() {
    const mainLc = contacts.find(lc => lc.is_main_contact) || contacts[0]
    const mc = mainLc?.contacts
    setEmailForm({
      to: mc?.email || '',
      cc: '',
      subject: lead?.lead_number ? `Re: ${lead.lead_number}` : '',
      body: '',
    })
    setShowCompose(true)
  }

  async function resolveEmailSignature() {
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'email_signature')
      .maybeSingle()
    if (!settingRow?.value) return ''

    const { data: profile } = await supabase
      .from('users')
      .select('full_name, role, email, phone')
      .eq('email', user?.email)
      .maybeSingle()

    return settingRow.value
      .replace(/\[username\]/gi, profile?.full_name || user?.email || '')
      .replace(/\[role\]/gi,     profile?.role || '')
      .replace(/\[email\]/gi,    profile?.email || user?.email || '')
      .replace(/\[company\]/gi,  'Wandsworth Sash Windows')
      .replace(/\[phone\]/gi,    profile?.phone || '')
  }

  async function sendEmail() {
    if (!emailForm.to.trim()) return
    setSendingEmail(true)
    setSendResult(null)

    try {
      const EDGE_URL = 'https://ubmxstufxyeimaywcevk.supabase.co/functions/v1/send-email'

      const signature = await resolveEmailSignature()
      const bodyWithSig = emailForm.body + (signature ? '\n\n--\n' + signature : '')

      const requestBody = {
        to: emailForm.to,
        ...(emailForm.cc ? { cc: emailForm.cc } : {}),
        subject: emailForm.subject,
        body: bodyWithSig,
        from_mailbox: user.email,
      }

      console.log('[sendEmail] URL:', EDGE_URL)
      console.log('[sendEmail] Request body:', requestBody)

      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer sb_publishable_YbIHzqpnFXin94E1bpVUug_c_B-UvTw',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const responseText = await res.text()
      console.log('[sendEmail] Response status:', res.status, res.statusText)
      console.log('[sendEmail] Response body:', responseText)

      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try { const j = JSON.parse(responseText); msg = j.error || j.message || msg } catch (_) {}
        setSendResult({ error: `Failed to send: ${msg}` })
        setSendingEmail(false)
        return
      }

      const notesBody = [
        `To: ${emailForm.to}`,
        emailForm.cc ? `CC: ${emailForm.cc}` : null,
        '',
        bodyWithSig,
      ].filter(l => l !== null).join('\n')

      await supabase.from('lead_notes').insert([{
        lead_id: leadId,
        subject: emailForm.subject,
        type: 'Email out',
        notes: notesBody,
        author: user?.email || 'Unknown',
        created_at: new Date().toISOString(),
      }])
      await fetchLeadNotes()
      setSendResult({ ok: true })
      setSendingEmail(false)
      setTimeout(() => {
        setShowCompose(false)
        setEmailForm({ to: '', cc: '', subject: '', body: '' })
        setSendResult(null)
      }, 1800)
    } catch (err) {
      console.error('[sendEmail] Caught error:', err)
      setSendResult({ error: err.message || 'Network error' })
      setSendingEmail(false)
    }
  }

  // ── Reply helpers ────────────────────────────────────────────────────────────

  function getReply(id) {
    return replyState[id] || { open: false, to: '', subject: '', body: '', sending: false, result: null }
  }

  function setReply(id, patch) {
    setReplyState(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { open: false, to: '', subject: '', body: '', sending: false, result: null }), ...patch },
    }))
  }

  function openReply(note, emailBody, isOut, toAddr) {
    // Determine reply-to address
    let replyTo = ''
    if (!isOut) {
      // Email in: author may be "Name email@example.com" — extract the email address
      const match = note.author?.match(/[\w.+\-]+@[\w.\-]+\.[a-zA-Z]{2,}/)
      replyTo = match ? match[0] : (note.author || '')
    } else {
      replyTo = toAddr
    }

    const replySubject = note.subject?.startsWith('Re:') ? note.subject : `Re: ${note.subject || ''}`

    // Strip HTML tags for the quoted block
    const plainQuote = /<[a-z][\s\S]*>/i.test(emailBody)
      ? emailBody.replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ').trim()
      : emailBody

    const dateLine = new Date(note.created_at).toLocaleString('en-GB')
    const fromLine = isOut ? `To: ${toAddr}` : `From: ${note.author}`
    const quoted = `\n\n---\nOn ${dateLine}, ${fromLine}:\n${plainQuote}`

    setReply(note.id, { open: true, to: replyTo, subject: replySubject, body: quoted, sending: false, result: null })
  }

  async function sendReply(noteId) {
    const r = getReply(noteId)
    if (!r.to.trim()) return
    setReply(noteId, { sending: true, result: null })

    const EDGE_URL = 'https://ubmxstufxyeimaywcevk.supabase.co/functions/v1/send-email'
    try {
      const signature = await resolveEmailSignature()
      const cleanBody = stripQuoted(r.body)
      const bodyWithSig = cleanBody + (signature ? '\n\n--\n' + signature : '')

      const requestBody = { to: r.to, subject: r.subject, body: bodyWithSig, from_mailbox: user.email }
      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer sb_publishable_YbIHzqpnFXin94E1bpVUug_c_B-UvTw',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
      const responseText = await res.text()
      if (!res.ok) {
        let msg = `HTTP ${res.status}`
        try { const j = JSON.parse(responseText); msg = j.error || j.message || msg } catch (_) {}
        setReply(noteId, { sending: false, result: { error: `Failed to send: ${msg}` } })
        return
      }

      // 1. Insert sent email into lead_notes
      await supabase.from('lead_notes').insert([{
        lead_id: leadId,
        subject: r.subject,
        type: 'Email out',
        notes: `To: ${r.to}\n\n${bodyWithSig}`,
        author: user?.email || 'Unknown',
        created_at: new Date().toISOString(),
      }])

      // 2. Refresh the correspondence thread
      await fetchLeadNotes()

      // 3. Show success briefly then close the compose area
      setReply(noteId, { sending: false, result: { ok: true } })
      setTimeout(() => setReply(noteId, { open: false, result: null }), 1800)
    } catch (err) {
      setReply(noteId, { sending: false, result: { error: err.message || 'Network error' } })
    }
  }

  async function addContact() {
    if (!newContact.first_name && !newContact.last_name) return
    const { tags, ...rest } = newContact
    const { data: contactData } = await supabase.from('contacts').insert([{
      ...rest,
      tags: tags.join(', '),
      created_at: new Date().toISOString(),
    }]).select()
    if (contactData) {
      await supabase.from('lead_contacts').insert([{ lead_id: leadId, contact_id: contactData[0].id, is_main_contact: false, created_at: new Date().toISOString() }])
      await fetchLead()
      setShowAddContact(false)
      setNewContact({ title: '', first_name: '', last_name: '', phone: '', email: '', notes: '', tags: [] })
    }
  }

  async function updateContact(contactId) {
    const { tags, ...rest } = editDraft
    await supabase.from('contacts').update({ ...rest, tags: tags.join(', ') }).eq('id', contactId)
    await fetchLead()
    setEditingContactId(null)
    setEditDraft(null)
  }

  async function setMainContact(leadContactId) {
    await supabase.from('lead_contacts').update({ is_main_contact: false }).eq('lead_id', leadId)
    await supabase.from('lead_contacts').update({ is_main_contact: true }).eq('id', leadContactId)
    await fetchLead()
  }

  async function removeContact(leadContactId) {
    await supabase.from('lead_contacts').delete().eq('id', leadContactId)
    await fetchLead()
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#aaa' }}>Loading...</div>
  if (!lead) return <div style={{ padding: 40, color: '#aaa' }}>Lead not found</div>

  const mainContactLink = contacts.find(lc => lc.is_main_contact) || contacts[0]
  const mainContact = mainContactLink?.contacts

  // Lead tags derived
  const leadTagList = lead.lead_tags ? lead.lead_tags.split(',').map(t => t.trim()).filter(Boolean) : []

  // History helpers
  const createdByRow = leadHistory.length > 0 ? leadHistory[leadHistory.length - 1] : null
  const modifiedByRow = leadHistory.length > 0 ? leadHistory[0] : null

  return (
    <Layout subMenu={<LeadsSubNav />}>

      {/* Lead title bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e6e0', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/leads')} style={{ fontSize: 12, padding: '5px 11px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer', fontWeight: 500, color: '#555', marginRight: 4, fontFamily: 'inherit' }}>← Leads</button>
        <span style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a' }}>{lead.lead_number}</span>
        {mainContact?.last_name && (
          <span style={{ fontSize: 15, color: '#555', fontWeight: 500 }}>{mainContact.last_name}</span>
        )}
        {leadTagList.map(tag => {
          const c = LEAD_TAG_COLOURS[tag] || { bg: '#f0eefc', color: '#3d35a8' }
          return <span key={tag} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color }}>{tag}</span>
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
          {saving && <span style={{ fontSize: 12, color: '#aaa' }}>Saving…</span>}
          <div style={{ position: 'relative' }}>
            <button onClick={toggleSameLocation} style={{ fontSize: 12, padding: '6px 12px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer', fontWeight: 500, color: '#555', fontFamily: 'inherit' }}>
              Leads and orders at same location
            </button>
            {showSameLocation && (
              <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, width: 260, background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>Same postcode</div>
                {!lead.property_postcode ? (
                  <div style={{ fontSize: 12, color: '#aaa' }}>No postcode set on this lead</div>
                ) : sameLocationLeads.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#aaa' }}>No other leads found</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {sameLocationLeads.map(l => (
                      <button key={l.id} onClick={() => navigate(`/leads/${l.id}`)} style={{ textAlign: 'left', fontSize: 12, padding: '6px 8px', border: 'none', borderRadius: 6, background: '#faf9f7', cursor: 'pointer', color: '#3d35a8' }}>
                        {l.lead_number}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button onClick={copyLead} disabled={copyingLead} style={{ fontSize: 12, padding: '6px 12px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: copyingLead ? 'default' : 'pointer', fontWeight: 500, color: '#555', fontFamily: 'inherit' }}>
            {copyingLead ? 'Copying…' : 'Copy lead'}
          </button>
          <button onClick={deleteLead} disabled={deletingLead} style={{ fontSize: 12, padding: '6px 12px', border: '1px solid #f0c9c9', borderRadius: 7, background: '#fff', cursor: deletingLead ? 'default' : 'pointer', fontWeight: 500, color: '#c0392b', fontFamily: 'inherit' }}>
            {deletingLead ? 'Deleting…' : 'Delete lead'}
          </button>
          <button style={{ fontSize: 12, padding: '6px 14px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>Convert to quote →</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '0 24px', background: '#fff', borderBottom: '1px solid #e8e6e0', flexShrink: 0 }}>
        {[['general', 'General'], ['quotes', 'Quote'], ['uploads', 'Upload'], ['tracking', 'Tracking'], ['correspondence', 'Correspondence'], ['location', 'Location'], ['output', 'Output'], ['contacts', 'Contacts'], ['survey', 'Survey']].map(([id, label]) => (
          <div key={id} onClick={() => setActiveTab(id)} style={{ padding: '11px 16px', fontSize: 13, color: activeTab === id ? '#3d35a8' : '#888', cursor: 'pointer', borderBottom: activeTab === id ? '2px solid #3d35a8' : '2px solid transparent', fontWeight: 500 }}>{label}</div>
        ))}
      </div>

      <div style={{ flex: 1, padding: 24, overflowY: 'auto', background: '#f5f4f0' }}>

          {/* GENERAL TAB */}
          {activeTab === 'general' && (() => {
            const iStyle = { fontSize: 13, padding: '7px 10px', border: '1px solid #d8d5cf', borderRadius: 7, outline: 'none', background: '#fff', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
            const allTags = LEAD_TAGS
            const activeTags = lead.lead_tags ? lead.lead_tags.split(',').map(t => t.trim()).filter(Boolean) : []

            function DetailRow({ field, label, value, editable, editEl }) {
              const isEditing = editingField === field
              return (
                <tr>
                  <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle', background: 'inherit' }}>
                    {label}
                  </td>
                  <td style={{ padding: '8px 14px', fontSize: 13, color: '#1a1a1a', borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle', background: 'inherit' }}>
                    {isEditing ? editEl : (value || <span style={{ color: '#ccc' }}>—</span>)}
                  </td>
                  <td style={{ padding: '8px 10px', width: 40, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle', textAlign: 'center', background: 'inherit' }}>
                    {editable && !isEditing && (
                      <button
                        onClick={() => { setEditingField(field); setFieldDraft(lead[field] || '') }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ccc', padding: '2px 4px', borderRadius: 4, fontFamily: 'inherit' }}
                        title="Edit"
                        onMouseEnter={e => { e.currentTarget.style.color = '#3d35a8' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#ccc' }}
                      >✎</button>
                    )}
                    {isEditing && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={saveFieldEdit} style={{ background: '#3d35a8', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit' }}>Save</button>
                        <button onClick={() => { setEditingField(null); setFieldDraft('') }} style={{ background: '#f0eeea', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit', color: '#555' }}>✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            }

            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
                {/* Left column — Lead details table */}
                <div>
                  <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '13px 16px', borderBottom: '1px solid #f0eeea' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Lead details</div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {/* Read-only rows */}
                        {[
                          ['Lead number', lead.lead_number],
                          ['Created by', createdByRow?.user_email || '—'],
                          ['Created date', lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-GB') : '—'],
                          ['Last modified by', modifiedByRow?.user_email || '—'],
                          ['Last modified', lead.last_updated_at ? new Date(lead.last_updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'],
                        ].map(([lbl, val], idx) => (
                          <tr key={lbl} style={{ background: idx % 2 === 0 ? '#fff' : '#faf9f8' }}>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>{lbl}</td>
                            <td style={{ padding: '8px 14px', fontSize: 13, color: '#1a1a1a', borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle', fontWeight: lbl === 'Lead number' ? 700 : 400 }}>{val}</td>
                            <td style={{ width: 40, borderBottom: '1px solid #f5f4f0' }} />
                          </tr>
                        ))}
                        {/* Editable: Assigned to */}
                        {(() => { const isEdit = editingField === 'assigned_to'; return (
                          <tr style={{ background: '#fff' }}>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>Assigned to</td>
                            <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>
                              {isEdit
                                ? <select value={fieldDraft} onChange={e => setFieldDraft(e.target.value)} style={iStyle}>
                                    <option value="">— Unassigned —</option>
                                    {users.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                                  </select>
                                : <span style={{ color: lead.assigned_to ? '#1a1a1a' : '#ccc' }}>{lead.assigned_to || '—'}</span>}
                            </td>
                            <td style={{ padding: '8px 10px', width: 40, borderBottom: '1px solid #f5f4f0', textAlign: 'center', verticalAlign: 'middle' }}>
                              {!isEdit
                                ? <button onClick={() => { setEditingField('assigned_to'); setFieldDraft(lead.assigned_to || '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ccc', padding: '2px 4px', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.color = '#3d35a8' }} onMouseLeave={e => { e.currentTarget.style.color = '#ccc' }}>✎</button>
                                : <div style={{ display: 'flex', gap: 4 }}><button onClick={saveFieldEdit} style={{ background: '#3d35a8', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit' }}>Save</button><button onClick={() => { setEditingField(null); setFieldDraft('') }} style={{ background: '#f0eeea', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit', color: '#555' }}>✕</button></div>}
                            </td>
                          </tr>
                        )})()}
                        {/* Editable: Source */}
                        {(() => { const isEdit = editingField === 'source'; return (
                          <tr style={{ background: '#faf9f8' }}>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>Source</td>
                            <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>
                              {isEdit
                                ? <select value={fieldDraft} onChange={e => setFieldDraft(e.target.value)} style={iStyle}>
                                    {['Online presence','Recommendation','Repeat customer','FRS presence','SRS presence','Physical presence','Historical remedial'].map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                : <span style={{ color: lead.source ? '#1a1a1a' : '#ccc' }}>{lead.source || '—'}</span>}
                            </td>
                            <td style={{ padding: '8px 10px', width: 40, borderBottom: '1px solid #f5f4f0', textAlign: 'center', verticalAlign: 'middle' }}>
                              {!isEdit
                                ? <button onClick={() => { setEditingField('source'); setFieldDraft(lead.source || '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ccc', padding: '2px 4px', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.color = '#3d35a8' }} onMouseLeave={e => { e.currentTarget.style.color = '#ccc' }}>✎</button>
                                : <div style={{ display: 'flex', gap: 4 }}><button onClick={saveFieldEdit} style={{ background: '#3d35a8', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit' }}>Save</button><button onClick={() => { setEditingField(null); setFieldDraft('') }} style={{ background: '#f0eeea', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit', color: '#555' }}>✕</button></div>}
                            </td>
                          </tr>
                        )})()}
                        {/* Editable: Sector */}
                        {(() => { const isEdit = editingField === 'sector'; return (
                          <tr style={{ background: '#fff' }}>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>Sector</td>
                            <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>
                              {isEdit
                                ? <select value={fieldDraft} onChange={e => setFieldDraft(e.target.value)} style={iStyle}>
                                    <option value="">— Select —</option>
                                    {['Residential','Commercial','Heritage','Landlord','Developer'].map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                : <span style={{ color: lead.sector ? '#1a1a1a' : '#ccc' }}>{lead.sector || '—'}</span>}
                            </td>
                            <td style={{ padding: '8px 10px', width: 40, borderBottom: '1px solid #f5f4f0', textAlign: 'center', verticalAlign: 'middle' }}>
                              {!isEdit
                                ? <button onClick={() => { setEditingField('sector'); setFieldDraft(lead.sector || '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ccc', padding: '2px 4px', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.color = '#3d35a8' }} onMouseLeave={e => { e.currentTarget.style.color = '#ccc' }}>✎</button>
                                : <div style={{ display: 'flex', gap: 4 }}><button onClick={saveFieldEdit} style={{ background: '#3d35a8', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit' }}>Save</button><button onClick={() => { setEditingField(null); setFieldDraft('') }} style={{ background: '#f0eeea', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit', color: '#555' }}>✕</button></div>}
                            </td>
                          </tr>
                        )})()}
                        {/* Editable: Product Type */}
                        {(() => { const isEdit = editingField === 'product_type'; return (
                          <tr style={{ background: '#fff' }}>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>Product Type</td>
                            <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>
                              {isEdit
                                ? <select value={fieldDraft} onChange={e => setFieldDraft(e.target.value)} style={iStyle}>
                                    <option value="">— Select —</option>
                                    {PRODUCT_TYPE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                : <span style={{ color: lead.product_type ? '#1a1a1a' : '#ccc' }}>{lead.product_type || '—'}</span>}
                            </td>
                            <td style={{ padding: '8px 10px', width: 40, borderBottom: '1px solid #f5f4f0', textAlign: 'center', verticalAlign: 'middle' }}>
                              {!isEdit
                                ? <button onClick={() => { setEditingField('product_type'); setFieldDraft(lead.product_type || '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ccc', padding: '2px 4px', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.color = '#3d35a8' }} onMouseLeave={e => { e.currentTarget.style.color = '#ccc' }}>✎</button>
                                : <div style={{ display: 'flex', gap: 4 }}><button onClick={saveFieldEdit} style={{ background: '#3d35a8', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit' }}>Save</button><button onClick={() => { setEditingField(null); setFieldDraft('') }} style={{ background: '#f0eeea', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit', color: '#555' }}>✕</button></div>}
                            </td>
                          </tr>
                        )})()}
                        {/* Editable: Status */}
                        {(() => { const isEdit = editingField === 'stage'; return (
                          <tr style={{ background: '#faf9f8' }}>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>Status</td>
                            <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>
                              {isEdit
                                ? <select value={fieldDraft} onChange={e => setFieldDraft(e.target.value)} style={iStyle}>
                                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                : (() => { const c = stageColours[lead.stage] || { bg: '#f5f4f0', color: '#666' }; return (
                                    <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color }}>{lead.stage}</span>
                                  )})()}
                            </td>
                            <td style={{ padding: '8px 10px', width: 40, borderBottom: '1px solid #f5f4f0', textAlign: 'center', verticalAlign: 'middle' }}>
                              {!isEdit
                                ? <button onClick={() => { setEditingField('stage'); setFieldDraft(lead.stage || '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ccc', padding: '2px 4px', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.color = '#3d35a8' }} onMouseLeave={e => { e.currentTarget.style.color = '#ccc' }}>✎</button>
                                : <div style={{ display: 'flex', gap: 4 }}><button onClick={saveFieldEdit} style={{ background: '#3d35a8', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit' }}>Save</button><button onClick={() => { setEditingField(null); setFieldDraft('') }} style={{ background: '#f0eeea', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit', color: '#555' }}>✕</button></div>}
                            </td>
                          </tr>
                        )})()}
                        {/* Editable: Rating */}
                        <tr style={{ background: '#faf9f8' }}>
                          <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>Rating</td>
                          <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>
                            <Stars value={lead.rating} onChange={n => updateLead({ rating: n })} />
                          </td>
                          <td style={{ width: 40, borderBottom: '1px solid #f5f4f0' }} />
                        </tr>
                        {/* Editable: Method of Contact */}
                        {(() => { const isEdit = editingField === 'method_of_contact'; return (
                          <tr style={{ background: '#fff' }}>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>Method of Contact</td>
                            <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>
                              {isEdit
                                ? <select value={fieldDraft} onChange={e => setFieldDraft(e.target.value)} style={iStyle}>
                                    <option value="">— Select —</option>
                                    {METHOD_OF_CONTACT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                  </select>
                                : <span style={{ color: lead.method_of_contact ? '#1a1a1a' : '#ccc' }}>{lead.method_of_contact || '—'}</span>}
                            </td>
                            <td style={{ padding: '8px 10px', width: 40, borderBottom: '1px solid #f5f4f0', textAlign: 'center', verticalAlign: 'middle' }}>
                              {!isEdit
                                ? <button onClick={() => { setEditingField('method_of_contact'); setFieldDraft(lead.method_of_contact || '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ccc', padding: '2px 4px', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.color = '#3d35a8' }} onMouseLeave={e => { e.currentTarget.style.color = '#ccc' }}>✎</button>
                                : <div style={{ display: 'flex', gap: 4 }}><button onClick={saveFieldEdit} style={{ background: '#3d35a8', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit' }}>Save</button><button onClick={() => { setEditingField(null); setFieldDraft('') }} style={{ background: '#f0eeea', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit', color: '#555' }}>✕</button></div>}
                            </td>
                          </tr>
                        )})()}
                        {/* Read-only: Orders */}
                        <tr style={{ background: '#faf9f8' }}>
                          <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>Orders</td>
                          <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle', color: '#888' }}>0</td>
                          <td style={{ width: 40, borderBottom: '1px solid #f5f4f0' }} />
                        </tr>
                        {/* Account ID — stub, no accounts table yet */}
                        <tr style={{ background: '#fff' }}>
                          <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>Account ID</td>
                          <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>
                            <button disabled title="Accounts are not set up yet" style={{ fontSize: 12, padding: '5px 10px', border: '1px dashed #d8d5cf', borderRadius: 6, background: '#faf9f7', color: '#aaa', cursor: 'not-allowed', fontFamily: 'inherit' }}>Select Account</button>
                          </td>
                          <td style={{ width: 40, borderBottom: '1px solid #f5f4f0' }} />
                        </tr>
                        {/* Editable: Window types */}
                        {(() => { const isEdit = editingField === 'window_types'; return (
                          <tr style={{ background: '#fff' }}>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>Enquiry / types</td>
                            <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>
                              {isEdit
                                ? <input value={fieldDraft} onChange={e => setFieldDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveFieldEdit(); if (e.key === 'Escape') { setEditingField(null); setFieldDraft('') } }} style={iStyle} autoFocus />
                                : <span style={{ color: lead.window_types ? '#1a1a1a' : '#ccc' }}>{lead.window_types || '—'}</span>}
                            </td>
                            <td style={{ padding: '8px 10px', width: 40, borderBottom: '1px solid #f5f4f0', textAlign: 'center', verticalAlign: 'middle' }}>
                              {!isEdit
                                ? <button onClick={() => { setEditingField('window_types'); setFieldDraft(lead.window_types || '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ccc', padding: '2px 4px', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.color = '#3d35a8' }} onMouseLeave={e => { e.currentTarget.style.color = '#ccc' }}>✎</button>
                                : <div style={{ display: 'flex', gap: 4 }}><button onClick={saveFieldEdit} style={{ background: '#3d35a8', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit' }}>Save</button><button onClick={() => { setEditingField(null); setFieldDraft('') }} style={{ background: '#f0eeea', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit', color: '#555' }}>✕</button></div>}
                            </td>
                          </tr>
                        )})()}
                        {/* Editable: Notes */}
                        {(() => { const isEdit = editingField === 'notes'; return (
                          <tr style={{ background: '#faf9f8' }}>
                            <td style={{ padding: '8px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, borderBottom: '1px solid #f5f4f0', verticalAlign: 'top', paddingTop: 12 }}>Notes</td>
                            <td style={{ padding: '8px 14px', fontSize: 13, borderBottom: '1px solid #f5f4f0', verticalAlign: 'middle' }}>
                              {isEdit
                                ? <textarea value={fieldDraft} onChange={e => setFieldDraft(e.target.value)} rows={3} style={{ ...iStyle, resize: 'vertical' }} autoFocus />
                                : <span style={{ color: lead.notes ? '#1a1a1a' : '#ccc', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{lead.notes || '—'}</span>}
                            </td>
                            <td style={{ padding: '8px 10px', width: 40, borderBottom: '1px solid #f5f4f0', textAlign: 'center', verticalAlign: 'top', paddingTop: 12 }}>
                              {!isEdit
                                ? <button onClick={() => { setEditingField('notes'); setFieldDraft(lead.notes || '') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ccc', padding: '2px 4px', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.color = '#3d35a8' }} onMouseLeave={e => { e.currentTarget.style.color = '#ccc' }}>✎</button>
                                : <div style={{ display: 'flex', gap: 4 }}><button onClick={saveFieldEdit} style={{ background: '#3d35a8', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit' }}>Save</button><button onClick={() => { setEditingField(null); setFieldDraft('') }} style={{ background: '#f0eeea', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 10, padding: '3px 7px', fontFamily: 'inherit', color: '#555' }}>✕</button></div>}
                            </td>
                          </tr>
                        )})()}
                        {/* Tags row */}
                        <tr style={{ background: '#fff' }}>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: '#888', fontWeight: 500, width: 180, verticalAlign: 'top', paddingTop: 12 }}>Tags</td>
                          <td colSpan={2} style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                            {editingField === 'lead_tags' ? (
                              <div>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                                  {allTags.map(tag => {
                                    const active = activeTags.includes(tag)
                                    const c = LEAD_TAG_COLOURS[tag] || { bg: '#f0eefc', color: '#3d35a8' }
                                    return (
                                      <div key={tag} onClick={() => toggleLeadTag(tag)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, cursor: 'pointer', fontWeight: 500, background: active ? c.bg : '#f0eeea', color: active ? c.color : '#999', border: `1px solid ${active ? c.color + '44' : 'transparent'}` }}>
                                        {tag}
                                      </div>
                                    )
                                  })}
                                </div>
                                <button onClick={() => setEditingField(null)} style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#555', fontFamily: 'inherit' }}>Done</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {activeTags.length === 0
                                  ? <span style={{ fontSize: 12, color: '#bbb' }}>No tags</span>
                                  : activeTags.map(tag => {
                                      const c = LEAD_TAG_COLOURS[tag] || { bg: '#f0eefc', color: '#3d35a8' }
                                      return <span key={tag} style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color }}>{tag}</span>
                                    })
                                }
                                <button onClick={() => setEditingField('lead_tags')} style={{ fontSize: 11, padding: '2px 7px', border: '1px solid #d8d5cf', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#888', marginLeft: 2, fontFamily: 'inherit' }}>✏</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Customer card */}
                  {mainContact && (
                    <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em' }}>Customer</div>
                        <button onClick={() => setActiveTab('contacts')} style={{ fontSize: 11, border: 'none', background: 'none', color: '#3d35a8', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>All contacts →</button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#e6f0fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#1a5fa8', flexShrink: 0 }}>
                          {(mainContact.first_name?.[0] || '') + (mainContact.last_name?.[0] || '')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 3 }}>
                            {[mainContact.title, mainContact.first_name, mainContact.last_name].filter(Boolean).join(' ')}
                          </div>
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: '#f0eefc', color: '#3d35a8', fontWeight: 600 }}>Main contact</span>
                          <div style={{ fontSize: 12, color: '#555', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {mainContact.phone && (
                              <span>📞 {mainContact.phone}</span>
                            )}
                            {mainContact.email && (
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉ {mainContact.email}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Installation address */}
                  <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Installation address</div>
                    <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>
                      {lead.property_road && <div>{lead.property_road}</div>}
                      {lead.property_address_2 && <div>{lead.property_address_2}</div>}
                      {lead.property_town && <div>{lead.property_town}</div>}
                      {lead.property_postcode && <div style={{ fontWeight: 600, color: '#1a1a1a' }}>{lead.property_postcode}</div>}
                      {!lead.property_road && !lead.property_town && !lead.property_postcode && (
                        <span style={{ color: '#ccc' }}>No address recorded</span>
                      )}
                    </div>
                    {(lead.listed_building || lead.conservation_area) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        {lead.listed_building && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: '#faeeda', color: '#7a4a08' }}>Listed building</span>}
                        {lead.conservation_area && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: '#fceaea', color: '#8b2020' }}>Conservation area</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Lead history — full width */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '13px 16px', borderBottom: '1px solid #f0eeea' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Lead history</div>
                    </div>
                    {leadHistory.length === 0 ? (
                      <div style={{ padding: '28px 16px', textAlign: 'center', color: '#ccc', fontSize: 13 }}>
                        No history recorded yet — history is captured automatically once the lead_history migration is run.
                      </div>
                    ) : (
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#faf9f7' }}>
                            <th style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 600, color: '#888', borderBottom: '1px solid #eeece8', width: 160 }}>Date</th>
                            <th style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 600, color: '#888', borderBottom: '1px solid #eeece8', width: 200 }}>User</th>
                            <th style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 600, color: '#888', borderBottom: '1px solid #eeece8' }}>Event</th>
                            <th style={{ textAlign: 'left', padding: '8px 14px', fontWeight: 600, color: '#888', borderBottom: '1px solid #eeece8', width: 200 }}>Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leadHistory.map((row, idx) => (
                            <tr key={row.id} style={{ background: idx % 2 === 0 ? '#fff' : '#faf9f8' }}>
                              <td style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4f0', color: '#555', whiteSpace: 'nowrap' }}>
                                {new Date(row.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4f0', color: '#555' }}>
                                {row.user_email || row.user_id || '—'}
                              </td>
                              <td style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4f0', color: '#1a1a1a', fontWeight: 500 }}>
                                {row.event || (row.field_name ? `${row.field_name}: ${row.old_value || '(blank)'} → ${row.new_value || '(blank)'}` : '—')}
                              </td>
                              <td style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4f0', color: '#888' }}>
                                {row.notes || ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

              </div>
            )
          })()}

          {/* CONTACTS TAB */}
          {activeTab === 'contacts' && (
            <div style={{ maxWidth: 700 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Contacts</div>
                <button onClick={() => setShowAddContact(true)} style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>+ Add contact</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {contacts.map(lc => {
                  const isEditing = editingContactId === lc.id
                  const tagList = lc.contacts?.tags ? lc.contacts.tags.split(',').map(t => t.trim()).filter(Boolean) : []
                  const iStyle = { fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', width: '100%', boxSizing: 'border-box' }

                  return (
                    <div key={lc.id} style={{ background: '#fff', border: `1px solid ${lc.is_main_contact ? '#b0a8f0' : '#e8e6e0'}`, borderRadius: 12, padding: '14px 16px' }}>

                      {/* Card header — always visible */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e6f0fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#1a5fa8', flexShrink: 0 }}>
                            {(lc.contacts?.first_name?.[0] || '') + (lc.contacts?.last_name?.[0] || '')}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{lc.contacts?.title} {lc.contacts?.first_name} {lc.contacts?.last_name}</div>
                            {lc.is_main_contact && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: '#f0eefc', color: '#3d35a8', fontWeight: 500 }}>Main contact</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {!isEditing && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingContactId(lc.id)
                                  setEditDraft({
                                    title: lc.contacts?.title || '',
                                    first_name: lc.contacts?.first_name || '',
                                    last_name: lc.contacts?.last_name || '',
                                    phone: lc.contacts?.phone || '',
                                    email: lc.contacts?.email || '',
                                    notes: lc.contacts?.notes || '',
                                    tags: tagList,
                                  })
                                }}
                                style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                              >Edit</button>
                              {!lc.is_main_contact && <button onClick={() => setMainContact(lc.id)} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Set as main</button>}
                              <button onClick={() => removeContact(lc.id)} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #e8d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#8b2020' }}>Remove</button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* View mode */}
                      {!isEditing && (
                        <>
                          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#555', flexWrap: 'wrap', marginBottom: tagList.length || lc.contacts?.notes ? 8 : 0 }}>
                            {lc.contacts?.phone && <span>📞 {lc.contacts.phone}</span>}
                            {lc.contacts?.email && <span>✉ {lc.contacts.email}</span>}
                          </div>
                          {tagList.length > 0 && (
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: lc.contacts?.notes ? 8 : 0 }}>
                              {tagList.map(tag => (
                                <span key={tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f0eefc', color: '#3d35a8', fontWeight: 500 }}>{tag}</span>
                              ))}
                            </div>
                          )}
                          {lc.contacts?.notes && (
                            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5, padding: '8px 10px', background: '#faf9f7', borderRadius: 7 }}>
                              {lc.contacts.notes}
                            </div>
                          )}
                        </>
                      )}

                      {/* Edit mode */}
                      {isEditing && editDraft && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Title</label>
                              <select value={editDraft.title} onChange={e => setEditDraft(p => ({ ...p, title: e.target.value }))} style={{ ...iStyle }}>
                                <option value="">—</option>
                                {['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'].map(t => <option key={t}>{t}</option>)}
                              </select>
                            </div>
                            {[['First name', 'first_name'], ['Last name', 'last_name']].map(([label, key]) => (
                              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{label}</label>
                                <input value={editDraft[key]} onChange={e => setEditDraft(p => ({ ...p, [key]: e.target.value }))} style={iStyle} />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[['Phone', 'phone'], ['Email', 'email']].map(([label, key]) => (
                              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{label}</label>
                                <input value={editDraft[key]} onChange={e => setEditDraft(p => ({ ...p, [key]: e.target.value }))} style={iStyle} />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Tags</label>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {CONTACT_TAGS.map(tag => {
                                const active = editDraft.tags.includes(tag)
                                return (
                                  <div
                                    key={tag}
                                    onClick={() => setEditDraft(p => ({
                                      ...p,
                                      tags: active ? p.tags.filter(t => t !== tag) : [...p.tags, tag],
                                    }))}
                                    style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 500, border: `1px solid ${active ? '#b0a8f0' : '#d8d5cf'}`, background: active ? '#f0eefc' : '#fff', color: active ? '#3d35a8' : '#555' }}
                                  >
                                    {tag}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Notes</label>
                            <textarea
                              value={editDraft.notes}
                              onChange={e => setEditDraft(p => ({ ...p, notes: e.target.value }))}
                              rows={3}
                              placeholder="Any notes about this contact..."
                              style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => { setEditingContactId(null); setEditDraft(null) }}
                              style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
                            >Cancel</button>
                            <button
                              onClick={() => updateContact(lc.contact_id)}
                              style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
                            >Save</button>
                          </div>
                        </div>
                      )}

                    </div>
                  )
                })}
                {contacts.length === 0 && <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 40 }}>No contacts linked yet</div>}
              </div>

              {showAddContact && (
                <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>New contact</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Title</label>
                      <select value={newContact.title} onChange={e => setNewContact(p => ({ ...p, title: e.target.value }))} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}>
                        <option value="">—</option>
                        {['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    {[['First name', 'first_name'], ['Last name', 'last_name']].map(([label, key]) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{label}</label>
                        <input value={newContact[key]} onChange={e => setNewContact(p => ({ ...p, [key]: e.target.value }))} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {[['Phone', 'phone'], ['Email', 'email']].map(([label, key]) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{label}</label>
                        <input value={newContact[key]} onChange={e => setNewContact(p => ({ ...p, [key]: e.target.value }))} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Tags</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {CONTACT_TAGS.map(tag => {
                        const active = newContact.tags.includes(tag)
                        return (
                          <div
                            key={tag}
                            onClick={() => setNewContact(p => ({
                              ...p,
                              tags: active ? p.tags.filter(t => t !== tag) : [...p.tags, tag],
                            }))}
                            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 500, border: `1px solid ${active ? '#b0a8f0' : '#d8d5cf'}`, background: active ? '#f0eefc' : '#fff', color: active ? '#3d35a8' : '#555' }}
                          >
                            {tag}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Notes</label>
                    <textarea
                      value={newContact.notes}
                      onChange={e => setNewContact(p => ({ ...p, notes: e.target.value }))}
                      rows={3}
                      placeholder="Any notes about this contact..."
                      style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowAddContact(false)} style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={addContact} style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Add contact</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CORRESPONDENCE TAB */}
          {activeTab === 'correspondence' && (
            <div style={{ maxWidth: 760 }}>

              {/* ── TASKS ── */}
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Tasks</div>

              {/* New task form */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                {(() => {
                  const iS = { fontSize: 13, padding: '7px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Subject</label>
                          <input value={newTask.subject} onChange={e => setNewTask(p => ({ ...p, subject: e.target.value }))} placeholder="Task subject…" style={iS} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Due date</label>
                          <input type="date" value={newTask.due_date} onChange={e => setNewTask(p => ({ ...p, due_date: e.target.value }))} style={iS} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Assigned to</label>
                          <select value={newTask.assigned_to} onChange={e => setNewTask(p => ({ ...p, assigned_to: e.target.value }))} style={{ ...iS, background: '#fff' }}>
                            <option value="">— Unassigned —</option>
                            {users.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Notes</label>
                        <textarea value={newTask.notes} onChange={e => setNewTask(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Optional task notes…" style={{ ...iS, resize: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={saveTask} disabled={savingTask || !newTask.subject.trim()} style={{ fontSize: 12, padding: '7px 16px', border: 'none', borderRadius: 8, background: savingTask || !newTask.subject.trim() ? '#9993d4' : '#3d35a8', color: '#fff', cursor: savingTask || !newTask.subject.trim() ? 'default' : 'pointer', fontWeight: 500 }}>
                          {savingTask ? 'Saving…' : 'Add task'}
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Task list */}
              {tasks.length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '24px', background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, marginBottom: 28 }}>No tasks yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
                  {tasks.map(task => (
                    <div key={task.id} style={{ background: '#fff', border: `1px solid ${task.completed ? '#e8e6e0' : '#e8e6e0'}`, borderRadius: 10, padding: '12px 14px', opacity: task.completed ? 0.6 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <input type="checkbox" checked={!!task.completed} onChange={() => toggleTaskComplete(task)} style={{ marginTop: 2, width: 15, height: 15, cursor: 'pointer', accentColor: '#3d35a8', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? '#aaa' : '#222' }}>{task.subject}</div>
                          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#888', marginTop: 3, flexWrap: 'wrap' }}>
                            {task.due_date && <span>Due {new Date(task.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                            {task.assigned_to && <span>→ {task.assigned_to}</span>}
                          </div>
                          {task.notes && <div style={{ fontSize: 12, color: '#666', marginTop: 6, lineHeight: 1.5 }}>{task.notes}</div>}
                        </div>
                        <button onClick={() => deleteTask(task.id)} style={{ fontSize: 11, padding: '3px 9px', border: '1px solid #e8d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#8b2020', flexShrink: 0 }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── FILE NOTES ── */}
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>File notes</div>

              {/* New note form */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                {(() => {
                  const iS = { fontSize: 13, padding: '7px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Subject</label>
                          <input value={noteForm.subject} onChange={e => setNoteForm(p => ({ ...p, subject: e.target.value }))} placeholder="Note subject…" style={iS} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Type</label>
                          <select value={noteForm.type} onChange={e => setNoteForm(p => ({ ...p, type: e.target.value }))} style={{ ...iS, background: '#fff' }}>
                            {NOTE_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Notes</label>
                        <textarea value={noteForm.notes} onChange={e => setNoteForm(p => ({ ...p, notes: e.target.value }))} rows={3} placeholder="Log a file note — phone call, site visit, conversation…" style={{ ...iS, resize: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                          <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Attach file <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span></label>
                          <input type="file" onChange={e => setNoteForm(p => ({ ...p, file: e.target.files[0] || null }))} style={{ fontSize: 12 }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-end', flexShrink: 0 }}>
                          <button onClick={openCompose} style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8a060', borderRadius: 8, background: '#fff8f0', color: '#a04010', cursor: 'pointer', fontWeight: 500 }}>
                            ✉ Send email
                          </button>
                          <button onClick={saveLeadNote} disabled={savingNote || (!noteForm.subject.trim() && !noteForm.notes.trim())} style={{ fontSize: 12, padding: '7px 16px', border: 'none', borderRadius: 8, background: savingNote || (!noteForm.subject.trim() && !noteForm.notes.trim()) ? '#9993d4' : '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                            {savingNote ? 'Saving…' : 'Log note'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Email compose panel */}
              {showCompose && (() => {
                const iS = { fontSize: 13, padding: '7px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
                return (
                  <div style={{ background: '#fffcf8', border: '1px solid #d8a060', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#a04010' }}>✉ New email</div>
                      <button onClick={() => setShowCompose(false)} style={{ fontSize: 18, color: '#aaa', cursor: 'pointer', border: 'none', background: 'none', lineHeight: 1, padding: 0 }}>×</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>To</label>
                          <input value={emailForm.to} onChange={e => setEmailForm(p => ({ ...p, to: e.target.value }))} placeholder="recipient@example.com" style={iS} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>CC <span style={{ color: '#aaa', fontWeight: 400 }}>(optional)</span></label>
                          <input value={emailForm.cc} onChange={e => setEmailForm(p => ({ ...p, cc: e.target.value }))} placeholder="cc@example.com" style={iS} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Subject</label>
                        <input value={emailForm.subject} onChange={e => setEmailForm(p => ({ ...p, subject: e.target.value }))} placeholder="Subject…" style={iS} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Body</label>
                        <textarea value={emailForm.body} onChange={e => setEmailForm(p => ({ ...p, body: e.target.value }))} rows={6} placeholder="Write your email here…" style={{ ...iS, resize: 'vertical' }} />
                      </div>
                      {sendResult && (
                        <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: sendResult.ok ? '#e1f5ee' : '#fceaea', color: sendResult.ok ? '#0a5a3c' : '#8b2020', fontWeight: 500 }}>
                          {sendResult.ok ? '✓ Email sent successfully' : `✕ ${sendResult.error}`}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setShowCompose(false); setSendResult(null) }} style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                        <button
                          onClick={sendEmail}
                          disabled={sendingEmail || !emailForm.to.trim() || sendResult?.ok}
                          style={{ fontSize: 12, padding: '7px 16px', border: 'none', borderRadius: 8, background: sendingEmail || !emailForm.to.trim() || sendResult?.ok ? '#c8905a' : '#a04010', color: '#fff', cursor: sendingEmail || !emailForm.to.trim() || sendResult?.ok ? 'default' : 'pointer', fontWeight: 500 }}
                        >
                          {sendingEmail ? 'Sending…' : 'Send email'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Search bar */}
              {(() => {
                const sq = noteSearch.trim().toLowerCase()
                const filteredNotes = sq
                  ? leadNotes.filter(n =>
                      (n.subject || '').toLowerCase().includes(sq) ||
                      (n.notes || '').toLowerCase().includes(sq) ||
                      (n.author || '').toLowerCase().includes(sq)
                    )
                  : leadNotes
                const hl = text => highlight(text, noteSearch.trim())

                return (
                  <>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#aaa', pointerEvents: 'none' }}>🔍</span>
                        <input
                          value={noteSearch}
                          onChange={e => setNoteSearch(e.target.value)}
                          placeholder="Search notes…"
                          style={{ fontSize: 13, padding: '8px 32px 8px 32px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
                        />
                        {noteSearch && (
                          <button onClick={() => setNoteSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 17, color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                        )}
                      </div>
                      {noteSearch.trim() && (
                        <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                          {filteredNotes.length === 0
                            ? `No results for "${noteSearch.trim()}"`
                            : `${filteredNotes.length} result${filteredNotes.length === 1 ? '' : 's'} for "${noteSearch.trim()}"`}
                        </div>
                      )}
                    </div>

                    {/* Note list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {filteredNotes.map(note => {
                        const isEmailNote = note.type === 'Email out' || note.type === 'Email in'
                        const c = NOTE_TYPE_COLOURS[note.type] || NOTE_TYPE_COLOURS['Internal note']
                        const fileUrl = note.file_path ? supabase.storage.from('lead-files').getPublicUrl(note.file_path).data.publicUrl : null

                        if (isEmailNote) {
                          const isOut = note.type === 'Email out'
                          let toAddr = '', ccAddr = '', emailBody = note.notes || ''
                          if (isOut && note.notes) {
                            const lines = note.notes.split('\n')
                            let bodyStart = 0
                            for (let i = 0; i < lines.length; i++) {
                              if (lines[i].startsWith('To: ')) { toAddr = lines[i].slice(4); bodyStart = i + 1 }
                              else if (lines[i].startsWith('CC: ')) { ccAddr = lines[i].slice(4); bodyStart = i + 1 }
                              else if (lines[i] === '' && i > 0) { bodyStart = i + 1; break }
                              else if (i > 1) break
                            }
                            emailBody = lines.slice(bodyStart).join('\n').trim()
                          }
                          const sanitisedHtml = emailBody
                            .replace(/<head[\s\S]*?<\/head>/gi, '')
                            .replace(/<style[\s\S]*?<\/style>/gi, '')
                            .replace(/<meta[^>]*>/gi, '')
                          const isHtml = /<[a-z][\s\S]*>/i.test(sanitisedHtml)
                          const r = getReply(note.id)
                          const iS = { fontSize: 13, padding: '7px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
                          return (
                            <div key={note.id} style={{ background: '#fffcf8', border: '1px solid #e8c898', borderRadius: 10, overflow: 'hidden' }}>
                              {/* Email header bar */}
                              <div style={{ background: '#fff8f0', borderBottom: '1px solid #e8c898', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 14, flexShrink: 0 }}>✉</span>
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500, background: isOut ? '#fff0e8' : '#e1f5ee', color: isOut ? '#a04010' : '#0a5a3c', flexShrink: 0 }}>
                                  {isOut ? 'Email out' : 'Email in'}
                                </span>
                                {isOut && toAddr && (
                                  <span style={{ fontSize: 12, color: '#888' }}>
                                    To: <span style={{ color: '#555', fontWeight: 500 }}>{hl(toAddr)}</span>
                                    {ccAddr && <span> · CC: <span style={{ color: '#555', fontWeight: 500 }}>{hl(ccAddr)}</span></span>}
                                  </span>
                                )}
                                {!isOut && note.author && (
                                  <span style={{ fontSize: 12, color: '#888' }}>
                                    From: <span style={{ color: '#555', fontWeight: 500 }}>{hl(note.author)}</span>
                                  </span>
                                )}
                                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#aaa', flexShrink: 0 }}>
                                  {new Date(note.created_at).toLocaleString('en-GB')}
                                </span>
                                <button
                                  onClick={() => r.open ? setReply(note.id, { open: false }) : openReply(note, emailBody, isOut, toAddr)}
                                  style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #d8a060', borderRadius: 6, background: r.open ? '#fceaea' : '#fff', color: r.open ? '#8b2020' : '#a04010', cursor: 'pointer', flexShrink: 0 }}
                                >
                                  {r.open ? 'Cancel' : '↩ Reply'}
                                </button>
                              </div>

                              {/* Subject + body */}
                              <div style={{ padding: '12px 14px' }}>
                                {note.subject && (
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#222', marginBottom: emailBody ? 8 : 0 }}>{hl(note.subject)}</div>
                                )}
                                {emailBody && (
                                  isHtml
                                    ? <div style={{ fontSize: 13, color: '#555', lineHeight: 1.65, maxHeight: 300, overflowY: 'auto', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: sanitisedHtml }} />
                                    : <div style={{ fontSize: 13, color: '#555', lineHeight: 1.65, maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{hl(emailBody)}</div>
                                )}
                                {!isOut && !emailBody && note.notes && (
                                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.65, maxHeight: 300, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{hl(note.notes)}</div>
                                )}
                              </div>

                        {/* Inline reply compose */}
                        {r.open && (
                          <div style={{ borderTop: '1px solid #e8c898', background: '#fff', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#a04010' }}>↩ Reply</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>To</label>
                                <input value={r.to} onChange={e => setReply(note.id, { to: e.target.value })} style={iS} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Subject</label>
                                <input value={r.subject} onChange={e => setReply(note.id, { subject: e.target.value })} style={iS} />
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Body</label>
                              <textarea
                                value={r.body}
                                onChange={e => setReply(note.id, { body: e.target.value })}
                                rows={8}
                                style={{ ...iS, resize: 'vertical' }}
                              />
                            </div>
                            {r.result && (
                              <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: r.result.ok ? '#e1f5ee' : '#fceaea', color: r.result.ok ? '#0a5a3c' : '#8b2020', fontWeight: 500 }}>
                                {r.result.ok ? '✓ Reply sent' : `✕ ${r.result.error}`}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                              <button onClick={() => setReply(note.id, { open: false })} style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                              <button
                                onClick={() => sendReply(note.id)}
                                disabled={r.sending || !r.to.trim() || r.result?.ok}
                                style={{ fontSize: 12, padding: '7px 16px', border: 'none', borderRadius: 8, background: r.sending || !r.to.trim() || r.result?.ok ? '#c8905a' : '#a04010', color: '#fff', cursor: r.sending || !r.to.trim() || r.result?.ok ? 'default' : 'pointer', fontWeight: 500 }}
                              >
                                {r.sending ? 'Sending…' : 'Send reply'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  }

                        return (
                          <div key={note.id} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color }}>{note.type}</span>
                              {note.subject && <span style={{ fontSize: 13, fontWeight: 600 }}>{hl(note.subject)}</span>}
                              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#aaa' }}>{hl(note.author)} · {new Date(note.created_at).toLocaleString('en-GB')}</span>
                            </div>
                            {note.notes && <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: fileUrl ? 8 : 0 }}>{hl(note.notes)}</div>}
                            {fileUrl && (
                              <a href={fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#3d35a8', textDecoration: 'none', fontWeight: 500 }}>
                                📎 {note.filename} ↗
                              </a>
                            )}
                          </div>
                        )
                      })}
                      {filteredNotes.length === 0 && (
                        <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 40 }}>
                          {noteSearch.trim() ? `No results for "${noteSearch.trim()}"` : 'No file notes yet'}
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* SURVEY TAB */}
          {activeTab === 'survey' && (
            <div style={{ maxWidth: 600 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Survey details</div>

              {/* ── Geo-clustering ──────────────────────────────────────── */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Find a nearby slot</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                  Search for available survey slots near this property to minimise travel time.
                </div>
                <button
                  onClick={findGeoSlots}
                  disabled={geoClusterLoading || !lead.property_postcode}
                  style={{ fontSize: 13, padding: '8px 18px', border: 'none', borderRadius: 8, background: geoClusterLoading || !lead.property_postcode ? '#9993d4' : '#3d35a8', color: '#fff', cursor: geoClusterLoading || !lead.property_postcode ? 'default' : 'pointer', fontWeight: 500 }}
                >
                  {geoClusterLoading ? 'Searching for nearby appointments…' : 'Find recommended slots'}
                </button>

                {geoClusterError && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#fceaea', borderRadius: 8, fontSize: 13, color: '#8b2020' }}>
                    {geoClusterError}
                  </div>
                )}

                {geoClusterSlots !== null && !geoClusterLoading && (() => {
                  const recommended = geoClusterSlots.recommendations || []
                  const others      = geoClusterSlots.all_slots || []
                  return (
                    <div style={{ marginTop: 16 }}>
                      {/* Recommended */}
                      <div style={{ fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>Recommended slots — drive time 30 mins or under</div>
                      {recommended.length === 0 ? (
                        <div style={{ padding: '12px 14px', background: '#faf9f7', borderRadius: 8, fontSize: 13, color: '#888', marginBottom: 16 }}>
                          No nearby appointments found in the next 6 weeks — all available slots shown below
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                          {recommended.map((slot, i) => {
                            const driveTime = slot.drive_time_minutes ?? slot.drive_time_mins ?? slot.drive_time
                            const surveyor  = slot.surveyor || slot.surveyor_name || '—'
                            const origin    = slot.origin_address || slot.from_address || slot.from_postcode || ''
                            return (
                              <div
                                key={i}
                                onClick={() => applySlot(slot)}
                                style={{ padding: '12px 14px', background: '#e1f5ee', border: '1px solid #b2dece', borderRadius: 8, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3 }}
                              >
                                <div style={{ fontSize: 11, fontWeight: 600, color: '#0a5a3c', textTransform: 'uppercase', letterSpacing: '.04em' }}>Recommended — nearby appointment</div>
                                <div style={{ fontSize: 13, color: '#0a3a2a', fontWeight: 500 }}>
                                  {surveyor} · {slot.date ? new Date(slot.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'} at {slot.time || '—'}
                                  {driveTime != null && <span style={{ fontWeight: 400, color: '#2a7a5c' }}> · {driveTime} min drive</span>}
                                </div>
                                {origin && <div style={{ fontSize: 11, color: '#2a7a5c' }}>From: {origin}</div>}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* All other slots */}
                      {others.length > 0 && (
                        <>
                          <div style={{ fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 8 }}>All other slots</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {others.map((slot, i) => {
                              const driveTime = slot.drive_time_minutes ?? slot.drive_time_mins ?? slot.drive_time
                              const surveyor  = slot.surveyor || slot.surveyor_name || '—'
                              return (
                                <div
                                  key={i}
                                  onClick={() => applySlot(slot)}
                                  style={{ padding: '10px 12px', background: '#faf9f7', border: '1px solid #e8e6e0', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#444' }}
                                >
                                  <span style={{ fontWeight: 500 }}>{surveyor}</span>
                                  <span>{slot.date ? new Date(slot.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'} at {slot.time || '—'}</span>
                                  {driveTime != null && <span style={{ color: '#888', fontSize: 12, marginLeft: 'auto' }}>{driveTime} min drive</span>}
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })()}
              </div>

              {/* ── Booking fields ──────────────────────────────────────── */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Date</label>
                    <input type="date" value={surveyDate} onChange={e => setSurveyDate(e.target.value)} onBlur={e => updateLead({ survey_date: e.target.value })} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Time</label>
                    <select value={surveyTime} onChange={e => setSurveyTime(e.target.value)} onBlur={e => updateLead({ survey_time: e.target.value })} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}>
                      <option value="">Select time</option>
                      {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Surveyor</label>
                    <select value={surveyorVal} onChange={e => setSurveyorVal(e.target.value)} onBlur={e => updateLead({ surveyor: e.target.value })} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}>
                      <option value="">Select surveyor</option>
                      {users.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                    </select>
                  </div>
                </div>
                {/* Confirm booking button — shown when all three fields have values and differ from what's saved */}
                {(() => {
                  const surveyChanged = surveyDate !== (lead.survey_date || '') ||
                    surveyTime !== (lead.survey_time || '') ||
                    surveyorVal !== (lead.surveyor || '')
                  return surveyDate && surveyTime && surveyorVal && surveyChanged && !surveyBookedMsg && (
                    <div ref={confirmButtonRef} style={{ padding: '14px 16px', background: '#f0eefc', border: '1px solid #c0b8f0', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#3d35a8', marginBottom: 2 }}>Ready to confirm</div>
                        <div style={{ fontSize: 12, color: '#555' }}>
                          {new Date(surveyDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at {surveyTime} with {surveyorVal}
                        </div>
                      </div>
                      <button
                        onClick={confirmSurveyBooking}
                        disabled={confirmingBooking}
                        style={{ fontSize: 13, padding: '9px 20px', border: 'none', borderRadius: 8, background: confirmingBooking ? '#9993d4' : '#3d35a8', color: '#fff', cursor: confirmingBooking ? 'default' : 'pointer', fontWeight: 600, flexShrink: 0 }}
                      >
                        {confirmingBooking ? 'Saving…' : 'Confirm survey booking'}
                      </button>
                    </div>
                  )
                })()}

                {/* Success banner */}
                {surveyBookedMsg && (
                  <div style={{ padding: '12px 14px', background: '#e1f5ee', border: '1px solid #b2dece', borderRadius: 8, fontSize: 13, color: '#0a5a3c', fontWeight: 500, marginBottom: 12 }}>
                    ✓ Survey booked successfully
                  </div>
                )}

                {lead.survey_date && !surveyBookedMsg && (
                  <div style={{ padding: '12px 14px', background: '#e1f5ee', borderRadius: 8, fontSize: 13, color: '#0a5a3c', fontWeight: 500 }}>
                    Survey booked: {new Date(lead.survey_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at {lead.survey_time} with {lead.surveyor}
                  </div>
                )}
                {!lead.survey_date && !surveyDate && (
                  <div style={{ padding: '12px 14px', background: '#faf9f7', borderRadius: 8, fontSize: 13, color: '#aaa' }}>No survey booked yet</div>
                )}
              </div>
            </div>
          )}

          {/* UPLOADS TAB */}
          {activeTab === 'uploads' && (
            <div style={{ maxWidth: 700 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Uploads</div>

              {/* Upload form */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Files</label>
                    <input
                      type="file"
                      multiple
                      onChange={e => setUploadFileList(Array.from(e.target.files).map(f => ({ file: f, notes: '' })))}
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  {/* Per-file notes */}
                  {uploadFileList.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {uploadFileList.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#faf9f7', borderRadius: 8, border: '1px solid #e8e6e0' }}>
                          <div style={{ fontSize: 12, fontWeight: 500, minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file.name}</div>
                          <input
                            value={item.notes}
                            onChange={e => setUploadFileList(prev => prev.map((x, i) => i === idx ? { ...x, notes: e.target.value } : x))}
                            placeholder="Notes (optional)"
                            style={{ fontSize: 12, padding: '5px 9px', border: '1px solid #d8d5cf', borderRadius: 7, outline: 'none', width: 220, flexShrink: 0 }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <button
                      onClick={handleUpload}
                      disabled={!uploadFileList.length || uploading}
                      style={{ fontSize: 12, padding: '7px 16px', border: 'none', borderRadius: 8, background: !uploadFileList.length || uploading ? '#9993d4' : '#3d35a8', color: '#fff', cursor: !uploadFileList.length || uploading ? 'default' : 'pointer', fontWeight: 500 }}
                    >
                      {uploading ? 'Uploading…' : `Upload${uploadFileList.length > 1 ? ` ${uploadFileList.length} files` : ''}`}
                    </button>
                  </div>
                </div>
              </div>

              {/* Upload table */}
              {uploads.length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 40, background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12 }}>No uploads yet</div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#faf9f7' }}>
                        <th style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 600, color: '#888', borderBottom: '1px solid #eeece8' }}>File</th>
                        <th style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 600, color: '#888', borderBottom: '1px solid #eeece8', width: 150 }}>Uploaded by</th>
                        <th style={{ textAlign: 'left', padding: '9px 14px', fontWeight: 600, color: '#888', borderBottom: '1px solid #eeece8', width: 170 }}>Photos taken by</th>
                        <th style={{ textAlign: 'right', padding: '9px 14px', fontWeight: 600, color: '#888', borderBottom: '1px solid #eeece8', width: 60 }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '9px 14px', fontWeight: 600, color: '#888', borderBottom: '1px solid #eeece8', width: 90 }}>Size</th>
                        <th style={{ width: 60, borderBottom: '1px solid #eeece8' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {uploads.map((upload, idx) => {
                        const { data: { publicUrl } } = supabase.storage.from('lead-files').getPublicUrl(upload.file_path)
                        return (
                          <tr key={upload.id} style={{ background: idx % 2 === 0 ? '#fff' : '#faf9f8' }}>
                            <td style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4f0' }}>
                              <div style={{ fontWeight: 500, color: '#1a1a1a' }}>{upload.filename}</div>
                              {upload.notes && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{upload.notes}</div>}
                              <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>{new Date(upload.created_at).toLocaleDateString('en-GB')}</div>
                            </td>
                            <td style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4f0', color: '#555' }}>{upload.uploaded_by || '—'}</td>
                            <td style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4f0' }}>
                              <input
                                defaultValue={upload.photos_taken_by || ''}
                                onBlur={e => { if (e.target.value !== (upload.photos_taken_by || '')) updateUploadField(upload.id, 'photos_taken_by', e.target.value) }}
                                placeholder="—"
                                style={{ fontSize: 12, padding: '4px 6px', border: '1px solid transparent', borderRadius: 5, outline: 'none', width: '100%', boxSizing: 'border-box', background: 'transparent' }}
                                onFocus={e => { e.target.style.border = '1px solid #d8d5cf'; e.target.style.background = '#fff' }}
                              />
                            </td>
                            <td style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4f0', textAlign: 'right', color: '#555' }}>1</td>
                            <td style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4f0', textAlign: 'right', color: '#555' }}>{formatBytes(upload.file_size)}</td>
                            <td style={{ padding: '8px 14px', borderBottom: '1px solid #f5f4f0', textAlign: 'right' }}>
                              <a href={publicUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#3d35a8', textDecoration: 'none', fontWeight: 500 }}>View ↗</a>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* LOCATION TAB */}
          {activeTab === 'location' && (() => {
            const fullAddress = [lead.property_road, lead.property_town, lead.property_postcode].filter(Boolean).join(', ')
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY
            const mapSrc = coords ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${coords.lat},${coords.lng}&maptype=${mapType}` : null
            const svSrc = coords ? `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${coords.lat},${coords.lng}&heading=210&pitch=10&fov=90` : null
            const distHq = coords ? haversineMiles(coords, HQ_LATLNG) : null
            const distLondon = coords ? haversineMiles(coords, LONDON_LATLNG) : null
            return (
              <div style={{ maxWidth: 1100 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Location</div>
                {!fullAddress ? (
                  <div style={{ marginTop: 16, padding: '40px 24px', background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                    No address has been added yet. Add a property road, town or postcode on the General tab.
                  </div>
                ) : geoLoading ? (
                  <div style={{ marginTop: 16, padding: '40px 24px', background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                    Looking up location…
                  </div>
                ) : !coords ? (
                  <div style={{ marginTop: 16, padding: '40px 24px', background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                    Could not find coordinates for this address. Check the postcode or road name on the General tab.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>{fullAddress}</div>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 18, background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 18px' }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em' }}>Distance from HQ</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{distHq != null ? `${distHq.toFixed(1)} miles` : '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em' }}>Distance from central London</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{distLondon != null ? `${distLondon.toFixed(1)} miles` : '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em' }}>Lat / Long</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em' }}>Google Place ID</div>
                        <div style={{ fontSize: 12, color: '#555', fontFamily: 'monospace' }}>{placeId || '—'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Map</div>
                          <div style={{ display: 'flex', border: '1px solid #d8d5cf', borderRadius: 7, overflow: 'hidden' }}>
                            {['roadmap', 'satellite'].map(mt => (
                              <button key={mt} onClick={() => setMapType(mt)} style={{ fontSize: 11, padding: '4px 12px', border: 'none', cursor: 'pointer', fontWeight: 500, background: mapType === mt ? '#3d35a8' : '#fff', color: mapType === mt ? '#fff' : '#555', textTransform: 'capitalize' }}>{mt}</button>
                            ))}
                          </div>
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
                          <iframe
                            title="map"
                            src={mapSrc}
                            width="100%"
                            height="450"
                            style={{ display: 'block', border: 'none' }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Street View</div>
                        <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
                          <iframe
                            title="streetview"
                            src={svSrc}
                            width="100%"
                            height="450"
                            style={{ display: 'block', border: 'none' }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })()}

          {/* TRACKING TAB */}
          {activeTab === 'tracking' && trackingDraft && (() => {
            const tiStyle = { fontSize: 12, padding: '6px 9px', border: '1px solid #d8d5cf', borderRadius: 6, outline: 'none', background: '#fff', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
            const panelStyle = { background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 16px' }
            const panelTitle = { fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }
            const fieldLabel = { fontSize: 11, color: '#888', marginBottom: 4, display: 'block' }
            const addBtn = { fontSize: 11, padding: '5px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#faf9f7', cursor: 'pointer', color: '#555', fontFamily: 'inherit' }

            // Week grid range
            const weekDays = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(calendarWeekStart)
              d.setDate(d.getDate() + i)
              return d
            })
            const apptsByDay = weekDays.map(d => {
              const key = d.toISOString().slice(0, 10)
              return leadAppointments.filter(a => a.date === key)
            })

            return (
              <div style={{ maxWidth: 1000 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Tracking</div>
                  <button onClick={saveTracking} disabled={savingTracking} style={{ fontSize: 12, padding: '7px 18px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: savingTracking ? 'default' : 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                    {savingTracking ? 'Saving…' : 'Save'}
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                  {/* Admin */}
                  <div style={panelStyle}>
                    <div style={panelTitle}>Admin</div>
                    <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>Lead created {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</div>
                    <label style={fieldLabel}>Assigned to</label>
                    <select value={trackingDraft.assigned_to} onChange={e => updateTrackingDraft('assigned_to', e.target.value)} style={{ ...tiStyle, marginBottom: 8 }}>
                      <option value="">— Unassigned —</option>
                      {users.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                    </select>
                    <label style={fieldLabel}>Notes (max 1000 chars)</label>
                    <textarea
                      value={trackingDraft.admin_notes}
                      onChange={e => updateTrackingDraft('admin_notes', e.target.value.slice(0, 1000))}
                      rows={3}
                      style={{ ...tiStyle, resize: 'vertical' }}
                    />
                  </div>

                  {/* Sales */}
                  <div style={panelStyle}>
                    <div style={panelTitle}>Sales</div>
                    <label style={fieldLabel}>Sales date</label>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <input type="date" value={trackingDraft.sales_date} onChange={e => updateTrackingDraft('sales_date', e.target.value)} style={tiStyle} />
                      <button onClick={() => addTrackingAppointment('Sales', trackingDraft.sales_date)} style={addBtn}>Add appointment</button>
                    </div>
                  </div>

                  {/* Survey */}
                  <div style={panelStyle}>
                    <div style={panelTitle}>Survey</div>
                    <label style={fieldLabel}>Survey date</label>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <input type="date" value={trackingDraft.survey_date_t} onChange={e => updateTrackingDraft('survey_date_t', e.target.value)} style={tiStyle} />
                      <button onClick={() => addTrackingAppointment('Survey', trackingDraft.survey_date_t)} style={addBtn}>Add appointment</button>
                    </div>
                    <label style={fieldLabel}>Notes</label>
                    <textarea value={trackingDraft.survey_notes} onChange={e => updateTrackingDraft('survey_notes', e.target.value)} rows={2} style={{ ...tiStyle, resize: 'vertical' }} />
                  </div>

                  {/* Installation */}
                  <div style={panelStyle}>
                    <div style={panelTitle}>Installation</div>
                    <label style={fieldLabel}>Site visit</label>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <input type="date" value={trackingDraft.installation_date} onChange={e => updateTrackingDraft('installation_date', e.target.value)} style={tiStyle} />
                      <button onClick={() => addTrackingAppointment('Installation', trackingDraft.installation_date)} style={addBtn}>Add appointment</button>
                    </div>
                    <label style={fieldLabel}>Notes</label>
                    <textarea value={trackingDraft.installation_notes} onChange={e => updateTrackingDraft('installation_notes', e.target.value)} rows={2} style={{ ...tiStyle, resize: 'vertical' }} />
                  </div>
                </div>

                {/* Lead Calendar — week grid */}
                <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0eeea', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Lead Calendar</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setCalendarWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })} style={addBtn}>← Prev</button>
                      <span style={{ fontSize: 12, color: '#555' }}>
                        {weekDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <button onClick={() => setCalendarWeekStart(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })} style={addBtn}>Next →</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 160 }}>
                    {weekDays.map((d, i) => {
                      const isToday = d.toDateString() === new Date().toDateString()
                      return (
                        <div key={i} style={{ borderRight: i < 6 ? '1px solid #f0eeea' : 'none', padding: 8, minHeight: 160 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: isToday ? '#3d35a8' : '#888', marginBottom: 6 }}>
                            {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {apptsByDay[i].map(a => {
                              const c = APPT_TYPE_COLOURS[a.type] || APPT_TYPE_COLOURS.Other
                              return (
                                <div key={a.id} style={{ fontSize: 10, padding: '3px 6px', borderRadius: 5, background: c.bg, color: c.color, fontWeight: 500 }}>
                                  {a.type}{a.start_time ? ` ${a.start_time}` : ''}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* QUOTE TAB */}
          {activeTab === 'quotes' && (() => {
            const publishedQuotes = quotes.filter(q => q.status === 'Published' || q.status === 'Accepted')
            const openQuotes = quotes.filter(q => q.status === 'Open')

            function quoteSummary(q) {
              const rows = quoteDrawings.filter(qd => qd.quote_id === q.id)
              const items = rows.map(qd => {
                const item = jobItems.find(i => i.id === qd.job_item_id)
                const dwg = drawings.find(d => d.id === qd.drawing_id)
                return { item, dwg }
              }).filter(r => r.item)
              const totalsInput = items.map(({ dwg }) => ({
                calculated: parseFloat(dwg?.calculated_price) || 0,
                priceOverride: dwg?.price_override ?? null,
                itemDiscountPct: dwg?.item_discount_pct ?? 0,
                vatRate: dwg?.vat_rate ?? 20,
                poa: dwg?.poa ?? false,
              }))
              const totals = items.length > 0
                ? computeQuoteTotals({ discountPct: q.discount_pct, depositPct: q.deposit_pct, interimPct: q.interim_pct }, totalsInput)
                : null
              return { items, totals }
            }

            return (
              <div style={{ maxWidth: 860 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Quote</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {publishedQuotes.length} published quote{publishedQuotes.length === 1 ? '' : 's'} · {openQuotes.length} open quote{openQuotes.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/leads/${leadId}/quotes`)}
                    style={{ fontSize: 12, padding: '7px 16px', border: 'none', borderRadius: 7, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Manage Quotes
                  </button>
                </div>

                {quotesLoading || jobItemsLoading ? (
                  <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>Loading…</div>
                ) : quotes.length === 0 ? (
                  <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '32px 24px', background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, marginBottom: 20 }}>
                    No quotes yet for this lead — click Manage Quotes to start one.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    {quotes.map(q => {
                      const statusStyle = q.status === 'Open'
                        ? { bg: '#f5f4f0', color: '#666' }
                        : q.status === 'Published'
                        ? { bg: '#e6f0fb', color: '#1a5fa8' }
                        : { bg: '#e1f5ee', color: '#0a5a3c' }
                      const { items, totals } = quoteSummary(q)
                      return (
                        <div key={q.id} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: items.length > 0 ? 10 : 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{q.quote_number} — contains {items.length} item{items.length === 1 ? '' : 's'}</div>
                            <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: statusStyle.bg, color: statusStyle.color }}>{q.status}</span>
                            {q.status !== 'Open' && <span title="Locked" style={{ fontSize: 12 }}>🔒</span>}
                            <div style={{ flex: 1 }} />
                            {totals && <div style={{ fontSize: 13, fontWeight: 700, color: '#1a5a1a' }}>{fmtGBP(totals.totalInclVat)} incl. VAT</div>}
                            <button
                              onClick={() => navigate(`/leads/${leadId}/quotes/${q.id}`)}
                              style={{ fontSize: 12, padding: '5px 14px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer', fontWeight: 500 }}
                            >
                              Open
                            </button>
                          </div>
                          {items.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              {items.map(({ item, dwg }) => (
                                <div key={item.id} style={{ fontSize: 12, color: '#666', display: 'flex', gap: 10 }}>
                                  <span>Item {item.item_number} · {[item.floor_level, item.elevation, item.room_name].filter(Boolean).join(' · ') || 'No location set'}</span>
                                  <span style={{ color: '#aaa' }}>1 drawing{dwg?.window_type ? ` (${dwg.window_type})` : ''}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Manual Quote — stub */}
                <div style={{ background: '#fff', border: '1px dashed #d8d5cf', borderRadius: 10, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Manual Quote</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>For quotes made outside the system</div>
                  </div>
                  <button disabled title="Coming soon" style={{ fontSize: 12, padding: '7px 16px', border: 'none', borderRadius: 7, background: '#e8e6f5', color: '#9993d4', cursor: 'not-allowed', fontWeight: 600 }}>
                    Create Manual Quote
                  </button>
                </div>
              </div>
            )
          })()}

          {/* OUTPUT TAB */}
          {activeTab === 'output' && (
            <div style={{ maxWidth: 700 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Output</div>
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 8 }}>Quote</label>
                <select
                  value={outputQuoteId}
                  onChange={e => setOutputQuoteId(e.target.value)}
                  style={{ fontSize: 13, padding: '7px 10px', border: '1px solid #d8d5cf', borderRadius: 7, outline: 'none', background: '#fff', width: '100%', maxWidth: 300, marginBottom: 20 }}
                >
                  <option value="">— Select a quote —</option>
                  {quotes.map(q => <option key={q.id} value={q.id}>{q.quote_number} ({q.status})</option>)}
                </select>

                {outputQuoteId && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: 'Quote PDF', hint: 'Coming in Step H3' },
                      { label: 'Item Details Sheet', hint: 'Coming soon' },
                    ].map(o => (
                      <div key={o.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid #ece9e2', borderRadius: 8, background: '#faf9f7' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#555' }}>{o.label}</span>
                        <button disabled title={o.hint} style={{ fontSize: 12, padding: '6px 14px', border: 'none', borderRadius: 7, background: '#e8e6f5', color: '#9993d4', cursor: 'not-allowed', fontWeight: 600 }}>
                          Generate
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
    </Layout>
  )
}