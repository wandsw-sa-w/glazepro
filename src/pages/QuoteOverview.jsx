import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { loadDrawingParts, saveDrawingParts, loadReferenceOptions, loadFieldDefinitions, loadProfileValues } from '../drawingBoard/api.js'
import { treeHash } from '../pricing/treeHash.js'
import { computeQuoteTotals } from '../quotes/quoteTotals.js'
import { GRID_COLUMNS, readColumnValue, writeColumnValue } from '../quotes/gridColumns.js'
import { loadDrawingRunPrices, drawingRunSales, drawingQuoteItemNet } from '../quotes/drawingRunPrice.js'
import { effectiveProfileId } from '../drawingBoard/defaultProfile.js'
import { buildQuoteSnapshot } from '../quotes/buildSnapshot.js'
import { publishQuote } from '../quotes/publishQuote.js'
import { copyQuote } from '../quotes/copyQuote.js'
import { FRONT_COVER_LETTER, BACK_COVER_LETTER } from '../quotes/pdf/quoteContent.js'
import { useVersion } from '../context/VersionContext.jsx'
import { validateDrawing, validateQuote, countBySeverity, hasErrors as hasValidationErrors } from '../validation/validate.js'
import { computeVariables, computeQuoteVariables } from '../pricing/computeVariables.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'

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

