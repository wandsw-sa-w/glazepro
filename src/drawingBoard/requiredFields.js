// requiredFields.js — the ONE required-fields check.
//
// Step AQ item 8: this was a local function inside DrawingBoard.jsx, so no
// test could run it. A drawing started from a casement template opened with
// two "Required fields empty" errors (Product and Quantity) and nothing in
// the suite noticed, exactly as the containment check was invisible to the
// board-path tests. It is a module now, and the board-path tests run it over
// every tree they build.

import { isFieldHidden } from './fieldVisibility.js'

/**
 * Every required input field that is empty on a tree.
 *
 * A field counts when it is `is_required`, is an `input` (a derived or
 * config field is not the surveyor's to fill) and is not hidden for the
 * current board mode — the same three conditions the drawing board's
 * Summary panel uses, because this IS that code.
 *
 * @param {Object} tree
 * @param {Object} fieldDefs       part_type -> definition rows
 * @param {Object} [visibilityMap] field_key -> visibility
 * @param {string} [boardMode]     'sales' | 'survey' | 'switch'
 * @param {boolean} [showHidden]
 * @returns {Array<{key, fieldKey, label, partType}>}
 */
export function findRequiredEmpty(tree, fieldDefs, visibilityMap = {}, boardMode = 'sales', showHidden = false) {
  const issues = []
  function traverse(node) {
    const fields = (fieldDefs[node.part_type] ?? []).filter(
      f => f.is_required && f.role === 'input' && !isFieldHidden(visibilityMap[f.field_key], boardMode, showHidden)
    )
    for (const f of fields) {
      const v = node.values?.[f.property_name]
      if (v === null || v === undefined || v === '') {
        issues.push({ key: node.key, fieldKey: f.field_key, label: f.label, partType: node.part_type })
      }
    }
    for (const c of (node.children ?? [])) traverse(c)
  }
  if (tree) traverse(tree)
  return issues
}
