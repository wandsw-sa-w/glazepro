import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../supabase'
import RuleEditor from '../../components/pricing/RuleEditor'

const SUB_TABS = [
  { key: 'price',       label: 'Price',       path: '/price' },
  { key: 'install',     label: 'Install',     path: '/install' },
  { key: 'manufacture', label: 'Manufacture', path: '/manufacture' },
  { key: 'parts',       label: 'Parts',       path: '/parts' },
]

export default function RuleEditorPage({ ruleFamily, title, description }) {
  const navigate   = useNavigate()
  const { fileId } = useParams()
  const { user, signOut } = useAuth()

  const [file, setFile] = useState(undefined)

  useEffect(() => {
    supabase
      .from('price_files')
      .select('id, status')
      .eq('id', fileId)
      .single()
      .then(({ data }) => { if (data) setFile(data) })
  }, [fileId])

  const readOnly = file === undefined ? false : file.status !== 'draft'

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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', gap: 8, padding: '0 20px', flexShrink: 0 }}>
          <button onClick={() => navigate('/pricing')} style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Pricing
          </button>
          <span style={{ color: '#ccc' }}>/</span>
          <button onClick={() => navigate(`/pricing/${fileId}`)} style={{ fontSize: 13, color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file?.name ?? '…'}
          </button>
          <span style={{ color: '#ccc' }}>/</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>{title}</span>
          {readOnly && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f5f5f0', color: '#888', fontWeight: 500, marginLeft: 4 }}>
              Read-only
            </span>
          )}
        </div>

        {/* Sub-tabs */}
        <div style={{ background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', padding: '0 20px', gap: 2, flexShrink: 0 }}>
          {SUB_TABS.map(tab => {
            const active = ruleFamily.startsWith(tab.key)
            return (
              <div
                key={tab.key}
                onClick={() => navigate(`/pricing/${fileId}${tab.path}`)}
                style={{
                  padding: '10px 14px', fontSize: 13, cursor: 'pointer',
                  borderBottom: active ? '2px solid #3d35a8' : '2px solid transparent',
                  color: active ? '#3d35a8' : '#666',
                  fontWeight: active ? 500 : 400,
                  marginBottom: -1,
                }}
              >
                {tab.label}
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {description && (
            <p style={{ fontSize: 12, color: '#888', marginTop: 0, marginBottom: 18 }}>{description}</p>
          )}
          <RuleEditor fileId={fileId} ruleFamily={ruleFamily} readOnly={readOnly} />
        </div>
      </div>
    </div>
  )
}
