import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

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
const SURVEYORS = ['Tom B', 'Dave K', 'Sarah W', 'John Smith']
const CONTACT_TAGS = ['Homeowner', 'Landlord', 'Tenant', 'Builder', 'Architect', 'Developer', 'Agent', 'Other']
const TIME_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00']

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
  const [lead, setLead] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({ title: '', first_name: '', last_name: '', phone: '', email: '', notes: '', tags: [] })
  const [editingContactId, setEditingContactId] = useState(null)
  const [editDraft, setEditDraft] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [notes, setNotes] = useState([])

  useEffect(() => { fetchLead() }, [leadId])

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
    }
    setLoading(false)
  }

  async function updateLead(updates) {
    setSaving(true)
    await supabase.from('leads').update(updates).eq('id', leadId)
    await fetchLead()
    setSaving(false)
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

  async function addNote() {
    if (!noteText.trim()) return
    const note = { text: noteText, author: 'Nathan Smith', created_at: new Date().toISOString(), type: 'note' }
    setNotes(prev => [note, ...prev])
    setNoteText('')
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
        {['Lead capture', 'Quotes & orders', 'Production', 'Scheduling', 'Invoicing'].map(item => (
          <div key={item} onClick={item === 'Lead capture' ? () => navigate('/leads') : undefined} style={{ padding: '8px 11px', fontSize: 13, color: item === 'Lead capture' ? '#3d35a8' : '#aaa', fontWeight: item === 'Lead capture' ? 500 : 400, background: item === 'Lead capture' ? '#f0eefc' : 'transparent', borderRadius: 8, margin: '1px 7px', cursor: item === 'Lead capture' ? 'pointer' : 'not-allowed', opacity: item === 'Lead capture' ? 1 : 0.5 }}>
            {item}
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
          {[['general', 'General'], ['contacts', 'Contacts'], ['correspondence', 'Correspondence'], ['survey', 'Survey'], ['tracking', 'Tracking']].map(([id, label]) => (
            <div key={id} onClick={() => setActiveTab(id)} style={{ padding: '12px 16px', fontSize: 13, color: activeTab === id ? '#3d35a8' : '#888', cursor: 'pointer', borderBottom: activeTab === id ? '2px solid #3d35a8' : '2px solid transparent', fontWeight: 500 }}>{label}</div>
          ))}
        </div>

        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>

          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 900 }}>

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
                  ['Assigned to', lead.assigned_to],
                ].map(([label, val]) => val ? (
                  <div key={label} style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid #f5f4f0', fontSize: 13 }}>
                    <span style={{ color: '#888', minWidth: 120, fontSize: 12 }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{val}</span>
                  </div>
                ) : null)}
                {lead.notes && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: '#faf9f7', borderRadius: 8, fontSize: 12, color: '#555', lineHeight: 1.6 }}>{lead.notes}</div>
                )}
              </div>

              {/* Status */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px', gridColumn: '1/-1' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Status</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {STAGES.map(stage => (
                    <div key={stage} onClick={() => updateLead({ stage })} style={{ fontSize: 12, padding: '7px 14px', border: `2px solid ${lead.stage === stage ? '#3d35a8' : '#e8e6e0'}`, borderRadius: 8, background: lead.stage === stage ? '#f0eefc' : '#fff', color: lead.stage === stage ? '#3d35a8' : '#555', cursor: 'pointer', fontWeight: lead.stage === stage ? 600 : 400 }}>{stage}</div>
                  ))}
                </div>
              </div>

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
            <div style={{ maxWidth: 700 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Correspondence &amp; file notes</div>
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Log a file note — phone call, site visit, conversation..." rows={3} style={{ width: '100%', fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', resize: 'none', fontFamily: 'inherit', marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer' }}>Send email</button>
                  <button onClick={addNote} style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Log note</button>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {notes.map((note, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{note.author}</span>
                      <span style={{ fontSize: 11, color: '#aaa' }}>{new Date(note.created_at).toLocaleString('en-GB')}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{note.text}</div>
                  </div>
                ))}
                {notes.length === 0 && <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 40 }}>No correspondence yet</div>}
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
                      {SURVEYORS.map(s => <option key={s}>{s}</option>)}
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

          {/* TRACKING TAB */}
          {activeTab === 'tracking' && (
            <div style={{ maxWidth: 600 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Activity timeline</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { text: `Lead created as ${lead.stage}`, time: lead.created_at, author: lead.assigned_to || 'System' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 20, position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3d35a8', flexShrink: 0, marginTop: 3 }} />
                      <div style={{ width: 2, flex: 1, background: '#e8e6e0', marginTop: 4 }} />
                    </div>
                    <div style={{ flex: 1, paddingBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{item.text}</div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{new Date(item.time).toLocaleString('en-GB')} · {item.author}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}