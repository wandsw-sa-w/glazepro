// templates.js — Drawing template operations: save, list, create-from-template.
//
// Templates store a snapshot of a drawing's parts tree. Creating a drawing
// from a template copies the tree with fresh node keys and clears item-specific
// values so the new drawing starts clean.

import { supabase } from '../supabase.js'
import { saveDrawingParts } from './api.js'
import { insertDrawingHistory } from './drawingHistory.js'
import { applyCompleteNewThickness, COMPLETE_NEW_SASH_THICKNESS_MM } from './sashThickness.js'
import { applySashesReplaced } from './sashesReplaced.js'

// ── Key regeneration ─────────────────────────────────────────────────────────

/** Replace every node key in the tree with a fresh UUID. */
export function regenerateKeys(node) {
  if (!node) return node
  return {
    ...node,
    key: crypto.randomUUID(),
    children: (node.children ?? []).map(regenerateKeys),
  }
}

// ── Clear item-specific values ───────────────────────────────────────────────

/** Fields that must be reset when copying a template into a new drawing. */
const CLEAR_FIELDS = {
  drawingItemPart: {
    location: null,
    sheetQty: 1,
    manualPriceLowVat: null,
    manualPriceDefaultVat: null,
  },
  pricePart: {
    manualPriceLowVat: null,
    manualPriceDefaultVat: null,
    poa: null,
  },
  notesPart: {
    sowNotes: null,
    installationNotes: null,
    productionNotes: null,
    drawingLabel: null,
  },
}

/** Clear item-specific values from the tree so the new drawing starts fresh. */
export function clearItemValues(node) {
  if (!node) return node
  const patch = CLEAR_FIELDS[node.part_type]
  const values = patch
    ? { ...node.values, ...patch }
    : node.values
  return {
    ...node,
    values,
    children: (node.children ?? []).map(clearItemValues),
  }
}

// ── Glass code guard (Step AE item 2) ────────────────────────────────────────

/**
 * A template must never carry a glass NAME: pricing looks glass up by PART
 * CODE, so a name prices as "no glass" (the step-ad3 data fix converted the
 * three existing templates; this guard is for whoever makes the next one).
 * A part code never contains whitespace ("GL100010"); a catalogue name
 * always does ("4mm Clear Toughened") — so any glass value containing
 * whitespace is reported, naming the template and the field. The pricing
 * warning ("Glass code not found") already exists; this one fires at
 * template save / drawing creation, for the template's author.
 */
export function templateGlassNameWarnings(tree, templateName = 'template') {
  const warnings = []
  const FIELDS = ['internalGlassPartNo', 'externalGlassPartNo', 'singleGlassPartNo']
  ;(function walk(n) {
    if (!n) return
    if (n.part_type === 'glassPart') {
      for (const k of FIELDS) {
        const v = n.values?.[k]
        if (typeof v === 'string' && v.trim() !== '' && /\s/.test(v.trim())) {
          warnings.push(
            `Template "${templateName}": ${k} holds a glass NAME ("${v}"), not a part code — drawings made from this template price with NO glass until it is fixed`)
        }
      }
    }
    for (const c of (n.children ?? [])) walk(c)
  })(tree)
  return warnings
}

// ── Creation-time tree preparation ───────────────────────────────────────────

/**
 * The tree a new drawing starts from: the template's tree with fresh keys
 * and item-specific values cleared, then the board's business rules applied
 * once, at creation.
 *
 * Pure, and exported so it can be tested directly — createDrawingFromTemplate
 * calls exactly this, so the test and the real creation path cannot drift.
 *
 * Step AI 1b: a COMPLETE NEW sash window is always 45 mm (Nathan, 9 Oct
 * 2026), so a complete-new template stored at another thickness is set to 45
 * through the same thicknessChangePatches path as a hand edit (bottom rails
 * and frame height shift identically).
 * Step AJ 1: the sashes' To Be Replaced follows the type of work (a sash
 * replacement always replaces both sashes), through the same single path the
 * board uses.
 * An EXISTING drawing is never touched by either rule — that is the board's
 * "Set to 45 mm" / "Set sashes to match type of work" buttons.
 *
 * @returns {{tree: Object, adjustments: string[]}} adjustments are for the
 *   drawing's history note, so the creation records what it changed.
 */
