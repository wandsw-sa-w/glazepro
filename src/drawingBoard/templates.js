// templates.js — Drawing template operations: save, list, create-from-template.
//
// Templates store a snapshot of a drawing's parts tree. Creating a drawing
// from a template copies the tree with fresh node keys and clears item-specific
// values so the new drawing starts clean.

import { supabase } from '../supabase.js'
import { saveDrawingParts } from './api.js'
import { insertDrawingHistory } from './drawingHistory.js'

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
  // Insert the drawings row
  const { data: newDwg, error } = await supabase
    .from('drawings')
    .insert({
      job_item_id: jobItemId,
      drawing_number: nextDrawingNumber,
      sort_order: nextDrawingNumber,
      window_type: template.window_type ?? 'Box Sash',
      default_profile_id: template.default_profile_id ?? null,
    })
    .select()
    .single()
  if (error) throw error

  // Copy the template tree with fresh keys and cleared values
  const freshTree = clearItemValues(regenerateKeys(template.tree))
  await saveDrawingParts(newDwg.id, freshTree)

  // Record 'created_from_template' history event (non-blocking)
  try {
    const userId = (await supabase.auth.getUser()).data?.user?.id ?? null
    await insertDrawingHistory({
      drawingId: newDwg.id,
      userId,
      event: 'created_from_template',
      note: `Template: ${template.name}`,
    })
  } catch (histE) {
    console.warn('History insert for template creation failed:', histE)
  }

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
