/**
 * buildSnapshot.js — single place that builds the v2 quote snapshot.
 *
 * Both the Overview's doPublish, the Matrix's doPublishQuote, and the
 * preview path call buildQuoteSnapshot(). The snapshot contains everything
 * the PDF needs so it never reads live data.
 *
 * assembleSnapshot() is the pure core, exported for testing.
 */

import { loadDrawingParts } from '../drawingBoard/api.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { computeSashGeometry } from '../drawingBoard/sashGeometry.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { defaultIronmonger } from '../pricing/defaultIronmongery.js'
import { loadDrawingRunPrices, drawingQuoteItemNet } from './drawingRunPrice.js'
import { computeQuoteTotals } from './quoteTotals.js'
import { QUOTE_CONTENT } from './pdf/quoteContent.js'
import { loadQuoteSettings, mergeQuoteContent } from './loadQuoteSettings.js'
import { fetchAllRows } from '../lib/fetchAllRows.js'

// ── Tree helper ─────────────────────────────────────────────────────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

// ── Pure assembly (tested directly) ─────────────────────────────────────────

/**
 * Assemble a v2 snapshot from pre-fetched data. No I/O.
 *
 * @param {object} data  All the resolved data (see fetchSnapshotData)
 * @returns {object}     The frozen snapshot object
 */
