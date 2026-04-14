import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import LeadDetail from './LeadDetail'

const STAGES = ['New', 'Contacted', 'Survey booked', 'Quoted']

const stageColours = {
  New: { bg: '#e6f0fb', color: '#1a5fa8' },
  Contacted: { bg: '#faeeda', color: '#7a4a08' },
  'Survey booked': { bg: '#e1f5ee', color: '#0a5a3c' },
  Quoted: { bg: '#eeedfe', color: '#4a3ab0' },
}

const priorityColours = {
  High: '#e24b4a',
  Medium: '#ef9f27',
  Low: '#639922',
}

const sourceColours = {
  Phone: { bg: '#eaf3de', color: '#2e6010' },
  Website: { bg: '#e6f0fb', color: '#1a5fa8' },
  Email: { bg: '#faeeda', color: '#7a4a08' },
  Referral: { bg: '#eeedfe', color: '#4a3ab0' },
}

const SECTORS = ['Residential', 'Commercial', 'Heritage', 'Landlord', 'Developer']
const WINDOW_TYPES = ['Sash windows', 'Casement windows', 'Timber doors', 'Fixed lights']
const SURVEYORS = ['Tom B', 'Dave K', 'Sarah W', 'John Smith']
const TIME_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00']

function Pill({ text, colourMap }) {
  const c = colourMap?.[text] || { bg: '#f5f4f0', color: '#666' }
  return <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>{text}</span>
}

