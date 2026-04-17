import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'

const STATUS_LABEL = {
  draft:       'Draft',
  published:   'Published',
  superseded:  'Superseded',
}

const STATUS_COLOR = {
  draft:       { background: '#f5f5f0', color: '#666' },
  published:   { background: '#eaf6ee', color: '#2a7a40' },
  superseded:  { background: '#f5f5f0', color: '#aaa' },
}

export default function PricingPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [files,    setFiles]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadFiles()
  }, [])

  async function loadFiles() {
    setLoading(true)
    const { data, error } = await supabase
      .from('price_files')
      .select('id, version_number, status, notes, created_at, published_at')
      .order('created_at', { ascending: false })
    if (!error) setFiles(data || [])
    setLoading(false)
  }

  async function createDraft() {
    setCreating(true)

    const { data, error } = await supabase
      .from('price_files')
      .insert({ status: 'draft' })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to create price file:', error)
      setCreating(false)
      return
    }

    // Copy rules from currently published price file if one exists
    const { data: published } = await supabase
      .from('price_files')
      .select('id')
      .eq('status', 'published')
      .single()

    if (published) {
      const { data: existingRules } = await supabase
        .from('price_rules')
        .select('*')
        .eq('price_file_id', published.id)

      if (existingRules && existingRules.length > 0) {
        const copiedRules = existingRules.map(({ id, price_file_id, created_at, ...rest }) => ({
          ...rest,
          price_file_id: data.id,
        }))
        await supabase.from('price_rules').insert(copiedRules)
      }
    }

    setCreating(false)
    navigate(`/pricing/${data.id}`)
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Pricing</div>
          <button
            onClick={createDraft}
            disabled={creating}
            style={{ fontSize: 13, padding: '6px 14px', borderRadius: 7, border: 'none', background: '#3d35a8', color: '#fff', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.6 : 1, fontWeight: 500 }}
          >
            {creating ? 'Creating…' : 'New Draft'}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {loading ? (
            <div style={{ color: '#aaa', fontSize: 13, marginTop: 40, textAlign: 'center' }}>Loading…</div>
          ) : files.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: 13, marginTop: 60, textAlign: 'center' }}>
              No price files yet.<br />
              <span style={{ marginTop: 8, display: 'inline-block' }}>Click <strong>New Draft</strong> to create one.</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e8e6e0' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Version</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Notes</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: '#555', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr
                    key={f.id}
                    onClick={() => navigate(`/pricing/${f.id}`)}
                    style={{ borderBottom: '1px solid #f0ede8', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#faf9f7'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 10px', color: '#222', fontWeight: 500 }}>Version {f.version_number}</td>
                    <td style={{ padding: '10px 10px', color: f.notes ? '#555' : '#bbb', maxWidth: 320 }}>
                      {f.notes ? (f.notes.length > 60 ? f.notes.slice(0, 60) + '…' : f.notes) : '—'}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500, ...STATUS_COLOR[f.status] }}>
                        {STATUS_LABEL[f.status] ?? f.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', color: '#888' }}>
                      {new Date(f.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
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
}
