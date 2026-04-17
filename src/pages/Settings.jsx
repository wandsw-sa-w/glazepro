import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'
import { useCurrentUser } from '../hooks/useCurrentUser'

const EXAMPLE_VALUES = {
  '[username]': 'John Smith',
  '[role]':     'Sales Manager',
  '[email]':    'john.smith@wandsworthsash.co.uk',
  '[company]':  'Wandsworth Sash Windows',
  '[phone]':    '020 7123 4567',
}

function resolvePreview(text) {
  let result = text
  Object.entries(EXAMPLE_VALUES).forEach(([key, val]) => {
    result = result.replace(new RegExp(key.replace(/[[\]]/g, '\\$&'), 'gi'), val)
  })
  return result
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const unmatchedCount = useUnmatchedCount()
  const currentUser = useCurrentUser()

  const [activeTab, setActiveTab] = useState('email_signature')
  const [signature, setSignature] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Surveyor availability tab
  const [surveyors, setSurveyors] = useState([])
  const [availDraft, setAvailDraft] = useState({})   // { [userId]: { 1: 'full', ..., 7: 'full' } }
  const [availLoading, setAvailLoading] = useState(false)
  const [surveyorSaving, setSurveyorSaving] = useState({})
  const [surveyorSaved, setSurveyorSaved] = useState({})

  useEffect(() => { fetchSignature() }, [])

  useEffect(() => {
    if (activeTab === 'surveyor_availability') fetchSurveyorAvailability()
  }, [activeTab])

  async function fetchSignature() {
    setLoading(true)
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'email_signature')
      .maybeSingle()
    if (data?.value) setSignature(data.value)
    setLoading(false)
  }

  async function fetchSurveyorAvailability() {
    setAvailLoading(true)
    const { data: surveyorData } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('is_surveyor', true)
      .order('full_name')
    setSurveyors(surveyorData || [])

    if ((surveyorData || []).length > 0) {
      const ids = surveyorData.map(s => s.id)
      const { data: rules } = await supabase
        .from('surveyor_availability')
        .select('user_id, day_of_week, availability')
        .in('user_id', ids)

      // Build draft with all 7 days defaulting to 'full', then overlay saved rules
      const draft = {}
      for (const s of surveyorData) {
        draft[s.id] = { 1: 'full', 2: 'full', 3: 'full', 4: 'full', 5: 'full', 6: 'full', 0: 'full' }
      }
      for (const rule of rules || []) {
        if (draft[rule.user_id]) draft[rule.user_id][rule.day_of_week] = rule.availability
      }
      setAvailDraft(draft)
    }
    setAvailLoading(false)
  }

  async function saveSurveyorAvailability(surveyorId) {
    setSurveyorSaving(prev => ({ ...prev, [surveyorId]: true }))
    const days = availDraft[surveyorId] || {}
    const rows = Object.entries(days).map(([day, availability]) => ({
      user_id: surveyorId,
      day_of_week: parseInt(day),
      availability,
    }))
    console.log('Upserting surveyor_availability rows:', rows)
    const { error } = await supabase
      .from('surveyor_availability')
      .upsert(rows, { onConflict: 'user_id,day_of_week' })
    setSurveyorSaving(prev => ({ ...prev, [surveyorId]: false }))
    if (error) {
      console.log('Error saving surveyor availability:', error)
    } else {
      setSurveyorSaved(prev => ({ ...prev, [surveyorId]: true }))
      setTimeout(() => setSurveyorSaved(prev => ({ ...prev, [surveyorId]: false })), 2500)
    }
  }

  async function saveSignature() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase.from('settings').upsert({
      key: 'email_signature',
      value: signature,
      updated_at: new Date().toISOString(),
      updated_by: user.email,
    })
    setSaving(false)
    if (error) {
      console.log('Error saving signature:', error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
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
        {[
          ['Leads',            '/leads',             null],
          ['Quotes & orders',  null,                 null],
          ['Production',       null,                 null],
          ['Scheduling',       '/calendar',          null],
          ['Invoicing',        null,                 null],
          ['Tasks',            '/tasks',             null],
          ['Unmatched emails', '/unmatched-emails',  unmatchedCount || null],
        ].map(([item, path, badge]) => (
          <div
            key={item}
            onClick={path ? () => navigate(path) : undefined}
            style={{
              padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: path ? '#555' : '#aaa',
              fontWeight: 400,
              background: 'transparent',
              cursor: path ? 'pointer' : 'not-allowed',
              opacity: path ? 1 : 0.5,
            }}
          >
            <span>{item}</span>
            {badge > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#fceaea', color: '#8b2020', fontWeight: 600, flexShrink: 0 }}>{badge}</span>}
          </div>
        ))}
        <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Catalogue</div>
        <div
          onClick={() => navigate('/ironmongery')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#555', fontWeight: 400, background: 'transparent', cursor: 'pointer' }}
        >
          <span>Ironmongery</span>
        </div>
        <div
          onClick={() => navigate('/pricing')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#555', fontWeight: 400, background: 'transparent', cursor: 'pointer' }}
        >
          <span>Pricing</span>
        </div>
        {currentUser?.role === 'Admin' && (
          <div onClick={() => navigate('/settings')} style={{ margin: '4px 7px 2px', padding: '8px 11px', fontSize: 13, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#3d35a8', fontWeight: 500, background: '#f0eefc', cursor: 'pointer' }}>
            <span>⚙</span><span>Settings</span>
          </div>
        )}
        <div style={{ marginTop: 'auto', padding: 13, borderTop: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          <button onClick={signOut} style={{ fontSize: 11, padding: '5px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#555' }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Settings</div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 2, padding: '0 20px', background: '#fff', borderBottom: '1px solid #e8e6e0', flexShrink: 0 }}>
          {[['email_signature', 'Email signature'], ['surveyor_availability', 'Surveyor availability']].map(([id, label]) => (
            <div
              key={id}
              onClick={() => setActiveTab(id)}
              style={{ padding: '12px 16px', fontSize: 13, color: activeTab === id ? '#3d35a8' : '#888', cursor: 'pointer', borderBottom: activeTab === id ? '2px solid #3d35a8' : '2px solid transparent', fontWeight: 500 }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {activeTab === 'email_signature' && (
            <div style={{ maxWidth: 780 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Email signature</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.5 }}>
                This signature is automatically appended to every outgoing email sent from GlazePro. Use variables to personalise it per sender.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: 20, alignItems: 'start' }}>

                {/* Textarea */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: '#555' }}>Signature text</label>
                  {loading ? (
                    <div style={{ color: '#aaa', fontSize: 13, padding: '20px 0' }}>Loading…</div>
                  ) : (
                    <textarea
                      value={signature}
                      onChange={e => { setSignature(e.target.value); setSaved(false) }}
                      rows={10}
                      placeholder={'Kind regards,\n[username]\n[role]\n[company]\n[phone] | [email]'}
                      style={{ fontSize: 13, padding: '10px 12px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, width: '100%', boxSizing: 'border-box' }}
                    />
                  )}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      onClick={saveSignature}
                      disabled={saving || loading}
                      style={{ fontSize: 13, padding: '8px 20px', border: 'none', borderRadius: 8, background: saving || loading ? '#9993d4' : '#3d35a8', color: '#fff', cursor: saving || loading ? 'default' : 'pointer', fontWeight: 500 }}
                    >
                      {saving ? 'Saving…' : 'Save signature'}
                    </button>
                    {saved && <span style={{ fontSize: 12, color: '#0a5a3c', fontWeight: 500 }}>✓ Saved</span>}
                  </div>
                </div>

                {/* Variables reference */}
                <div style={{ background: '#f5f4f0', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 12 }}>Available variables</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      ['[username]', "Sender's full name"],
                      ['[role]',     'Their job role'],
                      ['[email]',    'Their email address'],
                      ['[company]',  'Company name'],
                      ['[phone]',    'Their phone number'],
                    ].map(([variable, desc]) => (
                      <div key={variable}>
                        <code style={{ fontSize: 12, fontWeight: 600, color: '#3d35a8', background: '#e8e6f8', padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 2 }}>{variable}</code>
                        <div style={{ fontSize: 11, color: '#888' }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview */}
              {signature.trim() && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>
                    Preview <span style={{ fontWeight: 400, color: '#aaa' }}>(with example values)</span>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '16px 18px', fontSize: 13, color: '#555', lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
                    {resolvePreview(signature)}
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'surveyor_availability' && (
            <div style={{ maxWidth: 900 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Surveyor availability</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 1.5 }}>
                Set each surveyor's working pattern per day. The geo-cluster slot finder will only show slots within these windows.
              </div>

              {availLoading ? (
                <div style={{ color: '#aaa', fontSize: 13, padding: '20px 0' }}>Loading…</div>
              ) : surveyors.length === 0 ? (
                <div style={{ color: '#aaa', fontSize: 13 }}>No surveyors found. Set <code>is_surveyor = true</code> on users to manage their availability here.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {surveyors.map(surveyor => {
                    const draft = availDraft[surveyor.id] || {}
                    const isSaving = surveyorSaving[surveyor.id] || false
                    const isSaved  = surveyorSaved[surveyor.id]  || false
                    return (
                      <div key={surveyor.id} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{surveyor.full_name}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 14 }}>
                          {[
                            [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'],
                            [5, 'Fri'], [6, 'Sat'], [0, 'Sun'],
                          ].map(([day, label]) => (
                            <div key={day} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</label>
                              <select
                                value={draft[day] || 'full'}
                                onChange={e => setAvailDraft(prev => ({
                                  ...prev,
                                  [surveyor.id]: { ...prev[surveyor.id], [day]: e.target.value },
                                }))}
                                style={{ fontSize: 12, padding: '6px 8px', border: '1px solid #d8d5cf', borderRadius: 7, outline: 'none', background: '#fff', width: '100%' }}
                              >
                                <option value="full">Full day</option>
                                <option value="morning">Morning only (08:00–12:00)</option>
                                <option value="afternoon">Afternoon only (12:30–16:30)</option>
                                <option value="unavailable">Unavailable</option>
                              </select>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <button
                            onClick={() => saveSurveyorAvailability(surveyor.id)}
                            disabled={isSaving}
                            style={{ fontSize: 13, padding: '7px 18px', border: 'none', borderRadius: 8, background: isSaving ? '#9993d4' : '#3d35a8', color: '#fff', cursor: isSaving ? 'default' : 'pointer', fontWeight: 500 }}
                          >
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                          {isSaved && <span style={{ fontSize: 12, color: '#0a5a3c', fontWeight: 500 }}>✓ Saved</span>}
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
