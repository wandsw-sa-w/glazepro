import { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import { listAllTemplates, updateTemplate, deleteTemplate } from '../drawingBoard/templates.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { computeSashGeometry } from '../drawingBoard/sashGeometry.js'
import { SashElevation } from '../drawingBoard/renderElevation.jsx'

// ── Constants ────────────────────────────────────────────────────────────────

const FAMILIES = [
  { key: 'sash', label: 'Sash' },
  { key: 'casement', label: 'Casement' },
  { key: 'door', label: 'Door' },
  { key: 'free_text', label: 'Other' },
]

const SI = {
  width: '100%', padding: '6px 8px', fontSize: 12,
  border: '1px solid #d8d5cf', borderRadius: 6, outline: 'none',
  background: '#fff', boxSizing: 'border-box',
}

// ── Thumbnail from tree ─────────────────────────────────────────────────────

function TemplateThumb({ tree }) {
  if (!tree || !tree.part_type) {
    return (
      <div style={{ width: '100%', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11, fontStyle: 'italic' }}>
        No preview
      </div>
    )
  }
  try {
    const derived = computeDerived(tree)
    const geometry = computeSashGeometry(tree, derived)
    return (
      <div style={{ width: '100%', height: 120, overflow: 'hidden' }}>
        <SashElevation tree={tree} geometry={geometry} refOptions={{}} viewMode="internal" />
      </div>
    )
  } catch {
    return (
      <div style={{ width: '100%', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11, fontStyle: 'italic' }}>
        Preview unavailable
      </div>
    )
  }
}

// ── Confirm dialog ──────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{message}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ fontSize: 12, padding: '6px 16px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ fontSize: 12, padding: '6px 16px', border: 'none', borderRadius: 7, background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function TemplateManager() {
  const { user } = useAuth()

  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [familyFilter, setFamilyFilter] = useState('sash')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null) // template id

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editFamily, setEditFamily] = useState('sash')
  const [editGroup, setEditGroup] = useState('')
  const [editSortOrder, setEditSortOrder] = useState(0)
  const [editActive, setEditActive] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await listAllTemplates()
      setTemplates(data)
    } catch (e) {
      console.error('Failed to load templates:', e)
    }
    setLoading(false)
  }

  const selected = templates.find(t => t.id === selectedId) ?? null

  function selectTemplate(t) {
    setSelectedId(t.id)
    setEditName(t.name)
    setEditFamily(t.family)
    setEditGroup(t.group_name)
    setEditSortOrder(t.sort_order)
    setEditActive(t.is_active)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await updateTemplate(selected.id, {
        name: editName,
        family: editFamily,
        group_name: editGroup,
        sort_order: editSortOrder,
        is_active: editActive,
      })
      setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))
    } catch (e) {
      console.error('Failed to save template:', e)
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    try {
      await deleteTemplate(confirmDelete)
      setTemplates(prev => prev.filter(t => t.id !== confirmDelete))
      if (selectedId === confirmDelete) setSelectedId(null)
    } catch (e) {
      console.error('Failed to delete template:', e)
    }
    setConfirmDelete(null)
  }

  // Group templates by family then group_name
  const filtered = templates.filter(t => t.family === familyFilter)
  const groups = {}
  for (const t of filtered) {
    const g = t.group_name || '(ungrouped)'
    if (!groups[g]) groups[g] = []
    groups[g].push(t)
  }

  // Collect existing group names for the datalist
  const allGroupNames = [...new Set(templates.map(t => t.group_name).filter(Boolean))].sort()

  return (
    <Layout>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left panel — list */}
        <div style={{ width: 340, borderRight: '1px solid #e8e6e0', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #e8e6e0' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>Drawing Templates</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {FAMILIES.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setFamilyFilter(f.key); setSelectedId(null) }}
                  style={{
                    flex: 1, fontSize: 11, padding: '5px 0', borderRadius: 6, cursor: 'pointer',
                    border: familyFilter === f.key ? '1px solid #3d35a8' : '1px solid #d8d5cf',
                    background: familyFilter === f.key ? '#f0eefc' : '#fff',
                    color: familyFilter === f.key ? '#3d35a8' : '#555',
                    fontWeight: familyFilter === f.key ? 600 : 400,
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {loading && <div style={{ textAlign: 'center', color: '#aaa', padding: 40, fontSize: 12 }}>Loading...</div>}
            {!loading && filtered.length === 0 && (
              <div style={{ textAlign: 'center', color: '#bbb', padding: 40, fontSize: 12 }}>No templates in this family</div>
            )}
            {!loading && Object.entries(groups).map(([groupName, items]) => (
              <div key={groupName}>
                <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {groupName}
                </div>
                {items.map(t => (
                  <div
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    style={{
                      padding: '7px 16px', fontSize: 12, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: selectedId === t.id ? '#f0eefc' : 'transparent',
                      borderLeft: selectedId === t.id ? '3px solid #3d35a8' : '3px solid transparent',
                      color: t.is_active ? '#333' : '#bbb',
                    }}
                    onMouseEnter={e => { if (selectedId !== t.id) e.currentTarget.style.background = '#f8f7f5' }}
                    onMouseLeave={e => { if (selectedId !== t.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontWeight: selectedId === t.id ? 600 : 400 }}>{t.name}</span>
                    {!t.is_active && <span style={{ fontSize: 9, color: '#bbb', fontStyle: 'italic' }}>inactive</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — detail */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#faf9f7' }}>
          {!selected ? (
            <div style={{ textAlign: 'center', color: '#bbb', fontSize: 13, paddingTop: 80 }}>
              Select a template to view its details
            </div>
          ) : (
            <div style={{ maxWidth: 560 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 20 }}>{selected.name}</div>

              {/* Thumbnail */}
              <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
                <TemplateThumb tree={selected.tree} />
              </div>

              {/* Edit form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>Name</label>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={SI} />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>Family</label>
                  <select value={editFamily} onChange={e => setEditFamily(e.target.value)} style={SI}>
                    {FAMILIES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>Group</label>
                  <input value={editGroup} onChange={e => setEditGroup(e.target.value)} list="template-groups" style={SI} />
                  <datalist id="template-groups">
                    {allGroupNames.map(g => <option key={g} value={g} />)}
                  </datalist>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#666', display: 'block', marginBottom: 3 }}>Sort order</label>
                  <input type="number" value={editSortOrder} onChange={e => setEditSortOrder(Number(e.target.value))} style={{ ...SI, width: 100 }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    onClick={() => setEditActive(a => !a)}
                    style={{ width: 36, height: 20, borderRadius: 10, background: editActive ? '#3d35a8' : '#d8d5cf', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background .15s' }}
                  >
                    <div style={{ position: 'absolute', top: 3, left: editActive ? 19 : 3, width: 14, height: 14, borderRadius: 7, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#555' }}>Active</span>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ fontSize: 12, padding: '7px 20px', border: 'none', borderRadius: 7, background: '#3d35a8', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(selected.id)}
                    style={{ fontSize: 12, padding: '7px 16px', border: '1px solid #fca5a5', borderRadius: 7, background: '#fef2f2', color: '#b91c1c', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>

                <div style={{ fontSize: 10, color: '#aaa', marginTop: 8 }}>
                  Window type: {selected.window_type || '(none)'}
                  <br />
                  Created: {selected.created_at ? new Date(selected.created_at).toLocaleDateString('en-GB') : '—'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmDialog
          message="Delete this template permanently? This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </Layout>
  )
}
