import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

const STATUS_STYLE = {
  Open:      { bg: '#f5f4f0', color: '#666' },
  Published: { bg: '#e6f0fb', color: '#1a5fa8' },
  Accepted:  { bg: '#e1f5ee', color: '#0a5a3c' },
}

const ITEM_COL_W = 220
const QUOTE_COL_W = 190

export default function QuoteMatrix({ leadId, leadNumber, onClose }) {
  const { user } = useAuth()
  const [jobItems,   setJobItems]   = useState([])
  const [drawings,   setDrawings]   = useState([])
  const [quotes,     setQuotes]     = useState([])
  const [selections, setSelections] = useState({}) // `${quoteId}_${jobItemId}` → drawingId
  const [loading,    setLoading]    = useState(true)
  const [creating,   setCreating]   = useState(false)

  useEffect(() => { load() }, [leadId])

  async function load() {
    setLoading(true)

    // Job items
    const { data: items } = await supabase
      .from('job_items')
      .select('*')
      .eq('lead_id', leadId)
      .order('item_number')

    // Drawings for those items
    const itemIds = (items || []).map(i => i.id)
    let dwgs = []
    if (itemIds.length > 0) {
      const { data } = await supabase
        .from('drawings')
        .select('*')
        .in('job_item_id', itemIds)
        .order('drawing_number')
      dwgs = data || []
    }

    // Quotes for this lead
    const { data: qts } = await supabase
      .from('quotes')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at')

    // Quote-drawing selections — requires UNIQUE (quote_id, job_item_id) on quote_drawings
    const quoteIds = (qts || []).map(q => q.id)
    const qdMap = {}
    if (quoteIds.length > 0) {
      const { data: qds, error: qdErr } = await supabase
        .from('quote_drawings')
        .select('quote_id, job_item_id, drawing_id')
        .in('quote_id', quoteIds)
      if (qdErr) {
        console.error('Failed to load quote_drawings:', qdErr)
      } else {
        for (const qd of (qds || [])) {
          qdMap[`${qd.quote_id}_${qd.job_item_id}`] = qd.drawing_id
        }
      }
    }

    setJobItems(items || [])
    setDrawings(dwgs)
    setQuotes(qts || [])
    setSelections(qdMap)
    setLoading(false)
  }

  async function handleCellChange(quoteId, jobItemId, drawingId) {
    const key = `${quoteId}_${jobItemId}`

    if (!drawingId) {
      // "Not included" — remove the row
      const { error } = await supabase
        .from('quote_drawings')
        .delete()
        .eq('quote_id', quoteId)
        .eq('job_item_id', jobItemId)
      if (error) {
        console.error('Failed to remove quote_drawing:', error)
        return
      }
      setSelections(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    } else {
      // Drawing selected — upsert; requires UNIQUE (quote_id, job_item_id) on quote_drawings
      const { error } = await supabase
        .from('quote_drawings')
        .upsert(
          { quote_id: quoteId, job_item_id: jobItemId, drawing_id: drawingId },
          { onConflict: 'quote_id,job_item_id' }
        )
      if (error) {
        console.error('Failed to save quote_drawing:', error)
        return
      }
      setSelections(prev => ({ ...prev, [key]: drawingId }))
    }
  }

  async function createQuote() {
    setCreating(true)
    const nextNum = quotes.length + 1
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: newQuote, error } = await supabase
      .from('quotes')
      .insert({
        lead_id:        leadId,
        quote_number:   `Q${nextNum}`,
        status:         'Open',
        salesperson_id: user?.id ?? null,
        valid_until:    validUntil,
        created_at:     new Date().toISOString(),
      })
      .select()
      .single()
    if (!error && newQuote) setQuotes(prev => [...prev, newQuote])
    setCreating(false)
  }

  async function publishQuote(quoteId) {
    const { error } = await supabase
      .from('quotes')
      .update({ status: 'Published' })
      .eq('id', quoteId)
    if (!error) {
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: 'Published' } : q))
    }
  }

  function getQuoteTotal(quoteId) {
    return jobItems.reduce((sum, item) => {
      const drawingId = selections[`${quoteId}_${item.id}`]
      if (!drawingId) return sum
      const dwg = drawings.find(d => d.id === drawingId)
      return sum + (parseFloat(dwg?.calculated_price) || 0)
    }, 0)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'stretch' }}>

      {/* Backdrop */}
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.35)', cursor: 'pointer' }} />

      {/* Drawer */}
      <div style={{ width: '90%', display: 'flex', flexDirection: 'column', background: '#f7f6f2', borderLeft: '1px solid #e8e6e0', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', height: 56, borderBottom: '1px solid #e8e6e0', background: '#fff', flexShrink: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Quote Matrix</div>
          {leadNumber && (
            <div style={{ fontSize: 12, color: '#aaa', fontWeight: 500 }}>{leadNumber}</div>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={createQuote}
            disabled={creating}
            style={{
              fontSize: 12, padding: '6px 14px', border: 'none', borderRadius: 7,
              background: '#3d35a8', color: '#fff', fontWeight: 500,
              cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1,
            }}
          >
            {creating ? 'Creating…' : '+ New Quote'}
          </button>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #e8e6e0', background: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 13 }}>
              Loading…
            </div>
          ) : jobItems.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>
              No items on this lead yet. Add items from the Quotes tab first.
            </div>
          ) : (
            <table style={{
              borderCollapse: 'separate', borderSpacing: 0,
              minWidth: ITEM_COL_W + Math.max(quotes.length, 1) * QUOTE_COL_W,
              width: '100%',
            }}>
              <thead>
                <tr>
                  {/* Item column header */}
                  <th style={{
                    position: 'sticky', left: 0, zIndex: 3,
                    width: ITEM_COL_W, minWidth: ITEM_COL_W,
                    padding: '10px 14px', textAlign: 'left',
                    background: '#fff',
                    borderBottom: '2px solid #e8e6e0',
                    borderRight: '1px solid #e8e6e0',
                    fontSize: 11, fontWeight: 700, color: '#555',
                    textTransform: 'uppercase', letterSpacing: '.06em',
                  }}>
                    Item
                  </th>

                  {/* Quote column headers */}
                  {quotes.map(q => {
                    const ss = STATUS_STYLE[q.status] || STATUS_STYLE.Open
                    return (
                      <th key={q.id} style={{
                        width: QUOTE_COL_W, minWidth: QUOTE_COL_W,
                        padding: '10px 14px', textAlign: 'center',
                        background: '#3d35a8',
                        borderBottom: '2px solid #2d268a',
                        borderLeft: '1px solid #2d268a',
                      }}>
                        <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                          {q.quote_number}
                        </div>
                        <span style={{
                          fontSize: 10, padding: '1px 8px', borderRadius: 999,
                          fontWeight: 600, background: ss.bg, color: ss.color,
                          display: 'inline-block',
                        }}>
                          {q.status}
                        </span>
                      </th>
                    )
                  })}

                  {/* Placeholder column when no quotes exist */}
                  {quotes.length === 0 && (
                    <th style={{
                      padding: '10px 14px', background: '#f5f4f0',
                      borderBottom: '2px solid #e8e6e0', borderLeft: '1px solid #e8e6e0',
                      color: '#bbb', fontSize: 12, fontStyle: 'italic', fontWeight: 400,
                      textAlign: 'center',
                    }}>
                      No quotes yet — click "+ New Quote"
                    </th>
                  )}
                </tr>
              </thead>

              <tbody>
                {jobItems.map((item, rowIdx) => {
                  const itemDrawings = drawings.filter(d => d.job_item_id === item.id)
                  const rowBg = rowIdx % 2 === 0 ? '#fff' : '#faf9f7'
                  return (
                    <tr key={item.id}>
                      {/* Item info cell */}
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 1, background: rowBg,
                        padding: '10px 14px',
                        borderBottom: '1px solid #ede9e2',
                        borderRight: '1px solid #e8e6e0',
                        verticalAlign: 'middle',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                            background: '#f0eefc', color: '#3d35a8',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700,
                          }}>
                            {item.item_number}
                          </div>
                          <div>
                            {item.room_name && (
                              <div style={{ fontSize: 12, fontWeight: 500, color: '#222' }}>{item.room_name}</div>
                            )}
                            <div style={{ fontSize: 11, color: '#888' }}>
                              {[item.floor_level, item.elevation].filter(Boolean).join(' · ') || 'No location set'}
                            </div>
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
                            padding: '8px 10px',
                            background: rowBg,
                            borderBottom: '1px solid #ede9e2',
                            borderLeft: '1px solid #e8e6e0',
                            verticalAlign: 'middle', textAlign: 'center',
                          }}>
                            {itemDrawings.length === 0 ? (
                              <span style={{ fontSize: 11, color: '#ccc', fontStyle: 'italic' }}>No drawings</span>
                            ) : (
                              <select
                                value={selectedId}
                                onChange={e => handleCellChange(q.id, item.id, e.target.value || null)}
                                style={{
                                  width: '100%', padding: '5px 8px', fontSize: 11,
                                  border: '1px solid',
                                  borderColor: hasSelection ? '#3d35a8' : '#d8d5cf',
                                  borderRadius: 6, outline: 'none',
                                  background: hasSelection ? '#f0eefc' : '#fff',
                                  color: hasSelection ? '#3d35a8' : '#888',
                                  cursor: 'pointer',
                                }}
                              >
                                <option value="">Not included</option>
                                {itemDrawings.map(dwg => (
                                  <option key={dwg.id} value={dwg.id}>
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

              {/* Footer: totals + action buttons */}
              {quotes.length > 0 && (
                <tfoot>
                  {/* Total row */}
                  <tr>
                    <td style={{
                      position: 'sticky', left: 0, zIndex: 1,
                      background: '#f5f4f0',
                      padding: '10px 14px',
                      borderTop: '2px solid #e8e6e0', borderRight: '1px solid #e8e6e0',
                      fontSize: 11, fontWeight: 700, color: '#555',
                      textTransform: 'uppercase', letterSpacing: '.05em',
                    }}>
                      Total
                    </td>
                    {quotes.map(q => {
                      const total = getQuoteTotal(q.id)
                      return (
                        <td key={q.id} style={{
                          padding: '10px 14px', background: '#f5f4f0',
                          borderTop: '2px solid #e8e6e0', borderLeft: '1px solid #e8e6e0',
                          textAlign: 'center',
                          fontWeight: 700, fontSize: 14,
                          color: total > 0 ? '#1a5a1a' : '#bbb',
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
                      background: '#f5f4f0',
                      borderRight: '1px solid #e8e6e0',
                      borderBottom: '1px solid #e8e6e0',
                    }} />
                    {quotes.map(q => (
                      <td key={q.id} style={{
                        padding: '8px 10px', background: '#f5f4f0',
                        borderLeft: '1px solid #e8e6e0',
                        borderBottom: '1px solid #e8e6e0',
                        textAlign: 'center',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                          {q.status === 'Open' && (
                            <button
                              onClick={() => publishQuote(q.id)}
                              style={{
                                fontSize: 11, padding: '5px 0', width: 120,
                                border: 'none', borderRadius: 5,
                                background: '#3d35a8', color: '#fff',
                                cursor: 'pointer', fontWeight: 600,
                              }}
                            >
                              Publish
                            </button>
                          )}
                          <button
                            onClick={() => alert('Quote PDF coming soon')}
                            style={{
                              fontSize: 11, padding: '5px 0', width: 120,
                              border: '1px solid #d8d5cf', borderRadius: 5,
                              background: '#fff', color: '#555',
                              cursor: 'pointer', fontWeight: 500,
                            }}
                          >
                            Open Quote
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

      </div>
    </div>
  )
}
