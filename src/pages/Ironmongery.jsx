import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useUnmatchedCount } from '../hooks/useUnmatchedCount'

const CATEGORIES = [
  'Sash Fastener', 'Sash Lift', 'Sash Pulley', 'Sash Restrictor',
  'Casement Handle', 'Casement Stay', 'Casement Hinge',
  'Door Handle', 'Door Lock', 'Door Hinge', 'Door Knocker',
  'Letterplate', 'Numerals', 'Trickle Vent', 'Cylinder',
]

const FINISHES = [
  { name: 'Polished Brass',  code: 'PB'   },
  { name: 'Polished Chrome', code: 'PC'   },
  { name: 'Satin Chrome',    code: 'SC'   },
  { name: 'Black',           code: 'Blk'  },
  { name: 'Pewter',          code: 'Pwt'  },
  { name: 'Antique Brass',   code: 'ABs'  },
  { name: 'Antique Black',   code: 'ABlk' },
  { name: 'White',           code: 'Wht'  },
  { name: 'Aged Brass',      code: 'AgBs' },
  { name: 'Antique Bronze',  code: 'ABz'  },
  { name: 'Polished Nickel', code: 'PN'   },
]

const CAT_COLOUR = {
  'Sash Fastener':   { bg: '#e6f0fb', color: '#1a5fa8' },
  'Sash Lift':       { bg: '#e6f0fb', color: '#1a5fa8' },
  'Sash Pulley':     { bg: '#e6f0fb', color: '#1a5fa8' },
  'Sash Restrictor': { bg: '#e6f0fb', color: '#1a5fa8' },
  'Casement Handle': { bg: '#eeedfe', color: '#4a3ab0' },
  'Casement Stay':   { bg: '#eeedfe', color: '#4a3ab0' },
  'Casement Hinge':  { bg: '#eeedfe', color: '#4a3ab0' },
  'Door Handle':     { bg: '#e1f5ee', color: '#0a5a3c' },
  'Door Lock':       { bg: '#e1f5ee', color: '#0a5a3c' },
  'Door Hinge':      { bg: '#e1f5ee', color: '#0a5a3c' },
  'Door Knocker':    { bg: '#e1f5ee', color: '#0a5a3c' },
  'Letterplate':     { bg: '#faeeda', color: '#7a4a08' },
  'Numerals':        { bg: '#faeeda', color: '#7a4a08' },
  'Trickle Vent':    { bg: '#fceaea', color: '#8b2020' },
  'Cylinder':        { bg: '#f5f4f0', color: '#555'    },
}

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: value ? '#3d35a8' : '#d8d5cf',
        position: 'relative', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: value ? 19 : 3,
        width: 14, height: 14, borderRadius: 7,
        background: '#fff', transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </div>
  )
}

const inputStyle = {
  fontSize: 13,
  padding: '6px 10px',
  border: '1px solid #d8d5cf',
  borderRadius: 8,
  outline: 'none',
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
}

const labelStyle = {
  fontSize: 11,
  fontWeight: 500,
  color: '#888',
  marginBottom: 4,
  display: 'block',
}

