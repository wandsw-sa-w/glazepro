import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

const SECTIONS = [
  { key: 'price',       label: 'Price Rules',        sub: '/price',       desc: 'Item-level and quote-level pricing formulas',      family: 'price' },
  { key: 'install',     label: 'Install Labour',     sub: '/install',     desc: 'Installation time rules (minutes per condition)',  family: 'install_labour' },
  { key: 'manufacture', label: 'Manufacture Labour', sub: '/manufacture', desc: 'Manufacturing time rules (minutes per condition)', family: 'manufacture_labour' },
  { key: 'parts',       label: 'Parts',              sub: '/parts',       desc: 'Parts and materials consumed per drawing',         family: 'parts' },
]

export default function PriceFileDetail() {
  const navigate   = useNavigate()
  const { fileId } = useParams()
  const { user, signOut } = useAuth()

  const [file,       setFile]       = useState(null)
  const [ruleCounts, setRuleCounts] = useState({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    loadFile()
  }, [fileId])

  async function loadFile() {
    setLoading(true)

    const [{ data, error }, { data: counts }] = await Promise.all([
      supabase
        .from('price_files')
        .select('id, version_number, status, notes, created_at, published_at')
        .eq('id', fileId)
        .single(),
      supabase
        .from('price_rules')
        .select('rule_family')
        .eq('price_file_id', fileId)
        .eq('is_active', true),
    ])

    if (!error) setFile(data)

    if (counts) {
      const tally = {}
      for (const row of counts) {
        tally[row.rule_family] = (tally[row.rule_family] ?? 0) + 1
      }
      setRuleCounts(tally)
    }

    setLoading(false)
  }

  async function publishFile() {
    if (!window.confirm('Publishing this price file will supersede the current published version and immediately affect all new pricing runs. Continue?')) return

    setSaving(true)

    // Step 1: supersede any currently published file
    await supabase
      .from('price_files')
      .update({ status: 'superseded' })
      .eq('status', 'published')
      .neq('id', fileId)

    // Step 2: publish this file
    const { error } = await supabase
      .from('price_files')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_by: user.id,
      })
      .eq('id', fileId)

    setSaving(false)
    if (error) { console.error('Failed to publish:', error); return }
    setFile(f => ({ ...f, status: 'published', published_at: new Date().toISOString() }))
  }

  async function updateNotes(newNotes) {
    const { error } = await supabase
      .from('price_files')
      .update({ notes: newNotes.trim() || null })
      .eq('id', fileId)
    if (!error) setFile(f => ({ ...f, notes: newNotes.trim() || null }))
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#aaa', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  if (!file) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontSize: 13 }}>
        Price file not found.
      </div>
    )
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
          ['Leads',            '/leads',            null],
          ['Quotes & orders',  null,                null],
          ['Production',       null,                null],
          ['Scheduling',       '/calendar',         null],
          ['Invoicing',        null,                null],
          ['Tasks',            '/tasks',            null],
          ['Unmatched emails', '/unmatched-emails', null],
        ].map(([item, path, badge]) => (
          <div
            key={item}
            onClick={path ? () => navigate(path) : undefined}
            style={{
              padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: path ? '#555' : '#aaa',
              fontWeight: 400, background: 'transparent',
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
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#3d35a8', fontWeight: 500, background: '#f0eefc', cursor: 'pointer' }}
        >
          <span>Pricing</span>
        </div>
        <div onClick={() => navigate('/settings')} style={{ margin: '4px 7px 2px', padding: '8px 11px', fontSize: 13, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#555', cursor: 'pointer' }}>
          <span>⚙</span><span>Settings</span>
        </div>
        <div style={{ marginTop: 'auto', padding: 13, borderTop: '1px solid #e8e6e0' }}>
          <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
          <button onClick={signOut} style={{ fontSize: 11, padding: '5px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#555' }}>Sign out</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', flexShrink: 0 }}>
          <button
            onClick={() => navigate('/pricing')}
            style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Pricing
          </button>
          <span style={{ color: '#ccc' }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>Version {file.version_number}</span>
          <StatusBadge status={file.status} />
          {(file.status === 'published' || file.status === 'superseded') && file.published_at && (
            <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>
              Published: {new Date(file.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>

          {/* Notes field */}
          <div style={{ marginBottom: 24, maxWidth: 520 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Notes</div>
            <EditableNotes value={file.notes} onCommit={updateNotes} disabled={file.status !== 'draft'} />
          </div>

          {/* Publish button */}
          {file.status === 'draft' && (
            <div style={{ marginBottom: 28 }}>
              <button
                onClick={publishFile}
                disabled={saving}
                style={{ fontSize: 13, padding: '7px 16px', borderRadius: 7, border: 'none', background: '#2a7a40', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontWeight: 500 }}
              >
                {saving ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          )}

          {/* Section cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {SECTIONS.map(s => {
              const count = ruleCounts[s.family] ?? 0
              return (
                <div
                  key={s.key}
                  onClick={() => navigate(`/pricing/${fileId}${s.sub}`)}
                  style={{
                    border: '1px solid #e8e6e0', borderRadius: 10, padding: '18px 20px',
                    cursor: 'pointer', background: '#fff',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#222', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>{s.desc}</div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 10 }}>{count} active rule{count !== 1 ? 's' : ''}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    draft:      { background: '#f5f5f0', color: '#666' },
    published:  { background: '#eaf6ee', color: '#2a7a40' },
    superseded: { background: '#f5f5f0', color: '#aaa' },
  }
  const labels = { draft: 'Draft', published: 'Published', superseded: 'Superseded' }
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500, ...(styles[status] ?? {}) }}>
      {labels[status] ?? status}
    </span>
  )
}

function EditableNotes({ value, onCommit, disabled }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value ?? '')

  useEffect(() => { setDraft(value ?? '') }, [value])

  if (disabled || !editing) {
    return (
      <div
        onClick={disabled ? undefined : () => setEditing(true)}
        style={{
          fontSize: 13, color: value ? '#333' : '#bbb', lineHeight: 1.5,
          padding: '7px 10px', borderRadius: 6, border: '1px solid #e8e6e0',
          background: disabled ? '#faf9f7' : '#fff',
          cursor: disabled ? 'default' : 'text',
          minHeight: 38,
        }}
      >
        {value || 'Add notes…'}
      </div>
    )
  }

  return (
    <textarea
      autoFocus
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); onCommit(draft) }}
      onKeyDown={e => {
        if (e.key === 'Escape') { setEditing(false); setDraft(value ?? '') }
      }}
      style={{
        width: '100%', fontSize: 13, lineHeight: 1.5, padding: '7px 10px',
        borderRadius: 6, border: '1px solid #c5c0f0', outline: 'none',
        resize: 'vertical', minHeight: 70, boxSizing: 'border-box', fontFamily: 'inherit',
      }}
    />
  )
}
