import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'
import { useCurrentUser } from '../hooks/useCurrentUser'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDateTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function truncate(str, n) {
  if (!str) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UnmatchedEmails() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const unmatchedCount = useUnmatchedCount()
  const currentUser = useCurrentUser()

  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)

  // Per-card search state: { [emailId]: { query, results, searching, selected } }
  const [searchState, setSearchState] = useState({})
  // Per-card submitting: { [emailId]: boolean }
  const [submitting, setSubmitting] = useState({})
  // Per-card expanded body: Set of IDs
  const [expandedBody, setExpandedBody] = useState(new Set())

  useEffect(() => { fetchEmails() }, [])

  async function fetchEmails() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const userEmail = session?.user?.email
    const { data, error } = await supabase
      .from('unmatched_emails')
      .select('*')
      .or('assigned.eq.false,assigned.is.null')
      .eq('mailbox', userEmail)
      .order('received_at', { ascending: false })
    console.log('[UnmatchedEmails] data:', data, 'error:', error)
    setEmails(data || [])
    setLoading(false)
  }

  // ── Per-card search helpers ───────────────────────────────────────────────

  function getS(id) {
    return searchState[id] || { query: '', results: [], searching: false, selected: null }
  }

  function setS(id, patch) {
    setSearchState(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { query: '', results: [], searching: false, selected: null }), ...patch },
    }))
  }

  async function runSearch(emailId, query) {
    setS(emailId, { query, results: [], searching: !!query.trim() })
    if (!query.trim()) return

    const q = query.trim()
    const leadSelect = 'id, lead_number, property_road, property_town, lead_contacts(contacts(first_name, last_name))'

    // 1. Direct lead-field search
    const { data: direct } = await supabase
      .from('leads')
      .select(leadSelect)
      .or(`lead_number.ilike.%${q}%,property_road.ilike.%${q}%,property_town.ilike.%${q}%`)
      .limit(8)

    // 2. Contact-name search — 2 steps to avoid unsupported cross-relation filters
    const { data: contactRows } = await supabase
      .from('contacts')
      .select('id')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .limit(20)

    let viaContact = []
    if (contactRows?.length) {
      const cIds = contactRows.map(c => c.id)
      const { data: lcRows } = await supabase
        .from('lead_contacts')
        .select('lead_id')
        .in('contact_id', cIds)
      if (lcRows?.length) {
        const lIds = [...new Set(lcRows.map(r => r.lead_id))]
        const { data: cl } = await supabase
          .from('leads')
          .select(leadSelect)
          .in('id', lIds)
          .limit(8)
        viaContact = cl || []
      }
    }

    // Merge, deduplicate
    const seen = new Set()
    const merged = [...(direct || []), ...viaContact].filter(l => {
      if (seen.has(l.id)) return false
      seen.add(l.id)
      return true
    })

    setS(emailId, { results: merged.slice(0, 8), searching: false })
  }

  function selectLead(emailId, lead) {
    setS(emailId, { selected: lead, query: '', results: [] })
  }

  function clearLead(emailId) {
    setS(emailId, { selected: null, query: '', results: [] })
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function linkToLead(email) {
    const s = getS(email.id)
    if (!s.selected) return
    setSubmitting(p => ({ ...p, [email.id]: true }))

    await supabase.from('unmatched_emails').update({
      lead_id: s.selected.id,
      assigned: true,
    }).eq('id', email.id)

    await supabase.from('lead_notes').insert([{
      lead_id: s.selected.id,
      subject: email.subject || '(No subject)',
      type: 'Email in',
      notes: email.body || '',
      author: [email.from_name, email.from_email].filter(Boolean).join(' '),
      created_at: email.received_at || new Date().toISOString(),
    }])

    setEmails(prev => prev.filter(e => e.id !== email.id))
    setSubmitting(p => ({ ...p, [email.id]: false }))
  }

  async function dismiss(emailId) {
    setSubmitting(p => ({ ...p, [emailId]: true }))
    await supabase.from('unmatched_emails').update({ assigned: true }).eq('id', emailId)
    setEmails(prev => prev.filter(e => e.id !== emailId))
    setSubmitting(p => ({ ...p, [emailId]: false }))
  }

  function toggleBody(id) {
    setExpandedBody(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
        ].map(([item, path, badge]) => {
          const active = item === 'Unmatched emails'
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

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Unmatched emails</div>
          {!loading && (
            <span style={{ fontSize: 11, padding: '3px 11px', borderRadius: 999, fontWeight: 600, background: emails.length > 0 ? '#fceaea' : '#e1f5ee', color: emails.length > 0 ? '#8b2020' : '#0a5a3c' }}>
              {emails.length} unmatched
            </span>
          )}
          <button
            onClick={fetchEmails}
            disabled={loading}
            style={{ fontSize: 12, padding: '6px 13px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: loading ? 'default' : 'pointer', color: '#555', opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: 60 }}>Loading…</div>
          ) : emails.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: 60, background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#555', marginBottom: 6 }}>All clear</div>
              <div style={{ fontSize: 13 }}>No unmatched emails to review.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 860 }}>
              {emails.map(email => {
                const s = getS(email.id)
                const busy = submitting[email.id]
                const bodyExpanded = expandedBody.has(email.id)
                const bodyText = email.body || ''
                const bodyPreview = truncate(bodyText, 280)
                const hasMoreBody = bodyText.length > 280

                return (
                  <div key={email.id} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, overflow: 'hidden' }}>

                    {/* Email header */}
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0eeea' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0, flex: 1 }}>

                          {/* Subject */}
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#222', marginBottom: 5, lineHeight: 1.3 }}>
                            {email.subject || '(No subject)'}
                          </div>

                          {/* From + meta */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#555' }}>
                            <span>
                              <span style={{ color: '#888' }}>From </span>
                              <span style={{ fontWeight: 500 }}>{email.from_name || email.from_email}</span>
                              {email.from_name && email.from_email && (
                                <span style={{ color: '#888' }}> &lt;{email.from_email}&gt;</span>
                              )}
                            </span>
                            {email.mailbox && (
                              <span>
                                <span style={{ color: '#888' }}>To </span>
                                <span style={{ fontWeight: 500 }}>{email.mailbox}</span>
                              </span>
                            )}
                            <span style={{ color: '#aaa' }}>{fmtDateTime(email.received_at)}</span>
                          </div>
                        </div>

                        {/* Dismiss */}
                        <button
                          onClick={() => dismiss(email.id)}
                          disabled={busy}
                          style={{ fontSize: 11, padding: '5px 11px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: busy ? 'default' : 'pointer', color: '#888', flexShrink: 0, opacity: busy ? 0.5 : 1 }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>

                    {/* Body preview */}
                    {bodyText && (
                      <div style={{ padding: '12px 18px', borderBottom: '1px solid #f0eeea', background: '#faf9f7' }}>
                        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {bodyExpanded ? bodyText : bodyPreview}
                        </div>
                        {hasMoreBody && (
                          <button
                            onClick={() => toggleBody(email.id)}
                            style={{ fontSize: 11, color: '#3d35a8', background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer', fontWeight: 500 }}
                          >
                            {bodyExpanded ? 'Show less' : 'Show full email'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Link to lead */}
                    <div style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#555', marginBottom: 8 }}>Link to lead</div>

                      {s.selected ? (
                        /* Selected lead chip */
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '8px 12px', border: '1px solid #b0cff0', borderRadius: 8, background: '#f0f7ff' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a5fa8' }}>{s.selected.lead_number}</span>
                            {(s.selected.property_road || s.selected.property_town) && (
                              <span style={{ fontSize: 12, color: '#555' }}>
                                {[s.selected.property_road, s.selected.property_town].filter(Boolean).join(', ')}
                              </span>
                            )}
                            {(() => {
                              const lcs = s.selected.lead_contacts || []
                              const c = (lcs.find(lc => lc.is_main_contact) || lcs[0])?.contacts
                              if (!c) return null
                              return <span style={{ fontSize: 12, color: '#888' }}>· {[c.first_name, c.last_name].filter(Boolean).join(' ')}</span>
                            })()}
                            <button
                              onClick={() => clearLead(email.id)}
                              style={{ marginLeft: 'auto', fontSize: 15, color: '#888', cursor: 'pointer', border: 'none', background: 'none', lineHeight: 1, padding: 0, flexShrink: 0 }}
                            >×</button>
                          </div>
                          <button
                            onClick={() => linkToLead(email)}
                            disabled={busy}
                            style={{ fontSize: 12, padding: '8px 16px', border: 'none', borderRadius: 8, background: busy ? '#9993d4' : '#3d35a8', color: '#fff', cursor: busy ? 'default' : 'pointer', fontWeight: 500, flexShrink: 0 }}
                          >
                            {busy ? 'Linking…' : 'Link & file note'}
                          </button>
                        </div>
                      ) : (
                        /* Search input */
                        <div style={{ position: 'relative' }}>
                          <input
                            value={s.query}
                            onChange={e => runSearch(email.id, e.target.value)}
                            onBlur={() => setTimeout(() => setS(email.id, { results: [] }), 160)}
                            placeholder="Search by lead number, address or contact name…"
                            style={{ fontSize: 13, padding: '8px 11px', border: '1px solid #d8d5cf', borderRadius: 8, outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
                          />
                          {(s.searching || s.results.length > 0) && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,.1)', overflow: 'hidden' }}>
                              {s.searching && s.results.length === 0 && (
                                <div style={{ padding: '10px 14px', fontSize: 12, color: '#aaa' }}>Searching…</div>
                              )}
                              {s.results.map(lead => {
                                const lcs = lead.lead_contacts || []
                                const c = (lcs.find(lc => lc.is_main_contact) || lcs[0])?.contacts
                                return (
                                  <div
                                    key={lead.id}
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => selectLead(email.id, lead)}
                                    style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #f5f4f0', fontSize: 13, display: 'flex', gap: 10, alignItems: 'baseline' }}
                                  >
                                    <span style={{ fontWeight: 600, color: '#1a5fa8', flexShrink: 0 }}>{lead.lead_number}</span>
                                    <span style={{ color: '#555', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {[lead.property_road, lead.property_town].filter(Boolean).join(', ')}
                                    </span>
                                    {c && (
                                      <span style={{ color: '#aaa', fontSize: 12, flexShrink: 0, marginLeft: 'auto' }}>
                                        {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                              {!s.searching && s.results.length === 0 && s.query.trim() && (
                                <div style={{ padding: '10px 14px', fontSize: 12, color: '#aaa' }}>No leads found</div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
