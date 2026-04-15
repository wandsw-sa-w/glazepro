import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const WINDOW_TYPES   = ['Box Sash', 'Spiral Sash', 'Flush Casement', 'Stormproof Casement', 'Front Door', 'Single Door', 'French Door', 'Bifolding Door']
const SASH_TYPES     = new Set(['Box Sash', 'Spiral Sash'])
const SERVICE_TYPES  = ['Complete New', 'Sash Replacement 35mm', 'Sash Replacement 40mm', 'Sash Replacement 45mm']
const TIMBER_OPTIONS = ['Solid Redwood', 'Accoya', 'Sapele']
const CILL_OPTIONS   = ['Solid Utile Hardwood', 'Accoya']
const GLASS_TYPES    = ['Clear Toughened', 'Sandblasted Toughened', 'Antique Cathedral', 'Pilkington K']
const FINISH_OPTIONS = ['Clean White', 'White Gloss', 'White Satin', 'Colour Match Satin', 'Colour Match Gloss', 'Custom']
const IRON_FINISHES  = ['PB', 'PC', 'SC', 'Blk', 'Pwt', 'ABs', 'ABlk', 'Wht', 'AgBs', 'ABz', 'PN']
const OPERATIONS     = ['Cord Hung', 'Spiral Hung', 'Fix']
const HORNS          = ['Victorian', 'None']
const SASH_SURROUNDS = 'Nosing, Ogee Architrave Internal Architrave'

const DEFAULT_SPEC = {
  window_type:             'Box Sash',
  service_type:            'Complete New',
  timber_frame:            'Solid Redwood',
  timber_sash:             'Solid Redwood',
  cill_material:           'Solid Utile Hardwood',
  doc_l:                   true,
  frame_width:             '',
  frame_height:            '',
  sash_width:              '',
  sash_height:             '',
  equal_sash:              true,
  top_sash_height:         '',
  bottom_sash_height:      '',
  top_operation:           'Cord Hung',
  top_horn:                'Victorian',
  top_bars_wide:           1,
  top_bars_high:           1,
  top_glass:               'Clear Toughened',
  bottom_operation:        'Cord Hung',
  bottom_horn:             'Victorian',
  bottom_bars_wide:        1,
  bottom_bars_high:        1,
  bottom_glass:            'Clear Toughened',
  trickle_vent:            false,
  internal_finish:         'Clean White',
  internal_finish_custom:  '',
  external_finish:         'Clean White',
  external_finish_custom:  '',
  cill_finish:             'Clean White',
  cill_finish_custom:      '',
  ironmongery_finish:      'PB',
  ironmongery_items:       [],
  surrounds:               '',
  quote_notes:             '',
  installation_notes:      '',
  hs_notes:                '',
  staff_bead_type:         'Small',
  cad_required:            false,
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const SI = {
  width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #d8d5cf',
  borderRadius: 6, outline: 'none', background: '#fff', boxSizing: 'border-box',
}

// ── Small UI primitives ───────────────────────────────────────────────────────

function Section({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid #ede9e2' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</span>
        <span style={{ fontSize: 10, color: '#aaa' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ paddingBottom: 14 }}>{children}</div>}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 600, color: '#666', display: 'block', marginBottom: 4 }}>{label}</label>}
      {children}
    </div>
  )
}

function Sel({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={SI}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Tog({ value, onChange, label }) {
  return (
    <div onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ width: 32, height: 18, borderRadius: 999, background: value ? '#3d35a8' : '#d8d5cf', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 16 : 2, transition: 'left .2s' }} />
      </div>
      <span style={{ fontSize: 12, color: value ? '#3d35a8' : '#888' }}>{label}</span>
    </div>
  )
}

function BtnGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} style={{
          padding: '4px 9px', fontSize: 11, border: '1px solid', borderRadius: 6, cursor: 'pointer', fontWeight: 500,
          borderColor: value === o ? '#3d35a8' : '#d8d5cf',
          background:  value === o ? '#f0eefc' : '#fff',
          color:       value === o ? '#3d35a8' : '#555',
        }}>{o}</button>
      ))}
    </div>
  )
}

function FinishField({ label, field, customField, spec, update }) {
  return (
    <Field label={label}>
      <Sel value={spec[field]} onChange={v => update(field, v)} options={FINISH_OPTIONS} />
      {spec[field] === 'Custom' && (
        <input
          value={spec[customField] || ''}
          onChange={e => update(customField, e.target.value)}
          placeholder="Describe finish…"
          style={{ ...SI, marginTop: 4 }}
        />
      )}
    </Field>
  )
}

