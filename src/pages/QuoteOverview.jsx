import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { loadDrawingParts, saveDrawingParts, loadReferenceOptions } from '../drawingBoard/api.js'
import { treeHash } from '../pricing/treeHash.js'
import { computeQuoteTotals } from '../quotes/quoteTotals.js'
import { GRID_COLUMNS, readColumnValue, writeColumnValue } from '../quotes/gridColumns.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—'
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_STYLE = {
  Open:      { bg: '#f5f4f0', color: '#666' },
  Published: { bg: '#e6f0fb', color: '#1a5fa8' },
  Accepted:  { bg: '#e1f5ee', color: '#0a5a3c' },
}

function mergeLetter(text, fields) {
  if (!text) return ''
  let out = text
  for (const [k, v] of Object.entries(fields)) {
    out = out.split(`[${k}]`).join(v || `[${k}]`)
  }
  return out
}

const FRONT_COVER_LETTER = `Dear [customer_forename],

I would like to thank you for your enquiry, and I have included below our quotation for the proposed works at [installation_full_address_one_line].

Wandsworth Sash Windows and Parsons Joinery are part of Branford Group Limited, a family-run business specialising in high-quality timber joinery.

At present, our lead time for the manufacture of new joinery is [nj_lead_time] weeks, though this may vary throughout the year.

[sales_person_full_name]
Branford Group Limited
Wandsworth Sash Windows & Parsons Joinery`

const BACK_COVER_LETTER = `Price Matching
We are dedicated to providing the best value for our customers.

Payment Terms
A 40% deposit is required to place your order. A further 50% is due 8 weeks after the order is placed, prior to installation and the 10% balance is due upon completion of the installation.

Lead Time
Our lead time for manufacture is currently [nj_lead_time] weeks.`

// ── Main component ────────────────────────────────────────────────────────────