function Toggle({ value, onChange, label }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ width: 36, height: 20, borderRadius: 999, background: value ? '#3d35a8' : '#d8d5cf', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left .2s' }} />
      </div>
      <span style={{ fontSize: 12, color: value ? '#3d35a8' : '#888', fontWeight: value ? 500 : 400 }}>{label}</span>
    </div>
  )
}

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState(null)
  const [activeTab, setActiveTab] = useState('board')
  const [saving, setSaving] = useState(false)
  const [postcodeLoading, setPostcodeLoading] = useState(false)

  const emptyForm = {
    property_address: '', property_postcode: '', property_town: '', property_road: '',
    contact_address: '', same_address: true,
    listed_building: false, conservation_area: false,
    window_types: [], estimated_units: '',
    source: 'Phone', priority: 'Medium', stage: 'New',
    assigned_to: '', sector: '', notes: '',
    survey_date: '', survey_time: '', surveyor: '',
    contact_first_name: '', contact_last_name: '', contact_title: '',
    contact_phone: '', contact_email: '',
  }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    setLoading(true)
    const { data, error } = await supabase
      .from('leads')
      .select(`*, lead_contacts(contact_id, is_main_contact, contacts(title, first_name, last_name, phone, email))`)
      .order('created_at', { ascending: false })
    if (!error) setLeads(data || [])
    setLoading(false)
  }

  async function lookupPostcode() {
    const pc = form.property_postcode.trim().replace(/\s/g, '')
    if (!pc) return
    setPostcodeLoading(true)
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${pc}`)
      const data = await res.json()
      if (data.status === 200) {
        setForm(p => ({
          ...p,
          property_road: data.result.thoroughfare || data.result.dependent_thoroughfare || '',
          property_town: data.result.post_town || data.result.admin_district || '',
          property_address: `${data.result.thoroughfare || ''}, ${data.result.post_town || ''}, ${data.result.postcode}`.trim()
        }))
      } else {
        alert('Postcode not found — please check and try again')
      }
    } catch {
      alert('Postcode lookup failed — please check your connection')
    }
    setPostcodeLoading(false)
  }

  async function saveLead() {
    if (!form.contact_first_name.trim() && !form.contact_last_name.trim()) {
      alert('Please enter at least one contact name.')
      return
    }
    setSaving(true)
    try {
      const leadNumber = 'L' + Date.now().toString().slice(-6)
      const windowTypesStr = form.window_types.join(', ')

      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .insert([{
          lead_number: leadNumber,
          property_address: form.property_address,
          property_postcode: form.property_postcode,
          property_road: form.property_road,
          property_town: form.property_town,
          contact_address: form.same_address ? form.property_address : form.contact_address,
          same_address: form.same_address,
          listed_building: form.listed_building,
          conservation_area: form.conservation_area,
          window_types: windowTypesStr,
          estimated_units: form.estimated_units ? parseInt(form.estimated_units) : null,
          source: form.source,
          priority: form.priority,
          stage: form.stage,
          assigned_to: form.assigned_to,
          sector: form.sector,
          notes: form.notes,
          survey_date: form.survey_date || null,
          survey_time: form.survey_time || null,
          surveyor: form.surveyor || null,
          created_at: new Date().toISOString()
        }])
        .select()

      if (leadError) throw leadError

      const newLeadId = leadData[0].id

      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .insert([{
          title: form.contact_title,
          first_name: form.contact_first_name,
          last_name: form.contact_last_name,
          phone: form.contact_phone,
          email: form.contact_email,
          created_at: new Date().toISOString()
        }])
        .select()

      if (contactError) throw contactError

      const { error: linkError } = await supabase
        .from('lead_contacts')
        .insert([{
          lead_id: newLeadId,
          contact_id: contactData[0].id,
          is_main_contact: true,
          created_at: new Date().toISOString()
        }])

      if (linkError) throw linkError

      await fetchLeads()
      setShowModal(false)
      setForm(emptyForm)
    } catch (err) {
      alert('Error saving: ' + err.message)
    }
    setSaving(false)
  }

  async function updateStage(id, stage) {
    await supabase.from('leads').update({ stage }).eq('id', id)
    await fetchLeads()
  }

  function toggleWindowType(type) {
    setForm(p => ({
      ...p,
      window_types: p.window_types.includes(type)
        ? p.window_types.filter(t => t !== type)
        : [...p.window_types, type]
    }))
  }

  function getMainContact(lead) {
    if (!lead.lead_contacts?.length) return null
    const main = lead.lead_contacts.find(lc => lc.is_main_contact) || lead.lead_contacts[0]
    return main?.contacts
  }

  const leadsForStage = (stage) => leads.filter(l => l.stage === stage)

  if (selectedLeadId) {
    return <LeadDetail leadId={selectedLeadId} onBack={() => { setSelectedLeadId(null); fetchLeads() }} />
  }

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
          <div key={item} style={{ padding: '8px 11px', fontSize: 13, color: item === 'Lead capture' ? '#3d35a8' : '#aaa', fontWeight: item === 'Lead capture' ? 500 : 400, background: item === 'Lead capture' ? '#f0eefc' : 'transparent', borderRadius: 8, margin: '1px 7px', cursor: item === 'Lead capture' ? 'pointer' : 'not-allowed', opacity: item === 'Lead capture' ? 1 : 0.5 }}>
            {item}
          </div>
        ))}
        <div style={{ marginTop: 'auto', padding: 13, borderTop: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#e6f0fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#1a5fa8' }}>NS</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>Nathan Smith</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>Admin</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Lead capture</div>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 500, background: '#e6f0fb', color: '#1a5fa8' }}>{leads.filter(l => l.stage === 'New').length} new</span>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 500, background: '#eaf3de', color: '#2e6010' }}>{leads.length} total</span>
          <button onClick={() => setShowModal(true)} style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>+ New lead</button>
        </div>

        <div style={{ display: 'flex', gap: 2, padding: '0 20px', background: '#fff', borderBottom: '1px solid #e8e6e0', flexShrink: 0 }}>
          {[['board', 'Lead board'], ['list', 'List view']].map(([id, label]) => (
            <div key={id} onClick={() => setActiveTab(id)} style={{ padding: '12px 16px', fontSize: 13, color: activeTab === id ? '#3d35a8' : '#888', cursor: 'pointer', borderBottom: activeTab === id ? '2px solid #3d35a8' : '2px solid transparent', fontWeight: 500 }}>{label}</div>
          ))}
        </div>

        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#aaa', marginTop: 60 }}>Loading leads...</div>
          ) : activeTab === 'board' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, alignItems: 'start' }}>
              {STAGES.map(stage => (
                <div key={stage} style={{ background: '#faf9f7', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {stage}
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, fontWeight: 500, ...stageColours[stage] }}>{leadsForStage(stage).length}</span>
                  </div>
                  {leadsForStage(stage).length === 0 && <div style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '20px 0' }}>No leads</div>}
                  {leadsForStage(stage).map(lead => {
                    const contact = getMainContact(lead)
                    return (
                      <div key={lead.id} onClick={() => setSelectedLeadId(lead.id)} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '12px 13px', marginBottom: 8, cursor: 'pointer', transition: 'border-color .1s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColours[lead.priority] || '#ccc', flexShrink: 0 }} />
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{lead.lead_number}</div>
                        </div>
                        {contact && <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 2 }}>{contact.title} {contact.first_name} {contact.last_name}</div>}
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
                          {lead.property_road && <div>{lead.property_road}</div>}
                          {lead.property_town && <div>{lead.property_town}</div>}
                          {lead.window_types && <div style={{ marginTop: 2 }}>{lead.window_types}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                          <Pill text={lead.source} colourMap={sourceColours} />
                          <span style={{ fontSize: 11, color: '#aaa' }}>{new Date(lead.created_at).toLocaleDateString('en-GB')}</span>
                        </div>
                        {lead.listed_building && <div style={{ marginTop: 6, fontSize: 10, padding: '2px 7px', borderRadius: 999, background: '#faeeda', color: '#7a4a08', display: 'inline-block', fontWeight: 500 }}>Listed building</div>}
                        {lead.conservation_area && <div style={{ marginTop: 4, fontSize: 10, padding: '2px 7px', borderRadius: 999, background: '#fceaea', color: '#8b2020', display: 'inline-block', fontWeight: 500 }}>Conservation area</div>}
                        {lead.assigned_to && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888', marginTop: 7 }}>
                            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#e6f0fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#1a5fa8' }}>{lead.assigned_to.substring(0, 2).toUpperCase()}</div>
                            {lead.assigned_to}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#faf9f7' }}>
                    {['Lead no.', 'Contact', 'Property', 'Window types', 'Source', 'Priority', 'Surveyor', 'Stage', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 11, color: '#888', borderBottom: '1px solid #eeece8', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => {
                    const contact = getMainContact(lead)
                    return (
                      <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', fontWeight: 600, color: '#3d35a8' }}>{lead.lead_number}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', fontWeight: 500 }}>{contact ? `${contact.first_name} ${contact.last_name}` : '—'}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: '#555' }}>{lead.property_road}, {lead.property_town}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: '#555' }}>{lead.window_types || '—'}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}><Pill text={lead.source} colourMap={sourceColours} /></td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: priorityColours[lead.priority], fontWeight: 500 }}>{lead.priority}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: '#888' }}>{lead.surveyor || '—'}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}><Pill text={lead.stage} colourMap={stageColours} /></td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}>
                          <button onClick={e => { e.stopPropagation(); setSelectedLeadId(lead.id) }} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Open</button>
                        </td>
                      </tr>
                    )
                  })}
                  {leads.length === 0 && <tr><td colSpan={9} style={{ padding: '40px 12px', textAlign: 'center', color: '#aaa' }}>No leads yet — add your first one</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New lead modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0eeea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Log new lead</div>
              <button onClick={() => setShowModal(false)} style={{ fontSize: 22, color: '#aaa', cursor: 'pointer', border: 'none', background: 'none', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Contact details */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0eeea' }}>Primary contact</div>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Title</label>
                    <select value={form.contact_title} onChange={e => setForm(p => ({ ...p, contact_title: e.target.value }))} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}>
                      <option value="">—</option>
                      {['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  {[['First name', 'contact_first_name', 'e.g. Tom'], ['Last name', 'contact_last_name', 'e.g. Harrison']].map(([label, key, ph]) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{label}</label>
                      <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[['Phone', 'contact_phone', '07700 900000'], ['Email', 'contact_email', 'name@email.com']].map(([label, key, ph]) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{label}</label>
                      <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, padding: '10px 12px', background: '#f5f4f0', borderRadius: 8, fontSize: 12, color: '#888' }}>
                  Additional contacts can be added after saving the lead from the lead detail page.
                </div>
              </div>

              {/* Property details */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0eeea' }}>Property details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Property postcode</label>
                    <input value={form.property_postcode} onChange={e => setForm(p => ({ ...p, property_postcode: e.target.value }))} onKeyDown={e => e.key === 'Enter' && lookupPostcode()} placeholder="e.g. SW1A 1AA" style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>&nbsp;</label>
                    <button onClick={lookupPostcode} disabled={postcodeLoading} style={{ fontSize: 12, padding: '8px 16px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500, height: 38 }}>
                      {postcodeLoading ? 'Looking up...' : 'Lookup ↗'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {[['Road / street', 'property_road', 'e.g. Elm Road'], ['Town / city', 'property_town', 'e.g. London']].map(([label, key, ph]) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{label}</label>
                      <input value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                  <Toggle value={form.listed_building} onChange={v => setForm(p => ({ ...p, listed_building: v }))} label="Listed building" />
                  <Toggle value={form.conservation_area} onChange={v => setForm(p => ({ ...p, conservation_area: v }))} label="Conservation area" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Toggle value={!form.same_address} onChange={v => setForm(p => ({ ...p, same_address: !v }))} label="Contact address is different to property address" />
                  {!form.same_address && (
                    <input value={form.contact_address} onChange={e => setForm(p => ({ ...p, contact_address: e.target.value }))} placeholder="Contact's home / billing address" style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', marginTop: 8 }} />
                  )}
                </div>
              </div>

              {/* Enquiry details */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0eeea' }}>Enquiry details</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500, display: 'block', marginBottom: 6 }}>Window / door types required</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {WINDOW_TYPES.map(type => (
                        <div key={type} onClick={() => toggleWindowType(type)} style={{ fontSize: 12, padding: '6px 13px', border: `1px solid ${form.window_types.includes(type) ? '#b0a8f0' : '#d8d5cf'}`, borderRadius: 8, background: form.window_types.includes(type) ? '#f0eefc' : '#fff', color: form.window_types.includes(type) ? '#3d35a8' : '#555', cursor: 'pointer', fontWeight: 500 }}>{type}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Estimated number of units</label>
                      <input type="number" min="1" value={form.estimated_units} onChange={e => setForm(p => ({ ...p, estimated_units: e.target.value }))} placeholder="e.g. 6" style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Sector</label>
                      <select value={form.sector} onChange={e => setForm(p => ({ ...p, sector: e.target.value }))} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}>
                        <option value="">Select sector</option>
                        {SECTORS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Description</label>
                    <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="e.g. 6 sash windows like-for-like, Victorian terrace, painted white..." style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                  </div>
                </div>
              </div>

              {/* Lead details */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0eeea' }}>Lead details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Source</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['Phone', 'Website', 'Email', 'Referral'].map(s => (
                        <div key={s} onClick={() => setForm(p => ({ ...p, source: s }))} style={{ fontSize: 12, padding: '6px 13px', border: `1px solid ${form.source === s ? '#b0a8f0' : '#d8d5cf'}`, borderRadius: 8, background: form.source === s ? '#f0eefc' : '#fff', color: form.source === s ? '#3d35a8' : '#555', cursor: 'pointer', fontWeight: 500 }}>{s}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Priority</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['High', 'Medium', 'Low'].map(p => (
                        <div key={p} onClick={() => setForm(prev => ({ ...prev, priority: p }))} style={{ fontSize: 12, padding: '6px 13px', border: `1px solid ${form.priority === p ? '#b0a8f0' : '#d8d5cf'}`, borderRadius: 8, background: form.priority === p ? '#f0eefc' : '#fff', color: form.priority === p ? '#3d35a8' : '#555', cursor: 'pointer', fontWeight: 500 }}>{p}</div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Assigned to</label>
                    <select value={form.assigned_to} onChange={e => setForm(p => ({ ...p, assigned_to: e.target.value }))} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}>
                      <option value="">— Select —</option>
                      {SURVEYORS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1/-1' }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Notes</label>
                    <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any extra context..." style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
                  </div>
                </div>
              </div>

              {/* Survey booking */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0eeea' }}>Survey booking (optional)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Date</label>
                    <input type="date" value={form.survey_date} onChange={e => setForm(p => ({ ...p, survey_date: e.target.value }))} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Time</label>
                    <select value={form.survey_time} onChange={e => setForm(p => ({ ...p, survey_time: e.target.value }))} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}>
                      <option value="">Select time</option>
                      {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Surveyor</label>
                    <select value={form.surveyor} onChange={e => setForm(p => ({ ...p, surveyor: e.target.value }))} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', background: '#fff' }}>
                      <option value="">Select surveyor</option>
                      {SURVEYORS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid #f0eeea', display: 'flex', gap: 8, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: '#fff' }}>
              <button onClick={() => setShowModal(false)} style={{ fontSize: 12, padding: '7px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
              <button onClick={saveLead} disabled={saving} style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>
                {saving ? 'Saving...' : 'Save lead ↗'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}