// ── SVG Preview ───────────────────────────────────────────────────────────────

function SashSVG({ spec }) {
  const frameW = parseFloat(spec.frame_width)  || 900
  const frameH = parseFloat(spec.frame_height) || 1200
  const isSash = SASH_TYPES.has(spec.window_type)

  const SVG_W = 260
  const SVG_H = Math.min(Math.max(Math.round(SVG_W * frameH / frameW), 180), 440)
  const M     = 30

  const dW = SVG_W - 2 * M
  const dH = SVG_H - 2 * M
  const fT = Math.max(10, Math.round(dW * 0.09))
  const mR = Math.max(5,  Math.round(dH * 0.026))

  const gX = M + fT
  const gY = M + fT
  const gW = dW - 2 * fT
  const gH = dH - 2 * fT

  const sashH = Math.floor((gH - mR) / 2)
  let topH, botH, mrY
  if (!spec.equal_sash && parseFloat(spec.top_sash_height) && parseFloat(spec.bottom_sash_height)) {
    const t = parseFloat(spec.top_sash_height)
    const b = parseFloat(spec.bottom_sash_height)
    topH = Math.round((gH - mR) * t / (t + b))
    botH = (gH - mR) - topH
  } else {
    topH = sashH
    botH = sashH
  }
  mrY = gY + topH
  const botGlassY = mrY + mR

  const dc = '#666'
  const df = 8

  function hDim(x1, x2, y, lbl) {
    const mx = (x1 + x2) / 2
    return (
      <g key={`hd-${lbl}`}>
        <line x1={x1} y1={y} x2={x2} y2={y} stroke={dc} strokeWidth={0.7} />
        <line x1={x1} y1={y - 3} x2={x1} y2={y + 3} stroke={dc} strokeWidth={0.7} />
        <line x1={x2} y1={y - 3} x2={x2} y2={y + 3} stroke={dc} strokeWidth={0.7} />
        <text x={mx} y={y - 4} textAnchor="middle" fontSize={df} fill={dc}>{lbl}</text>
      </g>
    )
  }

  function vDim(x, y1, y2, lbl) {
    const my = (y1 + y2) / 2
    return (
      <g key={`vd-${lbl}`}>
        <line x1={x} y1={y1} x2={x} y2={y2} stroke={dc} strokeWidth={0.7} />
        <line x1={x - 3} y1={y1} x2={x + 3} y2={y1} stroke={dc} strokeWidth={0.7} />
        <line x1={x - 3} y1={y2} x2={x + 3} y2={y2} stroke={dc} strokeWidth={0.7} />
        <text x={x + 5} y={my + 3} fontSize={df} fill={dc}>{lbl}</text>
      </g>
    )
  }

  function bars(x, y, w, h, bw, bh) {
    const els = []
    for (let i = 1; i < bw; i++) {
      const bx = x + (w / bw) * i
      els.push(<line key={`bv${i}`} x1={bx} y1={y} x2={bx} y2={y + h} stroke="#c4a882" strokeWidth={2.5} />)
    }
    for (let i = 1; i < bh; i++) {
      const by = y + (h / bh) * i
      els.push(<line key={`bh${i}`} x1={x} y1={by} x2={x + w} y2={by} stroke="#c4a882" strokeWidth={2.5} />)
    }
    return els
  }

  const dimW = spec.frame_width  ? `${spec.frame_width}`  : '—'
  const dimH = spec.frame_height ? `${spec.frame_height}` : '—'

  if (!isSash) {
    return (
      <svg width={SVG_W} height={SVG_H} style={{ maxWidth: '100%', display: 'block' }}>
        <rect x={M} y={M} width={dW} height={dH} fill="#c4a882" />
        <rect x={gX} y={gY} width={gW} height={gH} fill="#d4e8f0" opacity={0.85} />
        <text x={gX + gW / 2} y={gY + gH / 2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#555">{spec.window_type}</text>
        {hDim(M, M + dW, M - 10, dimW)}
        {vDim(M + dW + 10, M, M + dH, dimH)}
      </svg>
    )
  }

  const topIsSand   = spec.top_glass    === 'Sandblasted Toughened'
  const botIsSand   = spec.bottom_glass === 'Sandblasted Toughened'
  const topCanMove  = spec.top_operation    !== 'Fix'
  const botCanMove  = spec.bottom_operation !== 'Fix'
  const hornW = 8, hornH = 15
  const hornLX = gX - 6
  const hornRX = gX + gW - 2

  return (
    <svg width={SVG_W} height={SVG_H} style={{ maxWidth: '100%', display: 'block' }}>
      <defs>
        {topIsSand && (
          <pattern id="sbTop" patternUnits="userSpaceOnUse" width={6} height={6}>
            <line x1={0} y1={6} x2={6} y2={0} stroke="#8ab0bc" strokeWidth={0.8} />
          </pattern>
        )}
        {botIsSand && (
          <pattern id="sbBot" patternUnits="userSpaceOnUse" width={6} height={6}>
            <line x1={0} y1={6} x2={6} y2={0} stroke="#8ab0bc" strokeWidth={0.8} />
          </pattern>
        )}
      </defs>

      {/* Frame */}
      <rect x={M} y={M} width={dW} height={dH} fill="#c4a882" />

      {/* Top glass */}
      <rect x={gX} y={gY} width={gW} height={topH} fill="#d4e8f0" opacity={0.85} />
      {topIsSand && <rect x={gX} y={gY} width={gW} height={topH} fill="url(#sbTop)" />}

      {/* Meeting rail */}
      <rect x={M + Math.round(fT / 2)} y={mrY} width={gW + fT} height={mR} fill="#b89060" />

      {/* Bottom glass */}
      <rect x={gX} y={botGlassY} width={gW} height={botH} fill="#d4e8f0" opacity={0.85} />
      {botIsSand && <rect x={gX} y={botGlassY} width={gW} height={botH} fill="url(#sbBot)" />}

      {/* Victorian horns — top sash (protrude downward from bottom stile corners) */}
      {spec.top_horn === 'Victorian' && (
        <g>
          <rect x={hornLX} y={mrY}          width={hornW} height={hornH} fill="#c4a882" />
          <rect x={hornRX} y={mrY}          width={hornW} height={hornH} fill="#c4a882" />
        </g>
      )}
      {/* Victorian horns — bottom sash (protrude upward from top stile corners) */}
      {spec.bottom_horn === 'Victorian' && (
        <g>
          <rect x={hornLX} y={mrY - hornH} width={hornW} height={hornH} fill="#c4a882" />
          <rect x={hornRX} y={mrY - hornH} width={hornW} height={hornH} fill="#c4a882" />
        </g>
      )}

      {/* Glazing bars */}
      <g>{bars(gX, gY,        gW, topH, spec.top_bars_wide    || 1, spec.top_bars_high    || 1)}</g>
      <g>{bars(gX, botGlassY, gW, botH, spec.bottom_bars_wide || 1, spec.bottom_bars_high || 1)}</g>

      {/* Operation labels */}
      <text x={gX + 3} y={gY        + 9} fontSize={7} fill="#3d35a8" opacity={0.75}>{spec.top_operation}    A1</text>
      <text x={gX + 3} y={botGlassY + 9} fontSize={7} fill="#3d35a8" opacity={0.75}>{spec.bottom_operation} A2</text>

      {/* Movement arrows */}
      {topCanMove && <text x={gX + gW / 2} y={gY        + topH / 2} textAnchor="middle" dominantBaseline="middle" fontSize={16} fill="#555">{'\u2195'}</text>}
      {botCanMove && <text x={gX + gW / 2} y={botGlassY + botH / 2} textAnchor="middle" dominantBaseline="middle" fontSize={16} fill="#555">{'\u2195'}</text>}

      {/* Dimension lines */}
      {hDim(M, M + dW, M - 10, dimW)}
      {vDim(M + dW + 10, M, M + dH, dimH)}
    </svg>
  )
}

// ── Ironmongery modal ─────────────────────────────────────────────────────────

function IronmongeryModal({ finish, onAdd, onClose }) {
  const [search,   setSearch]   = useState('')
  const [products, setProducts] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    supabase
      .from('ironmongery_products')
      .select('*, ironmongery_variants(*)')
      .order('name')
      .then(({ data }) => { setProducts(data || []); setLoading(false) })
  }, [])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)' }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 480, maxHeight: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e8e6e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Add Ironmongery</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#888' }}>✕</button>
        </div>
        <div style={{ padding: '10px 18px', borderBottom: '1px solid #f0ede8' }}>
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" style={SI} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px' }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No products found</div>
          ) : filtered.map(p => {
            const variant = p.ironmongery_variants?.find(v => v.finish_code === finish) || p.ironmongery_variants?.[0]
            return (
              <div
                key={p.id}
                onClick={() => {
                  onAdd({ product_id: p.id, product_name: p.name, variant_id: variant?.id || null, finish_code: variant?.finish_code || finish, part_no: variant?.part_no || '', quantity: 1 })
                  onClose()
                }}
                style={{ padding: '10px 0', borderBottom: '1px solid #f5f4f0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                  {variant && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{variant.finish_code}{variant.part_no ? ` — ${variant.part_no}` : ''}</div>}
                </div>
                <span style={{ fontSize: 11, color: '#3d35a8', fontWeight: 600 }}>+ Add</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Drawing board form ────────────────────────────────────────────────────────

function DrawingBoard({ drawing }) {
  const initSpec = () => {
    const s = { ...DEFAULT_SPEC, ...(drawing.spec || {}) }
    if (SASH_TYPES.has(s.window_type) && !s.surrounds) s.surrounds = SASH_SURROUNDS
    return s
  }

  const [spec, setSpec]             = useState(initSpec)
  const [showIronModal, setShowIronModal] = useState(false)
  const debounceRef   = useRef(null)
  const prevTypeRef   = useRef(spec.window_type)

  const isSash       = SASH_TYPES.has(spec.window_type)
  const isReplacement = spec.service_type !== 'Complete New'

  // Auto-populate surrounds when switching into a sash type
  useEffect(() => {
    if (SASH_TYPES.has(spec.window_type) && !SASH_TYPES.has(prevTypeRef.current) && !spec.surrounds) {
      update('surrounds', SASH_SURROUNDS)
    }
    prevTypeRef.current = spec.window_type
  }, [spec.window_type])

  function scheduleSave(next) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      supabase.from('drawings')
        .update({ spec: next })
        .eq('id', drawing.id)
        .then(({ error }) => { if (error) console.error('Spec save error:', error) })
    }, 500)
  }

  function update(field, value) {
    setSpec(prev => {
      const next = { ...prev, [field]: value }
      scheduleSave(next)
      return next
    })
  }

  function changeIronFinish(finish) {
    setSpec(prev => {
      const next = {
        ...prev,
        ironmongery_finish: finish,
        ironmongery_items: (prev.ironmongery_items || []).map(it => ({ ...it, finish_code: finish })),
      }
      scheduleSave(next)
      return next
    })
  }

  function addIronmongery(product) {
    update('ironmongery_items', [...(spec.ironmongery_items || []), product])
  }

  function removeIronmongery(idx) {
    update('ironmongery_items', (spec.ironmongery_items || []).filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Form — 40% ──────────────────────────────────────────────────────── */}
      <div style={{ width: '40%', borderRight: '1px solid #e8e6e0', overflowY: 'auto', padding: '14px 16px 40px', background: '#fff' }}>

        <Section title="Window Spec">
          <Field label="Window type">
            <Sel value={spec.window_type} onChange={v => update('window_type', v)} options={WINDOW_TYPES} />
          </Field>
          {isSash && (
            <Field label="Service type">
              <Sel value={spec.service_type} onChange={v => update('service_type', v)} options={SERVICE_TYPES} />
            </Field>
          )}
          <Field label="Timber — Frame">
            <Sel value={spec.timber_frame} onChange={v => update('timber_frame', v)} options={TIMBER_OPTIONS} />
          </Field>
          {isSash && (
            <Field label="Timber — Sash">
              <Sel value={spec.timber_sash} onChange={v => update('timber_sash', v)} options={TIMBER_OPTIONS} />
            </Field>
          )}
          <Field label="Cill material">
            <Sel value={spec.cill_material} onChange={v => update('cill_material', v)} options={CILL_OPTIONS} />
          </Field>
          <Tog value={spec.doc_l} onChange={v => update('doc_l', v)} label="Doc L" />
        </Section>

        <Section title="Dimensions">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Field label="Frame width mm">
              <input type="number" value={spec.frame_width} onChange={e => update('frame_width', e.target.value)} style={SI} placeholder="e.g. 900" />
            </Field>
            <Field label="Frame height mm">
              <input type="number" value={spec.frame_height} onChange={e => update('frame_height', e.target.value)} style={SI} placeholder="e.g. 1200" />
            </Field>
          </div>
          {isSash && isReplacement && (
            <>
              <div style={{ fontSize: 11, color: '#999', margin: '2px 0 6px' }}>or enter sash size</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field label="Sash width mm">
                  <input type="number" value={spec.sash_width} onChange={e => update('sash_width', e.target.value)} style={SI} />
                </Field>
                <Field label="Sash height mm">
                  <input type="number" value={spec.sash_height} onChange={e => update('sash_height', e.target.value)} style={SI} />
                </Field>
              </div>
            </>
          )}
        </Section>

        {isSash && (
          <Section title="Sash Details">
            <Field label="Sash division">
              <BtnGroup options={['Equal', 'Custom']} value={spec.equal_sash ? 'Equal' : 'Custom'} onChange={v => update('equal_sash', v === 'Equal')} />
            </Field>
            {!spec.equal_sash && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <Field label="Top sash height mm">
                  <input type="number" value={spec.top_sash_height} onChange={e => update('top_sash_height', e.target.value)} style={SI} />
                </Field>
                <Field label="Bottom sash height mm">
                  <input type="number" value={spec.bottom_sash_height} onChange={e => update('bottom_sash_height', e.target.value)} style={SI} />
                </Field>
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', margin: '12px 0 8px' }}>Top Sash</div>
            <Field label="Operation">
              <BtnGroup options={OPERATIONS} value={spec.top_operation} onChange={v => update('top_operation', v)} />
            </Field>
            <Field label="Horn">
              <BtnGroup options={HORNS} value={spec.top_horn} onChange={v => update('top_horn', v)} />
            </Field>
            <Field label="Glazing bars">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" min={1} max={6} value={spec.top_bars_wide} onChange={e => update('top_bars_wide', Math.max(1, parseInt(e.target.value) || 1))} style={{ ...SI, width: 50 }} />
                <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>wide ×</span>
                <input type="number" min={1} max={6} value={spec.top_bars_high} onChange={e => update('top_bars_high', Math.max(1, parseInt(e.target.value) || 1))} style={{ ...SI, width: 50 }} />
                <span style={{ fontSize: 12, color: '#888' }}>high</span>
              </div>
            </Field>
            <Field label="Glass type">
              <Sel value={spec.top_glass} onChange={v => update('top_glass', v)} options={GLASS_TYPES} />
            </Field>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.05em', margin: '12px 0 8px' }}>Bottom Sash</div>
            <Field label="Operation">
              <BtnGroup options={OPERATIONS} value={spec.bottom_operation} onChange={v => update('bottom_operation', v)} />
            </Field>
            <Field label="Horn">
              <BtnGroup options={HORNS} value={spec.bottom_horn} onChange={v => update('bottom_horn', v)} />
            </Field>
            <Field label="Glazing bars">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" min={1} max={6} value={spec.bottom_bars_wide} onChange={e => update('bottom_bars_wide', Math.max(1, parseInt(e.target.value) || 1))} style={{ ...SI, width: 50 }} />
                <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>wide ×</span>
                <input type="number" min={1} max={6} value={spec.bottom_bars_high} onChange={e => update('bottom_bars_high', Math.max(1, parseInt(e.target.value) || 1))} style={{ ...SI, width: 50 }} />
                <span style={{ fontSize: 12, color: '#888' }}>high</span>
              </div>
            </Field>
            <Field label="Glass type">
              <Sel value={spec.bottom_glass} onChange={v => update('bottom_glass', v)} options={GLASS_TYPES} />
            </Field>

            <div style={{ marginTop: 10 }}>
              <Tog value={spec.trickle_vent} onChange={v => update('trickle_vent', v)} label="Trickle vent" />
            </div>
          </Section>
        )}

        <Section title="Finish & Ironmongery">
          <FinishField label="Internal finish" field="internal_finish" customField="internal_finish_custom" spec={spec} update={update} />
          <FinishField label="External finish" field="external_finish" customField="external_finish_custom" spec={spec} update={update} />
          <FinishField label="Cill finish"     field="cill_finish"     customField="cill_finish_custom"     spec={spec} update={update} />

          <Field label="Ironmongery finish">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {IRON_FINISHES.map(f => (
                <button key={f} onClick={() => changeIronFinish(f)} style={{
                  padding: '3px 8px', fontSize: 10, border: '1px solid', borderRadius: 5, cursor: 'pointer', fontWeight: 600,
                  borderColor: spec.ironmongery_finish === f ? '#3d35a8' : '#d8d5cf',
                  background:  spec.ironmongery_finish === f ? '#f0eefc' : '#fff',
                  color:       spec.ironmongery_finish === f ? '#3d35a8' : '#666',
                }}>{f}</button>
              ))}
            </div>
          </Field>

          <Field label="Ironmongery items">
            <div>
              {(spec.ironmongery_items || []).map((itm, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f5f4f0', fontSize: 12 }}>
                  <span>{itm.product_name} <span style={{ color: '#888' }}>[{itm.finish_code}]</span> × {itm.quantity}</span>
                  <button onClick={() => removeIronmongery(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c00', fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
              <button onClick={() => setShowIronModal(true)} style={{ marginTop: 6, fontSize: 11, padding: '4px 10px', border: '1px dashed #c0bdb5', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#555' }}>
                + Add ironmongery
              </button>
            </div>
          </Field>
        </Section>

        <Section title="Surrounds">
          <textarea
            value={spec.surrounds}
            onChange={e => update('surrounds', e.target.value)}
            rows={3}
            style={{ ...SI, resize: 'vertical' }}
            placeholder={isSash ? SASH_SURROUNDS : ''}
          />
        </Section>

        <Section title="Notes" defaultOpen={false}>
          <Field label="Quote notes">
            <textarea value={spec.quote_notes} onChange={e => update('quote_notes', e.target.value)} rows={3} style={{ ...SI, resize: 'vertical' }} />
          </Field>
          <Field label="Installation notes">
            <textarea value={spec.installation_notes} onChange={e => update('installation_notes', e.target.value)} rows={3} style={{ ...SI, resize: 'vertical' }} />
          </Field>
          <Field label="H&S / Access notes">
            <textarea value={spec.hs_notes} onChange={e => update('hs_notes', e.target.value)} rows={2} style={{ ...SI, resize: 'vertical' }} />
          </Field>
        </Section>

        <Section title="Advanced" defaultOpen={false}>
          <Field label="Staff bead type">
            <Sel value={spec.staff_bead_type} onChange={v => update('staff_bead_type', v)} options={['Small', 'Large']} />
          </Field>
          <div style={{ marginTop: 8 }}>
            <Tog value={spec.cad_required} onChange={v => update('cad_required', v)} label="CAD drawing required" />
          </div>
        </Section>

      </div>

      {/* ── SVG Preview — 60% ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#f7f6f2', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 10, color: '#999', marginBottom: 10, letterSpacing: '.07em', textTransform: 'uppercase', fontWeight: 700 }}>Internal View</div>
        <SashSVG spec={spec} />
        <div style={{ marginTop: 10, fontSize: 11, color: '#888', textAlign: 'center' }}>
          {spec.window_type}
          {spec.frame_width && spec.frame_height ? ` — ${spec.frame_width} × ${spec.frame_height} mm` : ''}
        </div>
      </div>

      {showIronModal && (
        <IronmongeryModal
          finish={spec.ironmongery_finish}
          onAdd={addIronmongery}
          onClose={() => setShowIronModal(false)}
        />
      )}
    </div>
  )
}

// ── QuoteDrawer ───────────────────────────────────────────────────────────────

export default function QuoteDrawer({ drawingId, jobItemId, leadNumber, onClose }) {
  const [drawing, setDrawing] = useState(null)
  const [jobItem, setJobItem] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: dwg }, { data: ji }] = await Promise.all([
        supabase.from('drawings').select('*').eq('id', drawingId).single(),
        supabase.from('job_items').select('*').eq('id', jobItemId).single(),
      ])
      setDrawing(dwg || null)
      setJobItem(ji  || null)
      setLoading(false)
    }
    load()
  }, [drawingId, jobItemId])

  const drawingLabel = drawing && jobItem
    ? `Drawing ${jobItem.item_number}.${drawing.drawing_number}`
    : 'Drawing'

  const contextParts = [jobItem?.floor_level, jobItem?.elevation, jobItem?.room_name].filter(Boolean)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'stretch' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.35)', cursor: 'pointer' }} />

      {/* Drawer */}
      <div style={{ width: '90%', display: 'flex', flexDirection: 'column', background: '#f7f6f2', borderLeft: '1px solid #e8e6e0', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', height: 56, borderBottom: '1px solid #e8e6e0', background: '#fff', flexShrink: 0 }}>
          {leadNumber && <div style={{ fontSize: 12, color: '#aaa', fontWeight: 500 }}>{leadNumber}</div>}
          <div style={{ fontWeight: 600, fontSize: 15 }}>{drawingLabel}</div>
          {contextParts.length > 0 && (
            <div style={{ fontSize: 12, color: '#888' }}>{contextParts.join(' · ')}</div>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #e8e6e0', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13 }}>
              Loading…
            </div>
          ) : drawing ? (
            <DrawingBoard key={drawing.id} drawing={drawing} />
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>
              Drawing not found
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
