// Layout.jsx — shared app shell: dark TopBar + Sidebar + optional sub-nav
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'
import { useOpenTaskCount } from '../hooks/useOpenTaskCount'

const ACCENT = '#3d35a8'
const TOPBAR_BG = '#1e1a2e'

// ── Global search overlay ──────────────────────────────────────────────────────

export function SearchOverlay({ onClose }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const [{ data: byNum }, { data: byAddr }] = await Promise.all([
          supabase
            .from('leads')
            .select('id, lead_number, property_road, property_town, property_postcode, stage, lead_contacts(is_main_contact, contacts(first_name, last_name))')
            .ilike('lead_number', `%${q}%`)
            .limit(5),
          supabase
            .from('leads')
            .select('id, lead_number, property_road, property_town, property_postcode, stage, lead_contacts(is_main_contact, contacts(first_name, last_name))')
            .or(`property_road.ilike.%${q}%,property_postcode.ilike.%${q}%`)
            .limit(5),
        ])
        const all = [...(byNum || []), ...(byAddr || [])]
        const deduped = Object.values(Object.fromEntries(all.map(l => [l.id, l])))
        setResults(deduped.slice(0, 8))
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => clearTimeout(timer)
  }, [q])

  function mainName(lead) {
    const lc = lead.lead_contacts?.find(c => c.is_main_contact) || lead.lead_contacts?.[0]
    const c = lc?.contacts
    return c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : null
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 72 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 580, boxShadow: '0 24px 80px rgba(0,0,0,.3)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid #f0eeea' }}>
          <span style={{ fontSize: 16, color: '#aaa', flexShrink: 0 }}>⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search leads by number, name or postcode…"
            style={{ flex: 1, fontSize: 15, border: 'none', outline: 'none', fontFamily: 'inherit', color: '#1a1a1a' }}
            onKeyDown={e => e.key === 'Escape' && onClose()}
          />
          {searching && <span style={{ fontSize: 11, color: '#bbb' }}>searching…</span>}
        </div>
        {results.length > 0 && (
          <div>
            {results.map(lead => (
              <div
                key={lead.id}
                onClick={() => { navigate(`/leads/${lead.id}`); onClose() }}
                style={{ padding: '10px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f5f4f0' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8f7ff' }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}
              >
                <span style={{ fontWeight: 700, color: ACCENT, minWidth: 68, fontSize: 13 }}>{lead.lead_number}</span>
                <span style={{ fontSize: 13, color: '#1a1a1a', flex: 1 }}>{mainName(lead) || '—'}</span>
                <span style={{ fontSize: 11, color: '#888' }}>{[lead.property_road, lead.property_postcode].filter(Boolean).join(', ')}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#f5f4f0', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {lead.stage}
                </span>
              </div>
            ))}
          </div>
        )}
        {q && !searching && results.length === 0 && (
          <div style={{ padding: '28px 18px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
            No leads found for "{q}"
          </div>
        )}
        {!q && (
          <div style={{ padding: '16px 18px', color: '#bbb', fontSize: 12 }}>
            Type a lead number, customer name, or postcode
          </div>
        )}
      </div>
    </div>
  )
}

// ── TopBar icon button ─────────────────────────────────────────────────────────

function TBBtn({ icon, label, badge, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 1, padding: '5px 12px',
        background: hov ? 'rgba(255,255,255,0.1)' : 'none',
        border: 'none', cursor: 'pointer',
        color: hov ? '#fff' : 'rgba(255,255,255,0.72)',
        borderRadius: 7, position: 'relative', minWidth: 50, transition: 'all .1s',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '.02em' }}>{label}</span>
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: 3, right: 6,
          background: '#e24b4a', color: '#fff',
          fontSize: 8, fontWeight: 700,
          padding: '1px 4px', borderRadius: 999, lineHeight: '13px', minWidth: 14, textAlign: 'center',
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

// ── TopBar ─────────────────────────────────────────────────────────────────────

function TopBar({ onSearch }) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const unmatchedCount = useUnmatchedCount()
  const openTaskCount = useOpenTaskCount()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{
      height: 48, background: TOPBAR_BG,
      display: 'flex', alignItems: 'center',
      padding: '0 16px', flexShrink: 0, zIndex: 50,
    }}>
      {/* Logo */}
      <div
        onClick={() => navigate('/')}
        style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginRight: 20 }}
      >
        <div style={{
          width: 26, height: 26, background: ACCENT, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: '#fff',
        }}>G</div>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#fff', letterSpacing: '-0.2px' }}>GlazePro</span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Action icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TBBtn icon="⌕" label="Search" onClick={onSearch} />
        <TBBtn icon="✓" label="Tasks" badge={openTaskCount || null} onClick={() => navigate('/tasks')} />
        <TBBtn icon="⊞" label="Calendar" onClick={() => navigate('/calendar')} />
        <TBBtn icon="✉" label="E-mail" badge={unmatchedCount || null} onClick={() => navigate('/unmatched-emails')} />

        <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,.15)', margin: '0 6px' }} />

        {/* User menu */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowUserMenu(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 6,
              color: 'rgba(255,255,255,.85)', fontFamily: 'inherit',
            }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: '50%', background: ACCENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {(user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <span style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,.45)' }}>▾</span>
          </button>
          {showUserMenu && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,.14)', minWidth: 200, overflow: 'hidden', zIndex: 200,
            }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0eeea' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>
                  {user?.email?.split('@')[0]}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>{user?.email}</div>
              </div>
              <button
                onClick={signOut}
                style={{
                  display: 'block', width: '100%', padding: '10px 14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontSize: 13, color: '#555', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f8f7f5' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const unmatchedCount = useUnmatchedCount()

  function isActive(path) {
    if (!path) return false
    if (path === '/leads') return pathname === '/leads' || pathname.startsWith('/leads/')
    return pathname.startsWith(path)
  }

  const groups = [
    {
      label: 'CRM',
      items: [
        { label: 'Leads', path: '/leads' },
        { label: 'Quotes & orders', path: null },
        { label: 'Tasks', path: '/tasks' },
        { label: 'Unmatched emails', path: '/unmatched-emails', badge: unmatchedCount || null },
        { label: 'Calendar', path: '/calendar' },
      ],
    },
    {
      label: 'Build',
      items: [
        { label: 'Pricing', path: '/pricing' },
        { label: 'Ironmongery', path: '/ironmongery' },
        { label: 'Reference Data', path: '/reference-data' },
        { label: 'Defaults & Parts', path: '/defaults' },
        { label: 'Templates', path: '/templates' },
      ],
    },
    {
      label: 'Admin',
      items: [
        { label: 'Settings', path: '/settings' },
      ],
    },
  ]

  return (
    <div style={{
      width: 200, background: '#fff', borderRight: '1px solid #e8e6e0',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
    }}>
      {groups.map(g => (
        <div key={g.label}>
          <div style={{
            padding: '12px 14px 4px', fontSize: 10, color: '#aaa',
            letterSpacing: '.07em', textTransform: 'uppercase', fontWeight: 600,
          }}>
            {g.label}
          </div>
          {g.items.map(item => {
            const active = isActive(item.path)
            return (
              <div
                key={item.label}
                onClick={item.path ? () => navigate(item.path) : undefined}
                style={{
                  padding: '7px 10px', fontSize: 13, borderRadius: 7, margin: '1px 6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  color: active ? ACCENT : item.path ? '#555' : '#c0bcb8',
                  fontWeight: active ? 600 : 400,
                  background: active ? '#f0eefc' : 'transparent',
                  cursor: item.path ? 'pointer' : 'default',
                }}
                onMouseEnter={e => { if (!active && item.path) e.currentTarget.style.background = '#f8f7f5' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#fceaea', color: '#8b2020', fontWeight: 600 }}>
                    {item.badge}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ── Leads section sub-nav bar ──────────────────────────────────────────────────

export function LeadsSubNav({ onAddNew, onSearch, activeView }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const items = [
    {
      label: 'Lead list',
      active: pathname === '/leads' && activeView !== 'board',
      action: () => navigate('/leads?view=list'),
    },
    {
      label: 'Board',
      active: pathname === '/leads' && activeView === 'board',
      action: () => navigate('/leads?view=board'),
    },
    { label: 'Add new lead', action: onAddNew || (() => navigate('/leads')) },
    { label: 'Search', action: onSearch || (() => {}) },
    { label: 'Settings', action: () => navigate('/settings') },
  ]

  return (
    <div style={{
      height: 38, background: '#fff', borderBottom: '1px solid #e8e6e0',
      display: 'flex', alignItems: 'center', padding: '0 24px', gap: 2,
      flexShrink: 0,
    }}>
      {items.map(item => (
        <button
          key={item.label}
          onClick={item.action}
          style={{
            padding: '4px 11px', fontSize: 12, fontWeight: item.active ? 600 : 400,
            background: item.active ? '#f0eefc' : 'none', border: 'none',
            cursor: 'pointer', borderRadius: 6,
            color: item.active ? ACCENT : '#555',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (!item.active) e.currentTarget.style.background = '#f5f4f0' }}
          onMouseLeave={e => { if (!item.active) e.currentTarget.style.background = 'none' }}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ── Main Layout wrapper ────────────────────────────────────────────────────────

export function Layout({ children, subMenu, hideSidebar }) {
  const [showSearch, setShowSearch] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', fontFamily: 'inherit' }}>
      {showSearch && <SearchOverlay onClose={() => setShowSearch(false)} />}
      <TopBar onSearch={() => setShowSearch(true)} />
      {subMenu}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {!hideSidebar && <Sidebar />}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