export function prepareTemplateTree(templateTree) {
  let tree = clearItemValues(regenerateKeys(templateTree))
  const adjustments = []

  const thicknessFix = applyCompleteNewThickness(tree)
  tree = thicknessFix.tree
  if (thicknessFix.pairsChanged.length > 0) {
    adjustments.push(`sash thickness set to ${COMPLETE_NEW_SASH_THICKNESS_MM} mm (complete new)`)
  }

  const replacedFix = applySashesReplaced(tree)
  tree = replacedFix.tree
  if (replacedFix.sashesChanged.length > 0) {
    adjustments.push(`sashes set To Be Replaced = ${replacedFix.target} (type of work)`)
  }

  return { tree, adjustments }
}

// ── Template CRUD ────────────────────────────────────────────────────────────

/**
 * Save the current drawing as a template.
 * @param {{ window_type?: string, default_profile_id?: string }} drawingMeta
 * @param {object} tree - The parts tree
 * @param {{ name: string, family: string, group_name?: string }} opts
 * @returns {Promise<object>} the inserted template row
 */
export async function saveAsTemplate(drawingMeta, tree, { name, family, group_name }) {
  const { data, error } = await supabase
    .from('drawing_templates')
    .insert({
      name,
      family,
      group_name: group_name || '',
      window_type: drawingMeta?.window_type ?? null,
      default_profile_id: drawingMeta?.default_profile_id ?? null,
      tree,
      created_by: (await supabase.auth.getUser()).data?.user?.id ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * List all active templates, ordered by family, group, sort_order.
 */
export async function listTemplates() {
  const { data, error } = await supabase
    .from('drawing_templates')
    .select('*')
    .eq('is_active', true)
    .order('family')
    .order('group_name')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

/**
 * List all templates (including inactive), for the template manager.
 */
export async function listAllTemplates() {
  const { data, error } = await supabase
    .from('drawing_templates')
    .select('*')
    .order('family')
    .order('group_name')
    .order('sort_order')
  if (error) throw error
  return data ?? []
}

/**
 * Create a new drawing from a template.
 * @param {number} jobItemId
 * @param {object} template - A drawing_templates row
 * @param {number} nextDrawingNumber
 * @returns {Promise<object>} the new drawings row
 */
export async function createDrawingFromTemplate(jobItemId, template, nextDrawingNumber) {
  // Resolve profile id: use the template's, or fall back to the sash profile
  // (same fallback as the quick "Sash" button — see defaultProfile.js)
  let profileId = template.default_profile_id ?? null
  if (!profileId) {
    const { data: profiles } = await supabase
      .from('default_profiles')
      .select('id, code')
      .eq('is_active', true)
    profileId = (profiles || []).find(p => p.code === 'sash')?.id ?? null
  }

  // Insert the drawings row
  const { data: newDwg, error } = await supabase
    .from('drawings')
    .insert({
      job_item_id: jobItemId,
      drawing_number: nextDrawingNumber,
      sort_order: nextDrawingNumber,
      window_type: template.window_type ?? 'Box Sash',
      default_profile_id: profileId,
    })
    .select()
    .single()
  if (error) throw error

  const { tree: freshTree, adjustments } = prepareTemplateTree(template.tree)
  await saveDrawingParts(newDwg.id, freshTree)

  // Record 'created_from_template' history event (non-blocking)
  try {
    const authUser = (await supabase.auth.getUser()).data?.user
    // Look up the user's name by email (same pattern as useCurrentUser)
    let userName = authUser?.email || null
    if (authUser?.email) {
      const { data: userRow } = await supabase.from('users').select('full_name').eq('email', authUser.email).maybeSingle()
      if (userRow?.full_name) userName = userRow.full_name
    }
    await insertDrawingHistory({
      drawingId: newDwg.id,
      userId: authUser?.id ?? null,
      userName,
      event: 'created_from_template',
      note: adjustments.length > 0
        ? `Template: ${template.name} — ${adjustments.join('; ')}`
        : `Template: ${template.name}`,
    })
  } catch (histE) {
    console.warn('History insert for template creation failed:', histE)
  }

  // Step AE item 2: creating from a template must never silently carry a
  // glass NAME — the caller shows these to the user.
  newDwg.glassNameWarnings = templateGlassNameWarnings(template.tree, template.name)

  return newDwg
}

/**
 * Update a template row (for the template manager).
 */
export async function updateTemplate(id, patch) {
  const { data, error } = await supabase
    .from('drawing_templates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Delete a template (hard delete).
 */
export async function deleteTemplate(id) {
  const { error } = await supabase
    .from('drawing_templates')
    .delete()
    .eq('id', id)
  if (error) throw error
}
