import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUsers } from '../hooks/useUsers'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'

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
  Installation: { bg: '#e1f5ee', color: '#0a5a3c' },
  Snagging:     { bg: '#faeeda', color: '#7a4a08' },
  Other:        { bg: '#eeedfe', color: '#4a3ab0' },
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

export default function LeadDetail() {
  const { id: leadId } = useParams()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { users } = useUsers()
  const unmatchedCount = useUnmatchedCount()
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
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState({ subject: '', due_date: '', assigned_to: '', notes: '' })
  const [savingTask, setSavingTask] = useState(false)
  const [leadAppointments, setLeadAppointments] = useState([])
  const [coords, setCoords] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [enquiryNotes, setEnquiryNotes] = useState('')

  useEffect(() => { fetchLead(); fetchUploads() }, [leadId])

  useEffect(() => {
    if (activeTab === 'tracking') fetchLeadAppointments()
    if (activeTab === 'correspondence') { fetchTasks(); fetchLeadNotes() }
  }, [activeTab, leadId])

  useEffect(() => {
    if (activeTab !== 'location' || !lead) return
    const fullAddress = [lead.property_road, lead.property_town, lead.property_postcode].filter(Boolean).join(', ')
    if (!fullAddress) return
    setCoords(null)
    setGeoLoading(true)
    fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(fullAddress)}&key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}`)
      .then(r => r.json())
      .then(data => {
        if (data.results?.[0]?.geometry?.location) {
          setCoords(data.results[0].geometry.location)
        }
      })
      .finally(() => setGeoLoading(false))
  }, [activeTab, lead])

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
        created_at: new Date().toISOString(),
      }])
    }
    await fetchUploads()
    setUploadFileList([])
    setUploading(false)
  }

  async function fetchLeadAppointments() {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('lead_id', leadId)
      .order('date', { ascending: false })
    setLeadAppointments(data || [])
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

  async function sendEmail() {
    if (!emailForm.to.trim()) return
    setSendingEmail(true)
    setSendResult(null)

    try {
      const EDGE_URL = 'https://ubmxstufxyeimaywcevk.supabase.co/functions/v1/send-email'

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const requestBody = {
        to: emailForm.to,
        ...(emailForm.cc ? { cc: emailForm.cc } : {}),
        subject: emailForm.subject,
        body: emailForm.body,
        from_mailbox: user?.email,
      }

      console.log('[sendEmail] URL:', EDGE_URL)
      console.log('[sendEmail] Token (first 20 chars):', token ? token.slice(0, 20) + '…' : 'null')
      console.log('[sendEmail] Request body:', requestBody)

      const res = await fetch(EDGE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
        emailForm.body,
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
        ].map(([item, path, badge]) => (
          <div key={item} onClick={path ? () => navigate(path) : undefined} style={{ padding: '8px 11px', fontSize: 13, color: item === 'Leads' ? '#3d35a8' : path ? '#555' : '#aaa', fontWeight: item === 'Leads' ? 500 : 400, background: item === 'Leads' ? '#f0eefc' : 'transparent', borderRadius: 8, margin: '1px 7px', cursor: path ? 'pointer' : 'not-allowed', opacity: path ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{item}</span>
            {badge > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#fceaea', color: '#8b2020', fontWeight: 600, flexShrink: 0 }}>{badge}</span>}
          </div>
        ))}
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

        {/* Topbar */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
          <button onClick={() => navigate('/leads')} style={{ fontSize: 12, padding: '6px 12px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500 }}>← Back</button>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{lead.lead_number}</div>
          {mainContact && <div style={{ fontSize: 13, color: '#555' }}>{mainContact.first_name} {mainContact.last_name}</div>}
          <Pill text={lead.stage} colourMap={stageColours} />
          {lead.listed_building && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: '#faeeda', color: '#7a4a08' }}>Listed building</span>}
          {lead.conservation_area && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: '#fceaea', color: '#8b2020' }}>Conservation area</span>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {saving && <span style={{ fontSize: 12, color: '#aaa' }}>Saving...</span>}
            <button style={{ fontSize: 12, padding: '6px 14px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Convert to quote →</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '0 20px', background: '#fff', borderBottom: '1px solid #e8e6e0', flexShrink: 0 }}>
          {[['general', 'General'], ['contacts', 'Contacts'], ['correspondence', 'Correspondence'], ['survey', 'Survey'], ['uploads', 'Uploads'], ['location', 'Location'], ['tracking', 'Tracking']].map(([id, label]) => (
            <div key={id} onClick={() => setActiveTab(id)} style={{ padding: '12px 16px', fontSize: 13, color: activeTab === id ? '#3d35a8' : '#888', cursor: 'pointer', borderBottom: activeTab === id ? '2px solid #3d35a8' : '2px solid transparent', fontWeight: 500 }}>{label}</div>
          ))}
        </div>

        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>

          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>

              {/* Contacts (read-only) */}
              {contacts.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px', gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Contacts</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {contacts.map(lc => {
                      const tagList = lc.contacts?.tags ? lc.contacts.tags.split(',').map(t => t.trim()).filter(Boolean) : []
                      return (
                        <div key={lc.id} style={{ border: `1px solid ${lc.is_main_contact ? '#b0a8f0' : '#e8e6e0'}`, borderRadius: 10, padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e6f0fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#1a5fa8', flexShrink: 0 }}>
                              {(lc.contacts?.first_name?.[0] || '') + (lc.contacts?.last_name?.[0] || '')}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>
                                {[lc.contacts?.title, lc.contacts?.first_name, lc.contacts?.last_name].filter(Boolean).join(' ')}
                              </div>
                              {lc.is_main_contact && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: '#f0eefc', color: '#3d35a8', fontWeight: 500 }}>Main contact</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: '#555', display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: tagList.length ? 8 : 0 }}>
                            {lc.contacts?.phone && <span>📞 {lc.contacts.phone}</span>}
                            {lc.contacts?.email && <span>✉ {lc.contacts.email}</span>}
                          </div>
                          {tagList.length > 0 && (
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {tagList.map(tag => (
                                <span key={tag} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f0eefc', color: '#3d35a8', fontWeight: 500 }}>{tag}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Status + Assigned to */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Status</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {STAGES.map(stage => (
                    <div key={stage} onClick={() => updateLead({ stage })} style={{ fontSize: 12, padding: '7px 14px', border: `2px solid ${lead.stage === stage ? '#3d35a8' : '#e8e6e0'}`, borderRadius: 8, background: lead.stage === stage ? '#f0eefc' : '#fff', color: lead.stage === stage ? '#3d35a8' : '#555', cursor: 'pointer', fontWeight: lead.stage === stage ? 600 : 400 }}>{stage}</div>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid #f0eeea' }}>
                  <label style={{ fontSize: 12, color: '#888', fontWeight: 500, flexShrink: 0 }}>Assigned to</label>
                  <select
                    value={lead.assigned_to || ''}
                    onChange={e => updateLead({ assigned_to: e.target.value })}
                    style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff', cursor: 'pointer', minWidth: 160 }}
                  >
                    <option value="">— Unassigned —</option>
                    {users.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                  </select>
                </div>
              </div>

              {/* Lead Tags */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Tags</div>
                {(() => {
                  const activeTags = lead.lead_tags ? lead.lead_tags.split(',').map(t => t.trim()).filter(Boolean) : []
                  return (
                    <>
                      {activeTags.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                          {activeTags.map(tag => {
                            const c = LEAD_TAG_COLOURS[tag] || { bg: '#f0eefc', color: '#3d35a8' }
                            return <span key={tag} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color }}>{tag}</span>
                          })}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {LEAD_TAGS.map(tag => {
                          const active = activeTags.includes(tag)
                          return (
                            <div
                              key={tag}
                              onClick={() => toggleLeadTag(tag)}
                              style={{ fontSize: 12, padding: '5px 13px', borderRadius: 8, cursor: 'pointer', fontWeight: 500, border: `1px solid ${active ? '#b0a8f0' : '#d8d5cf'}`, background: active ? '#f0eefc' : '#fff', color: active ? '#3d35a8' : '#555' }}
                            >
                              {tag}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Property */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Property</div>
                {[
                  ['Road', lead.property_road],
                  ['Town', lead.property_town],
                  ['Postcode', lead.property_postcode],
                  ['Sector', lead.sector],
                ].map(([label, val]) => val ? (
                  <div key={label} style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid #f5f4f0', fontSize: 13 }}>
                    <span style={{ color: '#888', minWidth: 120, fontSize: 12 }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{val}</span>
                  </div>
                ) : null)}
                {lead.listed_building && <div style={{ marginTop: 8 }}><span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: '#faeeda', color: '#7a4a08' }}>Listed building</span></div>}
                {lead.conservation_area && <div style={{ marginTop: 4 }}><span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: '#fceaea', color: '#8b2020' }}>Conservation area</span></div>}
              </div>

              {/* Enquiry */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Enquiry</div>
                {[
                  ['Window types', lead.window_types],
                  ['Estimated units', lead.estimated_units],
                  ['Source', lead.source],
                  ['Priority', lead.priority],
                ].map(([label, val]) => val ? (
                  <div key={label} style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid #f5f4f0', fontSize: 13 }}>
                    <span style={{ color: '#888', minWidth: 120, fontSize: 12 }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{val}</span>
                  </div>
                ) : null)}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12 }}>
                  <label style={{ fontSize: 12, color: '#888', fontWeight: 500 }}>Enquiry notes</label>
                  <textarea
                    value={enquiryNotes}
                    onChange={e => setEnquiryNotes(e.target.value)}
                    onBlur={e => { if (e.target.value !== (lead.description || '')) updateLead({ description: e.target.value }) }}
                    rows={4}
                    placeholder="Add enquiry notes…"
                    style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

            </div>
          )}

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

              {/* Note list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {leadNotes.map(note => {
                  const isEmailNote = note.type === 'Email out' || note.type === 'Email in'
                  const c = NOTE_TYPE_COLOURS[note.type] || NOTE_TYPE_COLOURS['Internal note']
                  const fileUrl = note.file_path ? supabase.storage.from('lead-files').getPublicUrl(note.file_path).data.publicUrl : null

                  if (isEmailNote) {
                    const isOut = note.type === 'Email out'
                    // Parse To:/CC: header lines out of the notes body (Email out format)
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
                              To: <span style={{ color: '#555', fontWeight: 500 }}>{toAddr}</span>
                              {ccAddr && <span> · CC: <span style={{ color: '#555', fontWeight: 500 }}>{ccAddr}</span></span>}
                            </span>
                          )}
                          {!isOut && note.author && (
                            <span style={{ fontSize: 12, color: '#888' }}>
                              From: <span style={{ color: '#555', fontWeight: 500 }}>{note.author}</span>
                            </span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#aaa', flexShrink: 0 }}>
                            {new Date(note.created_at).toLocaleString('en-GB')}
                          </span>
                        </div>
                        {/* Subject + body */}
                        <div style={{ padding: '12px 14px' }}>
                          {note.subject && (
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#222', marginBottom: emailBody ? 8 : 0 }}>{note.subject}</div>
                          )}
                          {emailBody && (
                            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{emailBody}</div>
                          )}
                          {!isOut && !emailBody && note.notes && (
                            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.notes}</div>
                          )}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={note.id} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color }}>{note.type}</span>
                        {note.subject && <span style={{ fontSize: 13, fontWeight: 600 }}>{note.subject}</span>}
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#aaa' }}>{note.author} · {new Date(note.created_at).toLocaleString('en-GB')}</span>
                      </div>
                      {note.notes && <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: fileUrl ? 8 : 0 }}>{note.notes}</div>}
                      {fileUrl && (
                        <a href={fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#3d35a8', textDecoration: 'none', fontWeight: 500 }}>
                          📎 {note.filename} ↗
                        </a>
                      )}
                    </div>
                  )
                })}
                {leadNotes.length === 0 && <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 40 }}>No file notes yet</div>}
              </div>
            </div>
          )}

          {/* SURVEY TAB */}
          {activeTab === 'survey' && (
            <div style={{ maxWidth: 600 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Survey details</div>
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Date</label>
                    <input type="date" defaultValue={lead.survey_date || ''} onBlur={e => updateLead({ survey_date: e.target.value })} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Time</label>
                    <select defaultValue={lead.survey_time || ''} onBlur={e => updateLead({ survey_time: e.target.value })} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}>
                      <option value="">Select time</option>
                      {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Surveyor</label>
                    <select defaultValue={lead.surveyor || ''} onBlur={e => updateLead({ surveyor: e.target.value })} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}>
                      <option value="">Select surveyor</option>
                      {users.map(u => <option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                    </select>
                  </div>
                </div>
                {lead.survey_date && (
                  <div style={{ padding: '12px 14px', background: '#e1f5ee', borderRadius: 8, fontSize: 13, color: '#0a5a3c', fontWeight: 500 }}>
                    Survey booked: {new Date(lead.survey_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} at {lead.survey_time} with {lead.surveyor}
                  </div>
                )}
                {!lead.survey_date && (
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

              {/* Upload list */}
              {uploads.length === 0 && (
                <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 40 }}>No uploads yet</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {uploads.map(upload => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(upload.filename)
                  const { data: { publicUrl } } = supabase.storage.from('lead-files').getPublicUrl(upload.file_path)
                  return (
                    <div key={upload.id} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                        {isImage && (
                          <img src={publicUrl} alt={upload.filename} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '1px solid #e8e6e0' }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{upload.filename}</div>
                            <a href={publicUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #d8d5cf', borderRadius: 6, color: '#555', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>View ↗</a>
                          </div>
                          {upload.notes && <div style={{ fontSize: 12, color: '#666', marginBottom: 4, lineHeight: 1.4 }}>{upload.notes}</div>}
                          <div style={{ fontSize: 11, color: '#aaa' }}>{new Date(upload.created_at).toLocaleString('en-GB')}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* LOCATION TAB */}
          {activeTab === 'location' && (() => {
            const fullAddress = [lead.property_road, lead.property_town, lead.property_postcode].filter(Boolean).join(', ')
            const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY
            const mapSrc = coords ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${coords.lat},${coords.lng}` : null
            const svSrc = coords ? `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${coords.lat},${coords.lng}&heading=210&pitch=10&fov=90` : null
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
                    <div style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>{fullAddress}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Map</div>
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
          {activeTab === 'tracking' && (
            <div style={{ maxWidth: 700 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Appointments</div>

              {leadAppointments.length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: '40px 24px', background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12 }}>
                  No appointments linked to this lead yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {leadAppointments.map((appt, i) => {
                    const c = APPT_TYPE_COLOURS[appt.type] || APPT_TYPE_COLOURS.Other
                    const isLast = i === leadAppointments.length - 1
                    return (
                      <div key={appt.id} style={{ display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, marginTop: 4 }} />
                          {!isLast && <div style={{ width: 2, flex: 1, background: '#e8e6e0', marginTop: 4 }} />}
                        </div>
                        <div style={{ flex: 1, background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '12px 14px', marginBottom: isLast ? 0 : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color }}>{appt.type}</span>
                            {appt.allday && <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: '#f5f4f0', color: '#666', fontWeight: 500 }}>All day</span>}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{appt.title}</div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#555' }}>
                            {appt.date && <span>📅 {new Date(appt.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                            {!appt.allday && appt.start_time && <span>🕐 {appt.start_time}{appt.end_time ? ` – ${appt.end_time}` : ''}</span>}
                            {appt.assigned_to && <span>👤 {appt.assigned_to}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
                            Created {new Date(appt.created_at).toLocaleString('en-GB')}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}