export default function Ironmongery() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const unmatchedCount = useUnmatchedCount()

  // Products
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')

  // Selected product
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [productForm, setProductForm] = useState(null)

  // Variants
  const [variantDrafts, setVariantDrafts] = useState({})
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingFinish, setUploadingFinish] = useState(null)

  useEffect(() => { fetchProducts() }, [])

  async function fetchProducts() {
    setLoadingProducts(true)
    const { data } = await supabase
      .from('ironmongery_products')
      .select('*')
      .order('name')
    setProducts(data || [])
    setLoadingProducts(false)
  }

  function buildDrafts(productId, variantsFromDb) {
    const drafts = {}
    FINISHES.forEach(f => {
      const existing = variantsFromDb.find(v => v.finish_code === f.code)
      drafts[f.code] = existing
        ? { ...existing, _active: true }
        : {
            product_id: productId,
            finish_name: f.name,
            finish_code: f.code,
            part_no: '',
            internal_name: '',
            cost: '',
            photo_url: null,
            available: true,
            _active: false,
          }
    })
    setVariantDrafts(drafts)
  }

  async function selectProduct(product) {
    setSelectedProduct(product)
    setProductForm({ ...product })
    setLoadingVariants(true)
    const { data } = await supabase
      .from('ironmongery_variants')
      .select('*')
      .eq('product_id', product.id)
    buildDrafts(product.id, data || [])
    setLoadingVariants(false)
  }

  async function addProduct() {
    const { data } = await supabase
      .from('ironmongery_products')
      .insert([{
        name: 'New Product',
        category: 'Sash Fastener',
        default_finish: null,
        is_trickle_vent: false,
        trickle_vent_type: null,
      }])
      .select()
      .single()
    if (data) {
      setProducts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      selectProduct(data)
    }
  }

  async function saveProductField(field, value) {
    if (!selectedProduct) return
    await supabase.from('ironmongery_products').update({ [field]: value }).eq('id', selectedProduct.id)
    const updated = { ...selectedProduct, [field]: value }
    setSelectedProduct(updated)
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  function setFormField(field, value) {
    setProductForm(prev => ({ ...prev, [field]: value }))
  }

  function setVariantField(finishCode, field, value) {
    setVariantDrafts(prev => {
      const current = prev[finishCode] || {}
      const updated = { ...current, [field]: value }
      // Auto-activate the card when any meaningful value is entered
      if (value !== '' && value !== null && value !== undefined) {
        updated._active = true
      }
      return { ...prev, [finishCode]: updated }
    })
  }

  function activateVariant(finishCode) {
    setVariantDrafts(prev => ({
      ...prev,
      [finishCode]: { ...prev[finishCode], _active: true },
    }))
  }

  async function deleteVariant(finishCode) {
    const draft = variantDrafts[finishCode]
    if (draft?.id) {
      await supabase.from('ironmongery_variants').delete().eq('id', draft.id)
    }
    setVariantDrafts(prev => ({
      ...prev,
      [finishCode]: {
        product_id: selectedProduct.id,
        finish_name: FINISHES.find(f => f.code === finishCode)?.name || finishCode,
        finish_code: finishCode,
        part_no: '',
        internal_name: '',
        cost: '',
        photo_url: null,
        available: true,
        _active: false,
      },
    }))
  }

  async function uploadPhoto(finishCode, file) {
    if (!file) return
    setUploadingFinish(finishCode)
    // Path: productId/finishCode/timestamp.jpg — no spaces or special characters
    const path = `${selectedProduct.id}/${finishCode}/${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('ironmongery-photos')
      .upload(path, file, { upsert: true })
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage
        .from('ironmongery-photos')
        .getPublicUrl(path)
      // Store in local draft — will be persisted when Save variants is clicked
      setVariantField(finishCode, 'photo_url', publicUrl)
    } else {
      console.error('Photo upload error:', uploadError)
    }
    setUploadingFinish(null)
  }

  async function saveVariants() {
    if (!selectedProduct) return
    setSaving(true)
    const active = Object.values(variantDrafts).filter(v =>
      v._active || v.part_no || v.internal_name || (v.cost !== '' && v.cost != null) || v.photo_url
    )
    const rows = active.map(draft => {
  const finish = FINISHES.find(f => f.code === draft.finish_code)
  const row = {
    product_id: selectedProduct.id,
    finish_name: finish?.name || draft.finish_name || draft.finish_code,
    finish_code: draft.finish_code,
    part_no: draft.part_no || null,
    internal_name: draft.internal_name || null,
    cost: draft.cost === '' || draft.cost == null ? null : parseFloat(draft.cost) || null,
    photo_url: draft.photo_url || null,
    available: draft.available ?? true,
  }
  if (draft.id && Number.isInteger(Number(draft.id)) && Number(draft.id) > 0) {
    row.id = Number(draft.id)
  }
  return row
})
    if (rows.length > 0) {
  console.log('Saving variants:', rows)
  
  const finishCodes = rows.map(r => r.finish_code)
  await supabase
    .from('ironmongery_variants')
    .delete()
    .eq('product_id', selectedProduct.id)
    .in('finish_code', finishCodes)

  const cleanRows = rows.map(({ id, ...rest }) => rest)
const { data, error } = await supabase
  .from('ironmongery_variants')
  .insert(cleanRows)
  .select()

  console.log('Save result:', data, error)
  if (error) console.error('Error saving variants:', error)
}
    // Reload to capture generated IDs for new rows
    const { data } = await supabase
      .from('ironmongery_variants')
      .select('*')
      .eq('product_id', selectedProduct.id)
    buildDrafts(selectedProduct.id, data || [])
    setSaving(false)
  }

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'All' || p.category === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'inherit' }}>

      {/* ── Sidebar ───────────────────────────────────────────────────────────── */}
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
        ].map(([item, path, badge]) => {
          const active = false
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
              {badge > 0 && (
                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: '#fceaea', color: '#8b2020', fontWeight: 600, flexShrink: 0 }}>
                  {badge}
                </span>
              )}
            </div>
          )
        })}
        <div style={{ padding: '14px 14px 4px', fontSize: 10, color: '#aaa', letterSpacing: '.07em', textTransform: 'uppercase' }}>Catalogue</div>
        <div
          onClick={() => navigate('/ironmongery')}
          style={{ padding: '8px 11px', fontSize: 13, borderRadius: 8, margin: '1px 7px', display: 'flex', alignItems: 'center', color: '#3d35a8', fontWeight: 500, background: '#f0eefc', cursor: 'pointer' }}
        >
          <span>Ironmongery</span>
        </div>
        <div
          onClick={() => navigate('/settings')}
          style={{ margin: '4px 7px 2px', padding: '8px 11px', fontSize: 13, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#555', cursor: 'pointer' }}
        >
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

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{ height: 52, background: '#fff', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', padding: '0 20px', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ironmongery Catalogue</div>
        </div>

        {/* Two-panel area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── Left panel – Product list (30%) ─────────────────────────────── */}
          <div style={{ width: '30%', minWidth: 240, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e8e6e0', background: '#faf9f7', overflow: 'hidden', flexShrink: 0 }}>

            {/* Controls */}
            <div style={{ padding: 12, borderBottom: '1px solid #e8e6e0', background: '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={addProduct}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '7px 12px', borderRadius: 8,
                  border: '1px solid #3d35a8', background: '#3d35a8', color: '#fff',
                  cursor: 'pointer', width: '100%',
                }}
              >
                + Add New Product
              </button>
              <input
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, fontSize: 12 }}
              />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                style={{ ...inputStyle, fontSize: 12, cursor: 'pointer' }}
              >
                <option value="All">All categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Product list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingProducts ? (
                <div style={{ textAlign: 'center', color: '#aaa', padding: 32, fontSize: 13 }}>Loading…</div>
              ) : filteredProducts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#aaa', padding: 32, fontSize: 13 }}>No products found</div>
              ) : filteredProducts.map(product => {
                const isSelected = selectedProduct?.id === product.id
                const catColour = CAT_COLOUR[product.category] || { bg: '#f5f4f0', color: '#555' }
                return (
                  <div
                    key={product.id}
                    onClick={() => selectProduct(product)}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #ede9e3',
                      cursor: 'pointer',
                      background: isSelected ? '#f0eefc' : '#fff',
                      borderLeft: `3px solid ${isSelected ? '#3d35a8' : 'transparent'}`,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? '#3d35a8' : '#222', marginBottom: 4, lineHeight: 1.3 }}>
                      {product.name}
                    </div>
                    {product.category && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, fontWeight: 500, background: catColour.bg, color: catColour.color }}>
                        {product.category}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Right panel – Product detail (70%) ──────────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
            {!selectedProduct ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bbb', fontSize: 14 }}>
                Select a product to view details
              </div>
            ) : (
              <div style={{ padding: 24 }}>

                {/* ── Product fields ─────────────────────────────────────────── */}
                <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: 20, marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 16 }}>
                    Product Details
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

                    {/* Name */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Name</label>
                      <input
                        style={inputStyle}
                        value={productForm?.name || ''}
                        onChange={e => setFormField('name', e.target.value)}
                        onBlur={e => saveProductField('name', e.target.value)}
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label style={labelStyle}>Category</label>
                      <select
                        style={{ ...inputStyle, cursor: 'pointer' }}
                        value={productForm?.category || ''}
                        onChange={e => {
                          setFormField('category', e.target.value)
                          saveProductField('category', e.target.value)
                        }}
                      >
                        <option value="">— select —</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>

                    {/* Default finish */}
                    <div>
                      <label style={labelStyle}>Default finish</label>
                      <select
                        style={{ ...inputStyle, cursor: 'pointer' }}
                        value={productForm?.default_finish || ''}
                        onChange={e => {
                          setFormField('default_finish', e.target.value)
                          saveProductField('default_finish', e.target.value || null)
                        }}
                      >
                        <option value="">— none —</option>
                        {FINISHES.map(f => (
                          <option key={f.code} value={f.code}>{f.name} [{f.code}]</option>
                        ))}
                      </select>
                    </div>

                    {/* Is trickle vent */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, gridColumn: '1 / -1' }}>
                      <Toggle
                        value={productForm?.is_trickle_vent || false}
                        onChange={val => {
                          setFormField('is_trickle_vent', val)
                          saveProductField('is_trickle_vent', val)
                          if (!val) {
                            setFormField('trickle_vent_type', null)
                            saveProductField('trickle_vent_type', null)
                          }
                        }}
                      />
                      <span style={{ fontSize: 13, color: '#555', userSelect: 'none' }}>Is trickle vent</span>
                    </div>

                    {/* Trickle vent type — only when is_trickle_vent is true */}
                    {productForm?.is_trickle_vent && (
                      <div>
                        <label style={labelStyle}>Trickle vent type</label>
                        <select
                          style={{ ...inputStyle, cursor: 'pointer' }}
                          value={productForm?.trickle_vent_type || ''}
                          onChange={e => {
                            setFormField('trickle_vent_type', e.target.value)
                            saveProductField('trickle_vent_type', e.target.value || null)
                          }}
                        >
                          <option value="">— select —</option>
                          <option value="Internal">Internal</option>
                          <option value="External">External</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Variants section ───────────────────────────────────────── */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 16 }}>
                    Finish Variants
                  </div>

                  {loadingVariants ? (
                    <div style={{ textAlign: 'center', color: '#aaa', padding: 48, fontSize: 13 }}>Loading variants…</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                        {FINISHES.map(finish => {
                          const draft = variantDrafts[finish.code]
                          const isActive = draft?._active
                          const isUploading = uploadingFinish === finish.code

                          return (
                            <div
                              key={finish.code}
                              style={{
                                background: isActive ? '#fff' : '#faf9f7',
                                border: `1px solid ${isActive ? '#d8d5cf' : '#e8e6e0'}`,
                                borderRadius: 10,
                                padding: 14,
                                opacity: isActive ? 1 : 0.65,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10,
                              }}
                            >
                              {/* Card header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: '#222', lineHeight: 1.3 }}>{finish.name}</div>
                                  <div style={{ fontSize: 10, color: '#999', fontWeight: 500, marginTop: 1 }}>[{finish.code}]</div>
                                </div>
                                {isActive && (
                                  <button
                                    onClick={() => deleteVariant(finish.code)}
                                    style={{ fontSize: 10, padding: '2px 8px', border: '1px solid #e8d0d0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#8b2020', flexShrink: 0 }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>

                              {isActive ? (
                                <>
                                  {/* Part number */}
                                  <div>
                                    <label style={{ ...labelStyle, marginBottom: 2 }}>Part number</label>
                                    <input
                                      style={{ ...inputStyle, fontSize: 12 }}
                                      value={draft.part_no || ''}
                                      placeholder="e.g. PB-001"
                                      onChange={e => setVariantField(finish.code, 'part_no', e.target.value)}
                                    />
                                  </div>

                                  {/* Internal name */}
                                  <div>
                                    <label style={{ ...labelStyle, marginBottom: 2 }}>Internal name</label>
                                    <input
                                      style={{ ...inputStyle, fontSize: 12 }}
                                      value={draft.internal_name || ''}
                                      placeholder="Optional"
                                      onChange={e => setVariantField(finish.code, 'internal_name', e.target.value)}
                                    />
                                  </div>

                                  {/* Cost */}
                                  <div>
                                    <label style={{ ...labelStyle, marginBottom: 2 }}>Cost (£)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      style={{ ...inputStyle, fontSize: 12 }}
                                      value={draft.cost ?? ''}
                                      placeholder="0.00"
                                      onChange={e => setVariantField(finish.code, 'cost', e.target.value)}
                                    />
                                  </div>

                                  {/* Photo */}
                                  <div>
                                    <label style={{ ...labelStyle, marginBottom: 4 }}>Photo</label>
                                    {draft.photo_url && (
                                      <div style={{ marginBottom: 6 }}>
                                        <img
                                          src={draft.photo_url}
                                          alt={finish.name}
                                          style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #e8e6e0', display: 'block' }}
                                        />
                                      </div>
                                    )}
                                    <label style={{
                                      display: 'inline-block',
                                      fontSize: 11, fontWeight: 500, padding: '5px 10px',
                                      border: '1px solid #d8d5cf', borderRadius: 6,
                                      background: '#fff',
                                      cursor: isUploading ? 'not-allowed' : 'pointer',
                                      color: isUploading ? '#aaa' : '#555',
                                    }}>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        disabled={isUploading}
                                        style={{ display: 'none' }}
                                        onChange={e => uploadPhoto(finish.code, e.target.files[0])}
                                      />
                                      {isUploading ? 'Uploading…' : draft.photo_url ? 'Replace photo' : 'Upload photo'}
                                    </label>
                                  </div>

                                  {/* Available toggle */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #f0eeee', paddingTop: 8 }}>
                                    <Toggle
                                      value={draft.available ?? true}
                                      onChange={val => setVariantField(finish.code, 'available', val)}
                                    />
                                    <span style={{ fontSize: 12, color: '#555' }}>Available</span>
                                  </div>
                                </>
                              ) : (
                                <button
                                  onClick={() => activateVariant(finish.code)}
                                  style={{
                                    fontSize: 12, fontWeight: 500, padding: '6px 14px',
                                    border: '1px dashed #d8d5cf', borderRadius: 8,
                                    background: '#fff', cursor: 'pointer', color: '#888',
                                    alignSelf: 'flex-start',
                                  }}
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Save variants button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={saveVariants}
                          disabled={saving || loadingVariants}
                          style={{
                            fontSize: 13, fontWeight: 600, padding: '9px 24px',
                            borderRadius: 8, border: 'none',
                            background: saving ? '#c4c0e8' : '#3d35a8',
                            color: '#fff',
                            cursor: saving ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {saving ? 'Saving…' : 'Save variants'}
                        </button>
                      </div>
                    </>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