// Back cover letter: flatten [{heading, body}] into display text for the
// letter-view modal.
function flatBackCoverLetter(sections) {
  if (typeof sections === 'string') return sections
  return (sections || []).map(s => `${s.heading}\n${s.body}`).join('\n\n')
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuoteOverview({ leadId, quoteId, lead: leadStub }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isStale } = useVersion()

  const [lead, setLead] = useState(leadStub || null)
  const [mainContact, setMainContact] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [quote, setQuote] = useState(null)
  const [jobItems, setJobItems] = useState([])
  const [drawings, setDrawings] = useState([])
  const [selections, setSelections] = useState({})
  const [priceFiles, setPriceFiles] = useState([])
  const [latestRuns, setLatestRuns] = useState({}) // drawingId -> {id, price_file_id, tree_hash, status}
  const [drawingRunPrices, setDrawingRunPrices] = useState({}) // drawingId -> {sales, cost, pricingRunId, priceFileId} — see drawingRunPrice.js
  const [salespersonName, setSalespersonName] = useState('')
  const [loading, setLoading] = useState(true)
  const [refOptions, setRefOptions] = useState({})
  const [leadHistory, setLeadHistory] = useState([])
  const [costByDrawing, setCostByDrawing] = useState({})
  const [quoteItemCounts, setQuoteItemCounts] = useState({}) // quoteId → count
  const [quoteApportionment, setQuoteApportionment] = useState({}) // drawingId → sales total from latest quote pricing run
  const [profileDefaultsByDrawing, setProfileDefaultsByDrawing] = useState({}) // drawingId → { 'partType.property': value }
  const [profileNames, setProfileNames] = useState({}) // profileId → label
  const [profiles, setProfiles] = useState([]) // [{id, code, label}] — active default_profiles, for the fallback resolver

  const [usersList, setUsersList] = useState([]) // [{id, full_name}] for salesperson dropdown

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
  const [previewing, setPreviewing] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(null)
  const [previewError, setPreviewError] = useState(null)
  const [generatingSow, setGeneratingSow] = useState(false)
  const [generatingDetail, setGeneratingDetail] = useState(false)
  const [validationResults, setValidationResults] = useState([])
  const [validationCounts, setValidationCounts] = useState({ errors: 0, warnings: 0, info: 0 })

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
          .select('id, job_item_id, drawing_number, deleted_at, calculated_price, window_type, poa, price_override, item_discount_pct, vat_rate, notes_quote, notes_installation, default_profile_id')
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

        // Drawing-level sales/cost from each drawing's own latest completed
        // run — never drawings.calculated_price, which priceQuote doesn't
        // write and so can go stale. See src/quotes/drawingRunPrice.js.
        const runPrices = await loadDrawingRunPrices(drawingIds, supabase)
        setDrawingRunPrices(runPrices)

        const runIds = Object.values(runsMap).map(r => r.id)
        const costMap = {}   // drawing_id → total cost (drawing-level + quote apportioned)
        for (const [dId, rp] of Object.entries(runPrices)) {
          if (rp.cost != null) costMap[dId] = rp.cost
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

      // Load users for salesperson dropdown
      const { data: usersRows } = await supabase.from('users').select('id, full_name').order('full_name')
      setUsersList((usersRows || []).filter(u => u.full_name))

      const categories = [...new Set(GRID_COLUMNS.filter(c => c.referenceCategory).map(c => c.referenceCategory))]
      const loadedRefOptions = categories.length > 0 ? await loadReferenceOptions(categories).catch(() => ({})) : {}
      setRefOptions(loadedRefOptions)

      // Load profile defaults for each drawing's profile. A drawing with no
      // default_profile_id of its own (e.g. created before this fix, or by
      // an older version of the quick "Sash" button) falls back to the same
      // profile the drawing board itself falls back to — see
      // src/drawingBoard/defaultProfile.js — instead of showing "—" for
      // every field.
      const { data: allProfiles } = await supabase.from('default_profiles').select('id, code, label').eq('is_active', true)
      setProfiles(allProfiles || [])
      const profileIds = [...new Set(
        dwgs.map(d => effectiveProfileId(d, allProfiles || [])).filter(Boolean)
      )]
      if (profileIds.length > 0) {
        const fieldDefs = await loadFieldDefinitions().catch(() => ({}))
        const pnMap = {}
        for (const p of (allProfiles || [])) pnMap[p.id] = p.label
        setProfileNames(pnMap)

        const allPvRows = await Promise.all(profileIds.map(pid => loadProfileValues(pid).catch(() => [])))
        const pvByProfile = {}
        for (let i = 0; i < profileIds.length; i++) {
          const pvMap = {}
          for (const pv of (allPvRows[i] || [])) pvMap[pv.field_key] = pv
          pvByProfile[profileIds[i]] = pvMap
        }

        // Build per-drawing profileDefaults: { drawingId: { 'partType.property': convertedValue } }
        const pdMap = {}
        for (const dwg of dwgs) {
          const effId = effectiveProfileId(dwg, allProfiles || [])
          if (!effId) continue
          const pvMap = pvByProfile[effId] || {}
          const defaults = {}
          // For each grid column that has partType/property, resolve the profile default
          for (const col of GRID_COLUMNS) {
            if (!col.partType || !col.property) continue
            const fieldKey = `${col.partType}.${col.property}`
            const pv = pvMap[fieldKey]
            if (!pv || pv.default_value == null) continue
            // Find the field definition for this field_key to determine data_type
            const fields = fieldDefs[col.partType] ?? []
            const field = fields.find(f => f.field_key === fieldKey)
            if (!field) { defaults[fieldKey] = pv.default_value; continue }
            // Convert value based on data_type
            switch (field.data_type) {
              case 'number': {
                const n = Number(pv.default_value)
                if (!isNaN(n)) defaults[fieldKey] = n
                break
              }
              case 'boolean': {
                const s = String(pv.default_value).toLowerCase()
                if (s === '1' || s === 'true' || s === 'yes') defaults[fieldKey] = true
                else if (s === '0' || s === 'false' || s === 'no') defaults[fieldKey] = false
                break
              }
              case 'reference':
              case 'multi_reference': {
                const category = field.reference_category
                const options = loadedRefOptions[category] ?? []
                const raw = pv.default_value
                const srcRef = pv.source_ref
                let match = options.find(o => o.code === raw)
                if (!match && srcRef) match = options.find(o => o.code === srcRef)
                if (!match) match = options.find(o => o.label.toLowerCase() === String(raw).toLowerCase())
                if (match) defaults[fieldKey] = match.code
                break
              }
              default:
                defaults[fieldKey] = pv.default_value
            }
          }
          pdMap[dwg.id] = defaults
        }
        setProfileDefaultsByDrawing(pdMap)
      }
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
      salesperson_id: quote.salesperson_id || '',
    })
    setPaymentsDraft({ deposit_pct: quote.deposit_pct ?? 40, interim_pct: quote.interim_pct ?? 50 })
  }, [quote?.id])

  // ── Validation: compute results when trees are loaded ───────────────────────
  useEffect(() => {
    let cancelled = false
    async function runValidation() {
      const treeKeys = Object.keys(trees).filter(k => trees[k])
      if (treeKeys.length === 0) {
        setValidationResults([])
        setValidationCounts({ errors: 0, warnings: 0, info: 0 })
        return
      }
      // Load install minutes from latest pricing runs for installation_labour_time
      const drawingIds = treeKeys.map(Number).filter(Boolean)
      let totalInstallMinutes = 0
      if (drawingIds.length > 0) {
        const { data: pVars } = await supabase
          .from('drawing_pricing_variables')
          .select('drawing_id, variables')
          .in('drawing_id', drawingIds)
        if (cancelled) return
        for (const v of (pVars || [])) totalInstallMinutes += Number(v.variables?.total_install_minutes) || 0
      }

      const [
        { data: ruleData, error: rErr },
        { data: listData, error: lErr },
        { data: valData, error: vErr },
      ] = await Promise.all([
        supabase.from('validation_rules').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('validation_lists').select('*'),
        supabase.from('validation_list_values').select('*'),
      ])
      if (cancelled) return
      if (rErr || lErr || vErr) return
      const listsMap = {}
      for (const l of (listData || [])) {
        listsMap[l.name] = (valData || []).filter(v => v.list_id === l.id).map(v => v.value)
      }
      const itemRules = (ruleData || []).filter(r => r.level === 'item')
      const quoteRules = (ruleData || []).filter(r => r.level === 'quote')
      const allResults = []
      const itemVarsList = []

      // Build a drawingId→itemNumber map for labelling results
      const dwgItemMap = {}
      for (const item of jobItems) {
        const dwgId = selections[item.id]
        if (dwgId) dwgItemMap[String(dwgId)] = item.item_number
      }

      for (const dwgId of treeKeys) {
        const tree = trees[dwgId]
        if (!tree) continue
        const derived = computeDerived(tree)
        const vars = computeVariables(tree, derived) || {}
        itemVarsList.push(vars)
        const results = validateDrawing(tree, vars, itemRules, listsMap)
        const itemNum = dwgItemMap[String(dwgId)]
        for (const r of results) {
          if (r.status === 'fired') {
            r._itemNumber = itemNum
            allResults.push(r)
          }
        }
      }

      // Quote-level rules
      if (quoteRules.length > 0) {
        const quoteVars = computeQuoteVariables(itemVarsList, { totalInstallMinutes })
        const quoteResults = validateQuote(quoteVars, allResults, quoteRules, listsMap)
        for (const r of quoteResults) {
          if (r.status === 'fired') {
            r._isQuoteLevel = true
            allResults.push(r)
          }
        }
      }

      if (cancelled) return
      setValidationResults(allResults)
      setValidationCounts(countBySeverity(allResults))
    }
    runValidation()
    return () => { cancelled = true }
  }, [trees])

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
    return { calculated: drawingQuoteItemNet(dwg, drawingRunPrices, quoteApportionment), priceOverride: dwg.price_override ?? null, itemDiscountPct: dwg.item_discount_pct ?? 0, vatRate: dwg.vat_rate ?? 20, poa: dwg.poa ?? false }
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
      salesperson_id: detailsDraft.salesperson_id || null,
    }
    const { error } = await supabase.from('quotes').update(patch).eq('id', quote.id)
    if (!error) { setQuote(prev => ({ ...prev, ...patch })); setEditDetailsOpen(false); load() }
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
    if (isStale) { setPublishError('A new version of GlazePro is available — please reload the page before publishing.'); return }
    if (validationCounts.errors > 0) { setPublishError(`${validationCounts.errors} validation error(s) must be resolved before publishing. Review the validation results above.`); return }
    if (staleCount > 0) { setPublishError(`${staleCount} drawing(s) need pricing before this quote can be published — price them from the Quote Matrix.`); return }
    if (poaCount > 0 && !window.confirm(`This quote contains ${poaCount} POA item(s). Publish anyway?`)) return
    setPublishing(true)
    setPublishError(null)
    try {
      await publishQuote({ quoteId: quote.id, leadId, userId: user?.id, userName: user?.user_metadata?.full_name || user?.email?.split('@')[0], userEmail: user?.email, leadNumber: lead?.lead_number, quoteNumber: quote.quote_number, supabase })
    } catch (e) {
      setPublishError(e.message)
    }
    setPublishing(false)
    load()
  }

  async function doCopy() {
    setPublishError(null)
    try {
      const { newQuote } = await copyQuote({
        sourceQuote: quote, quotes, leadId, leadNumber: lead?.lead_number,
        jobItems, selections, userId: user?.id, userEmail: user?.email, supabase,
      })
      navigate(`/leads/${leadId}/quotes/${newQuote.id}`)
    } catch (e) {
      setPublishError(e.message)
    }
  }

  async function doAccept() {
    const acceptedAt = new Date().toISOString()
    const { error } = await supabase.from('quotes').update({ status: 'Accepted', accepted_at: acceptedAt }).eq('id', quote.id)
    if (!error) {
      setQuote(prev => ({ ...prev, status: 'Accepted', accepted_at: acceptedAt }))
      try { await supabase.from('lead_history').insert({ lead_id: leadId, user_id: user?.id ?? null, user_email: user?.email ?? null, event: 'Quote accepted', new_value: `${lead?.lead_number} / ${quote.quote_number}`, created_at: new Date().toISOString() }) } catch { /* ignore */ }
    }
  }

  async function doPreview() {
    if (staleCount > 0) { setPreviewError(`${staleCount} drawing(s) need pricing before a preview can be generated — price them from the Quote Matrix.`); return }
    setPreviewing(true)
    setPreviewError(null)
    setPreviewProgress('Building snapshot…')
    try {
      const snapshot = await buildQuoteSnapshot({ quoteId: quote.id, leadId, userId: user?.id, userName: user?.user_metadata?.full_name || user?.email?.split('@')[0], supabase })
      const { renderQuotePdf } = await import('../quotes/pdf/renderQuotePdf.js')
      const blob = await renderQuotePdf(snapshot, { watermark: true, onProgress: setPreviewProgress })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (e) {
      setPreviewError(`Preview failed: ${e.message}`)
    }
    setPreviewing(false)
    setPreviewProgress(null)
  }

  async function doGenerateSow() {
    setGeneratingSow(true)
    setPreviewError(null)
    try {
      let snapshot
      if (quote.status === 'Open') {
        snapshot = await buildQuoteSnapshot({ quoteId: quote.id, leadId, userId: user?.id, userName: user?.user_metadata?.full_name || user?.email?.split('@')[0], supabase })
      } else {
        snapshot = quote.snapshot
      }
      if (!snapshot || snapshot.version !== 2) throw new Error('Snapshot not available — publish the quote first or copy to a new one')
      const { renderScheduleOfWork } = await import('../quotes/pdf/renderScheduleOfWork.js')
      const blob = await renderScheduleOfWork(snapshot, { headerMode: 'customer' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (e) {
      setPreviewError(`SOW failed: ${e.message}`)
    }
    setGeneratingSow(false)
  }

  async function doGenerateItemDetail() {
    setGeneratingDetail(true)
    setPreviewError(null)
    try {
      let snapshot
      if (quote.status === 'Open') {
        snapshot = await buildQuoteSnapshot({ quoteId: quote.id, leadId, userId: user?.id, userName: user?.user_metadata?.full_name || user?.email?.split('@')[0], supabase })
      } else {
        snapshot = quote.snapshot
      }
      if (!snapshot || snapshot.version !== 2) throw new Error('Snapshot not available — publish the quote first or copy to a new one')
      const { renderItemDetailSheet } = await import('../quotes/pdf/renderItemDetailSheet.js')
      const blob = await renderItemDetailSheet(snapshot)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (e) {
      setPreviewError(`Item Detail failed: ${e.message}`)
    }
    setGeneratingDetail(false)
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
        <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12 }}>
          {/* Summary counts */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: validationResults.length > 0 ? 8 : 0 }}>
            <span style={{ fontWeight: 600 }}>Validation</span>
            {validationCounts.errors > 0 && <span style={{ color: '#dc2626', fontWeight: 600 }}>{validationCounts.errors} error{validationCounts.errors !== 1 ? 's' : ''}</span>}
            {validationCounts.warnings > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>{validationCounts.warnings} warning{validationCounts.warnings !== 1 ? 's' : ''}</span>}
            {validationCounts.info > 0 && <span style={{ color: '#3b82f6', fontWeight: 600 }}>{validationCounts.info} info</span>}
            {validationCounts.errors === 0 && validationCounts.warnings === 0 && validationCounts.info === 0 && <span style={{ color: '#15803d', fontWeight: 500 }}>No issues</span>}
            {staleCount > 0 && <span style={{ color: '#b45309', fontWeight: 600 }}>{staleCount} drawing(s) need pricing</span>}
            {poaCount > 0 && <span style={{ color: '#b45309', fontWeight: 600 }}>{poaCount} POA item(s)</span>}
          </div>
          {/* Individual messages grouped by severity: quote-level first, then per-item */}
          {validationResults.length > 0 && (() => {
            const quoteResults = validationResults.filter(r => r._isQuoteLevel)
            const itemResults = validationResults.filter(r => !r._isQuoteLevel)
            const severityOrder = { error: 0, warning: 1, information: 2 }
            const sortBySev = (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3)
            const sevColor = { error: '#dc2626', warning: '#f59e0b', information: '#3b82f6' }
            const sevBg = { error: '#fef2f2', warning: '#fffbeb', information: '#eff6ff' }
            const sorted = [...quoteResults.sort(sortBySev), ...itemResults.sort(sortBySev)]
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {sorted.map((r, idx) => (
                  <div key={idx} style={{ padding: '3px 8px', borderRadius: 4, background: sevBg[r.severity] || '#f5f4f0', color: sevColor[r.severity] || '#555', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                      {r._isQuoteLevel ? 'Quote' : r._itemNumber != null ? `Item ${r._itemNumber}` : ''}
                    </span>
                    {r.part_label && <span style={{ fontSize: 10, color: '#888', flexShrink: 0 }}>{r.part_label}</span>}
                    <span>{r.message}</span>
                  </div>
                ))}
              </div>
            )
          })()}
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
                      if (col.key === 'product_range') return <td key={col.key} style={{ ...bodyCell, background: rowBg }}>{profileNames[effectiveProfileId(dwg, profiles)] || '—'}</td>
                      const raw = col.source === 'drawing' ? (dwg[col.field] ?? null) : readColumnValue(tree, col, profileDefaultsByDrawing[dwg.id])
                      const canEdit = isLive && col.editable && (col.source === 'drawing' || tree)
                      if (!canEdit) {
                        const display = col.type === 'boolean' ? (raw == null ? '—' : (raw ? 'Yes' : 'No')) : (raw == null || raw === '' ? '—' : String(raw))
                        return <td key={col.key} style={{ ...bodyCell, background: rowBg, color: raw == null ? '#ccc' : '#333' }}>{display}</td>
                      }
                      return (
                        <td key={col.key} style={{ ...bodyCell, background: rowBg }}>
                          {col.type === 'boolean' ? (
                            <input type="checkbox" checked={!!raw} onChange={e => editCell(item, col, e.target.checked)} />
                          ) : col.type === 'reference' ? (() => {
                            const options = refOptions[col.referenceCategory] || []
                            // A stored value that isn't in the resolved options list (wrong/
                            // missing reference_category, or an options list that's empty or
                            // out of date) must still show, not silently vanish — <select>
                            // shows nothing selected when `value` matches no <option>, which
                            // looks exactly like the field is blank even though it has a value.
                            const hasMatch = options.some(o => o.code === raw)
                            return (
                              <select value={raw ?? ''} onChange={e => editCell(item, col, e.target.value)} style={cellInput}>
                                <option value="">—</option>
                                {options.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                                {raw && !hasMatch && <option value={raw}>{raw}</option>}
                              </select>
                            )
                          })() : col.type === 'number' ? (
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
        {isLive && <button onClick={doPreview} disabled={previewing || staleCount > 0} style={previewing || staleCount > 0 ? disabledBtn() : { fontSize: 12, padding: '8px 16px', border: '1px solid #3d35a8', borderRadius: 8, background: '#fff', color: '#3d35a8', fontWeight: 600, cursor: 'pointer' }}>
          {previewing ? (previewProgress || 'Generating…') : 'Generate quote preview'}
        </button>}
        <button onClick={() => navigate(`/leads/${leadId}`)} style={miniLinkBtn()}>Click here for more outputs</button>
        {(quote.status === 'Open' || quote.status === 'Published') && (
          <button onClick={doGenerateSow} disabled={generatingSow} style={{ fontSize: 11, padding: '6px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', color: '#555', cursor: generatingSow ? 'default' : 'pointer' }}>
            {generatingSow ? 'Generating...' : 'Schedule of Work'}
          </button>
        )}
        {(quote.status === 'Open' || quote.status === 'Published') && (
          <button onClick={doGenerateItemDetail} disabled={generatingDetail} style={{ fontSize: 11, padding: '6px 14px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', color: '#555', cursor: generatingDetail ? 'default' : 'pointer' }}>
            {generatingDetail ? 'Generating...' : 'Item Detail Sheet'}
          </button>
        )}
        <div style={{ flex: 1 }} />
        {quote.status === 'Open' ? (
          <>
            <span style={{ fontSize: 11, color: '#aaa' }}>A quote becomes locked when it is published</span>
            <button onClick={doPublish} disabled={publishing || isStale} style={{ fontSize: 12, padding: '8px 18px', border: 'none', borderRadius: 8, background: isStale ? '#ccc' : '#1a5fa8', color: '#fff', fontWeight: 700, cursor: isStale ? 'not-allowed' : 'pointer' }}>
              {publishing ? 'Publishing…' : `Publish ${quote.quote_number}`}
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12, color: '#555' }}>🔒 Published {quote.published_at ? new Date(quote.published_at).toLocaleDateString('en-GB') : ''}</span>
            {quote.pdf_path && <button onClick={async () => {
              const { data, error } = await supabase.storage.from('quote-pdfs').createSignedUrl(quote.pdf_path, 300)
              if (data?.signedUrl) window.open(data.signedUrl, '_blank')
              else if (error) alert(`Download failed: ${error.message}`)
            }} style={{ fontSize: 12, padding: '8px 16px', border: '1px solid #1a5fa8', borderRadius: 8, background: '#fff', color: '#1a5fa8', fontWeight: 600, cursor: 'pointer' }}>Download PDF</button>}
            {!quote.pdf_path && quote.snapshot?.version !== 2 && <span style={{ fontSize: 11, color: '#aaa' }}>Published before PDFs were available — copy to a new quote and publish that</span>}
          </>
        )}
        <button onClick={doCopy} style={{ fontSize: 12, padding: '8px 16px', border: '1px solid #d8d5cf', borderRadius: 8, background: '#fff', color: '#3d35a8', fontWeight: 600, cursor: 'pointer' }}>Copy to new quote</button>
        {quote.status === 'Published' && <button onClick={doAccept} style={{ fontSize: 12, padding: '8px 16px', border: 'none', borderRadius: 8, background: '#0a5a3c', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Accept</button>}
      </div>
      {publishError && <div style={{ color: '#c00', fontSize: 12, marginBottom: 16 }}>{publishError}</div>}
      {previewError && <div style={{ color: '#c00', fontSize: 12, marginBottom: 16 }}>{previewError}</div>}

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
          <FieldRow label="Sales Person on Quote">
            <select value={detailsDraft.salesperson_id} onChange={e => setDetailsDraft(d => ({ ...d, salesperson_id: e.target.value }))} style={modalInput}>
              <option value="">— None —</option>
              {usersList.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </FieldRow>
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
            {mergeLetter(letterView === 'front' ? FRONT_COVER_LETTER : flatBackCoverLetter(BACK_COVER_LETTER), mergeFields)}
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
