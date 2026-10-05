import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'
import { useCurrentUser } from '../hooks/useCurrentUser'
import {
  loadQuoteSettings,
  saveQuoteSetting,
  mergeQuoteContent,
  validateMergeFields,
  flattenBackCoverLetter,
  parseBackCoverLetter,
  QUOTE_SETTINGS_KEYS,
} from '../quotes/loadQuoteSettings.js'
import {
  FRONT_COVER_LETTER,
  BACK_COVER_LETTER,
  LEAD_TIMES,
  BANK_DETAILS,
  FOOTER,
  SPEC_SECTION_ORDER,
  HS_OPTIN_VALUES,
  ITEM_HEADING_WORDING,
} from '../quotes/pdf/quoteContent.js'

const EXAMPLE_VALUES = {
  '[username]': 'John Smith',
  '[role]':     'Sales Manager',
  '[email]':    'john.smith@wandsworthsash.co.uk',
  '[company]':  'Wandsworth Sash Windows',
  '[phone]':    '020 7123 4567',
}

// Merge-field variable info for the Quotes Content Editor
const QUOTE_MERGE_FIELDS = [
  ['[customer_forename]', "Customer's first name"],
  ['[installation_full_address_one_line]', 'Installation address'],
  ['[nj_lead_time]', 'New Joinery lead time'],
  ['[ds_lead_time]', 'Draught Seal lead time'],
  ['[bg_lead_time]', 'Bi-Glass lead time'],
  ['[sales_person_full_name]', 'Salesperson name'],
]

