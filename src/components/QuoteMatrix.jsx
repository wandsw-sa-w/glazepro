import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import QuoteDrawer from './QuoteDrawer'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  Open:      { bg: '#f5f4f0', color: '#666' },
  Published: { bg: '#e6f0fb', color: '#1a5fa8' },
  Accepted:  { bg: '#e1f5ee', color: '#0a5a3c' },
}

const ITEM_COL_W = 250
const QUOTE_COL_W = 200

// ── Main component ────────────────────────────────────────────────────────────

export default function QuoteMatrix({ leadId, leadNumber, onClose }) {
  const { user } = useAuth()

  // Data
  const [jobItems,   setJobItems]   = useState([])
  const [drawings,   setDrawings]   = useState([])
  const [quotes,     setQuotes]     = useState([])
  const [selections, setSelections] = useState({}) // `${quoteId}_${jobItemId}` → drawingId
  const [loading,    setLoading]    = useState(true)
  const [creating,   setCreating]   = useState(false)

  // Sidebar
  const [focusedQuoteId,  setFocusedQuoteId]  = useState(null)
  const [sidebarDraft,    setSidebarDraft]    = useState(null)
  const [salespersonName, setSalespersonName] = useState('')
  const sidebarSaveRef = useRef(null)

  // Drawing drawer
  const [selectedDrawingId,  setSelectedDrawingId]  = useState(null)
  const [selectedJobItemId,  setSelectedJobItemId]  = useState(null)

  useEffect(() => { load() }, [leadId])

  // ── Data loading ────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true)

    const { data: items } = await supabase
      .from('job_items').select('*').eq('lead_id', leadId).order('item_number')

    const itemIds = (items || []).map(i => i.id)
    let dwgs = []
    if (itemIds.length > 0) {
      const { data } = await supabase
        .from('drawings').select('*').in('job_item_id', itemIds).order('drawing_number')
      dwgs = data || []
    }

    const { data: qts } = await supabase
      .from('quotes').select('*').eq('lead_id', leadId).order('created_at')

    // Quote-drawing selections — requires UNIQUE (quote_id, job_item_id) on quote_drawings
    const quoteIds = (qts || []).map(q => q.id)
    const qdMap = {}
    if (quoteIds.length > 0) {
      const { data: qds, error: qdErr } = await supabase
        .from('quote_drawings')
        .select('quote_id, job_item_id, drawing_id')
        .in('quote_id', quoteIds)
      if (qdErr) console.error('Failed to load quote_drawings:', qdErr)
      else for (const qd of (qds || [])) {
        qdMap[`${qd.quote_id}_${qd.job_item_id}`] = qd.drawing_id
      }
    }

    setJobItems(items || [])
    setDrawings(dwgs)
    setQuotes(qts || [])
    setSelections(qdMap)

    const first = (qts || [])[0]
    if (first) focusQuote(first)

    setLoading(false)
  }

  // ── Cell selection ──────────────────────────────────────────────────────────

  async function handleCellChange(quoteId, jobItemId, drawingId) {
    const key = `${quoteId}_${jobItemId}`
    if (!drawingId) {
      const { error } = await supabase
        .from('quote_drawings').delete()
        .eq('quote_id', quoteId).eq('job_item_id', jobItemId)
      if (error) { console.error('Failed to remove quote_drawing:', error); return }
      setSelections(prev => { const n = { ...prev }; delete n[key]; return n })
    } else {
      const { error } = await supabase
        .from('quote_drawings')
        .upsert({ quote_id: quoteId, job_item_id: jobItemId, drawing_id: drawingId }, { onConflict: 'quote_id,job_item_id' })
      if (error) { console.error('Failed to save quote_drawing:', error); return }
      setSelections(prev => ({ ...prev, [key]: drawingId }))
    }
  }

  // ── Quote actions ───────────────────────────────────────────────────────────

  async function createQuote() {
    setCreating(true)
    const nextNum = quotes.length + 1
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: newQuote, error } = await supabase
      .from('quotes')
      .insert({ lead_id: leadId, quote_number: `Q${nextNum}`, status: 'Open', salesperson_id: user?.id ?? null, valid_until: validUntil, created_at: new Date().toISOString() })
      .select().single()
    if (!error && newQuote) {
      setQuotes(prev => [...prev, newQuote])
      focusQuote(newQuote)
    }
    setCreating(false)
  }

  async function publishQuote(quoteId) {
    const { error } = await supabase.from('quotes').update({ status: 'Published' }).eq('id', quoteId)
    if (!error) setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: 'Published' } : q))
  }

  function getQuoteTotal(quoteId) {
    return jobItems.reduce((sum, item) => {
      const dwg = drawings.find(d => d.id === selections[`${quoteId}_${item.id}`])
      return sum + (parseFloat(dwg?.calculated_price) || 0)
    }, 0)
  }

  // ── Sidebar ─────────────────────────────────────────────────────────────────

  function focusQuote(q) {
    setFocusedQuoteId(q.id)
    setSidebarDraft({
      discount:    q.discount    ?? '',
      notes:       q.notes       ?? '',
      valid_until: q.valid_until ?? '',
    })
  }

  // Fetch salesperson name whenever the focused quote changes
  useEffect(() => {
    const q = quotes.find(q => q.id === focusedQuoteId)
    if (!q?.salesperson_id) { setSalespersonName(''); return }
    let cancelled = false
    supabase.from('users').select('full_name').eq('id', q.salesperson_id).single()
      .then(({ data }) => {
        if (cancelled) return
        if (data?.full_name) setSalespersonName(data.full_name)
        else if (user?.id === q.salesperson_id && user?.email) setSalespersonName(user.email)
        else setSalespersonName('Unknown')
      })
    return () => { cancelled = true }
  }, [focusedQuoteId, quotes])

  function openDrawing(jobItemId, drawingId) {
    setSelectedJobItemId(jobItemId)
    setSelectedDrawingId(drawingId)
  }

  function updateSidebarField(field, value) {
    const fqId = focusedQuoteId
    setSidebarDraft(prev => {
      const next = { ...prev, [field]: value }
      if (sidebarSaveRef.current) clearTimeout(sidebarSaveRef.current)
      sidebarSaveRef.current = setTimeout(async () => {
        if (!fqId) return
        const { error } = await supabase.from('quotes').update({ [field]: value || null }).eq('id', fqId)
        if (error) console.error('Failed to save quote field:', error)
        else setQuotes(qs => qs.map(q => q.id === fqId ? { ...q, [field]: value } : q))
      }, 600)
      return next
    })
  }

  const focusedQuote = quotes.find(q => q.id === focusedQuoteId) ?? null

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'stretch' }}>

      {/* Backdrop */}
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.5)', cursor: 'pointer' }} />

      {/* Drawer */}
      <div style={{ width: '90%', display: 'flex', flexDirection: 'column', background: '#f8f8fc', boxShadow: '-6px 0 32px rgba(0,0,0,0.18)' }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 20px', height: 56, flexShrink: 0,
          background: '#1a1a2e',
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '.01em' }}>
            Quote Matrix
            {leadNumber && <span style={{ fontWeight: 400, color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>— {leadNumber}</span>}
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={createQuote}
            disabled={creating}
            style={{
              fontSize: 12, padding: '6px 16px', border: 'none', borderRadius: 7,
              background: '#3d35a8', color: '#fff', fontWeight: 600,
              cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1,
              letterSpacing: '.01em',
            }}
          >
            {creating ? 'Creating…' : '+ New Quote'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 7, background: 'rgba(255,255,255,0.1)', cursor: 'pointer',
              fontSize: 13, fontWeight: 500, color: '#fff', flexShrink: 0,
              letterSpacing: '.01em',
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* ── Table area ── */}
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 0 20px 20px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#aaa', fontSize: 13 }}>
                Loading…
              </div>
            ) : jobItems.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#bbb', fontSize: 14 }}>
                No items yet — add items from the Quotes tab first.
              </div>
            ) : (
              <table style={{
                borderCollapse: 'separate', borderSpacing: 0,
                minWidth: ITEM_COL_W + Math.max(quotes.length, 1) * QUOTE_COL_W,
                borderRadius: 10, overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              }}>

                {/* ── Table head ── */}
                <thead>
                  <tr>
                    {/* Item column header */}
                    <th style={{
                      position: 'sticky', left: 0, zIndex: 3,
                      width: ITEM_COL_W, minWidth: ITEM_COL_W,
                      padding: '12px 16px', textAlign: 'left',
                      background: '#3d35a8',
                      borderBottom: '1px solid #2d268a',
                      fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                      textTransform: 'uppercase', letterSpacing: '.08em',
                    }}>
                      Item
                    </th>

                    {/* Quote column headers */}
                    {quotes.map(q => {
                      const isFocused = q.id === focusedQuoteId
                      return (
                        <th
                          key={q.id}
                          onClick={() => focusQuote(q)}
                          style={{
                            width: QUOTE_COL_W, minWidth: QUOTE_COL_W,
                            padding: '10px 14px', textAlign: 'center',
                            background: isFocused ? '#2d268a' : '#3d35a8',
                            borderBottom: '1px solid #2d268a',
                            borderLeft: '1px solid #2d268a',
                            cursor: 'pointer', userSelect: 'none',
                            transition: 'background .15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{q.quote_number}</span>
                            {/* Pencil icon */}
                            <span style={{ fontSize: 12, opacity: 0.55, color: '#fff' }}>✎</span>
                          </div>
                          <div style={{ marginTop: 5 }}>
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                              background: 'rgba(255,255,255,0.18)', color: '#fff',
                              display: 'inline-block',
                            }}>
                              {q.status}
                            </span>
                          </div>
                        </th>
                      )
                    })}

                    {/* Placeholder when no quotes */}
                    {quotes.length === 0 && (
                      <th style={{
                        padding: '12px 16px', background: '#3d35a8',
                        borderLeft: '1px solid #2d268a',
                        color: 'rgba(255,255,255,0.4)', fontSize: 12,
                        fontStyle: 'italic', fontWeight: 400, textAlign: 'center',
                      }}>
                        No quotes yet — click "+ New Quote"
                      </th>
                    )}
                  </tr>
                </thead>

                {/* ── Table body ── */}
                <tbody>
                  {jobItems.map((item, rowIdx) => {
                    const itemDrawings = drawings.filter(d => d.job_item_id === item.id)
                    const rowBg = rowIdx % 2 === 0 ? '#fff' : '#f8f8fc'
                    return (
                      <tr key={item.id}>

                        {/* Item info cell */}
                        <td style={{
                          position: 'sticky', left: 0, zIndex: 1, background: rowBg,
                          padding: '10px 16px',
                          borderBottom: '1px solid #ecebf5',
                          borderRight: '1px solid #e0def0',
                          verticalAlign: 'top',
                          boxShadow: '2px 0 4px rgba(61,53,168,0.04)',
                        }}>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <div style={{
                              width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                              background: '#ede9fc', color: '#3d35a8',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700,
                            }}>
                              {item.item_number}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {item.room_name && (
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', marginBottom: 1 }}>
                                  {item.room_name}
                                </div>
                              )}
                              <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>
                                {[item.floor_level, item.elevation].filter(Boolean).join(' · ') || 'No location set'}
                              </div>
                              {/* Drawing badges — clickable to open drawer */}
                              {itemDrawings.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {itemDrawings.slice(0, 4).map(dwg => (
                                    <button
                                      key={dwg.id}
                                      onClick={() => openDrawing(item.id, dwg.id)}
                                      style={{
                                        fontSize: 10, padding: '1px 6px', borderRadius: 4,
                                        background: '#f0eefc', color: '#5448c8', fontWeight: 500,
                                        border: '1px solid #dcd9f5', cursor: 'pointer',
                                        lineHeight: 1.6,
                                      }}
                                    >
                                      {item.item_number}.{dwg.drawing_number}
                                    </button>
                                  ))}
                                  {itemDrawings.length > 4 && (
                                    <span style={{ fontSize: 10, color: '#aaa', padding: '1px 4px' }}>
                                      +{itemDrawings.length - 4}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Quote cells */}
                        {quotes.map(q => {
                          const key = `${q.id}_${item.id}`
                          const selectedId = selections[key] || ''
                          const hasSelection = Boolean(selectedId)
                          return (
                            <td key={q.id} style={{
                              padding: '10px 12px',
                              background: rowBg,
                              borderBottom: '1px solid #ecebf5',
                              borderLeft: '1px solid #e0def0',
                              verticalAlign: 'middle', textAlign: 'center',
                            }}>
                              {itemDrawings.length === 0 ? (
                                <span style={{ fontSize: 11, color: '#ccc', fontStyle: 'italic' }}>No drawings</span>
                              ) : (
                                <select
                                  value={selectedId}
                                  onChange={e => handleCellChange(q.id, item.id, e.target.value || null)}
                                  style={{
                                    width: '100%', padding: '6px 8px', fontSize: 11,
                                    border: '1px solid',
                                    borderColor: hasSelection ? '#a09be8' : '#dddaf0',
                                    borderRadius: 6, outline: 'none',
                                    background: hasSelection ? '#f0eefc' : '#fff',
                                    color: hasSelection ? '#3d35a8' : '#aaa',
                                    fontStyle: hasSelection ? 'normal' : 'italic',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <option value="">Not included</option>
                                  {itemDrawings.map(dwg => (
                                    <option key={dwg.id} value={dwg.id} style={{ fontStyle: 'normal', color: '#222' }}>
                                      {`Drawing ${item.item_number}.${dwg.drawing_number}`}
                                      {dwg.window_type ? ` — ${dwg.window_type}` : ''}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>

                {/* ── Footer ── */}
                {quotes.length > 0 && (
                  <tfoot>

                    {/* Totals row */}
                    <tr>
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 1,
                        background: '#f0eefc',
                        padding: '10px 16px',
                        borderTop: '2px solid #dcd9f5',
                        borderRight: '1px solid #e0def0',
                        fontSize: 11, fontWeight: 700, color: '#3d35a8',
                        textTransform: 'uppercase', letterSpacing: '.06em',
                      }}>
                        Total (excl. VAT)
                      </td>
                      {quotes.map(q => {
                        const total = getQuoteTotal(q.id)
                        return (
                          <td key={q.id} style={{
                            padding: '10px 14px', background: '#f0eefc',
                            borderTop: '2px solid #dcd9f5', borderLeft: '1px solid #e0def0',
                            textAlign: 'center', fontWeight: 700, fontSize: 15,
                            color: total > 0 ? '#1a5a1a' : '#c0bcec',
                          }}>
                            {total > 0
                              ? `£${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '—'
                            }
                          </td>
                        )
                      })}
                    </tr>

                    {/* Actions row */}
                    <tr>
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 1,
                        background: '#f0eefc',
                        borderRight: '1px solid #e0def0',
                        borderBottom: '1px solid #dcd9f5',
                        padding: '8px 16px',
                      }} />
                      {quotes.map(q => (
                        <td key={q.id} style={{
                          padding: '8px 12px', background: '#f0eefc',
                          borderLeft: '1px solid #e0def0',
                          borderBottom: '1px solid #dcd9f5',
                          textAlign: 'center',
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                            {q.status === 'Open' && (
                              <button
                                onClick={() => publishQuote(q.id)}
                                style={{
                                  fontSize: 11, padding: '5px 0', width: 130,
                                  border: 'none', borderRadius: 6,
                                  background: '#3d35a8', color: '#fff',
                                  cursor: 'pointer', fontWeight: 600, letterSpacing: '.02em',
                                }}
                              >
                                Publish
                              </button>
                            )}
                            <button
                              onClick={() => alert('Quote PDF coming soon')}
                              style={{
                                fontSize: 11, padding: '5px 0', width: 130,
                                border: '1px solid #dcd9f5', borderRadius: 6,
                                background: '#fff', color: '#aaa',
                                cursor: 'not-allowed', fontWeight: 500,
                              }}
                            >
                              PDF (coming soon)
                            </button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>

          {/* ── Right Sidebar ── */}
          <div style={{
            width: 300, flexShrink: 0, borderLeft: '1px solid #e0def0',
            background: '#fff', overflowY: 'auto', padding: 20,
            display: 'flex', flexDirection: 'column', gap: 0,
          }}>
            {!focusedQuote ? (
              <div style={{ color: '#bbb', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                Select a quote column to view details
              </div>
            ) : (
              <>
                {/* Quote identity */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-.01em' }}>
                      {focusedQuote.quote_number}
                    </div>
                    <span style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 600,
                      background: (STATUS_STYLE[focusedQuote.status] || STATUS_STYLE.Open).bg,
                      color:      (STATUS_STYLE[focusedQuote.status] || STATUS_STYLE.Open).color,
                    }}>
                      {focusedQuote.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>
                    Created {new Date(focusedQuote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  {salespersonName && (
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {salespersonName}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #f0eef8', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Valid until */}
                  <SidebarField label="Valid Until">
                    <input
                      type="date"
                      value={sidebarDraft?.valid_until || ''}
                      onChange={e => updateSidebarField('valid_until', e.target.value)}
                      style={sidebarInputStyle}
                    />
                  </SidebarField>

                  {/* Discount */}
                  <SidebarField label="Discount">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        min={0} max={100} step={0.5}
                        value={sidebarDraft?.discount || ''}
                        onChange={e => updateSidebarField('discount', e.target.value)}
                        placeholder="0"
                        style={{ ...sidebarInputStyle, width: 72 }}
                      />
                      <span style={{ fontSize: 13, color: '#888' }}>%</span>
                    </div>
                  </SidebarField>

                  {/* Notes */}
                  <SidebarField label="Notes">
                    <textarea
                      value={sidebarDraft?.notes || ''}
                      onChange={e => updateSidebarField('notes', e.target.value)}
                      rows={5}
                      placeholder="Add quote notes…"
                      style={{ ...sidebarInputStyle, resize: 'vertical', lineHeight: 1.5 }}
                    />
                  </SidebarField>

                </div>

                {/* Quote total summary */}
                <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid #f0eef8' }}>
                  {(() => {
                    const total = getQuoteTotal(focusedQuote.id)
                    const discount = parseFloat(sidebarDraft?.discount) || 0
                    const discounted = total * (1 - discount / 100)
                    const vat = discounted * 0.2
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <SummaryLine label="Subtotal" value={total > 0 ? `£${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'} />
                        {discount > 0 && (
                          <SummaryLine label={`Discount (${discount}%)`} value={`−£${(total - discounted).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} dim />
                        )}
                        <SummaryLine label="VAT (20%)" value={total > 0 ? `£${vat.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'} dim />
                        <div style={{ borderTop: '1px solid #ede9fc', paddingTop: 8, marginTop: 2 }}>
                          <SummaryLine
                            label="Total (incl. VAT)"
                            value={total > 0 ? `£${(discounted + vat).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                            bold
                          />
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </div>

    {/* Drawing drawer — opens on top of the matrix (zIndex 1100) */}
    {selectedDrawingId && (
      <QuoteDrawer
        drawingId={selectedDrawingId}
        jobItemId={selectedJobItemId}
        leadNumber={leadNumber}
        onClose={() => { setSelectedDrawingId(null); setSelectedJobItemId(null) }}
      />
    )}
    </>
  )
}

// ── Sidebar helpers ───────────────────────────────────────────────────────────

const sidebarInputStyle = {
  width: '100%', padding: '7px 10px', fontSize: 12,
  border: '1px solid #e0def0', borderRadius: 7, outline: 'none',
  background: '#faf9fe', color: '#1a1a2e', boxSizing: 'border-box',
  fontFamily: 'inherit',
}

function SidebarField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function SummaryLine({ label, value, dim, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: 12, color: dim ? '#aaa' : '#666' }}>{label}</span>
      <span style={{ fontSize: bold ? 14 : 12, fontWeight: bold ? 700 : 500, color: bold ? '#1a1a2e' : dim ? '#aaa' : '#444' }}>
        {value}
      </span>
    </div>
  )
}
