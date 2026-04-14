import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

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

export default function Leads() {
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [activeTab, setActiveTab] = useState('board')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: '',
    description: '', source: 'Phone', priority: 'Medium',
    stage: 'New', assigned_to: '', notes: ''
  })

  useEffect(() => { fetchLeads() }, [])

  async function fetchLeads() {
    setLoading(true)
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setLeads(data || [])
    setLoading(false)
  }

  async function saveLead() {
    if (!form.name.trim()) { alert('Please enter a name.'); return }
    setSaving(true)
    const { error } = await supabase.from('leads').insert([{
      ...form,
      created_at: new Date().toISOString()
    }])
    if (!error) {
      await fetchLeads()
      setShowModal(false)
      setForm({ name: '', phone: '', email: '', address: '', description: '', source: 'Phone', priority: 'Medium', stage: 'New', assigned_to: '', notes: '' })
    } else {
      alert('Error saving lead: ' + error.message)
    }
    setSaving(false)
  }

  async function updateStage(id, stage) {
    await supabase.from('leads').update({ stage }).eq('id', id)
    await fetchLeads()
    if (selectedLead?.id === id) setSelectedLead(prev => ({ ...prev, stage }))
  }

  const pill = (text, colourMap) => {
    const c = colourMap[text] || { bg: '#f5f4f0', color: '#666' }
    return (
      <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, fontWeight: 500, background: c.bg, color: c.color }}>
        {text}
      </span>
    )
  }

  const leadsForStage = (stage) => leads.filter(l => l.stage === stage)

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'inherit' }}>

      {/* Sidebar */}
      <div style={{ width: 215, background: '#fff', borderRight: '1px solid #e8e6e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>GlazePro</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Window management</div>
        </div>
        <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Workflow</div>
        {[
          { label: 'Lead capture', active: true },
          { label: 'Quotes & orders', active: false },
          { label: 'Production', active: false },
          { label: 'Scheduling', active: false },
          { label: 'Invoicing', active: false },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', fontSize: 13, color: item.active ? '#3d35a8' : '#aaa', fontWeight: item.active ? 500 : 400, background: item.active ? '#f0eefc' : 'transparent', borderRadius: 8, margin: '1px 7px', cursor: item.active ? 'pointer' : 'not-allowed', opacity: item.active ? 1 : 0.5 }}>
            {item.label}
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

        {/* Topbar */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Lead capture</div>
          {pill(`${leads.filter(l => l.stage === 'New').length} new`, { new: { bg: '#e6f0fb', color: '#1a5fa8' } }['new'] ? { bg: '#e6f0fb', color: '#1a5fa8' } : {})}
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 500, background: '#eaf3de', color: '#2e6010' }}>{leads.length} total leads</span>
          <button onClick={() => setShowModal(true)} style={{ fontSize: 12, padding: '7px 14px', border: 'none', borderRadius: 8, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>+ New lead</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '0 20px', background: '#fff', borderBottom: '1px solid #e8e6e0', flexShrink: 0 }}>
          {['board', 'list'].map(tab => (
            <div key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '12px 16px', fontSize: 13, color: activeTab === tab ? '#3d35a8' : '#888', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid #3d35a8' : '2px solid transparent', fontWeight: 500, textTransform: 'capitalize' }}>
              {tab === 'board' ? 'Lead board' : 'List view'}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 20, overflowY: 'auto' }}>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#aaa', marginTop: 60, fontSize: 14 }}>Loading leads...</div>
          ) : activeTab === 'board' ? (

            /* Board view */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, alignItems: 'start' }}>
              {STAGES.map(stage => (
                <div key={stage} style={{ background: '#faf9f7', borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {stage}
                    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 999, fontWeight: 500, ...stageColours[stage] }}>{leadsForStage(stage).length}</span>
                  </div>
                  {leadsForStage(stage).length === 0 && (
                    <div style={{ fontSize: 12, color: '#ccc', textAlign: 'center', padding: '20px 0' }}>No leads</div>
                  )}
                  {leadsForStage(stage).map(lead => (
                    <div key={lead.id} onClick={() => setSelectedLead(lead)} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '12px 13px', marginBottom: 8, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: priorityColours[lead.priority] || '#ccc', flexShrink: 0 }}></div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{lead.name}</div>
                      </div>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>{lead.address || 'No address'}<br />{lead.description?.substring(0, 50)}{lead.description?.length > 50 ? '...' : ''}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {pill(lead.source, sourceColours)}
                        <span style={{ fontSize: 11, color: '#aaa' }}>{new Date(lead.created_at).toLocaleDateString('en-GB')}</span>
                      </div>
                      {lead.assigned_to && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888', marginTop: 7 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#e6f0fb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#1a5fa8' }}>{lead.assigned_to.substring(0, 2).toUpperCase()}</div>
                          {lead.assigned_to}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

          ) : (

            /* List view */
            <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#faf9f7' }}>
                    {['Name', 'Description', 'Source', 'Priority', 'Assigned', 'Stage', 'Date', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 12px', fontSize: 11, color: '#888', borderBottom: '1px solid #eeece8', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedLead(lead)}>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', fontWeight: 600 }}>{lead.name}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: '#555', maxWidth: 200 }}>{lead.description?.substring(0, 60)}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}>{pill(lead.source, sourceColours)}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: priorityColours[lead.priority], fontWeight: 500 }}>{lead.priority}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: '#888' }}>{lead.assigned_to || '—'}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}>{pill(lead.stage, stageColours)}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0', color: '#aaa' }}>{new Date(lead.created_at).toLocaleDateString('en-GB')}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid #f5f4f0' }}>
                        <button onClick={e => { e.stopPropagation(); setSelectedLead(lead) }} style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Open</button>
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: '40px 12px', textAlign: 'center', color: '#aaa' }}>No leads yet — add your first one</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New lead modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 580, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0eeea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Log new lead</div>
              <button onClick={() => setShowModal(false)} style={{ fontSize: 22, color: '#aaa', cursor: 'pointer', border: 'none', background: 'none', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Full name', key: 'name', placeholder: 'e.g. Tom Harrison', span: false },
                { label: 'Phone', key: 'phone', placeholder: '07700 900000', span: false },
                { label: 'Email', key: 'email', placeholder: 'name@email.com', span: false },
                { label: 'Assign to', key: 'assigned_to', placeholder: 'e.g. Tom B', span: false },
                { label: 'Property address', key: 'address', placeholder: 'e.g. 14 Elm Road, Hammersmith', span: true },
              ].map(f => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: f.span ? '1/-1' : undefined }}>
                  <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>{f.label}</label>
                  <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', fontFamily: 'inherit' }} />
                </div>
              ))}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>What do they need?</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="e.g. 6 sash windows like-for-like, Victorian terrace..." style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', fontFamily: 'inherit', resize: 'none' }} />
              </div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: '1/-1' }}>
                <label style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any extra context..." style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', fontFamily: 'inherit', resize: 'none' }} />
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

      {/* Lead detail modal */}
      {selectedLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 520, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0eeea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{selectedLead.name}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{selectedLead.stage} · {selectedLead.priority} priority</div>
              </div>
              <button onClick={() => setSelectedLead(null)} style={{ fontSize: 22, color: '#aaa', cursor: 'pointer', border: 'none', background: 'none', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#faf9f7', borderRadius: 10, padding: '14px 16px' }}>
                {[
                  ['Phone', selectedLead.phone],
                  ['Email', selectedLead.email],
                  ['Address', selectedLead.address],
                  ['Source', selectedLead.source],
                  ['Assigned to', selectedLead.assigned_to],
                  ['Description', selectedLead.description],
                  ['Notes', selectedLead.notes],
                ].map(([label, val]) => val ? (
                  <div key={label} style={{ display: 'flex', padding: '7px 0', borderBottom: '1px solid #f0eeea', fontSize: 13, gap: 12 }}>
                    <span style={{ fontSize: 12, color: '#888', minWidth: 100 }}>{label}</span>
                    <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{val}</span>
                  </div>
                ) : null)}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>Move to stage</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {STAGES.map(stage => (
                    <div key={stage} onClick={() => updateStage(selectedLead.id, stage)} style={{ fontSize: 12, padding: '6px 13px', border: `1px solid ${selectedLead.stage === stage ? '#b0a8f0' : '#d8d5cf'}`, borderRadius: 8, background: selectedLead.stage === stage ? '#f0eefc' : '#fff', color: selectedLead.stage === stage ? '#3d35a8' : '#555', cursor: 'pointer', fontWeight: 500 }}>{stage}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}