// Sub-tab definitions for the Quotes section
const QUOTE_SUB_TABS = [
  ['content_editor', 'Content Editor'],
  ['header_footer', 'Header & Footer'],
  ['output_config', 'Output Config'],
  ['notes', 'Notes'],
  ['lead_times', 'Lead Times'],
  ['bank_details', 'Bank Details'],
]

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

  // Quotes settings tab
  const [quoteSubTab, setQuoteSubTab] = useState('content_editor')
  const [quoteSettings, setQuoteSettings] = useState({})        // raw DB settings map
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteSaving, setQuoteSaving] = useState(false)
  const [quoteSaved, setQuoteSaved] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [settingsHistory, setSettingsHistory] = useState([])

  // Drafts for each quote sub-tab (edited but not yet saved)
  const [lettersDraft, setLettersDraft] = useState({
    front_cover_letter: FRONT_COVER_LETTER,
    back_cover_letter_text: flattenBackCoverLetter(BACK_COVER_LETTER),
  })
  const [footerDraft, setFooterDraft] = useState({ ...FOOTER })
  const [outputConfigDraft, setOutputConfigDraft] = useState({
    salesperson_label: 'Sales manager',
    default_layout: '1 item with int & ext view, ironmongery & cover',
  })
  const [hsOptinDraft, setHsOptinDraft] = useState(HS_OPTIN_VALUES.map(v => ({ ...v, checked: true })))
  const [leadTimesDraft, setLeadTimesDraft] = useState({ ...LEAD_TIMES })
  const [bankDetailsDraft, setBankDetailsDraft] = useState({ ...BANK_DETAILS })

  useEffect(() => { fetchSignature() }, [])

  useEffect(() => {
    if (activeTab === 'surveyor_availability') fetchSurveyorAvailability()
    if (activeTab === 'quotes') fetchQuoteSettings()
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

  async function fetchQuoteSettings() {
    setQuoteLoading(true)
    const dbSettings = await loadQuoteSettings(supabase)
    setQuoteSettings(dbSettings)

    // Populate drafts from DB values (fall back to defaults)
    const letters = dbSettings.quote_letters || {}
    setLettersDraft({
      front_cover_letter: letters.front_cover_letter ?? FRONT_COVER_LETTER,
      back_cover_letter_text: flattenBackCoverLetter(letters.back_cover_letter ?? BACK_COVER_LETTER),
    })

    const ft = dbSettings.quote_footer || {}
    setFooterDraft({
      company: ft.company ?? FOOTER.company,
      address: ft.address ?? FOOTER.address,
      contact: ft.contact ?? FOOTER.contact,
      continue_text: ft.continue_text ?? FOOTER.continue_text,
      left: ft.left ?? FOOTER.left,
      right: ft.right ?? FOOTER.right,
      background: ft.background ?? FOOTER.background,
    })

    const oc = dbSettings.quote_output_config || {}
    setOutputConfigDraft({
      salesperson_label: oc.salesperson_label ?? 'Sales manager',
      default_layout: oc.default_layout ?? '1 item with int & ext view, ironmongery & cover',
    })

    const lt = dbSettings.quote_lead_times || {}
    setLeadTimesDraft({
      ds_lead_time: lt.ds_lead_time ?? LEAD_TIMES.ds_lead_time,
      bg_lead_time: lt.bg_lead_time ?? LEAD_TIMES.bg_lead_time,
      nj_lead_time: lt.nj_lead_time ?? LEAD_TIMES.nj_lead_time,
    })

    const bd = dbSettings.quote_bank_details || {}
    setBankDetailsDraft({
      name: bd.name ?? BANK_DETAILS.name,
      sort_code: bd.sort_code ?? BANK_DETAILS.sort_code,
      account_no: bd.account_no ?? BANK_DETAILS.account_no,
    })

    // H&S opt-in: load reference options for Landing Access and External Access
    const { data: refOpts } = await supabase
      .from('reference_options')
      .select('category, code, label')
      .in('category', ['landing_access', 'external_access'])
      .eq('is_active', true)
    const savedOptin = dbSettings.quote_hs_optin || HS_OPTIN_VALUES
    const categoryMap = { landing_access: 'Landing Access', external_access: 'External Access' }
    const optinChecks = (refOpts || []).map(opt => {
      const group = categoryMap[opt.category] || opt.category
      const isChecked = savedOptin.some(s => s.group === group && s.value === opt.label)
      return { group, value: opt.label, code: opt.code, checked: isChecked }
    })
    setHsOptinDraft(optinChecks.length > 0 ? optinChecks : HS_OPTIN_VALUES.map(v => ({ ...v, checked: true })))

    // Load settings history
    const { data: historyRows } = await supabase
      .from('settings_history')
      .select('id, setting_key, description, changed_by, created_at')
      .like('setting_key', 'quote_%')
      .order('created_at', { ascending: false })
      .limit(50)
    setSettingsHistory(historyRows || [])

    setQuoteLoading(false)
  }

  async function saveQuoteTab(tabKey) {
    setQuoteSaving(true)
    setQuoteSaved(false)
    setQuoteError('')

    let key, value, description
    switch (tabKey) {
      case 'content_editor': {
        // Validate merge fields before saving
        const frontCheck = validateMergeFields(lettersDraft.front_cover_letter)
        if (!frontCheck.valid) {
          setQuoteError(`Unknown merge field(s) in front letter: ${frontCheck.unknownFields.map(f => `[${f}]`).join(', ')}`)
          setQuoteSaving(false)
          return
        }
        const backCheck = validateMergeFields(lettersDraft.back_cover_letter_text)
        if (!backCheck.valid) {
          setQuoteError(`Unknown merge field(s) in back letter: ${backCheck.unknownFields.map(f => `[${f}]`).join(', ')}`)
          setQuoteSaving(false)
          return
        }
        key = 'quote_letters'
        value = {
          front_cover_letter: lettersDraft.front_cover_letter,
          back_cover_letter: parseBackCoverLetter(lettersDraft.back_cover_letter_text),
        }
        description = 'Updated cover letters'
        break
      }
      case 'header_footer':
        key = 'quote_footer'
        value = { ...footerDraft }
        description = 'Updated header & footer'
        break
      case 'output_config':
        key = 'quote_output_config'
        value = { ...outputConfigDraft }
        description = 'Updated output configuration'
        break
      case 'notes': {
        key = 'quote_hs_optin'
        value = hsOptinDraft.filter(v => v.checked).map(v => ({ group: v.group, value: v.value }))
        description = 'Updated H&S / Access opt-in values'
        break
      }
      case 'lead_times':
        key = 'quote_lead_times'
        value = { ...leadTimesDraft }
        description = 'Updated lead times'
        break
      case 'bank_details':
        key = 'quote_bank_details'
        value = { ...bankDetailsDraft }
        description = 'Updated bank details'
        break
      default:
        setQuoteSaving(false)
        return
    }

    const { error } = await saveQuoteSetting(supabase, key, value, user.email, description)
    setQuoteSaving(false)
    if (error) {
      setQuoteError(`Failed to save: ${error.message}`)
    } else {
      setQuoteSaved(true)
      setTimeout(() => setQuoteSaved(false), 2500)
      // Refresh history
      const { data: historyRows } = await supabase
        .from('settings_history')
        .select('id, setting_key, description, changed_by, created_at')
        .like('setting_key', 'quote_%')
        .order('created_at', { ascending: false })
        .limit(50)
      setSettingsHistory(historyRows || [])
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
        <div
          onClick={() => navigate('/reference-data')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#555', fontWeight: 400, background: 'transparent', cursor: 'pointer' }}
        >
          <span>Reference Data</span>
        </div>
        <div
          onClick={() => navigate('/defaults')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#555', fontWeight: 400, background: 'transparent', cursor: 'pointer' }}
        >
          <span>Defaults &amp; Parts</span>
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
          {[['email_signature', 'Email signature'], ['surveyor_availability', 'Surveyor availability'], ['quotes', 'Quotes']].map(([id, label]) => (
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
          {activeTab === 'quotes' && (
            <div style={{ maxWidth: 900 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Quote Settings</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 16, lineHeight: 1.5 }}>
                Configure the content, layout and output of quote PDFs. Changes apply to previews and newly published quotes only.
              </div>

              {/* Sub-tab bar */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid #e8e6e0' }}>
                {QUOTE_SUB_TABS.map(([id, label]) => (
                  <div
                    key={id}
                    onClick={() => { setQuoteSubTab(id); setQuoteError(''); setQuoteSaved(false) }}
                    style={{ padding: '10px 14px', fontSize: 12, color: quoteSubTab === id ? '#3d35a8' : '#888', cursor: 'pointer', borderBottom: quoteSubTab === id ? '2px solid #3d35a8' : '2px solid transparent', fontWeight: 500 }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {quoteLoading ? (
                <div style={{ color: '#aaa', fontSize: 13, padding: '20px 0' }}>Loading...</div>
              ) : (
                <>
                  {/* ── Content Editor ── */}
                  {quoteSubTab === 'content_editor' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 230px', gap: 20, alignItems: 'start', marginBottom: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label style={{ fontSize: 12, fontWeight: 500, color: '#555' }}>Front Cover Letter</label>
                          <textarea
                            value={lettersDraft.front_cover_letter}
                            onChange={e => { setLettersDraft(d => ({ ...d, front_cover_letter: e.target.value })); setQuoteSaved(false) }}
                            rows={14}
                            style={{ fontSize: 12, padding: '10px 12px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, width: '100%', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div style={{ background: '#f5f4f0', borderRadius: 10, padding: '14px 16px' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 12 }}>Available merge fields</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {QUOTE_MERGE_FIELDS.map(([variable, desc]) => (
                              <div key={variable}>
                                <code style={{ fontSize: 11, fontWeight: 600, color: '#3d35a8', background: '#e8e6f8', padding: '1px 6px', borderRadius: 4, display: 'inline-block', marginBottom: 2 }}>{variable}</code>
                                <div style={{ fontSize: 10, color: '#888' }}>{desc}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: '#555' }}>Back Cover Letter</label>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                          Format: a line on its own followed by a blank line becomes a bold heading. Everything else is body text.
                        </div>
                        <textarea
                          value={lettersDraft.back_cover_letter_text}
                          onChange={e => { setLettersDraft(d => ({ ...d, back_cover_letter_text: e.target.value })); setQuoteSaved(false) }}
                          rows={16}
                          style={{ fontSize: 12, padding: '10px 12px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, width: '100%', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── Header & Footer ── */}
                  {quoteSubTab === 'header_footer' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {[
                        ['company', 'Company name'],
                        ['address', 'Address'],
                        ['contact', 'Contact line'],
                        ['continue_text', 'Continue text'],
                        ['left', 'Footer left (page info)'],
                        ['right', 'Footer right'],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 4 }}>{label}</label>
                          <input
                            value={footerDraft[key] || ''}
                            onChange={e => { setFooterDraft(d => ({ ...d, [key]: e.target.value })); setQuoteSaved(false) }}
                            style={{ fontSize: 12, padding: '8px 12px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                          />
                        </div>
                      ))}
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 4 }}>Footer background colour</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <input
                            type="color"
                            value={footerDraft.background || '#faebce'}
                            onChange={e => { setFooterDraft(d => ({ ...d, background: e.target.value })); setQuoteSaved(false) }}
                            style={{ width: 40, height: 30, border: '1px solid #d8d5cf', borderRadius: 4, cursor: 'pointer', padding: 0 }}
                          />
                          <span style={{ fontSize: 12, color: '#888' }}>{footerDraft.background || '#faebce'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Output Config ── */}
                  {quoteSubTab === 'output_config' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 4 }}>Salesperson label</label>
                        <input
                          value={outputConfigDraft.salesperson_label || ''}
                          onChange={e => { setOutputConfigDraft(d => ({ ...d, salesperson_label: e.target.value })); setQuoteSaved(false) }}
                          style={{ fontSize: 12, padding: '8px 12px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', width: 300, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 4 }}>Default item layout</label>
                        <select
                          value={outputConfigDraft.default_layout || ''}
                          onChange={e => { setOutputConfigDraft(d => ({ ...d, default_layout: e.target.value })); setQuoteSaved(false) }}
                          style={{ fontSize: 12, padding: '8px 12px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', width: 400, boxSizing: 'border-box' }}
                        >
                          <option value="1 item with int & ext view, ironmongery & cover">1 item with int & ext view, ironmongery & cover</option>
                          <option value="1 item with ironmongery images & cover photo">1 item with ironmongery images & cover photo</option>
                          <option value="2 items per page with ironmongery images">2 items per page with ironmongery images</option>
                          <option value="2 items per page (no ironmongery images)">2 items per page (no ironmongery images)</option>
                          <option value="3 items per page (no ironmongery images)">3 items per page (no ironmongery images)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ── Notes (H&S opt-in) ── */}
                  {quoteSubTab === 'notes' && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Health & Safety / Access values</div>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 1.5 }}>
                        Ticked values will appear on quote PDFs when the item has a matching access note.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {hsOptinDraft.map((opt, idx) => (
                          <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={opt.checked}
                              onChange={e => {
                                setHsOptinDraft(prev => prev.map((v, i) => i === idx ? { ...v, checked: e.target.checked } : v))
                                setQuoteSaved(false)
                              }}
                            />
                            <span style={{ color: '#888', fontWeight: 500, minWidth: 130 }}>{opt.group}</span>
                            <span>{opt.value}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Lead Times ── */}
                  {quoteSubTab === 'lead_times' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {[
                        ['ds_lead_time', 'Draught Seal lead time (weeks)'],
                        ['bg_lead_time', 'Bi-Glass lead time (weeks)'],
                        ['nj_lead_time', 'New Joinery lead time (weeks)'],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 4 }}>{label}</label>
                          <input
                            value={leadTimesDraft[key] || ''}
                            onChange={e => { setLeadTimesDraft(d => ({ ...d, [key]: e.target.value })); setQuoteSaved(false) }}
                            style={{ fontSize: 12, padding: '8px 12px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', width: 200, boxSizing: 'border-box' }}
                            placeholder="e.g. 10-12"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Bank Details ── */}
                  {quoteSubTab === 'bank_details' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {[
                        ['name', 'Account name'],
                        ['sort_code', 'Sort code'],
                        ['account_no', 'Account number'],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 4 }}>{label}</label>
                          <input
                            value={bankDetailsDraft[key] || ''}
                            onChange={e => { setBankDetailsDraft(d => ({ ...d, [key]: e.target.value })); setQuoteSaved(false) }}
                            style={{ fontSize: 12, padding: '8px 12px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', width: 300, boxSizing: 'border-box' }}
                          />
                        </div>
                      ))}
                      <div style={{ fontSize: 12, color: '#888', marginTop: 8, lineHeight: 1.5 }}>
                        These details appear on the financial summary page of the quote PDF.<br />
                        Fixed lines: "VAT will be charged at the prevailing rate" and "This quote is valid for N days from [date]".
                      </div>
                    </div>
                  )}

                  {/* Save button + error/success */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 20, marginBottom: 20 }}>
                    <button
                      onClick={() => saveQuoteTab(quoteSubTab)}
                      disabled={quoteSaving}
                      style={{ fontSize: 13, padding: '8px 20px', border: 'none', borderRadius: 8, background: quoteSaving ? '#9993d4' : '#3d35a8', color: '#fff', cursor: quoteSaving ? 'default' : 'pointer', fontWeight: 500 }}
                    >
                      {quoteSaving ? 'Saving...' : 'Save'}
                    </button>
                    {quoteSaved && <span style={{ fontSize: 12, color: '#0a5a3c', fontWeight: 500 }}>Saved</span>}
                    {quoteError && <span style={{ fontSize: 12, color: '#c00', fontWeight: 500 }}>{quoteError}</span>}
                  </div>

                  {/* Settings history */}
                  {settingsHistory.length > 0 && (
                    <div style={{ marginTop: 16, borderTop: '1px solid #e8e6e0', paddingTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Change history</div>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#faf9f7' }}>
                            <th style={{ textAlign: 'left', padding: '6px 10px', color: '#888', borderBottom: '1px solid #eeece8' }}>Date</th>
                            <th style={{ textAlign: 'left', padding: '6px 10px', color: '#888', borderBottom: '1px solid #eeece8' }}>User</th>
                            <th style={{ textAlign: 'left', padding: '6px 10px', color: '#888', borderBottom: '1px solid #eeece8' }}>Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {settingsHistory.map(row => (
                            <tr key={row.id}>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f5f4f0' }}>{new Date(row.created_at).toLocaleString('en-GB')}</td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f5f4f0' }}>{row.changed_by || '--'}</td>
                              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f5f4f0' }}>{row.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