export default function QuoteOverview({ leadId, quoteId, lead: leadStub }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [lead, setLead] = useState(leadStub || null)
  const [mainContact, setMainContact] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [quote, setQuote] = useState(null)
  const [jobItems, setJobItems] = useState([])
  const [drawings, setDrawings] = useState([])
  const [selections, setSelections] = useState({})
  const [priceFiles, setPriceFiles] = useState([])
  const [latestRuns, setLatestRuns] = useState({}) // drawingId -> {id, price_file_id, tree_hash, status}
  const [salespersonName, setSalespersonName] = useState('')
  const [loading, setLoading] = useState(true)
  const [refOptions, setRefOptions] = useState({})
  const [leadHistory, setLeadHistory] = useState([])
  const [costByDrawing, setCostByDrawing] = useState({})
  const [installHours, setInstallHours] = useState(null)
  const [quoteItemCounts, setQuoteItemCounts] = useState({}) // quoteId → count
  const [quoteApportionment, setQuoteApportionment] = useState({}) // drawingId → sales total from latest quote pricing run

  const [showDeleted, setShowDeleted] = useState(false)
  const [onSiteMode, setOnSiteMode] = useState(false)
  const [trees, setTrees] = useState({})       // drawingId -> tree (live, Open quotes only)
  const [dirtyDrawings, setDirtyDrawings] = useState({}) // drawingId -> true once edited, cleared after Update Drawings
  const [saving, setSaving] = useState(false)
  const [editDetailsOpen, setEditDetailsOpen] = useState(false)
  const [editPaymentsOpen, setEditPaymentsOpen] = useState(false)
  const [detailsDraft, setDetailsDraft] = useState(null)
  const [paymentsDraft, setPaymentsDraft] = useState(null)
  const [letterView, setLetterView] = useState(null) // 'front' | 'back' | null
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState(null)

  const isLive = quote?.status === 'Open'

  useEffect(() => { load() }, [leadId, quoteId])

  async function load() {
    setLoading(true)

    const { data: leadRow } = await supabase
      .from('leads')
      .select('*, lead_contacts(id, is_main_contact, contact_id, contacts(*))')
      .eq('id', leadId).single()
    if (leadRow) {
      setLead(leadRow)
      const mc = (leadRow.lead_contacts || []).find(lc => lc.is_main_contact) || (leadRow.lead_contacts || [])[0]
      setMainContact(mc?.contacts || null)
    }

    const { data: qts } = await supabase
      .from('quotes').select('*').eq('lead_id', leadId).order('created_at')
    setQuotes(qts || [])
    const q = (qts || []).find(q => String(q.id) === String(quoteId))
    setQuote(q || null)

    const { data: pfs } = await supabase.from('price_files').select('id, name, status, is_current').order('created_at', { ascending: false })
    setPriceFiles(pfs || [])

    // Load item counts for all quotes (used by chip labels)
    const allQuoteIds = (qts || []).map(q => q.id)
    if (allQuoteIds.length > 0) {
      const { data: allQds } = await supabase.from('quote_drawings').select('quote_id').in('quote_id', allQuoteIds)
      const counts = {}
      for (const row of (allQds || [])) counts[row.quote_id] = (counts[row.quote_id] || 0) + 1
      setQuoteItemCounts(counts)
    }

    if (q?.status === 'Open') {
      const { data: items } = await supabase.from('job_items').select('*').eq('lead_id', leadId).order('sort_order', { ascending: true, nullsFirst: false }).order('item_number')
      setJobItems(items || [])
      const itemIds = (items || []).map(i => i.id)
      let dwgs = []
      if (itemIds.length > 0) {
        const { data } = await supabase
          .from('drawings')
          .select('id, job_item_id, drawing_number, deleted_at, calculated_price, window_type, poa, price_override, item_discount_pct, vat_rate, notes_quote, notes_installation')
          .in('job_item_id', itemIds)
        dwgs = data || []
      }
      setDrawings(dwgs)

      const { data: qds } = await supabase.from('quote_drawings').select('quote_id, job_item_id, drawing_id').eq('quote_id', q.id)
      const selMap = {}
      for (const qd of (qds || [])) selMap[qd.job_item_id] = qd.drawing_id
      setSelections(selMap)

      const drawingIds = Object.values(selMap)
      if (drawingIds.length > 0) {
        const { data: runs } = await supabase
          .from('pricing_runs').select('id, drawing_id, price_file_id, tree_hash, status, created_at')
          .in('drawing_id', drawingIds).eq('status', 'complete').order('created_at', { ascending: false })
        const runsMap = {}
        for (const run of (runs || [])) { if (!runsMap[run.drawing_id]) runsMap[run.drawing_id] = run }
        setLatestRuns(runsMap)

        // Install hours + drawing-level cost from the latest runs
        const runIds = Object.values(runsMap).map(r => r.id)
        const costMap = {}   // drawing_id → total cost (drawing-level + quote apportioned)
        if (runIds.length > 0) {
          const { data: vars } = await supabase.from('drawing_pricing_variables').select('pricing_run_id, drawing_id, variables').in('pricing_run_id', runIds)
          let totalMinutes = 0
          for (const v of (vars || [])) totalMinutes += Number(v.variables?.total_install_minutes) || 0
          setInstallHours(totalMinutes / 60)

          const { data: ruleResults } = await supabase.from('drawing_rule_results').select('pricing_run_id, drawing_id, cost').in('pricing_run_id', runIds)
          for (const r of (ruleResults || [])) costMap[r.drawing_id] = (costMap[r.drawing_id] || 0) + (Number(r.cost) || 0)
        }

        // Load latest quote-level apportionment for this quote
        const { data: qprRow } = await supabase
          .from('quote_pricing_runs')
          .select('id')
          .eq('quote_id', q.id)
          .eq('status', 'complete')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (qprRow) {
          const { data: apRows } = await supabase
            .from('quote_item_apportionment')
            .select('drawing_id, cost, sales')
            .eq('quote_pricing_run_id', qprRow.id)
          const apSalesMap = {}
          for (const r of (apRows || [])) {
            const key = String(r.drawing_id)
            apSalesMap[key] = (apSalesMap[key] || 0) + (Number(r.sales) || 0)
            // Add quote-level apportioned cost to the drawing-level cost
            costMap[r.drawing_id] = (costMap[r.drawing_id] || 0) + (Number(r.cost) || 0)
          }
          setQuoteApportionment(apSalesMap)
        } else {
          setQuoteApportionment({})
        }
        setCostByDrawing(costMap)

        // Load trees for the grid
        const treeEntries = await Promise.all(drawingIds.map(async id => [id, await loadDrawingParts(id).catch(() => null)]))
        setTrees(Object.fromEntries(treeEntries))
      }

      if (q.salesperson_id) {
        const { data: sp } = await supabase.from('users').select('full_name').eq('id', q.salesperson_id).maybeSingle()
        setSalespersonName(sp?.full_name || '')
      } else setSalespersonName('')

      const categories = [...new Set(GRID_COLUMNS.filter(c => c.referenceCategory).map(c => c.referenceCategory))]
      if (categories.length > 0) setRefOptions(await loadReferenceOptions(categories).catch(() => ({})))
    } else if (q?.snapshot) {
      // Locked quote — everything from the snapshot
      const snapItems = q.snapshot.items || []
      setJobItems(snapItems.map(it => it.job_item))
      setDrawings(snapItems.map(it => ({ id: it.drawing.id, job_item_id: it.job_item.id, drawing_number: it.drawing.drawing_number, window_type: it.drawing.window_type, calculated_price: it.calculated_price, poa: it.poa, vat_rate: it.vat_rate })))
      const selMap = {}
      const treeMap = {}
      for (const it of snapItems) { selMap[it.job_item.id] = it.drawing.id; treeMap[it.drawing.id] = it.parts_tree || null }
      setSelections(selMap)
      setTrees(treeMap)
      if (q.published_by) {
        const { data: sp } = await supabase.from('users').select('full_name').eq('id', q.published_by).maybeSingle()
        setSalespersonName(sp?.full_name || '')
      }
    }

    try {
      const { data: hist } = await supabase.from('lead_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(200)
      setLeadHistory((hist || []).filter(h => (h.new_value || '').includes(` / ${q?.quote_number}`) || (h.old_value || '').includes(` / ${q?.quote_number}`)))
    } catch { /* lead_history may not exist */ }

    setLoading(false)
  }

  useEffect(() => {
    if (!quote) return
    setDetailsDraft({
      label: quote.label || '',
      price_file_id: quote.price_file_id || '',
      discount_pct: quote.discount_pct ?? 0,
      valid_days: quote.valid_days ?? 30,
      item_layout: quote.item_layout || '',
    })
    setPaymentsDraft({ deposit_pct: quote.deposit_pct ?? 40, interim_pct: quote.interim_pct ?? 50 })
  }, [quote?.id])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Loading…</div>
  if (!quote) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Quote not found</div>

  const visibleItems = jobItems.filter(i => showDeleted ? true : !i.deleted_at)
  const defaultPriceFile = priceFiles.find(p => p.id === quote.price_file_id) || priceFiles.find(p => p.is_current)

  function isDrawingStale(drawingId) {
    if (!isLive) return false
    const run = latestRuns[drawingId]
    if (!run) return true
    if (quote.price_file_id && run.price_file_id !== quote.price_file_id) return true
    const tree = trees[drawingId]
    if (tree && run.tree_hash && run.tree_hash !== treeHash(tree)) return true
    return false
  }

  const totalsInput = jobItems.map(item => {
    const dwgId = selections[item.id]
    const dwg = dwgId ? drawings.find(d => d.id === dwgId) : null
    if (!dwg) return null
    const drawingLevelPrice = parseFloat(dwg.calculated_price) || 0
    const apportioned = quoteApportionment[String(dwg.id)] || 0
    return { calculated: drawingLevelPrice + apportioned, priceOverride: dwg.price_override ?? null, itemDiscountPct: dwg.item_discount_pct ?? 0, vatRate: dwg.vat_rate ?? 20, poa: dwg.poa ?? false }
  }).filter(Boolean)
  const totals = isLive
    ? (totalsInput.length > 0 ? computeQuoteTotals({ discountPct: quote.discount_pct, depositPct: quote.deposit_pct, interimPct: quote.interim_pct }, totalsInput) : null)
    : (quote.snapshot?.totals ? {
        subtotalBeforeDiscount: quote.snapshot.totals.subtotal_before_discount,
        discountAmount: quote.snapshot.totals.discount_amount,
        subtotalAfterDiscount: quote.snapshot.totals.subtotal_after_discount,
        vatByRate: quote.snapshot.totals.vat_by_rate,
        totalVat: quote.snapshot.totals.total_vat,
        totalInclVat: quote.snapshot.totals.total_incl_vat,
        stages: quote.snapshot.totals.stages,
        poaItems: [],
      } : null)

  const staleCount = isLive ? jobItems.filter(i => selections[i.id] && isDrawingStale(selections[i.id])).length : 0
  const poaCount = jobItems.filter(i => { const d = drawings.find(d => d.id === selections[i.id]); return d?.poa }).length
  const totalCost = jobItems.reduce((sum, item) => sum + (costByDrawing[selections[item.id]] || 0), 0)

  function fmtCompact(n) {
    if (n == null) return '—'
    if (n >= 1000) return `£${(n / 1000).toFixed(1)}K`
    return `£${Number(n).toFixed(0)}`
  }

  function chipLabel(q) {
    const pf    = priceFiles.find(p => p.id === q.price_file_id)
    const pfStr = pf?.name || '—'
    const n     = quoteItemCounts[q.id] ?? 0
    const items = `${n} item${n === 1 ? '' : 's'}`
    const num   = q.quote_number.replace(/^Q(\d+)$/, '$1')
    const label = num !== q.quote_number ? `Quote ${num}` : q.quote_number
    let totalStr = '—'
    if (q.snapshot?.totals?.total_incl_vat != null) {
      totalStr = fmtCompact(q.snapshot.totals.total_incl_vat)
    } else if (q.id === quote?.id && totals?.totalInclVat != null) {
      totalStr = fmtCompact(totals.totalInclVat)
    }
    return `${label} [${items}] ${pfStr} ${totalStr}`
  }

  // ── Grid cell edit ──────────────────────────────────────────────────────────

  async function editCell(item, column, newValue) {
    const dwgId = selections[item.id]
    if (!dwgId) return
    if (column.source === 'drawing') {
      await supabase.from('drawings').update({ [column.field]: newValue }).eq('id', dwgId)
      setDrawings(prev => prev.map(d => d.id === dwgId ? { ...d, [column.field]: newValue } : d))
      return
    }
    const tree = trees[dwgId]
    if (!tree) return
    const nextTree = writeColumnValue(tree, column, newValue)
    setTrees(prev => ({ ...prev, [dwgId]: nextTree }))
    setDirtyDrawings(prev => ({ ...prev, [dwgId]: true }))
  }

  async function updateDrawings() {
    setSaving(true)
    for (const dwgId of Object.keys(dirtyDrawings)) {
      const tree = trees[dwgId]
      if (tree) { try { await saveDrawingParts(Number(dwgId), tree) } catch (e) { console.error('Save drawing parts failed:', e) } }
    }
    setDirtyDrawings({})
    setSaving(false)
    load()
  }

  // ── Edit Quote Details / Payments ────────────────────────────────────────────

  async function saveDetails() {
    const patch = {
      label: detailsDraft.label || null,
      price_file_id: detailsDraft.price_file_id || null,
      discount_pct: parseFloat(detailsDraft.discount_pct) || 0,
      valid_days: parseInt(detailsDraft.valid_days, 10) || 30,
      item_layout: detailsDraft.item_layout || null,
    }
    const { error } = await supabase.from('quotes').update(patch).eq('id', quote.id)
    if (!error) { setQuote(prev => ({ ...prev, ...patch })); setEditDetailsOpen(false) }
  }

  async function savePayments() {
    const deposit = parseFloat(paymentsDraft.deposit_pct) || 0
    const interim = parseFloat(paymentsDraft.interim_pct) || 0
    if (deposit + interim > 100) { alert('Deposit + Interim cannot exceed 100%'); return }
    const patch = { deposit_pct: deposit, interim_pct: interim }
    const { error } = await supabase.from('quotes').update(patch).eq('id', quote.id)
    if (!error) { setQuote(prev => ({ ...prev, ...patch })); setEditPaymentsOpen(false) }
  }

  // ── Publish / copy / accept ──────────────────────────────────────────────────

  async function doPublish() {
    if (staleCount > 0) { setPublishError(`${staleCount} drawing(s) need pricing before this quote can be published — price them from the Quote Matrix.`); return }
    if (poaCount > 0 && !window.confirm(`This quote contains ${poaCount} POA item(s). Publish anyway?`)) return
    setPublishing(true)
    setPublishError(null)
    const publishedAt = new Date().toISOString()
    const validUntil = quote.valid_days ? new Date(Date.now() + quote.valid_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null
    const items = await Promise.all(jobItems.map(async item => {
      const dwgId = selections[item.id]
      if (!dwgId) return null
      const dwg = drawings.find(d => d.id === dwgId)
      const idx = jobItems.filter(i => selections[i.id]).findIndex(i => i.id === item.id)
      const itemTotals = totals?.items?.[idx]
      return {
        job_item: { id: item.id, item_number: item.item_number, floor_level: item.floor_level, elevation: item.elevation, room_name: item.room_name },
        drawing: { id: dwg?.id, drawing_number: dwg?.drawing_number, window_type: dwg?.window_type },
        parts_tree: trees[dwgId] || null,
        calculated_price: dwg?.calculated_price ?? null,
        net: itemTotals?.net ?? null,
        net_after_quote_discount: itemTotals?.netAfterQuoteDiscount ?? null,
        vat: itemTotals?.vat ?? null,
        vat_rate: dwg?.vat_rate ?? 20,
        poa: dwg?.poa ?? false,
      }
    }))
    const snapshot = {
      published_at: publishedAt, lead_number: lead?.lead_number, quote_number: quote.quote_number,
      quote_settings: { discount_pct: quote.discount_pct, deposit_pct: quote.deposit_pct, interim_pct: quote.interim_pct, valid_days: quote.valid_days, price_file_id: quote.price_file_id },
      totals: totals ? { subtotal_before_discount: totals.subtotalBeforeDiscount, discount_amount: totals.discountAmount, subtotal_after_discount: totals.subtotalAfterDiscount, vat_by_rate: totals.vatByRate, total_vat: totals.totalVat, total_incl_vat: totals.totalInclVat, stages: totals.stages } : null,
      items: items.filter(Boolean),
    }
    const { error } = await supabase.from('quotes').update({ status: 'Published', published_at: publishedAt, published_by: user?.id ?? null, valid_until: validUntil, snapshot }).eq('id', quote.id)
    setPublishing(false)
    if (error) { setPublishError(`Publish failed: ${error.message}`); return }
    try { await supabase.from('lead_history').insert({ lead_id: leadId, user_id: user?.id ?? null, user_email: user?.email ?? null, event: 'Quote published', new_value: `${lead?.lead_number} / ${quote.quote_number}`, created_at: new Date().toISOString() }) } catch { /* ignore */ }
    load()
  }

  async function doCopy() {
    const nextNum = `Q${quotes.length + 1}`
    const { data: newQuote, error } = await supabase.from('quotes').insert({
      lead_id: leadId, quote_number: nextNum, status: 'Open', salesperson_id: quote.salesperson_id ?? null,
      valid_days: quote.valid_days ?? 30, discount_pct: quote.discount_pct ?? 0, deposit_pct: quote.deposit_pct ?? 40,
      interim_pct: quote.interim_pct ?? 50, price_file_id: quote.price_file_id ?? null, copied_from_quote_id: quote.id,
      created_at: new Date().toISOString(),
    }).select('id').single()
    if (error || !newQuote) return
    const rows = jobItems.map(item => { const dwgId = selections[item.id]; return dwgId ? { quote_id: newQuote.id, job_item_id: item.id, drawing_id: dwgId } : null }).filter(Boolean)
    if (rows.length > 0) await supabase.from('quote_drawings').insert(rows)
    try { await supabase.from('lead_history').insert({ lead_id: leadId, user_id: user?.id ?? null, user_email: user?.email ?? null, event: 'Quote copied', old_value: `${lead?.lead_number} / ${quote.quote_number}`, new_value: `${lead?.lead_number} / ${nextNum}`, created_at: new Date().toISOString() }) } catch { /* ignore */ }
    navigate(`/leads/${leadId}/quotes/${newQuote.id}`)
  }

  async function doAccept() {
    const acceptedAt = new Date().toISOString()
    const { error } = await supabase.from('quotes').update({ status: 'Accepted', accepted_at: acceptedAt }).eq('id', quote.id)
    if (!error) {
      setQuote(prev => ({ ...prev, status: 'Accepted', accepted_at: acceptedAt }))
      try { await supabase.from('lead_history').insert({ lead_id: leadId, user_id: user?.id ?? null, user_email: user?.email ?? null, event: 'Quote accepted', new_value: `${lead?.lead_number} / ${quote.quote_number}`, created_at: new Date().toISOString() }) } catch { /* ignore */ }
    }
  }

  const mergeFields = {
    customer_forename: mainContact?.first_name || '',
    installation_full_address_one_line: [lead?.property_road, lead?.property_town, lead?.property_postcode].filter(Boolean).join(', '),
    nj_lead_time: '10-12',
    sales_person_full_name: salespersonName || '',
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 20, background: '#f5f4f0' }}>

      {/* ── Header strip ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {quotes.filter(q => q.status === 'Open').map(q => (
              <button key={q.id} onClick={() => navigate(`/leads/${leadId}/quotes/${q.id}`)} style={chipStyle(q.id === quote.id, false)}>
                {chipLabel(q)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {quotes.filter(q => q.status !== 'Open').map(q => (
              <button key={q.id} onClick={() => navigate(`/leads/${leadId}/quotes/${q.id}`)} style={chipStyle(q.id === quote.id, true)}>
                🔒 {chipLabel(q)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setShowDeleted(s => !s)} style={smallToggle(showDeleted)}>Show Deleted</button>
          <button onClick={() => setOnSiteMode(s => !s)} style={smallToggle(onSiteMode)}>On-Site Mode</button>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '10px 14px', minWidth: 220 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>Lead Details</div>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>{lead?.stage || '—'}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => navigate(`/leads/${leadId}`)} style={miniLinkBtn()}>Customer</button>
            <button onClick={() => navigate(`/leads/${leadId}`)} style={miniLinkBtn()}>Photos</button>
            <button onClick={() => navigate(`/leads/${leadId}`)} style={miniLinkBtn()}>Lead</button>
          </div>
        </div>
      </div>

      {/* ── Validation strip ── */}
      {isLive && (
        <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', fontSize: 12 }}>
          <span style={{ fontWeight: 600 }}>Estimated installation hours: {installHours != null ? installHours.toFixed(2) : '—'}</span>
          {staleCount > 0 && <span style={{ color: '#b45309', fontWeight: 600 }}>⚠ {staleCount} drawing(s) need pricing</span>}
          {poaCount > 0 && <span style={{ color: '#b45309', fontWeight: 600 }}>⚠ {poaCount} POA item(s)</span>}
        </div>
      )}

      {/* ── Items grid ── */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0eeea', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Items</div>
          {isLive && (
            <button onClick={updateDrawings} disabled={saving || Object.keys(dirtyDrawings).length === 0} style={{ fontSize: 12, padding: '6px 14px', border: 'none', borderRadius: 7, background: Object.keys(dirtyDrawings).length ? '#3d35a8' : '#cfcbe8', color: '#fff', cursor: Object.keys(dirtyDrawings).length ? 'pointer' : 'default', fontWeight: 600 }}>
              {saving ? 'Saving…' : `Update Drawings${Object.keys(dirtyDrawings).length ? ` (${Object.keys(dirtyDrawings).length})` : ''}`}
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
            <thead>
              <tr>
                <th style={stickyHeadCell}>Item / Location</th>
                {GRID_COLUMNS.map(col => <th key={col.key} style={headCell}>{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, rowIdx) => {
                const dwgId = selections[item.id]
                const dwg = dwgId ? drawings.find(d => d.id === dwgId) : null
                const tree = dwgId ? trees[dwgId] : null
                const rowBg = rowIdx % 2 === 0 ? '#fff' : '#faf9f8'
                return (
                  <tr key={item.id}>
                    <td style={{ ...stickyCell, background: rowBg }}>
                      <div style={{ fontWeight: 700 }}>Item {item.item_number}</div>
                      <div style={{ color: '#888' }}>{[item.floor_level, item.elevation, item.room_name].filter(Boolean).join(' · ') || '—'}</div>
                    </td>
                    {GRID_COLUMNS.map(col => {
                      if (!dwg) return <td key={col.key} style={{ ...bodyCell, background: rowBg, color: '#ccc' }}>—</td>
                      if (col.key === 'price_file') return <td key={col.key} style={{ ...bodyCell, background: rowBg }}>{defaultPriceFile?.name || '—'}</td>
                      if (col.key === 'product_range') return <td key={col.key} style={{ ...bodyCell, background: rowBg }}>—</td>
                      const raw = col.source === 'drawing' ? (dwg[col.field] ?? null) : readColumnValue(tree, col)
                      const canEdit = isLive && col.editable && (col.source === 'drawing' || tree)
                      if (!canEdit) {
                        const display = col.type === 'boolean' ? (raw == null ? '—' : (raw ? 'Yes' : 'No')) : (raw == null || raw === '' ? '—' : String(raw))
                        return <td key={col.key} style={{ ...bodyCell, background: rowBg, color: raw == null ? '#ccc' : '#333' }}>{display}</td>
                      }
                      return (
                        <td key={col.key} style={{ ...bodyCell, background: rowBg }}>
                          {col.type === 'boolean' ? (
                            <input type="checkbox" checked={!!raw} onChange={e => editCell(item, col, e.target.checked)} />
                          ) : col.type === 'reference' ? (
                            <select value={raw ?? ''} onChange={e => editCell(item, col, e.target.value)} style={cellInput}>
                              <option value="">—</option>
                              {(refOptions[col.referenceCategory] || []).map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                              {!col.referenceCategory && raw && <option value={raw}>{raw}</option>}
                            </select>
                          ) : col.type === 'number' ? (
                            <input type="number" value={raw ?? ''} onChange={e => editCell(item, col, e.target.value === '' ? null : Number(e.target.value))} style={cellInput} />
                          ) : (
                            <input type="text" value={raw ?? ''} onChange={e => editCell(item, col, e.target.value)} style={cellInput} />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Financial Schedule — visible always; Cost column hidden in On-Site Mode ── */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, marginBottom: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Financial Schedule</div>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 14 }}>
          <thead>
            <tr style={{ color: '#888', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>Item</th>
              <th style={{ padding: '6px 8px' }}>Location</th>
              {!onSiteMode && <th style={{ padding: '6px 8px', textAlign: 'right' }}>Cost</th>}
              <th style={{ padding: '6px 8px', textAlign: 'right' }}>Net Total</th>
            </tr>
          </thead>
          <tbody>
            {jobItems.filter(i => selections[i.id]).map((item, idx) => {
              const itemTotals = totals?.items?.[idx]
              return (
                <tr key={item.id} style={{ borderTop: '1px solid #f0eeea' }}>
                  <td style={{ padding: '6px 8px' }}>Item {item.item_number}</td>
                  <td style={{ padding: '6px 8px', color: '#888' }}>{[item.floor_level, item.elevation, item.room_name].filter(Boolean).join(' · ') || '—'}</td>
                  {!onSiteMode && <td style={{ padding: '6px 8px', textAlign: 'right', color: '#888' }}>{fmt(costByDrawing[selections[item.id]] ?? null)}</td>}
                  <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{itemTotals?.poa ? 'POA' : fmt(itemTotals?.netAfterQuoteDiscount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {totals ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 340, marginLeft: 'auto', fontSize: 12 }}>
            <Row label="Sub Total Before Discount" value={fmt(totals.subtotalBeforeDiscount)} />
            {quote.discount_pct > 0 && <Row label={`${quote.discount_pct}% Discount`} value={`−${fmt(totals.discountAmount)}`} dim />}
            <Row label="Sub Total After Discount" value={fmt(totals.subtotalAfterDiscount)} />
            {Object.entries(totals.vatByRate || {}).map(([rate, amt]) => <Row key={rate} label={`VAT @ ${rate}%`} value={fmt(amt)} dim />)}
            {!onSiteMode && <Row label="TOTAL (cost)" value={fmt(totalCost)} dim />}
            <Row label="Total Order Value incl. VAT" value={fmt(totals.totalInclVat)} bold />
            <Row label="Deposit With Order" value={fmt(totals.stages?.deposit)} dim />
            <Row label="Interim" value={fmt(totals.stages?.interim)} dim />
            <Row label="Balance on Completion" value={fmt(totals.stages?.balance)} dim />
          </div>
        ) : <div style={{ color: '#aaa', fontSize: 12 }}>No priced items yet</div>}
      </div>

      {!onSiteMode && (
        <>
          {/* ── Quote Details + Payment box ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Quote Details</div>
                {isLive && <button onClick={() => setEditDetailsOpen(true)} style={miniLinkBtn()}>Edit Quote Details</button>}
              </div>
              <DetailRow label="Quote Label" value={quote.label || '—'} />
              <DetailRow label="Discount" value={`${quote.discount_pct ?? 0}%`} />
              <DetailRow label="VAT" value="Per item (20 / 5 / 0%)" />
              <DetailRow label="Quote valid for" value={`${quote.valid_days ?? 30} days`} />
              <DetailRow label="Sales Person on Quote" value={salespersonName || '—'} />
              <DetailRow label="Layout" value={quote.item_layout || '1 item with int & ext view, ironmongery & cover'} />
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button onClick={() => setLetterView('front')} style={miniLinkBtn()}>Front Cover Letter — View</button>
                <button onClick={() => setLetterView('back')} style={miniLinkBtn()}>Back Cover Letter — View</button>
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 6, lineHeight: 1.5 }}>
                {mergeLetter(FRONT_COVER_LETTER, mergeFields).split('\n')[0]}
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Payment</div>
                {isLive && <button onClick={() => setEditPaymentsOpen(true)} style={miniLinkBtn()}>Edit Payments</button>}
              </div>
              <DetailRow label="Quote Reference" value={`${lead?.lead_number || ''} / ${quote.quote_number}`} />
              <DetailRow label="Net Value" value={fmt(totals?.subtotalAfterDiscount)} />
              <DetailRow label="Deposit" value={`${quote.deposit_pct ?? 40}% — ${fmt(totals?.stages?.deposit)}`} />
              <DetailRow label="Interim" value={`${quote.interim_pct ?? 50}% — ${fmt(totals?.stages?.interim)}`} />
              <DetailRow label="Balance" value={`${Math.max(0, 100 - (quote.deposit_pct ?? 40) - (quote.interim_pct ?? 50))}% — ${fmt(totals?.stages?.balance)}`} />
              <DetailRow label="Quote total incl. VAT" value={fmt(totals?.totalInclVat)} />
            </div>
          </div>
        </>
      )}

      {/* ── Outputs / publish ── */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button disabled title="Coming in Step H3" style={disabledBtn()}>Generate quote preview</button>
        <button onClick={() => navigate(`/leads/${leadId}`)} style={miniLinkBtn()}>Click here for more outputs</button>
        <div style={{ flex: 1 }} />
        {quote.status === 'Open' ? (
          <>
            <span style={{ fontSize: 11, color: '#aaa' }}>A quote becomes locked when it is published</span>
            <button onClick={doPublish} disabled={publishing} style={{ fontSize: 12, padding: '8px 18px', border: 'none', borderRadius: 8, background: '#1a5fa8', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              {publishing ? 'Publishing…' : `Publish ${quote.quote_number}`}
            </button>
          </>
        ) : (
          <span style={{ fontSize: 12, color: '#555' }}>🔒 Published {quote.published_at ? new Date(quote.published_at).toLocaleDateString('en-GB') : ''}</span>
        )}
        <button onClick={doCopy} style={{ fontSize: 12, padding: '8px 16px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', color: '#3d35a8', fontWeight: 600, cursor: 'pointer' }}>Copy to new quote</button>
        {quote.status === 'Published' && <button onClick={doAccept} style={{ fontSize: 12, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#0a5a3c', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Accept</button>}
      </div>
      {publishError && <div style={{ color: '#c00', fontSize: 12, marginBottom: 16 }}>{publishError}</div>}

      {/* ── Tracking ── */}
      <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Tracking</div>
        <div style={{ fontSize: 12, color: '#555', display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 12 }}>
          <span>Created {new Date(quote.created_at).toLocaleDateString('en-GB')}</span>
          {quote.published_at && <span>Pricing elements snapshot taken on {new Date(quote.published_at).toLocaleDateString('en-GB')}</span>}
        </div>
        <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#faf9f7' }}>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: '#888', borderBottom: '1px solid #eeece8' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: '#888', borderBottom: '1px solid #eeece8' }}>User</th>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: '#888', borderBottom: '1px solid #eeece8' }}>Event</th>
            </tr>
          </thead>
          <tbody>
            {leadHistory.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: '14px 10px', color: '#ccc', textAlign: 'center' }}>No quote history yet</td></tr>
            ) : leadHistory.map(row => (
              <tr key={row.id}>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #f5f4f0' }}>{new Date(row.created_at).toLocaleString('en-GB')}</td>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #f5f4f0' }}>{row.user_email || '—'}</td>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #f5f4f0' }}>{row.event}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Modals ── */}
      {editDetailsOpen && detailsDraft && (
        <Modal onClose={() => setEditDetailsOpen(false)} title="Edit Quote Details">
          <FieldRow label="Quote Label"><input value={detailsDraft.label} onChange={e => setDetailsDraft(d => ({ ...d, label: e.target.value }))} style={modalInput} /></FieldRow>
          <FieldRow label="Price File">
            <select value={detailsDraft.price_file_id} onChange={e => setDetailsDraft(d => ({ ...d, price_file_id: e.target.value }))} style={modalInput}>
              <option value="">— None —</option>
              {priceFiles.map(pf => <option key={pf.id} value={pf.id}>{pf.name}{pf.is_current ? ' ★' : ''}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Discount %"><input type="number" value={detailsDraft.discount_pct} onChange={e => setDetailsDraft(d => ({ ...d, discount_pct: e.target.value }))} style={modalInput} /></FieldRow>
          <FieldRow label="Valid for (days)"><input type="number" value={detailsDraft.valid_days} onChange={e => setDetailsDraft(d => ({ ...d, valid_days: e.target.value }))} style={modalInput} /></FieldRow>
          <FieldRow label="Layout">
            <select value={detailsDraft.item_layout} onChange={e => setDetailsDraft(d => ({ ...d, item_layout: e.target.value }))} style={modalInput}>
              <option value="">— Default —</option>
              <option>1 item with int &amp; ext view, ironmongery &amp; cover</option>
              <option>1 item with ironmongery images &amp; cover photo</option>
              <option>2 items per page with ironmongery images</option>
              <option>2 items per page (no ironmongery images)</option>
              <option>3 items per page (no ironmongery images)</option>
            </select>
          </FieldRow>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={saveDetails} style={primaryBtn()}>Save</button>
            <button onClick={() => setEditDetailsOpen(false)} style={secondaryBtn()}>Cancel</button>
          </div>
        </Modal>
      )}

      {editPaymentsOpen && paymentsDraft && (
        <Modal onClose={() => setEditPaymentsOpen(false)} title="Edit Payments">
          <FieldRow label="Deposit %"><input type="number" value={paymentsDraft.deposit_pct} onChange={e => setPaymentsDraft(d => ({ ...d, deposit_pct: e.target.value }))} style={modalInput} /></FieldRow>
          <FieldRow label="Interim %"><input type="number" value={paymentsDraft.interim_pct} onChange={e => setPaymentsDraft(d => ({ ...d, interim_pct: e.target.value }))} style={modalInput} /></FieldRow>
          <div style={{ fontSize: 11, color: '#888', margin: '6px 0 14px' }}>
            Balance: {Math.max(0, 100 - (parseFloat(paymentsDraft.deposit_pct) || 0) - (parseFloat(paymentsDraft.interim_pct) || 0))}%
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={savePayments} style={primaryBtn()}>Save</button>
            <button onClick={() => setEditPaymentsOpen(false)} style={secondaryBtn()}>Cancel</button>
          </div>
        </Modal>
      )}

      {letterView && (
        <Modal onClose={() => setLetterView(null)} title={letterView === 'front' ? 'Front Cover Letter' : 'Back Cover Letter'} wide>
          <div style={{ fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#333' }}>
            {mergeLetter(letterView === 'front' ? FRONT_COVER_LETTER : BACK_COVER_LETTER, mergeFields)}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Small UI helpers ─────────────────────────────────────────────────────────

function Row({ label, value, dim, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: dim ? '#aaa' : '#555' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: bold ? '#1a1a1a' : dim ? '#aaa' : '#333' }}>{value}</span>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderBottom: '1px solid #f5f4f0' }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function FieldRow({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 20, width: wide ? 520 : 360, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{title}</div>
        {children}
      </div>
    </div>
  )
}

function chipStyle(active, locked) {
  return {
    fontSize: 11, padding: '5px 12px', borderRadius: 999, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid #3d35a8' : '1px solid #d8d5cf',
    background: active ? '#3d35a8' : locked ? '#f5f4f0' : '#fff',
    color: active ? '#fff' : '#555',
  }
}
function smallToggle(active) {
  return { fontSize: 11, padding: '6px 12px', borderRadius: 7, fontWeight: 500, cursor: 'pointer', border: active ? '1px solid #3d35a8' : '1px solid #d8d5cf', background: active ? '#3d35a8' : '#fff', color: active ? '#fff' : '#555' }
}
function miniLinkBtn() {
  return { fontSize: 11, padding: '4px 10px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#faf9f7', cursor: 'pointer', color: '#3d35a8', fontWeight: 500 }
}
function disabledBtn() {
  return { fontSize: 12, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#e8e6f5', color: '#9993d4', cursor: 'not-allowed', fontWeight: 600 }
}
function primaryBtn() {
  return { fontSize: 12, padding: '7px 16px', border: 'none', borderRadius: 7, background: '#3d35a8', color: '#fff', fontWeight: 600, cursor: 'pointer' }
}
function secondaryBtn() {
  return { fontSize: 12, padding: '7px 16px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', color: '#555', cursor: 'pointer' }
}

const stickyHeadCell = { position: 'sticky', left: 0, zIndex: 2, background: '#3d35a8', color: '#fff', padding: '8px 12px', textAlign: 'left', minWidth: 170, borderBottom: '1px solid #2d268a' }
const headCell = { background: '#3d35a8', color: 'rgba(255,255,255,0.85)', padding: '8px 10px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid #2d268a', borderLeft: '1px solid #2d268a' }
const stickyCell = { position: 'sticky', left: 0, zIndex: 1, padding: '8px 12px', borderBottom: '1px solid #f0eeea', minWidth: 170, boxShadow: '2px 0 4px rgba(0,0,0,0.04)' }
const bodyCell = { padding: '6px 10px', borderBottom: '1px solid #f0eeea', borderLeft: '1px solid #f0eeea', whiteSpace: 'nowrap' }
const cellInput = { fontSize: 11, padding: '3px 5px', border: '1px solid #d8d5cf', borderRadius: 4, width: 100 }
const modalInput = { fontSize: 13, padding: '7px 10px', border: '1px solid #d8d5cf', borderRadius: 7, width: '100%', boxSizing: 'border-box' }
