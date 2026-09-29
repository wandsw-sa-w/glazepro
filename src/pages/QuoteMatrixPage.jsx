import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { Layout, LeadsSubNav } from '../components/Layout'
import { priceDrawing, priceQuote } from '../pricing/pricingEngine.js'
import { computeQuoteTotals } from '../quotes/quoteTotals.js'
import { validatePublish, nextQuoteNumber } from '../quotes/publishValidation.js'
import { computePopulatePatch } from '../quotes/populateQuote.js'
import { loadDrawingParts, saveDrawingParts } from '../drawingBoard/api.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { computeSashGeometry } from '../drawingBoard/sashGeometry.js'
import { SashElevation } from '../drawingBoard/renderElevation.jsx'
import QuoteOverview from './QuoteOverview.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—'
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function itemLabel(item) {
  return [item.floor_level, item.elevation, item.room_name].filter(Boolean).join(' · ') || 'No location set'
}

// ── Elevation thumbnail — lazily loads the drawing's parts tree ────────────────

function DrawingThumb({ drawingId }) {
  const [state, setState] = useState('loading') // 'loading' | 'none' | { tree, geometry }

  useEffect(() => {
    let cancelled = false
    setState('loading')
    loadDrawingParts(drawingId).then(tree => {
      if (cancelled) return
      if (!tree) { setState('none'); return }
      try {
        const derived = computeDerived(tree)
        const geometry = computeSashGeometry(tree, derived)
        setState({ tree, geometry })
      } catch {
        setState('none')
      }
    }).catch(() => { if (!cancelled) setState('none') })
    return () => { cancelled = true }
  }, [drawingId])

  if (state === 'loading') {
    return <div style={{ width: '100%', height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11 }}>…</div>
  }
  if (state === 'none') {
    return <div style={{ width: '100%', height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 11, fontStyle: 'italic' }}>Not drawn yet</div>
  }
  return (
    <div style={{ width: '100%', height: 110, overflow: 'hidden' }}>
      <SashElevation tree={state.tree} geometry={state.geometry} refOptions={{}} viewMode="internal" />
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function QuoteMatrixPage() {
  const { id: leadId, quoteId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [lead, setLead] = useState(null)
  const [jobItems, setJobItems] = useState([])
  const [drawings, setDrawings] = useState([])
  const [quotes, setQuotes] = useState([])
  const [selections, setSelections] = useState({})   // `${quoteId}_${jobItemId}` -> drawingId (saved)
  const [priceFiles, setPriceFiles] = useState([])
  const [latestRuns, setLatestRuns] = useState({})   // drawingId -> {price_file_id, status}
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [pricing, setPricing] = useState({})         // quoteId -> {busy, error, progress}

  const [showDeleted, setShowDeleted] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState(new Set())
  const [templatePickerFor, setTemplatePickerFor] = useState(null) // jobItemId
  const [priceFileModal, setPriceFileModal] = useState(false)

  const [panelOpen, setPanelOpen] = useState(true)
  const [panelDraft, setPanelDraft] = useState({})    // `${quoteId}_${jobItemId}` -> drawingId (uncommitted)
  const [openQuotesExpanded, setOpenQuotesExpanded] = useState(false)
  const [panelBusy, setPanelBusy] = useState({})      // quoteId -> true while saving

  useEffect(() => { load() }, [leadId])

  async function load() {
    setLoading(true)

    const { data: leadRow } = await supabase.from('leads').select('id, lead_number').eq('id', leadId).single()
    setLead(leadRow || null)

    const { data: items } = await supabase
      .from('job_items').select('*').eq('lead_id', leadId).order('sort_order', { ascending: true, nullsFirst: false }).order('item_number')

    const itemIds = (items || []).map(i => i.id)
    let dwgs = []
    if (itemIds.length > 0) {
      const { data } = await supabase
        .from('drawings')
        .select('id, job_item_id, drawing_number, sort_order, deleted_at, calculated_price, window_type, poa, price_override, item_discount_pct, vat_rate, material_frame, material_sash, finish_internal, default_profile_id')
        .in('job_item_id', itemIds)
        .order('sort_order', { ascending: true, nullsFirst: false })
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

    const { data: profs } = await supabase
      .from('default_profiles')
      .select('id, code, label, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order')

    const quoteIds = (qts || []).map(q => q.id)
    const qdMap = {}
    if (quoteIds.length > 0) {
      const { data: qds } = await supabase
        .from('quote_drawings')
        .select('quote_id, job_item_id, drawing_id')
        .in('quote_id', quoteIds)
      for (const qd of (qds || [])) qdMap[`${qd.quote_id}_${qd.job_item_id}`] = qd.drawing_id
    }

    const drawingIds = (dwgs || []).map(d => d.id)
    const runsMap = {}
    if (drawingIds.length > 0) {
      const { data: runs } = await supabase
        .from('pricing_runs')
        .select('drawing_id, price_file_id, status, created_at')
        .in('drawing_id', drawingIds)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
      for (const run of (runs || [])) { if (!runsMap[run.drawing_id]) runsMap[run.drawing_id] = run }
    }

    setJobItems(items || [])
    setDrawings(dwgs)
    setQuotes(qts || [])
    setPriceFiles(pfs || [])
    setProfiles(profs || [])
    setSelections(qdMap)
    setLatestRuns(runsMap)
    setLoading(false)
  }

  // Keep the floating panel's local draft in sync with saved selections
  // (only overwrite entries the user hasn't touched yet, i.e. on load/refresh)
  useEffect(() => {
    setPanelDraft(prev => {
      const next = { ...prev }
      for (const q of quotes.filter(q => q.status === 'Open')) {
        for (const item of jobItems) {
          const key = `${q.id}_${item.id}`
          if (!(key in next)) next[key] = selections[key] || ''
        }
      }
      return next
    })
  }, [quotes, jobItems, selections])

  const defaultPriceFile = priceFiles.find(p => p.is_current) || priceFiles.find(p => p.status === 'published')

  function isStale(drawingId) {
    const run = latestRuns[drawingId]
    if (!run) return true
    if (defaultPriceFile && run.price_file_id !== defaultPriceFile.id) return true
    return false
  }

  const visibleItems = jobItems.filter(i => showDeleted ? true : !i.deleted_at)
  const deletedItemsCount = jobItems.filter(i => i.deleted_at).length

  // ── Item / drawing management ───────────────────────────────────────────────

  async function addItem() {
    const nextNum = jobItems.length > 0 ? Math.max(...jobItems.map(i => i.item_number)) + 1 : 1
    const { data: newItem, error } = await supabase
      .from('job_items')
      .insert({ lead_id: leadId, item_number: nextNum, sort_order: nextNum })
      .select().single()
    if (!error && newItem) setJobItems(prev => [...prev, newItem])
  }

  async function addMultipleItems() {
    const countStr = window.prompt('How many items to add?', '1')
    const count = parseInt(countStr, 10)
    if (!count || count < 1) return
    const startNum = jobItems.length > 0 ? Math.max(...jobItems.map(i => i.item_number)) + 1 : 1
    const rows = Array.from({ length: count }, (_, i) => ({ lead_id: leadId, item_number: startNum + i, sort_order: startNum + i }))
    const { data: newItems, error } = await supabase.from('job_items').insert(rows).select()
    if (!error && newItems) setJobItems(prev => [...prev, ...newItems])
  }

  async function deleteItem(item) {
    const ok = window.confirm(`Delete Item ${item.item_number}? Its drawings will be deleted too.`)
    if (!ok) return
    const now = new Date().toISOString()
    await supabase.from('job_items').update({ deleted_at: now }).eq('id', item.id)
    const itemDwgIds = drawings.filter(d => d.job_item_id === item.id).map(d => d.id)
    if (itemDwgIds.length > 0) await supabase.from('drawings').update({ deleted_at: now }).in('id', itemDwgIds)
    setJobItems(prev => prev.map(i => i.id === item.id ? { ...i, deleted_at: now } : i))
    setDrawings(prev => prev.map(d => itemDwgIds.includes(d.id) ? { ...d, deleted_at: now } : d))
  }

  async function restoreItem(item) {
    await supabase.from('job_items').update({ deleted_at: null }).eq('id', item.id)
    setJobItems(prev => prev.map(i => i.id === item.id ? { ...i, deleted_at: null } : i))
  }

  async function moveItem(item, dir) {
    const idx = visibleItems.findIndex(i => i.id === item.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= visibleItems.length) return
    const other = visibleItems[swapIdx]
    const a = item.sort_order ?? item.item_number
    const b = other.sort_order ?? other.item_number
    await supabase.from('job_items').update({ sort_order: b }).eq('id', item.id)
    await supabase.from('job_items').update({ sort_order: a }).eq('id', other.id)
    setJobItems(prev => prev.map(i => {
      if (i.id === item.id) return { ...i, sort_order: b }
      if (i.id === other.id) return { ...i, sort_order: a }
      return i
    }))
  }

  async function duplicateDrawing(dwg, targetJobItemId, nextDrawingNumber) {
    const { id: _id, created_at: _created_at, updated_at: _updated_at, ...rest } = dwg
    const { data: newDwg, error } = await supabase
      .from('drawings')
      .insert({ ...rest, job_item_id: targetJobItemId, drawing_number: nextDrawingNumber, sort_order: nextDrawingNumber, deleted_at: null, created_at: new Date().toISOString() })
      .select().single()
    if (error || !newDwg) { console.error('Copy drawing failed:', error); return null }
    try {
      const tree = await loadDrawingParts(dwg.id)
      if (tree) await saveDrawingParts(newDwg.id, tree)
    } catch (e) { console.error('Copy drawing tree failed:', e) }
    return newDwg
  }

  async function copyAllDrawings(item) {
    const itemDwgs = drawings.filter(d => d.job_item_id === item.id && !d.deleted_at)
    let nextNum = Math.max(0, ...drawings.filter(d => d.job_item_id === item.id).map(d => d.drawing_number || 0)) + 1
    const created = []
    for (const dwg of itemDwgs) {
      const copy = await duplicateDrawing(dwg, item.id, nextNum)
      if (copy) { created.push(copy); nextNum++ }
    }
    if (created.length > 0) setDrawings(prev => [...prev, ...created])
  }

  async function moveDrawing(item, dwg, dir) {
    const itemDwgs = drawings.filter(d => d.job_item_id === item.id && (showDeleted ? true : !d.deleted_at))
    const idx = itemDwgs.findIndex(d => d.id === dwg.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= itemDwgs.length) return
    const other = itemDwgs[swapIdx]
    const a = dwg.sort_order ?? dwg.drawing_number
    const b = other.sort_order ?? other.drawing_number
    await supabase.from('drawings').update({ sort_order: b }).eq('id', dwg.id)
    await supabase.from('drawings').update({ sort_order: a }).eq('id', other.id)
    setDrawings(prev => prev.map(d => {
      if (d.id === dwg.id) return { ...d, sort_order: b }
      if (d.id === other.id) return { ...d, sort_order: a }
      return d
    }))
  }

  async function deleteDrawing(dwg) {
    const ok = window.confirm(`Delete this drawing?`)
    if (!ok) return
    const now = new Date().toISOString()
    await supabase.from('drawings').update({ deleted_at: now }).eq('id', dwg.id)
    setDrawings(prev => prev.map(d => d.id === dwg.id ? { ...d, deleted_at: now } : d))
  }

  async function copySingleDrawing(dwg) {
    const nextNum = Math.max(0, ...drawings.filter(d => d.job_item_id === dwg.job_item_id).map(d => d.drawing_number || 0)) + 1
    const copy = await duplicateDrawing(dwg, dwg.job_item_id, nextNum)
    if (copy) setDrawings(prev => [...prev, copy])
  }

  async function addDrawingQuick(item, kind) {
    if (kind !== 'sash') { alert('Coming soon'); return }
    const nextNum = Math.max(0, ...drawings.filter(d => d.job_item_id === item.id).map(d => d.drawing_number || 0)) + 1
    const { data: newDwg, error } = await supabase
      .from('drawings')
      .insert({ job_item_id: item.id, drawing_number: nextNum, sort_order: nextNum, window_type: 'Box Sash' })
      .select().single()
    if (!error && newDwg) navigate(`/drawing-board/${newDwg.id}`)
  }

  async function addDrawingFromProfile(item, profile) {
    const nextNum = Math.max(0, ...drawings.filter(d => d.job_item_id === item.id).map(d => d.drawing_number || 0)) + 1
    const { data: newDwg, error } = await supabase
      .from('drawings')
      .insert({ job_item_id: item.id, drawing_number: nextNum, sort_order: nextNum, window_type: 'Box Sash', default_profile_id: profile.id })
      .select().single()
    setTemplatePickerFor(null)
    if (!error && newDwg) navigate(`/drawing-board/${newDwg.id}`)
  }

  // ── Batch selection ──────────────────────────────────────────────────────────

  function toggleItemSelected(id) {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function batchDelete() {
    if (selectedItemIds.size === 0) return
    const ok = window.confirm(`Delete ${selectedItemIds.size} item(s)?`)
    if (!ok) return
    for (const id of selectedItemIds) {
      const item = jobItems.find(i => i.id === id)
      if (item) await deleteItem(item)
    }
    setSelectedItemIds(new Set())
    setSelectMode(false)
  }

  async function batchCopy() {
    if (selectedItemIds.size === 0) return
    const nextStart = jobItems.length > 0 ? Math.max(...jobItems.map(i => i.item_number)) + 1 : 1
    let n = nextStart
    for (const id of selectedItemIds) {
      const item = jobItems.find(i => i.id === id)
      if (!item) continue
      const { data: newItem, error } = await supabase
        .from('job_items')
        .insert({ lead_id: leadId, item_number: n, sort_order: n, floor_level: item.floor_level, elevation: item.elevation, room_name: item.room_name })
        .select().single()
      if (error || !newItem) continue
      setJobItems(prev => [...prev, newItem])
      const itemDwgs = drawings.filter(d => d.job_item_id === item.id && !d.deleted_at)
      let dn = 1
      for (const dwg of itemDwgs) {
        const copy = await duplicateDrawing(dwg, newItem.id, dn)
        if (copy) { setDrawings(prev => [...prev, copy]); dn++ }
      }
      n++
    }
    setSelectedItemIds(new Set())
    setSelectMode(false)
  }

  // ── Update Price File ────────────────────────────────────────────────────────

  async function applyPriceFileUpdate(priceFileId) {
    const targetIds = selectedItemIds.size > 0
      ? drawings.filter(d => selectedItemIds.has(d.job_item_id) && !d.deleted_at).map(d => d.id)
      : drawings.filter(d => !d.deleted_at).map(d => d.id)
    setPriceFileModal(false)
    for (const drawingId of targetIds) {
      const res = await priceDrawing(drawingId, supabase, { priceFileId })
      if (res.success) {
        setDrawings(prev => prev.map(d => d.id === drawingId ? { ...d, calculated_price: res.calculatedPrice } : d))
        setLatestRuns(prev => ({ ...prev, [drawingId]: { price_file_id: priceFileId, status: 'complete' } }))
      }
    }
  }

  // ── Quote actions (ported from the H1/H2 matrix — unchanged behaviour) ──────

  async function createQuote() {
    const nextNum = quotes.length + 1
    const currentPf = priceFiles.find(p => p.is_current) || priceFiles.find(p => p.status === 'published')
    const { data: newQuote, error } = await supabase
      .from('quotes')
      .insert({
        lead_id: leadId, quote_number: `Q${nextNum}`, status: 'Open',
        salesperson_id: user?.id ?? null, valid_days: 30, discount_pct: 0,
        deposit_pct: 40, interim_pct: 50, price_file_id: currentPf?.id ?? null,
        created_at: new Date().toISOString(),
      })
      .select('id, quote_number, status, lead_id, salesperson_id, valid_until, created_at, price_file_id, discount_pct, deposit_pct, interim_pct, valid_days')
      .single()
    if (!error && newQuote) {
      setQuotes(prev => [...prev, newQuote])
      setOpenQuotesExpanded(true)
    }
  }

  async function doPriceQuote(quoteId) {
    const q = quotes.find(q => q.id === quoteId)
    if (!q) return
    const priceFileId = q.price_file_id || undefined
    const staleDrawingIds = jobItems
      .map(item => selections[`${quoteId}_${item.id}`])
      .filter(Boolean)
      .filter(dwgId => isStale(dwgId))

    setPricing(prev => ({ ...prev, [quoteId]: { busy: true, error: null, progress: `Pricing ${staleDrawingIds.length} drawing(s)…` } }))
    const errors = []
    for (const drawingId of staleDrawingIds) {
      const res = await priceDrawing(drawingId, supabase, { priceFileId })
      if (!res.success) errors.push(`Drawing ${drawingId}: ${res.error}`)
      else {
        setDrawings(prev => prev.map(d => d.id === drawingId ? { ...d, calculated_price: res.calculatedPrice } : d))
        setLatestRuns(prev => ({ ...prev, [drawingId]: { price_file_id: priceFileId || null, status: 'complete' } }))
      }
    }
    setPricing(prev => ({ ...prev, [quoteId]: { ...prev[quoteId], progress: 'Running quote-level pass…' } }))
    const qRes = await priceQuote(quoteId, supabase, { priceFileId })
    if (!qRes.success) errors.push(`Quote-level pass: ${qRes.error}`)
    setPricing(prev => ({ ...prev, [quoteId]: { busy: false, error: errors.length ? errors.join('; ') : null, progress: null } }))
  }

  function getItemsForTotals(quoteId) {
    return jobItems.map(item => {
      const dwgId = selections[`${quoteId}_${item.id}`]
      const dwg = dwgId ? drawings.find(d => d.id === dwgId) : null
      if (!dwg) return null
      return {
        calculated: parseFloat(dwg.calculated_price) || 0,
        priceOverride: dwg.price_override ?? null,
        itemDiscountPct: dwg.item_discount_pct ?? 0,
        vatRate: dwg.vat_rate ?? 20,
        poa: dwg.poa ?? false,
      }
    }).filter(Boolean)
  }

  function getQuoteTotals(q) {
    const items = getItemsForTotals(q.id)
    if (items.length === 0) return null
    return computeQuoteTotals({ discountPct: q.discount_pct, depositPct: q.deposit_pct, interimPct: q.interim_pct }, items)
  }

  async function doPublishQuote(quoteId) {
    const q = quotes.find(q => q.id === quoteId)
    if (!q || q.status !== 'Open') return
    const validation = validatePublish(q, jobItems, drawings, selections, latestRuns)
    if (!validation.ok) {
      setPricing(prev => ({ ...prev, [quoteId]: { busy: false, error: validation.reason, progress: null } }))
      return
    }
    if (validation.poaItemIndices.length > 0) {
      const ok = window.confirm(`This quote contains ${validation.poaItemIndices.length} POA item(s). Publish anyway?`)
      if (!ok) return
    }
    const totals = getQuoteTotals(q)
    const selectedItems = (await Promise.all(jobItems.map(async item => {
      const dwgId = selections[`${q.id}_${item.id}`]
      if (!dwgId) return null
      const dwg = drawings.find(d => d.id === dwgId)
      const itemTotals = totals?.items?.[jobItems.indexOf(item)]
      let partsTree = null
      try { partsTree = await loadDrawingParts(dwgId) } catch { /* leave null — grid shows "—" for this item */ }
      return {
        job_item: { id: item.id, item_number: item.item_number, floor_level: item.floor_level, elevation: item.elevation, room_name: item.room_name },
        drawing: { id: dwg?.id, drawing_number: dwg?.drawing_number, window_type: dwg?.window_type },
        parts_tree: partsTree,
        calculated_price: dwg?.calculated_price ?? null,
        net: itemTotals?.net ?? null,
        net_after_quote_discount: itemTotals?.netAfterQuoteDiscount ?? null,
        vat: itemTotals?.vat ?? null,
        vat_rate: dwg?.vat_rate ?? 20,
        poa: dwg?.poa ?? false,
      }
    }))).filter(Boolean)

    const publishedAt = new Date().toISOString()
    const validUntil = q.valid_days ? new Date(Date.now() + q.valid_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : null
    const snapshot = {
      published_at: publishedAt, lead_number: lead?.lead_number, quote_number: q.quote_number,
      quote_settings: { discount_pct: q.discount_pct, deposit_pct: q.deposit_pct, interim_pct: q.interim_pct, valid_days: q.valid_days, price_file_id: q.price_file_id },
      totals: totals ? {
        subtotal_before_discount: totals.subtotalBeforeDiscount, discount_amount: totals.discountAmount,
        subtotal_after_discount: totals.subtotalAfterDiscount, vat_by_rate: totals.vatByRate,
        total_vat: totals.totalVat, total_incl_vat: totals.totalInclVat, stages: totals.stages,
      } : null,
      items: selectedItems,
    }
    const { error } = await supabase.from('quotes').update({ status: 'Published', published_at: publishedAt, published_by: user?.id ?? null, valid_until: validUntil, snapshot }).eq('id', quoteId)
    if (error) { setPricing(prev => ({ ...prev, [quoteId]: { busy: false, error: `Publish failed: ${error.message}`, progress: null } })); return }
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: 'Published', published_at: publishedAt, published_by: user?.id, valid_until: validUntil, snapshot } : q))
    try {
      await supabase.from('lead_history').insert({ lead_id: leadId, user_id: user?.id ?? null, user_email: user?.email ?? null, event: 'Quote published', new_value: `${lead?.lead_number} / ${q.quote_number}`, created_at: new Date().toISOString() })
    } catch { /* lead_history may not exist */ }
  }

  async function doCopyQuote(quoteId) {
    const q = quotes.find(q => q.id === quoteId)
    if (!q) return
    const newNum = nextQuoteNumber(quotes)
    const currentPf = priceFiles.find(p => p.is_current) || priceFiles.find(p => p.status === 'published')
    const { data: newQuote, error: qErr } = await supabase
      .from('quotes')
      .insert({
        lead_id: leadId, quote_number: newNum, status: 'Open', salesperson_id: q.salesperson_id ?? null,
        valid_days: q.valid_days ?? 30, discount_pct: q.discount_pct ?? 0, deposit_pct: q.deposit_pct ?? 40,
        interim_pct: q.interim_pct ?? 50, price_file_id: q.price_file_id ?? currentPf?.id ?? null,
        copied_from_quote_id: quoteId, created_at: new Date().toISOString(),
      })
      .select('id, quote_number, status, lead_id, salesperson_id, valid_until, created_at, price_file_id, discount_pct, deposit_pct, interim_pct, valid_days')
      .single()
    if (qErr || !newQuote) { console.error('Failed to copy quote:', qErr); return }
    const selRows = jobItems.map(item => {
      const dwgId = selections[`${quoteId}_${item.id}`]
      return dwgId ? { quote_id: newQuote.id, job_item_id: item.id, drawing_id: dwgId } : null
    }).filter(Boolean)
    if (selRows.length > 0) {
      const { error: selErr } = await supabase.from('quote_drawings').insert(selRows)
      if (!selErr) {
        const newSels = {}
        for (const row of selRows) newSels[`${newQuote.id}_${row.job_item_id}`] = row.drawing_id
        setSelections(prev => ({ ...prev, ...newSels }))
      }
    }
    setQuotes(prev => [...prev, newQuote])
    try {
      await supabase.from('lead_history').insert({ lead_id: leadId, user_id: user?.id ?? null, user_email: user?.email ?? null, event: 'Quote copied', old_value: `${lead?.lead_number} / ${q.quote_number}`, new_value: `${lead?.lead_number} / ${newNum}`, created_at: new Date().toISOString() })
    } catch { /* ignore */ }
  }

  // ── Floating quote picker panel ──────────────────────────────────────────────

  function setPanelSelection(quoteId, itemId, drawingId) {
    setPanelDraft(prev => ({ ...prev, [`${quoteId}_${itemId}`]: drawingId }))
  }

  function populateQuote(quoteId, mode) {
    setPanelDraft(prev => ({ ...prev, ...computePopulatePatch(mode, quoteId, jobItems, drawings, prev) }))
  }

  async function commitPanelUpdate(quoteId) {
    setPanelBusy(prev => ({ ...prev, [quoteId]: true }))
    const newSelections = { ...selections }
    for (const item of jobItems) {
      const key = `${quoteId}_${item.id}`
      const draftVal = panelDraft[key] || ''
      const savedVal = selections[key] || ''
      if (draftVal === savedVal) continue
      if (!draftVal) {
        await supabase.from('quote_drawings').delete().eq('quote_id', quoteId).eq('job_item_id', item.id)
        delete newSelections[key]
      } else {
        await supabase.from('quote_drawings').upsert({ quote_id: quoteId, job_item_id: item.id, drawing_id: draftVal }, { onConflict: 'quote_id,job_item_id' })
        newSelections[key] = draftVal
      }
    }
    setSelections(newSelections)
    setPanelBusy(prev => ({ ...prev, [quoteId]: false }))
  }

  function goToOverview(qId) {
    navigate(`/leads/${leadId}/quotes/${qId}`)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const openQuotes = quotes.filter(q => q.status === 'Open')
  const publishedQuotes = quotes.filter(q => q.status !== 'Open')

  return (
    <Layout subMenu={<LeadsSubNav />}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e8e6e0', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <button onClick={() => navigate(`/leads/${leadId}`)} style={{ fontSize: 12, padding: '5px 11px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer', fontWeight: 500, color: '#555' }}>← Lead</button>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{lead?.lead_number}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', border: '1px solid #d8d5cf', borderRadius: 8, overflow: 'hidden' }}>
          <button
            onClick={() => {
              const target = quoteId || openQuotes[0]?.id || quotes[0]?.id
              if (target) goToOverview(target)
              else alert('Create a quote first')
            }}
            style={{ fontSize: 12, padding: '7px 16px', border: 'none', cursor: 'pointer', fontWeight: 600, background: quoteId ? '#3d35a8' : '#fff', color: quoteId ? '#fff' : '#555' }}
          >
            Quote Overview
          </button>
          <button
            onClick={() => navigate(`/leads/${leadId}/quotes`)}
            style={{ fontSize: 12, padding: '7px 16px', border: 'none', borderLeft: '1px solid #d8d5cf', cursor: 'pointer', fontWeight: 600, background: !quoteId ? '#3d35a8' : '#fff', color: !quoteId ? '#fff' : '#555' }}
          >
            Quote Matrix
          </button>
        </div>
      </div>

      {quoteId ? (
        <QuoteOverview leadId={leadId} quoteId={quoteId} lead={lead} />
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>

            {/* ── Toolbar ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={addItem} style={toolbarBtn(true)}>+ Add Item</button>
              <button onClick={addMultipleItems} style={toolbarBtn()}>+ Add Items</button>
              <button onClick={() => setSelectMode(m => !m)} style={toolbarBtn(selectMode)}>{selectMode ? 'Cancel Select' : 'Batch Copy/Delete'}</button>
              {selectMode && (
                <>
                  <button onClick={batchCopy} disabled={selectedItemIds.size === 0} style={toolbarBtn()}>Copy ({selectedItemIds.size})</button>
                  <button onClick={batchDelete} disabled={selectedItemIds.size === 0} style={{ ...toolbarBtn(), color: '#c0392b', borderColor: '#f0c9c9' }}>Delete ({selectedItemIds.size})</button>
                </>
              )}
              <button onClick={() => setPriceFileModal(true)} style={toolbarBtn()}>Update Price File</button>
              <button onClick={() => setShowDeleted(s => !s)} style={toolbarBtn(showDeleted)}>
                {showDeleted ? 'Hide Deleted' : `Deleted Items (${deletedItemsCount})`}
              </button>
              <div style={{ flex: 1 }} />
              <button onClick={() => setPanelOpen(o => !o)} style={toolbarBtn(panelOpen)}>{panelOpen ? 'Hide Quote Panel' : 'Show Quote Panel'}</button>
            </div>

            {/* ── Price file update modal ── */}
            {priceFileModal && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPriceFileModal(false)}>
                <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: 20, width: 340 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Update Price File</div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                    Re-prices {selectedItemIds.size > 0 ? `${selectedItemIds.size} selected item(s)` : 'all drawings'} against the chosen price file.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {priceFiles.map(pf => (
                      <button key={pf.id} onClick={() => applyPriceFileUpdate(pf.id)} style={{ textAlign: 'left', fontSize: 12, padding: '8px 10px', border: '1px solid #e0def0', borderRadius: 7, background: '#faf9fe', cursor: 'pointer' }}>
                        {pf.name}{pf.is_current ? ' ★' : ''}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setPriceFileModal(false)} style={{ marginTop: 14, fontSize: 12, padding: '6px 12px', border: '1px solid #d8d5cf', borderRadius: 7, background: '#fff', cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* ── Item rows ── */}
            {loading ? (
              <div style={{ textAlign: 'center', color: '#aaa', padding: 60 }}>Loading…</div>
            ) : visibleItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bbb', padding: 60 }}>No items yet — click + Add Item to start.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {visibleItems.map(item => {
                  const itemDwgs = drawings.filter(d => d.job_item_id === item.id && (showDeleted ? true : !d.deleted_at))
                  const isDeleted = !!item.deleted_at
                  return (
                    <div key={item.id} style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 12, padding: 14, opacity: isDeleted ? 0.55 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        {/* Item label block */}
                        <div style={{ width: 190, flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            {selectMode && <input type="checkbox" checked={selectedItemIds.has(item.id)} onChange={() => toggleItemSelected(item.id)} />}
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#ede9fc', color: '#3d35a8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{item.item_number}</div>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>Item {item.item_number}</div>
                          </div>
                          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{itemLabel(item)}</div>
                          {isDeleted ? (
                            <button onClick={() => restoreItem(item)} style={miniBtn()}>Restore</button>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => moveItem(item, -1)} title="Move up" style={miniBtn()}>↑</button>
                                <button onClick={() => moveItem(item, 1)} title="Move down" style={miniBtn()}>↓</button>
                                <button onClick={() => copyAllDrawings(item)} title="Copy all drawings in this item" style={miniBtn()}>Copy All</button>
                              </div>
                              <button onClick={() => deleteItem(item)} style={{ ...miniBtn(), color: '#c0392b' }}>Delete Item</button>
                            </div>
                          )}
                        </div>

                        {/* Drawing cards */}
                        <div style={{ flex: 1, display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                          {itemDwgs.map(dwg => {
                            const stale = isStale(dwg.id)
                            const showPrice = dwg.poa ? 'POA' : dwg.calculated_price != null ? fmt(dwg.calculated_price) : '—'
                            const runPf = priceFiles.find(p => p.id === latestRuns[dwg.id]?.price_file_id)
                            const pfName = runPf?.name || defaultPriceFile?.name || '—'
                            const desc = [dwg.window_type, dwg.material_frame, dwg.finish_internal].filter(Boolean).join(' · ')
                            return (
                              <div key={dwg.id} style={{ width: 190, flexShrink: 0, border: '1px solid #e0def0', borderRadius: 10, overflow: 'hidden', opacity: dwg.deleted_at ? 0.5 : 1 }}>
                                <div style={{ padding: '7px 10px', background: '#f8f8fc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#3d35a8' }}>Drawing {item.item_number}.{dwg.drawing_number}</span>
                                  {!dwg.deleted_at && (
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button onClick={() => navigate(`/drawing-board/${dwg.id}`)} title="Edit" style={iconBtn()}>✎</button>
                                      <button onClick={() => copySingleDrawing(dwg)} title="Copy" style={iconBtn()}>⎘</button>
                                      <button onClick={() => moveDrawing(item, dwg, -1)} title="Move left" style={iconBtn()}>←</button>
                                      <button onClick={() => moveDrawing(item, dwg, 1)} title="Move right" style={iconBtn()}>→</button>
                                      <button onClick={() => deleteDrawing(dwg)} title="Delete" style={iconBtn()}>✕</button>
                                    </div>
                                  )}
                                </div>
                                <DrawingThumb drawingId={dwg.id} />
                                <div style={{ padding: '6px 10px', fontSize: 10, color: '#888', borderTop: '1px solid #f0eef8', minHeight: 14 }}>{desc || '—'}</div>
                                <div style={{ padding: '6px 10px', borderTop: '1px solid #f0eef8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: '#333' }}>{pfName} {showPrice} Qty 1</span>
                                  {stale && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 999, background: '#fffbeb', color: '#b45309', fontWeight: 700, border: '1px solid #fcd34d' }}>needs pricing</span>}
                                </div>
                              </div>
                            )
                          })}

                          {/* Add Drawing card */}
                          {!isDeleted && (
                            <div style={{ width: 160, flexShrink: 0, border: '1px dashed #c0bdb5', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', position: 'relative' }}>
                              <div style={{ fontSize: 10, color: '#888', fontWeight: 600, marginBottom: 2 }}>Add Drawing</div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button onClick={() => addDrawingQuick(item, 'sash')} style={quickBtn()}>Sash</button>
                                <button disabled title="Coming soon" style={{ ...quickBtn(), opacity: 0.5, cursor: 'not-allowed' }}>Casement</button>
                                <button disabled title="Coming soon" style={{ ...quickBtn(), opacity: 0.5, cursor: 'not-allowed' }}>Door</button>
                              </div>
                              <button onClick={() => setTemplatePickerFor(templatePickerFor === item.id ? null : item.id)} style={{ ...miniBtn(), width: '100%' }}>More…</button>
                              {templatePickerFor === item.id && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, marginTop: 4, width: 220, background: '#fff', border: '1px solid #e0def0', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.12)', padding: 8, maxHeight: 220, overflowY: 'auto' }}>
                                  {profiles.length === 0 ? (
                                    <div style={{ fontSize: 11, color: '#aaa', padding: 6 }}>No templates found</div>
                                  ) : profiles.map(p => (
                                    <button key={p.id} onClick={() => addDrawingFromProfile(item, p)} style={{ display: 'block', width: '100%', textAlign: 'left', fontSize: 11, padding: '6px 8px', border: 'none', borderRadius: 5, background: 'transparent', cursor: 'pointer' }}>
                                      {p.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Floating quote picker panel ── */}
          {panelOpen && (
            <div style={{ width: 380, flexShrink: 0, background: '#e6f5f2', borderLeft: '2px solid #b8e0d8', overflowY: 'auto', padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0a5a3c' }}>Quote picker</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={createQuote} style={{ fontSize: 11, padding: '5px 10px', border: 'none', borderRadius: 6, background: '#0a5a3c', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>+ New quote</button>
                  <button onClick={() => setPanelOpen(false)} style={{ fontSize: 11, padding: '5px 8px', border: '1px solid #b8e0d8', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>✕</button>
                </div>
              </div>

              {openQuotes.length === 0 ? (
                <div style={{ fontSize: 12, color: '#5a8a7c', textAlign: 'center', padding: 20 }}>No open quotes — click + New quote</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {openQuotes.map(q => {
                    const totals = (() => {
                      const items = jobItems.map(item => {
                        const dwgId = panelDraft[`${q.id}_${item.id}`]
                        const dwg = dwgId ? drawings.find(d => d.id === dwgId) : null
                        if (!dwg) return null
                        return { calculated: parseFloat(dwg.calculated_price) || 0, priceOverride: dwg.price_override ?? null, itemDiscountPct: dwg.item_discount_pct ?? 0, vatRate: dwg.vat_rate ?? 20, poa: dwg.poa ?? false }
                      }).filter(Boolean)
                      return items.length > 0 ? computeQuoteTotals({ discountPct: q.discount_pct, depositPct: q.deposit_pct, interimPct: q.interim_pct }, items) : null
                    })()
                    return (
                      <div key={q.id} style={{ background: '#fff', borderRadius: 10, padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{q.quote_number}</div>
                          <button onClick={() => goToOverview(q.id)} style={{ fontSize: 10, padding: '3px 9px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#faf9f7', cursor: 'pointer' }}>Open</button>
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                          <select id={`populate-${q.id}`} defaultValue="" style={{ fontSize: 10, flex: 1, padding: '4px 6px', border: '1px solid #d8d5cf', borderRadius: 5 }}>
                            <option value="" disabled>Populate…</option>
                            <option value="first">First drawing of each item</option>
                            {quotes.filter(q2 => q2.id !== q.id).map(q2 => <option key={q2.id} value={`copy:${q2.id}`}>Copy {q2.quote_number}</option>)}
                            <option value="clear">Clear</option>
                          </select>
                          <button onClick={() => { const sel = document.getElementById(`populate-${q.id}`); if (sel.value) populateQuote(q.id, sel.value) }} style={{ fontSize: 10, padding: '4px 8px', border: '1px solid #d8d5cf', borderRadius: 5, background: '#fff', cursor: 'pointer' }}>Apply</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                          {jobItems.map(item => {
                            const itemDwgs = drawings.filter(d => d.job_item_id === item.id && !d.deleted_at)
                            const val = panelDraft[`${q.id}_${item.id}`] || ''
                            return (
                              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, color: '#888', width: 46, flexShrink: 0 }}>Item {item.item_number}</span>
                                <select value={val} onChange={e => setPanelSelection(q.id, item.id, e.target.value)} style={{ fontSize: 10, flex: 1, padding: '4px 6px', border: '1px solid #d8d5cf', borderRadius: 5 }}>
                                  <option value="">Not included</option>
                                  {itemDwgs.map(dwg => {
                                    const price = dwg.poa ? 'POA' : dwg.calculated_price != null ? fmt(dwg.calculated_price) : '—'
                                    const runPf = priceFiles.find(p => p.id === latestRuns[dwg.id]?.price_file_id)
                                    return <option key={dwg.id} value={dwg.id}>{runPf?.name || defaultPriceFile?.name || 'PF'} {price} Qty 1</option>
                                  })}
                                </select>
                              </div>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: 6, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: '#888' }}>Total</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#0a5a3c' }}>{totals ? fmt(totals.totalInclVat) : '—'}</span>
                        </div>
                        <button onClick={() => commitPanelUpdate(q.id)} disabled={panelBusy[q.id]} style={{ width: '100%', fontSize: 11, padding: '6px 0', border: 'none', borderRadius: 6, background: '#0a5a3c', color: '#fff', cursor: 'pointer', fontWeight: 600, marginBottom: 6 }}>
                          {panelBusy[q.id] ? 'Saving…' : 'Update'}
                        </button>
                        <button onClick={() => doPriceQuote(q.id)} disabled={pricing[q.id]?.busy} style={{ width: '100%', fontSize: 11, padding: '6px 0', border: '1px solid #d8d5cf', borderRadius: 6, background: '#fff', color: '#555', cursor: 'pointer', fontWeight: 500, marginBottom: 4 }}>
                          {pricing[q.id]?.busy ? 'Pricing…' : 'Price quote'}
                        </button>
                        {pricing[q.id]?.error && <div style={{ fontSize: 10, color: '#c00' }}>{pricing[q.id].error}</div>}
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          <button onClick={() => doPublishQuote(q.id)} style={{ flex: 1, fontSize: 10, padding: '5px 0', border: 'none', borderRadius: 5, background: '#1a5fa8', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Publish</button>
                          <button onClick={() => doCopyQuote(q.id)} style={{ flex: 1, fontSize: 10, padding: '5px 0', border: '1px solid #d8d5cf', borderRadius: 5, background: '#fff', color: '#3d35a8', cursor: 'pointer', fontWeight: 600 }}>Copy</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Open Quotes — published, read-only */}
              <div style={{ marginTop: 18 }}>
                <button onClick={() => setOpenQuotesExpanded(e => !e)} style={{ width: '100%', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#0a5a3c', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                  {openQuotesExpanded ? '▾' : '▸'} Published quotes ({publishedQuotes.length})
                </button>
                {openQuotesExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {publishedQuotes.map(q => (
                      <div key={q.id} style={{ background: '#fff', borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>🔒 {q.quote_number}</span>
                        <button onClick={() => goToOverview(q.id)} style={{ fontSize: 10, padding: '3px 9px', border: '1px solid #d8d5cf', borderRadius: 6, background: '#faf9f7', cursor: 'pointer' }}>Open</button>
                      </div>
                    ))}
                    {publishedQuotes.length === 0 && <div style={{ fontSize: 11, color: '#5a8a7c' }}>None yet</div>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

// ── Small style helpers ──────────────────────────────────────────────────────

function toolbarBtn(active) {
  return {
    fontSize: 12, padding: '6px 13px', borderRadius: 7, fontWeight: 500, cursor: 'pointer',
    border: active ? '1px solid #3d35a8' : '1px solid #d8d5cf',
    background: active ? '#3d35a8' : '#fff',
    color: active ? '#fff' : '#555',
  }
}
function miniBtn() {
  return { fontSize: 10, padding: '3px 7px', border: '1px solid #d8d5cf', borderRadius: 5, background: '#faf9f7', cursor: 'pointer', color: '#555' }
}
function iconBtn() {
  return { fontSize: 10, padding: '2px 5px', border: 'none', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: '#888' }
}
function quickBtn() {
  return { flex: 1, fontSize: 10, padding: '5px 0', border: '1px solid #d8d5cf', borderRadius: 5, background: '#fff', cursor: 'pointer', color: '#3d35a8', fontWeight: 600 }
}
