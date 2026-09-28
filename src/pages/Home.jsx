// Home.jsx — GlazePro launchpad page
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'

const ACCENT = '#3d35a8'
const DARK_CARD = '#1e1a2e'

// Link item: { label, path, disabled }
function ModuleLink({ label, path, disabled }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={!disabled && path ? () => navigate(path) : undefined}
      style={{
        fontSize: 13, padding: '4px 0', cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#bbb' : '#374151',
        display: 'flex', alignItems: 'center', gap: 6,
      }}
      onMouseEnter={e => { if (!disabled && path) e.currentTarget.style.color = ACCENT }}
      onMouseLeave={e => { e.currentTarget.style.color = disabled ? '#bbb' : '#374151' }}
    >
      {disabled
        ? <span style={{ fontSize: 10, width: 14, textAlign: 'center', color: '#d0ccc8' }}>—</span>
        : <span style={{ fontSize: 10, width: 14, textAlign: 'center', color: '#a8a4f4' }}>›</span>}
      {label}
    </div>
  )
}

// Group of links within a module card
function LinkGroup({ icon, label, links }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b6575', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      {links.map(link => <ModuleLink key={link.label} {...link} />)}
    </div>
  )
}

// Module card (e.g. "GlazePro CRM")
function ModuleCard({ module, groups }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e8e6e0', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
      {/* Dark header */}
      <div style={{ background: DARK_CARD, padding: '13px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.45)', letterSpacing: '.09em', textTransform: 'uppercase', marginBottom: 2 }}>
          GlazePro
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px' }}>
          {module}
        </div>
      </div>
      {/* Link groups */}
      <div style={{ padding: '18px 20px' }}>
        {groups.map(g => <LinkGroup key={g.label} {...g} />)}
      </div>
    </div>
  )
}

const MODULES = [
  {
    module: 'CRM',
    groups: [
      {
        icon: '👥', label: 'Leads',
        links: [
          { label: 'Lead list', path: '/leads' },
          { label: 'Add new lead', path: '/leads?new=1' },
          { label: 'Search', path: '/leads?search=1' },
        ],
      },
      {
        icon: '📋', label: 'Quotes',
        links: [
          { label: 'Quote list', path: null, disabled: true },
        ],
      },
      {
        icon: '🏢', label: 'Office',
        links: [
          { label: 'Tasks', path: '/tasks' },
          { label: 'Unmatched emails', path: '/unmatched-emails' },
          { label: 'Calendar', path: '/calendar' },
        ],
      },
    ],
  },
  {
    module: 'BUILD',
    groups: [
      {
        icon: '📦', label: 'Orders',
        links: [
          { label: 'Order list', path: null, disabled: true },
        ],
      },
      {
        icon: '📐', label: 'Survey',
        links: [
          { label: 'Drawing list', path: null, disabled: true },
        ],
      },
      {
        icon: '💰', label: 'Pricing & Config',
        links: [
          { label: 'Pricing', path: '/pricing' },
          { label: 'Ironmongery', path: '/ironmongery' },
          { label: 'Reference Data', path: '/reference-data' },
          { label: 'Defaults & Parts', path: '/defaults' },
        ],
      },
    ],
  },
  {
    module: 'PRO',
    groups: [
      {
        icon: '⚙️', label: 'Production',
        links: [
          { label: 'Schedule', path: null, disabled: true },
        ],
      },
    ],
  },
  {
    module: 'FIT',
    groups: [
      {
        icon: '🔧', label: 'Installation',
        links: [
          { label: 'Scheduling', path: '/calendar' },
        ],
      },
    ],
  },
]

export default function Home() {
  return (
    <Layout>
      <div style={{ flex: 1, overflowY: 'auto', background: '#f5f4f0', padding: 28 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.5px', marginBottom: 4 }}>
            Welcome to GlazePro
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>
            Select a module to get started
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18, maxWidth: 1200 }}>
          {MODULES.map(m => <ModuleCard key={m.module} {...m} />)}
        </div>
      </div>
    </Layout>
  )
}
