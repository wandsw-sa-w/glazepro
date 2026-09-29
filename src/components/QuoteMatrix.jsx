import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import QuoteDrawer from './QuoteDrawer'
import { priceDrawing, priceQuote } from '../pricing/pricingEngine.js'
import { computeQuoteTotals } from '../quotes/quoteTotals.js'
import { validatePublish, isLocked, nextQuoteNumber } from '../quotes/publishValidation.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  Open:      { bg: '#f5f4f0', color: '#666' },
  Published: { bg: '#e6f0fb', color: '#1a5fa8' },
  Accepted:  { bg: '#e1f5ee', color: '#0a5a3c' },
}

const ITEM_COL_W  = 250
const QUOTE_COL_W = 220

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—'
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuoteMatrix({ leadId, leadNumber, onClose }) {
  const { user } = useAuth()

  // Data
  const [jobItems,   setJobItems]   = useState([])
  const [drawings,   setDrawings]   = useState([])
  const [quotes,     setQuotes]     = useState([])
  const [selections, setSelections] = useState({})   // `${quoteId}_${jobItemId}` → drawingId
  const [priceFiles, setPriceFiles] = useState([])   // all price_files rows
  const [latestRuns, setLatestRuns] = useState({})   // drawingId → {price_file_id, tree_hash, status}
  const [loading,    setLoading]    = useState(true)
  const [creating,   setCreating]   = useState(false)
  const [pricing,    setPricing]    = useState({})   // quoteId → { busy, error, progress }

  // Sidebar
  const [focusedQuoteId,  setFocusedQuoteId]  = useState(null)
  const [sidebarDraft,    setSidebarDraft]    = useState(null)
  const [salespersonName, setSalespersonName] = useState('')
  const sidebarSaveRef = useRef(null)

  // Drawing drawer
  const [selectedDrawingId, setSelectedDrawingId] = useState(null)
  const [selectedJobItemId, setSelectedJobItemId] = useState(null)

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
        .from('drawings')
        .select('id, job_item_id, drawing_number, calculated_price, window_type, poa, price_override, item_discount_pct, vat_rate')
        .in('job_item_id', itemIds)
        .order('drawing_number')
      dwgs = data || []
    }

    const { data: qts } = await supabase
      .from('quotes')
      .select('id, quote_number, status, lead_id, salesperson_id, valid_until, created_at, price_file_id, discount_pct, deposit_pct, interim_pct, valid_days')
      .eq('lead_id', leadId)
      .order('created_at')

    const { data: pfs } = await supabase
      .from('price_files')
      .select('id, name, status, is_current')
      .order('created_at', { ascending: false })

    // Quote-drawing selections
    const quoteIds = (qts || []).map(q => q.id)
    const qdMap = {}
    if (quoteIds.length > 0) {
      const { data: qds } = await supabase
        .from('quote_drawings')
        .select('quote_id, job_item_id, drawing_id')
        .in('quote_id', quoteIds)
      for (const qd of (qds || [])) {
        qdMap[`${qd.quote_id}_${qd.job_item_id}`] = qd.drawing_id
      }
    }

    // Latest completed pricing_run per drawing
    const drawingIds = (dwgs || []).map(d => d.id)
    const runsMap = {}
    if (drawingIds.length > 0) {
      const { data: runs } = await supabase
        .from('pricing_runs')
        .select('drawing_id, price_file_id, tree_hash, status, created_at')
        .in('drawing_id', drawingIds)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
      for (const run of (runs || [])) {
        if (!runsMap[run.drawing_id]) runsMap[run.drawing_id] = run
      }
    }

    setJobItems(items || [])
    setDrawings(dwgs)
    setQuotes(qts || [])
    setPriceFiles(pfs || [])
    setSelections(qdMap)
    setLatestRuns(runsMap)

    const first = (qts || [])[0]
    if (first) focusQuote(first)

    setLoading(false)
  }

  // ── Staleness ───────────────────────────────────────────────────────────────

  function isStale(quoteId, drawingId) {
    const q = quotes.find(q => q.id === quoteId)
    const run = latestRuns[drawingId]
    if (!run) return true                               // never priced
    if (q?.price_file_id && run.price_file_id !== q.price_file_id) return true  // different price file
    return false
  }

  // ── Cell selection ──────────────────────────────────────────────────────────

  async function handleCellChange(quoteId, jobItemId, drawingId) {
    const q = quotes.find(q => q.id === quoteId)
    if (q?.status !== 'Open') return

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
    const currentPf = priceFiles.find(p => p.is_current) || priceFiles.find(p => p.status === 'published')
    const { data: newQuote, error } = await supabase
      .from('quotes')
      .insert({
        lead_id:        leadId,
        quote_number:   `Q${nextNum}`,
        status:         'Open',
        salesperson_id: user?.id ?? null,
        valid_days:     30,
        discount_pct:   0,
        deposit_pct:    40,
        interim_pct:    50,
        price_file_id:  currentPf?.id ?? null,
        created_at:     new Date().toISOString(),
      })
      .select('id, quote_number, status, lead_id, salesperson_id, valid_until, created_at, price_file_id, discount_pct, deposit_pct, interim_pct, valid_days')
      .single()
    if (!error && newQuote) {
      setQuotes(prev => [...prev, newQuote])
      focusQuote(newQuote)
    }
    setCreating(false)
  }

  async function doPriceQuote(quoteId) {
    const q = quotes.find(q => q.id === quoteId)
    if (!q) return
    const priceFileId = q.price_file_id || undefined

    // Collect stale drawings for this quote
    const staleDrawingIds = jobItems
      .map(item => selections[`${quoteId}_${item.id}`])
      .filter(Boolean)
      .filter(dwgId => isStale(quoteId, dwgId))

    setPricing(prev => ({ ...prev, [quoteId]: { busy: true, error: null, progress: `Pricing ${staleDrawingIds.length} drawing(s)…` } }))

    const errors = []

    for (const drawingId of staleDrawingIds) {
      const res = await priceDrawing(drawingId, supabase, { priceFileId })
      if (!res.success) {
        errors.push(`Drawing ${drawingId}: ${res.error}`)
      } else {
        // Update local drawings state with new calculated_price
        setDrawings(prev => prev.map(d =>
          d.id === drawingId ? { ...d, calculated_price: res.calculatedPrice } : d
        ))
        // Mark run as fresh
        setLatestRuns(prev => ({
          ...prev,
          [drawingId]: { price_file_id: priceFileId || null, tree_hash: null, status: 'complete', created_at: new Date().toISOString() },
        }))
      }
    }

    // Run quote-level pass
    if (staleDrawingIds.length > 0 || errors.length === 0) {
      setPricing(prev => ({ ...prev, [quoteId]: { ...prev[quoteId], progress: 'Running quote-level pass…' } }))
      const qRes = await priceQuote(quoteId, supabase, { priceFileId })
      if (!qRes.success) errors.push(`Quote-level pass: ${qRes.error}`)
    }

    const errorMsg = errors.length > 0 ? errors.join('; ') : null
    setPricing(prev => ({ ...prev, [quoteId]: { busy: false, error: errorMsg, progress: null } }))
  }

  // ── Publish ─────────────────────────────────────────────────────────────────

  async function doPublishQuote(quoteId) {
    const q = quotes.find(q => q.id === quoteId)
    if (!q || q.status !== 'Open') return

    const validation = validatePublish(q, jobItems, drawings, selections, latestRuns)
    if (!validation.ok) {
      // Stale drawings — show error via pricing state
      setPricing(prev => ({
        ...prev,
        [quoteId]: { busy: false, error: validation.reason, progress: null },
      }))
      return
    }

    if (validation.poaItemIndices.length > 0) {
      const ok = window.confirm(
        `This quote contains ${validation.poaItemIndices.length} POA item(s). ` +
        `These will be excluded from the financial total.\n\nPublish anyway?`
      )
      if (!ok) return
    }

    // Build snapshot
    const totals = getSidebarTotals(quoteId)
    const selectedItems = jobItems.map(item => {
      const dwgId = selections[`${quoteId}_${item.id}`]
      if (!dwgId) return null
      const dwg = drawings.find(d => d.id === dwgId)
      const itemTotals = totals?.items?.[jobItems.indexOf(item)]
      return {
        job_item:  { id: item.id, item_number: item.item_number, floor_level: item.floor_level, elevation: item.elevation, room_name: item.room_name },
        drawing:   { id: dwg?.id, drawing_number: dwg?.drawing_number, window_type: dwg?.window_type },
        calculated_price:           dwg?.calculated_price ?? null,
        net:                        itemTotals?.net ?? null,
        net_after_quote_discount:   itemTotals?.netAfterQuoteDiscount ?? null,
        vat:                        itemTotals?.vat ?? null,
        vat_rate:                   dwg?.vat_rate ?? 20,
        poa:                        dwg?.poa ?? false,
      }
    }).filter(Boolean)

    const publishedAt = new Date().toISOString()
    const validUntil = q.valid_days
      ? new Date(Date.now() + q.valid_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null

    const snapshot = {
      published_at:    publishedAt,
      lead_number:     leadNumber,
      quote_number:    q.quote_number,
      quote_settings: {
        discount_pct: q.discount_pct,
        deposit_pct:  q.deposit_pct,
        interim_pct:  q.interim_pct,
        valid_days:   q.valid_days,
        price_file_id: q.price_file_id,
      },
      totals: totals ? {
        subtotal_before_discount: totals.subtotalBeforeDiscount,
        discount_amount:          totals.discountAmount,
        subtotal_after_discount:  totals.subtotalAfterDiscount,
        vat_by_rate:              totals.vatByRate,
        total_vat:                totals.totalVat,
        total_incl_vat:           totals.totalInclVat,
        stages:                   totals.stages,
      } : null,
      items: selectedItems,
    }

    const { error } = await supabase.from('quotes').update({
      status:       'Published',
      published_at: publishedAt,
      published_by: user?.id ?? null,
      valid_until:  validUntil,
      snapshot,
    }).eq('id', quoteId)

    if (error) {
      setPricing(prev => ({ ...prev, [quoteId]: { busy: false, error: `Publish failed: ${error.message}`, progress: null } }))
      return
    }

    setQuotes(prev => prev.map(q => q.id === quoteId
      ? { ...q, status: 'Published', published_at: publishedAt, published_by: user?.id, valid_until: validUntil, snapshot }
      : q
    ))

    // Record in lead_history (silently skip if table doesn't exist)
    try {
      await supabase.from('lead_history').insert({
        lead_id:    leadId,
        user_id:    user?.id ?? null,
        user_email: user?.email ?? null,
        event:      'Quote published',
        new_value:  `${leadNumber} / ${q.quote_number}`,
        created_at: new Date().toISOString(),
      })
    } catch { /* lead_history may not exist */ }
  }

  // ── Copy ────────────────────────────────────────────────────────────────────

  async function doCopyQuote(quoteId) {
    const q = quotes.find(q => q.id === quoteId)
    if (!q) return

    const newNum = nextQuoteNumber(quotes)
    const currentPf = priceFiles.find(p => p.is_current) || priceFiles.find(p => p.status === 'published')

    const { data: newQuote, error: qErr } = await supabase
      .from('quotes')
      .insert({
        lead_id:              leadId,
        quote_number:         newNum,
        status:               'Open',
        salesperson_id:       q.salesperson_id ?? null,
        valid_days:           q.valid_days ?? 30,
        discount_pct:         q.discount_pct ?? 0,
        deposit_pct:          q.deposit_pct ?? 40,
        interim_pct:          q.interim_pct ?? 50,
        price_file_id:        q.price_file_id ?? currentPf?.id ?? null,
        copied_from_quote_id: quoteId,
        created_at:           new Date().toISOString(),
      })
      .select('id, quote_number, status, lead_id, salesperson_id, valid_until, created_at, price_file_id, discount_pct, deposit_pct, interim_pct, valid_days')
      .single()

    if (qErr || !newQuote) {
      console.error('Failed to copy quote:', qErr)
      return
    }

    // Copy drawing selections
    const selRows = jobItems
      .map(item => {
        const dwgId = selections[`${quoteId}_${item.id}`]
        if (!dwgId) return null
        return { quote_id: newQuote.id, job_item_id: item.id, drawing_id: dwgId }
      })
      .filter(Boolean)

    if (selRows.length > 0) {
      const { error: selErr } = await supabase.from('quote_drawings').insert(selRows)
      if (selErr) console.error('Failed to copy quote_drawings:', selErr)
      else {
        const newSels = {}
        for (const row of selRows) {
          newSels[`${newQuote.id}_${row.job_item_id}`] = row.drawing_id
        }
        setSelections(prev => ({ ...prev, ...newSels }))
      }
    }

    setQuotes(prev => [...prev, newQuote])
    focusQuote(newQuote)

    // Record in lead_history
    try {
      await supabase.from('lead_history').insert({
        lead_id:    leadId,
        user_id:    user?.id ?? null,
        user_email: user?.email ?? null,
        event:      'Quote copied',
        old_value:  `${leadNumber} / ${q.quote_number}`,
        new_value:  `${leadNumber} / ${newNum}`,
        created_at: new Date().toISOString(),
      })
    } catch { /* lead_history may not exist */ }
  }

  // ── Accept ──────────────────────────────────────────────────────────────────

  async function doAcceptQuote(quoteId) {
    const acceptedAt = new Date().toISOString()
    const { error } = await supabase.from('quotes').update({
      status:      'Accepted',
      accepted_at: acceptedAt,
    }).eq('id', quoteId)

    if (error) { console.error('Failed to accept quote:', error); return }

    setQuotes(prev => prev.map(q => q.id === quoteId
      ? { ...q, status: 'Accepted', accepted_at: acceptedAt }
      : q
    ))

    // Record in lead_history
    try {
      const q = quotes.find(q => q.id === quoteId)
      await supabase.from('lead_history').insert({
        lead_id:    leadId,
        user_id:    user?.id ?? null,
        user_email: user?.email ?? null,
        event:      'Quote accepted',
        new_value:  `${leadNumber} / ${q?.quote_number}`,
        created_at: new Date().toISOString(),
      })
    } catch { /* lead_history may not exist */ }
  }

  // ── Sidebar ─────────────────────────────────────────────────────────────────

  function focusQuote(q) {
    setFocusedQuoteId(q.id)
    setSidebarDraft({
      price_file_id: q.price_file_id ?? '',
      discount_pct:  q.discount_pct  ?? 0,
      deposit_pct:   q.deposit_pct   ?? 40,
      interim_pct:   q.interim_pct   ?? 50,
      valid_days:    q.valid_days     ?? 30,
    })
  }

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

  function updateSidebarField(field, value) {
    const fqId = focusedQuoteId
    setSidebarDraft(prev => {
      const next = { ...prev, [field]: value }
      if (sidebarSaveRef.current) clearTimeout(sidebarSaveRef.current)
      sidebarSaveRef.current = setTimeout(async () => {
        if (!fqId) return
        const q = quotes.find(q => q.id === fqId)
        if (q?.status !== 'Open') return
        const dbVal = (field === 'discount_pct' || field === 'deposit_pct' || field === 'interim_pct' || field === 'valid_days')
          ? (parseFloat(value) || 0)
          : (value || null)
        const { error } = await supabase.from('quotes').update({ [field]: dbVal }).eq('id', fqId)
        if (error) console.error('Failed to save quote field:', error)
        else setQuotes(qs => qs.map(q => q.id === fqId ? { ...q, [field]: dbVal } : q))
      }, 600)
      return next
    })
  }

  // ── Totals for sidebar ──────────────────────────────────────────────────────

  function getItemsForTotals(quoteId) {
    const q = quotes.find(q => q.id === quoteId)
    return jobItems.map(item => {
      const dwgId = selections[`${quoteId}_${item.id}`]
      const dwg = dwgId ? drawings.find(d => d.id === dwgId) : null
      if (!dwg) return null
      return {
        calculated:      parseFloat(dwg.calculated_price) || 0,
        priceOverride:   dwg.price_override ?? null,
        itemDiscountPct: dwg.item_discount_pct ?? 0,
        vatRate:         dwg.vat_rate ?? 20,
        poa:             dwg.poa ?? false,
      }
    }).filter(Boolean)
  }

  function getSidebarTotals(quoteId) {
    const q = quotes.find(q => q.id === quoteId)
    if (!q) return null
    const items = getItemsForTotals(quoteId)
    if (items.length === 0) return null
    const draft = sidebarDraft ?? {}
    return computeQuoteTotals({
      discountPct: parseFloat(draft.discount_pct) || 0,
      depositPct:  parseFloat(draft.deposit_pct)  || 40,
      interimPct:  parseFloat(draft.interim_pct)  || 50,
    }, items)
  }

  function openDrawing(jobItemId, drawingId) {
    setSelectedJobItemId(jobItemId)
    setSelectedDrawingId(drawingId)
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

                    {quotes.map(q => {
                      const isFocused = q.id === focusedQuoteId
                      const pricingState = pricing[q.id]
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
                            <span style={{ fontSize: 12, opacity: 0.55, color: '#fff' }}>✎</span>
                          </div>
                          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                              background: 'rgba(255,255,255,0.18)', color: '#fff',
                              display: 'inline-block',
                            }}>
                              {q.status}
                            </span>
                            {q.status === 'Published' && <span title="Locked" style={{ fontSize: 13 }}>🔒</span>}
                          </div>
                          {pricingState?.progress && (
                            <div style={{ marginTop: 4, fontSize: 9, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic' }}>
                              {pricingState.progress}
                            </div>
                          )}
                        </th>
                      )
                    })}

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
                          const isLocked = q.status !== 'Open'
                          const dwg = hasSelection ? drawings.find(d => d.id === selectedId) : null
                          const stale = hasSelection && isStale(q.id, selectedId)
                          const showPrice = dwg?.poa ? 'POA' : dwg?.calculated_price != null ? fmt(dwg.calculated_price) : null

                          return (
                            <td key={q.id} style={{
                              padding: '10px 12px',
                              background: rowBg,
                              borderBottom: '1px solid #ecebf5',
                              borderLeft: '1px solid #e0def0',
                              verticalAlign: 'top', textAlign: 'center',
                            }}>
                              {itemDrawings.length === 0 ? (
                                <span style={{ fontSize: 11, color: '#ccc', fontStyle: 'italic' }}>No drawings</span>
                              ) : (
                                <>
                                  {isLocked ? (
                                    <div style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>
                                      {showPrice || '—'}
                                    </div>
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
                                  {hasSelection && (
                                    <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
                                      {dwg?.poa ? (
                                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontWeight: 600, border: '1px solid #fcd34d' }}>POA</span>
                                      ) : showPrice ? (
                                        <span style={{ fontSize: 11, fontWeight: 600, color: '#1a5a1a' }}>{showPrice}</span>
                                      ) : null}
                                      {stale && (
                                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: '#fffbeb', color: '#b45309', fontWeight: 700, border: '1px solid #fcd34d', whiteSpace: 'nowrap' }}>
                                          needs pricing
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </>
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
                        Total excl. VAT
                      </td>
                      {quotes.map(q => {
                        const totals = getSidebarTotals(q.id)
                        return (
                          <td key={q.id} style={{
                            padding: '10px 14px', background: '#f0eefc',
                            borderTop: '2px solid #dcd9f5', borderLeft: '1px solid #e0def0',
                            textAlign: 'center', fontWeight: 700, fontSize: 14,
                            color: totals ? '#1a5a1a' : '#c0bcec',
                          }}>
                            {totals ? fmt(totals.subtotalBeforeDiscount) : '—'}
                          </td>
                        )
                      })}
                    </tr>

                    <tr>
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 1,
                        background: '#f0eefc',
                        borderRight: '1px solid #e0def0',
                        borderBottom: '1px solid #dcd9f5',
                        padding: '8px 16px',
                      }} />
                      {quotes.map(q => {
                        const pricingState = pricing[q.id]
                        const isLocked = q.status !== 'Open'
                        const hasStaleCells = jobItems.some(item => {
                          const dwgId = selections[`${q.id}_${item.id}`]
                          return dwgId && isStale(q.id, dwgId)
                        })

                        return (
                          <td key={q.id} style={{
                            padding: '8px 12px', background: '#f0eefc',
                            borderLeft: '1px solid #e0def0',
                            borderBottom: '1px solid #dcd9f5',
                            textAlign: 'center',
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                              {!isLocked && (
                                <button
                                  onClick={() => doPriceQuote(q.id)}
                                  disabled={pricingState?.busy}
                                  style={{
                                    fontSize: 11, padding: '5px 0', width: 140,
                                    border: 'none', borderRadius: 6,
                                    background: pricingState?.busy ? '#c0bcec' : hasStaleCells ? '#b45309' : '#3d35a8',
                                    color: '#fff',
                                    cursor: pricingState?.busy ? 'not-allowed' : 'pointer',
                                    fontWeight: 600, letterSpacing: '.02em',
                                  }}
                                >
                                  {pricingState?.busy ? 'Pricing…' : hasStaleCells ? '⚠ Price quote' : 'Price quote'}
                                </button>
                              )}
                              {pricingState?.error && (
                                <div style={{ fontSize: 10, color: '#c00', maxWidth: 140, wordBreak: 'break-word' }}>
                                  {pricingState.error}
                                </div>
                              )}
                              <button
                                onClick={() => alert('Quote PDF coming soon')}
                                style={{
                                  fontSize: 11, padding: '5px 0', width: 140,
                                  border: '1px solid #dcd9f5', borderRadius: 6,
                                  background: '#fff', color: '#aaa',
                                  cursor: 'not-allowed', fontWeight: 500,
                                }}
                              >
                                PDF (coming soon)
                              </button>
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </div>

          {/* ── Right Sidebar ── */}
          <div style={{
            width: 320, flexShrink: 0, borderLeft: '1px solid #e0def0',
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
                      {leadNumber && `${leadNumber} / `}{focusedQuote.quote_number}
                    </div>
                    <span style={{
                      fontSize: 11, padding: '3px 10px', borderRadius: 999, fontWeight: 600,
                      background: (STATUS_STYLE[focusedQuote.status] || STATUS_STYLE.Open).bg,
                      color:      (STATUS_STYLE[focusedQuote.status] || STATUS_STYLE.Open).color,
                    }}>
                      {focusedQuote.status}
                    </span>
                    {focusedQuote.status !== 'Open' && <span style={{ fontSize: 16 }}>🔒</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>
                    Created {new Date(focusedQuote.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  {salespersonName && (
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{salespersonName}</div>
                  )}
                </div>

                {/* Settings (Open quotes only) */}
                {focusedQuote.status === 'Open' && (
                  <div style={{ borderTop: '1px solid #f0eef8', paddingTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Price file */}
                    <SidebarField label="Price File">
                      <select
                        value={sidebarDraft?.price_file_id || ''}
                        onChange={e => updateSidebarField('price_file_id', e.target.value || null)}
                        style={sidebarInputStyle}
                      >
                        <option value="">— None selected —</option>
                        {priceFiles.map(pf => (
                          <option key={pf.id} value={pf.id}>
                            {pf.name}{pf.is_current ? ' ★' : pf.status === 'published' ? ' ✓' : ''}
                          </option>
                        ))}
                      </select>
                    </SidebarField>

                    {/* Quote discount */}
                    <SidebarField label="Quote Discount">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number" min={0} max={100} step={0.5}
                          value={sidebarDraft?.discount_pct ?? ''}
                          onChange={e => updateSidebarField('discount_pct', e.target.value)}
                          placeholder="0"
                          style={{ ...sidebarInputStyle, width: 72 }}
                        />
                        <span style={{ fontSize: 13, color: '#888' }}>%</span>
                      </div>
                    </SidebarField>

                    {/* Payment stages */}
                    <SidebarField label="Payment Stages">
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {[
                          { key: 'deposit_pct',  label: 'Deposit' },
                          { key: 'interim_pct',  label: 'Interim' },
                        ].map(({ key, label }) => (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: 10, color: '#aaa' }}>{label}</span>
                            <input
                              type="number" min={0} max={100} step={1}
                              value={sidebarDraft?.[key] ?? ''}
                              onChange={e => updateSidebarField(key, e.target.value)}
                              style={{ ...sidebarInputStyle, width: 48, padding: '4px 6px', fontSize: 11 }}
                            />
                            <span style={{ fontSize: 10, color: '#aaa' }}>%</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          <span style={{ fontSize: 10, color: '#aaa' }}>Balance</span>
                          <span style={{ fontSize: 11, color: '#888', minWidth: 34, textAlign: 'right' }}>
                            {Math.max(0, 100 - (parseFloat(sidebarDraft?.deposit_pct) || 40) - (parseFloat(sidebarDraft?.interim_pct) || 50))}%
                          </span>
                        </div>
                      </div>
                    </SidebarField>

                    {/* Valid for */}
                    <SidebarField label="Valid For">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number" min={1} step={1}
                          value={sidebarDraft?.valid_days ?? 30}
                          onChange={e => updateSidebarField('valid_days', e.target.value)}
                          style={{ ...sidebarInputStyle, width: 60 }}
                        />
                        <span style={{ fontSize: 12, color: '#888' }}>days</span>
                      </div>
                    </SidebarField>

                    {/* Publish button */}
                    <button
                      onClick={() => doPublishQuote(focusedQuote.id)}
                      style={{
                        marginTop: 4, padding: '8px 0', width: '100%',
                        border: 'none', borderRadius: 8,
                        background: '#1a5fa8', color: '#fff',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '.02em',
                      }}
                    >
                      Publish Quote
                    </button>

                  </div>
                )}

                {/* Locked quote info */}
                {isLocked(focusedQuote) && (
                  <div style={{ borderTop: '1px solid #f0eef8', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {focusedQuote.published_at && (
                      <div style={{ fontSize: 12, color: '#555' }}>
                        Published {new Date(focusedQuote.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {salespersonName && ` by ${salespersonName.split(' ').map(p => p[0]).join('').toUpperCase()}`}
                      </div>
                    )}
                    {focusedQuote.valid_until && (
                      <div style={{ fontSize: 12, color: '#888' }}>
                        Valid until {new Date(focusedQuote.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {focusedQuote.status === 'Published' && (
                      <button
                        onClick={() => doAcceptQuote(focusedQuote.id)}
                        style={{
                          padding: '7px 0', width: '100%',
                          border: 'none', borderRadius: 8,
                          background: '#0a5a3c', color: '#fff',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        Mark as Accepted
                      </button>
                    )}
                  </div>
                )}

                {/* Copy button — available on any status */}
                <div style={{ paddingTop: 12 }}>
                  <button
                    onClick={() => doCopyQuote(focusedQuote.id)}
                    style={{
                      padding: '6px 0', width: '100%',
                      border: '1px solid #dcd9f5', borderRadius: 8,
                      background: '#f8f7fe', color: '#3d35a8',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Copy to New Quote
                  </button>
                </div>

                {/* Totals block */}
                {(() => {
                  const totals = getSidebarTotals(focusedQuote.id)
                  if (!totals) return (
                    <div style={{ marginTop: 20, fontSize: 12, color: '#ccc', textAlign: 'center', fontStyle: 'italic' }}>
                      Select drawings to see totals
                    </div>
                  )

                  const vatEntries = Object.entries(totals.vatByRate)
                  const discountPct = parseFloat(sidebarDraft?.discount_pct) || 0
                  const { deposit, interim, balance } = totals.stages

                  return (
                    <div style={{ marginTop: 20, borderTop: '2px solid #ede9fc', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <TotalsLine label="Sub Total Before Discount" value={fmt(totals.subtotalBeforeDiscount)} />
                      {discountPct > 0 && (
                        <TotalsLine label={`${discountPct}% Discount`} value={`−${fmt(totals.discountAmount)}`} dim />
                      )}
                      {discountPct > 0 && (
                        <TotalsLine label="Sub Total After Discount" value={fmt(totals.subtotalAfterDiscount)} />
                      )}
                      {vatEntries.map(([rate, amount]) => (
                        <TotalsLine key={rate} label={rate === '0' ? 'VAT (0%)' : `VAT @ ${rate}%`} value={fmt(amount)} dim />
                      ))}
                      <div style={{ borderTop: '1px solid #ede9fc', paddingTop: 8, marginTop: 4 }}>
                        <TotalsLine label="Total Order Value incl. VAT" value={fmt(totals.totalInclVat)} bold />
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, borderTop: '1px solid #f5f3ff', paddingTop: 8 }}>
                        <TotalsLine label="Deposit With Order" value={fmt(deposit)} dim />
                        <TotalsLine label="Interim" value={fmt(interim)} dim />
                        <TotalsLine label="Balance on Completion" value={fmt(balance)} dim />
                      </div>
                      {totals.poaItems.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 10, color: '#b45309', fontStyle: 'italic' }}>
                          {totals.poaItems.length} POA item{totals.poaItems.length > 1 ? 's' : ''} excluded from totals
                        </div>
                      )}
                    </div>
                  )
                })()}
              </>
            )}
          </div>

        </div>
      </div>
    </div>

    {/* Drawing drawer */}
    {selectedDrawingId && (
      <QuoteDrawer
        drawingId={selectedDrawingId}
        jobItemId={selectedJobItemId}
        leadNumber={leadNumber}
        onClose={() => {
          setSelectedDrawingId(null)
          setSelectedJobItemId(null)
          // Reload drawings in case pricing controls changed
          load()
        }}
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

function TotalsLine({ label, value, dim, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontSize: bold ? 12 : 11, color: dim ? '#aaa' : '#555' }}>{label}</span>
      <span style={{ fontSize: bold ? 14 : 12, fontWeight: bold ? 700 : 500, color: bold ? '#1a1a2e' : dim ? '#aaa' : '#333' }}>
        {value}
      </span>
    </div>
  )
}