export function assembleSnapshot(data) {
  const {
    quote, lead, mainContact, postalContact,
    salesperson, publishingUser,
    jobItems, selections, drawings,
    trees, drawingRunPrices, quoteApportionment,
    ironmongeryByDrawing, allocatedPartsByDrawing,
    latestRunByDrawing, profilesByDrawing,
    refLabels, refOptionsByCategory, profileLabelByDrawing,
    content,
  } = data

  const now = new Date().toISOString()

  // Build per-item totals input
  const selectedItems = jobItems
    .map(item => {
      const dwgId = selections[item.id]
      if (!dwgId) return null
      const dwg = drawings.find(d => String(d.id) === String(dwgId))
      if (!dwg) return null
      return { item, dwg, dwgId }
    })
    .filter(Boolean)

  const totalsInput = selectedItems.map(({ dwg }) => ({
    calculated: drawingQuoteItemNet(dwg, drawingRunPrices, quoteApportionment),
    priceOverride: dwg.price_override ?? null,
    itemDiscountPct: dwg.item_discount_pct ?? 0,
    vatRate: dwg.vat_rate ?? 20,
    poa: dwg.poa ?? false,
  }))

  const totals = computeQuoteTotals(
    {
      discountPct: quote.discount_pct ?? 0,
      depositPct: quote.deposit_pct ?? 40,
      interimPct: quote.interim_pct ?? 50,
    },
    totalsInput,
  )

  // Installation address (one-line and multi-line)
  const installLines = [
    lead?.property_name_number, lead?.property_road,
    lead?.property_town, lead?.property_county, lead?.property_postcode,
  ].filter(Boolean)
  const installOneLine = [
    lead?.property_road, lead?.property_town, lead?.property_postcode,
  ].filter(Boolean).join(', ')

  // Postal address
  const postalLines = postalContact
    ? [postalContact.address_1, postalContact.address_2, postalContact.town, postalContact.county, postalContact.postcode].filter(Boolean)
    : null
  const postalText = postalLines && postalLines.length > 0
    ? postalLines.join(', ')
    : 'Same as installation'

  const validUntil = quote.valid_days
    ? new Date(Date.now() + quote.valid_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    : null

  // Initials from a full name ("Nathan Smith" → "NS") or an email local
  // part ("nathan.smith" → "NS"). Splits on whitespace, dots, hyphens.
  function initials(name) {
    if (!name) return ''
    const parts = name.split(/[\s.\-_]+/).filter(Boolean)
    if (parts.length === 0) return ''
    return parts.map(w => w[0]).join('').toUpperCase()
  }

  // ── Per-item snapshot entries ─────────────────────────────────────────────

  const items = selectedItems.map(({ item, dwg, dwgId }, idx) => {
    const tree = trees[dwgId] || null
    const itemTotals = totals.items[idx]
    const ironmongery = (ironmongeryByDrawing[dwgId] || []).map(row => ({
      name: row.ironmongery_products?.name || row.product_name || '',
      qty: row.quantity || 1,
      finish_label: row.ironmongery_variants?.finish_name || row.finish_name || null,
      photo_url: row.ironmongery_variants?.photo_url || row.photo_url || null,
      has_multipoint: /multipoint/i.test(row.ironmongery_products?.name || row.product_name || ''),
    }))
    const allocatedParts = allocatedPartsByDrawing[dwgId] || []
    const pricingRun = latestRunByDrawing[dwgId] || null
    const profileDefaults = profilesByDrawing[dwgId] || null

    // Compute derived + geometry for the elevation renderer
    let derived = null
    let geometry = null
    if (tree) {
      try {
        derived = computeDerived(tree)
        geometry = computeSashGeometry(tree, derived)
      } catch { /* leave null */ }
    }

    // Location text: "Ground Floor Rear Elevation Kitchen"
    const locationText = [item.floor_level, item.elevation, item.room_name]
      .filter(Boolean).join(' ')

    return {
      // ── Existing v1 keys (kept for Overview reads) ──
      job_item: {
        id: item.id,
        item_number: item.item_number,
        floor_level: item.floor_level,
        elevation: item.elevation,
        room_name: item.room_name,
      },
      drawing: {
        id: dwg.id,
        drawing_number: dwg.drawing_number,
        window_type: dwg.window_type,
        default_profile_id: dwg.default_profile_id || null,
      },
      parts_tree: tree,
      calculated_price: drawingQuoteItemNet(dwg, drawingRunPrices, quoteApportionment),
      net: itemTotals?.net ?? null,
      net_after_quote_discount: itemTotals?.netAfterQuoteDiscount ?? null,
      vat: itemTotals?.vat ?? null,
      vat_rate: dwg.vat_rate ?? 20,
      poa: dwg.poa ?? false,

      // ── v2 additions ──
      location_text: locationText,
      profile_label: (profileLabelByDrawing || {})[dwgId] || null,
      ironmongery,
      allocated_parts: allocatedParts,
      pricing_run_id: pricingRun?.id || null,
      derived,
      geometry,
      profile_defaults: profileDefaults,
    }
  })

  // ── Top-level snapshot ────────────────────────────────────────────────────

  return {
    version: 2,
    published_at: now,
    lead_number: lead?.lead_number ?? null,
    quote_number: quote.quote_number,

    lead: {
      lead_number: lead?.lead_number ?? null,
      customer_title: mainContact?.title || null,
      customer_forename: mainContact?.first_name || null,
      customer_surname: mainContact?.last_name || null,
      contact_name: mainContact
        ? [mainContact.title, mainContact.first_name, mainContact.last_name].filter(Boolean).join(' ')
        : null,
      installation_address_lines: installLines,
      installation_address_one_line: installOneLine,
      postal_address_lines: postalLines,
      postal_address_text: postalText,
      phone: mainContact?.phone || lead?.phone || null,
      email: mainContact?.email || lead?.email || null,
    },

    salesperson: {
      full_name: salesperson?.full_name || null,
      initials: initials(salesperson?.full_name),
      phone: salesperson?.phone || null,
      email: salesperson?.email || null,
    },

    generated_by: initials(publishingUser?.full_name),
    generated_on: now,

    quote_settings: {
      discount_pct: quote.discount_pct ?? 0,
      deposit_pct: quote.deposit_pct ?? 40,
      interim_pct: quote.interim_pct ?? 50,
      valid_days: quote.valid_days ?? 30,
      price_file_id: quote.price_file_id ?? null,
      item_layout: quote.item_layout || '1 item with int & ext view, ironmongery & cover',
      valid_until: validUntil,
    },

    content,
    ref_labels: refLabels || {},
    ref_options: refOptionsByCategory || {},

    totals: {
      subtotal_before_discount: totals.subtotalBeforeDiscount,
      discount_amount: totals.discountAmount,
      subtotal_after_discount: totals.subtotalAfterDiscount,
      vat_by_rate: totals.vatByRate,
      total_vat: totals.totalVat,
      total_incl_vat: totals.totalInclVat,
      stages: totals.stages,
    },

    items,
  }
}

// ── Async data-fetching wrapper ─────────────────────────────────────────────

/**
 * Build a v2 quote snapshot. Both publish paths and the preview call this.
 *
 * @param {{ quoteId: string, leadId: string, userId: string, supabase: object }} opts
 * @returns {Promise<object>}  The assembled snapshot
 */
export async function buildQuoteSnapshot({ quoteId, leadId, userId, userName, supabase }) {
  // 1. Quote row
  const { data: quote, error: qErr } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()
  if (qErr) throw new Error(`Failed to load quote: ${qErr.message}`)

  // 2. Lead + contacts
  const { data: lead } = await supabase
    .from('leads')
    .select('*, lead_contacts(id, is_main_contact, contact_id, contacts(*))')
    .eq('id', leadId)
    .single()
  const mainContactLink = (lead?.lead_contacts || []).find(lc => lc.is_main_contact)
    || (lead?.lead_contacts || [])[0]
  const mainContact = mainContactLink?.contacts || null

  // Postal address: use the main contact's address if it differs from installation
  const postalContact = mainContact

  // 3. Salesperson
  let salesperson = null
  if (quote.salesperson_id) {
    const { data: sp } = await supabase
      .from('users')
      .select('full_name, phone, email')
      .eq('id', quote.salesperson_id)
      .maybeSingle()
    salesperson = sp
  }

  // 4. Publishing user — try the users table first (may fail with anon key RLS),
  // then fall back to the caller-supplied name or supabase.auth.getUser() metadata
  let publishingUser = null
  if (userId) {
    const { data: pu } = await supabase
      .from('users')
      .select('full_name, phone, email')
      .eq('id', userId)
      .maybeSingle()
    publishingUser = pu
  }
  if (!publishingUser?.full_name && userName) {
    publishingUser = { full_name: userName }
  }
  if (!publishingUser?.full_name) {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser?.user_metadata?.full_name) publishingUser = { full_name: authUser.user_metadata.full_name }
      else if (authUser?.email) publishingUser = { full_name: authUser.email.split('@')[0] }  // e.g. "nathan.smith" → initials "NS"
    } catch { /* ignore */ }
  }

  // 5. Job items + quote_drawings selections
  const { data: jobItemRows } = await supabase
    .from('job_items')
    .select('*')
    .eq('lead_id', leadId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('item_number')
  const jobItems = jobItemRows || []

  const { data: qdRows } = await supabase
    .from('quote_drawings')
    .select('job_item_id, drawing_id')
    .eq('quote_id', quoteId)
  const selections = {}
  for (const qd of (qdRows || [])) selections[qd.job_item_id] = qd.drawing_id

  // 6. Drawings
  const drawingIds = [...new Set(Object.values(selections).filter(Boolean))]
  let drawings = []
  if (drawingIds.length > 0) {
    const { data: dwgRows } = await supabase
      .from('drawings')
      .select('id, job_item_id, drawing_number, window_type, poa, price_override, item_discount_pct, vat_rate, default_profile_id')
      .in('id', drawingIds)
    drawings = dwgRows || []
  }

  // 7. Parts trees
  const trees = {}
  for (const dwgId of drawingIds) {
    try {
      trees[dwgId] = await loadDrawingParts(dwgId)
    } catch {
      trees[dwgId] = null
    }
  }

  // 8. Drawing run prices + latest runs
  const drawingRunPricesMap = await loadDrawingRunPrices(drawingIds, supabase)
  const latestRunByDrawing = {}
  if (drawingIds.length > 0) {
    // Paginated: run history grows without bound, and a newest-1,000 cap
    // could hide a drawing's latest run (src/lib/fetchAllRows.js)
    const runs = await fetchAllRows(
      () => supabase
        .from('pricing_runs')
        .select('id, drawing_id, price_file_id, tree_hash, status, created_at')
        .in('drawing_id', drawingIds)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      'pricing_runs'
    )
    for (const run of (runs || [])) {
      if (!latestRunByDrawing[run.drawing_id]) latestRunByDrawing[run.drawing_id] = run
    }
  }

  // 9. Quote-level apportionment
  const quoteApportionment = {}
  const { data: qprRow } = await supabase
    .from('quote_pricing_runs')
    .select('id')
    .eq('quote_id', quoteId)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (qprRow) {
    const { data: apRows } = await supabase
      .from('quote_item_apportionment')
      .select('drawing_id, sales')
      .eq('quote_pricing_run_id', qprRow.id)
    for (const r of (apRows || [])) {
      const key = String(r.drawing_id)
      quoteApportionment[key] = (quoteApportionment[key] || 0) + (Number(r.sales) || 0)
    }
  }

  // 10. Ironmongery per drawing — from drawing_ironmongery (QuoteDrawer) first,
  // then fall back to the tree's ironmongeryLines (DrawingBoard default ironmongery)
  const ironmongeryByDrawing = {}

  // Load product name/category lookup for resolving tree-stored short_names
  // (paginated: ~437 products today and growing — src/lib/fetchAllRows.js)
  const ironProducts = await fetchAllRows(
    () => supabase
      .from('ironmongery_products')
      .select('id, name, short_name, category')
      .order('id'),
    'ironmongery_products'
  )
  const productByShortName = {}
  const productById = {}
  for (const p of (ironProducts || [])) {
    if (p.short_name) productByShortName[p.short_name] = p
    productById[p.id] = p
  }

  // Load variant finish lookup (paginated: ironmongery_variants holds more
  // than the 1,000-row response cap — an unpaginated read silently dropped
  // the tail of the table)
  const ironVariants = await fetchAllRows(
    () => supabase
      .from('ironmongery_variants')
      .select('id, product_id, finish_code, finish_name, photo_url')
      .order('id'),
    'ironmongery_variants'
  )
  const variantByProductFinish = {}
  for (const v of (ironVariants || [])) {
    variantByProductFinish[`${v.product_id}__${v.finish_code}`] = v
  }

  if (drawingIds.length > 0) {
    // Try drawing_ironmongery first (explicit user-added lines)
    const { data: ironRows } = await supabase
      .from('drawing_ironmongery')
      .select('drawing_id, quantity, sort_order, product_id, variant_id, ironmongery_products(name, category), ironmongery_variants(finish_name, finish_code, photo_url)')
      .in('drawing_id', drawingIds)
      .order('sort_order')
    for (const row of (ironRows || [])) {
      const key = row.drawing_id
      if (!ironmongeryByDrawing[key]) ironmongeryByDrawing[key] = []
      ironmongeryByDrawing[key].push(row)
    }

    // For drawings with no drawing_ironmongery rows, check the tree's ironmongeryLines
    // then fall back to computing the default ironmongery (same function the drawing
    // board and pricing engine use)
    // Load default-ironmongery rules once for the fallback computation
    let defaultIronRules = null
    for (const dwgId of drawingIds) {
      if (ironmongeryByDrawing[dwgId] && ironmongeryByDrawing[dwgId].length > 0) continue
      const tree = trees[dwgId]
      if (!tree) continue

      // Try saved tree lines first
      const paintPart = findFirst(tree, 'paintAndIronmongeryPart')
      let lines = paintPart?.values?.ironmongeryLines
      if (!lines || !Array.isArray(lines) || lines.length === 0) lines = null

      // Fall back to computing defaults if no saved lines
      if (!lines) {
        if (defaultIronRules === null) {
          const { data: rules } = await supabase
            .from('part_allocation_rules')
            .select('*')
            .eq('rule_family', 'default_ironmongery')
            .eq('is_active', true)
          defaultIronRules = rules || []
        }
        if (defaultIronRules.length > 0) {
          try {
            const vars = computeVariables(tree, computeDerived(tree), {})
            lines = defaultIronmonger(tree, vars, defaultIronRules)
          } catch { /* leave null */ }
        }
      }

      if (!lines || lines.length === 0) continue
      ironmongeryByDrawing[dwgId] = lines.map(line => {
        const shortName = line.product_short_name || ''
        const finishCode = line.finish_code || ''
        const product = productByShortName[shortName] || {}
        const variant = variantByProductFinish[`${product.id}__${finishCode}`] || {}
        return {
          ironmongery_products: { name: product.name || shortName, category: product.category || '' },
          ironmongery_variants: { finish_name: variant.finish_name || finishCode || '', photo_url: variant.photo_url || null },
          quantity: line.qty || 1,
        }
      })
    }
  }

  // 11. Allocated parts per drawing (from latest completed run)
  const allocatedPartsByDrawing = {}
  const runIds = Object.values(latestRunByDrawing).map(r => r.id)
  if (runIds.length > 0) {
    const { data: apRows } = await supabase
      .from('drawing_allocated_parts')
      .select('drawing_id, pricing_run_id, part_code, part_name, unit_cost, quantity, total_cost')
      .in('pricing_run_id', runIds)
    for (const row of (apRows || [])) {
      const key = row.drawing_id
      if (!allocatedPartsByDrawing[key]) allocatedPartsByDrawing[key] = []
      allocatedPartsByDrawing[key].push({
        part_code: row.part_code,
        part_name: row.part_name,
        unit_cost: row.unit_cost,
        quantity: row.quantity,
        total_cost: row.total_cost,
      })
    }
  }

  // 12. Profile defaults per drawing + profile labels (for range display name)
  const profilesByDrawing = {}
  const profileLabelByDrawing = {}
  const profileIds = [...new Set(drawings.map(d => d.default_profile_id).filter(Boolean))]
  if (profileIds.length > 0) {
    // Try selecting display_name; if the column doesn't exist yet, fall back to label only
    let profileRows = null
    {
      const { data, error } = await supabase
        .from('default_profiles')
        .select('id, label, display_name')
        .in('id', profileIds)
      if (error) {
        console.warn('buildQuoteSnapshot: display_name select failed, falling back to label only:', error.message)
        const { data: fallback } = await supabase
          .from('default_profiles')
          .select('id, label')
          .in('id', profileIds)
        profileRows = fallback
      } else {
        profileRows = data
      }
    }
    const labelMap = {}
    for (const p of (profileRows || [])) labelMap[p.id] = p.display_name || p.label

    // Paginated: ~263 values per profile — several profiles exceed the cap
    const pvRows = await fetchAllRows(
      () => supabase
        .from('default_profile_values')
        .select('profile_id, field_key, default_value')
        .in('profile_id', profileIds)
        .order('profile_id').order('field_key'),
      'default_profile_values'
    )
    const pvByProfile = {}
    for (const pv of (pvRows || [])) {
      if (!pvByProfile[pv.profile_id]) pvByProfile[pv.profile_id] = {}
      pvByProfile[pv.profile_id][pv.field_key] = pv.default_value
    }
    for (const dwg of drawings) {
      if (dwg.default_profile_id && pvByProfile[dwg.default_profile_id]) {
        profilesByDrawing[dwg.id] = pvByProfile[dwg.default_profile_id]
      }
      if (dwg.default_profile_id && labelMap[dwg.default_profile_id]) {
        profileLabelByDrawing[dwg.id] = labelMap[dwg.default_profile_id]
      }
    }
  }

  // 13. Reference options — code→label map + grouped by category (for elevations)
  const refLabels = {}
  const refOptionsByCategory = {}
  const { data: refOpts } = await supabase
    .from('reference_options')
    .select('category, code, label')
    .eq('is_active', true)
  for (const opt of (refOpts || [])) {
    refLabels[opt.code] = opt.label
    if (!refOptionsByCategory[opt.category]) refOptionsByCategory[opt.category] = []
    refOptionsByCategory[opt.category].push({ code: opt.code, label: opt.label })
  }

  // 14. Load quote settings from DB, merge with quoteContent.js defaults
  const dbSettings = await loadQuoteSettings(supabase)
  const content = mergeQuoteContent(dbSettings)

  return assembleSnapshot({
    quote,
    lead,
    mainContact,
    postalContact,
    salesperson,
    publishingUser,
    jobItems,
    selections,
    drawings,
    trees,
    refLabels,
    refOptionsByCategory,
    profileLabelByDrawing,
    drawingRunPrices: drawingRunPricesMap,
    quoteApportionment,
    ironmongeryByDrawing,
    allocatedPartsByDrawing,
    latestRunByDrawing,
    profilesByDrawing,
    content,
  })
}
