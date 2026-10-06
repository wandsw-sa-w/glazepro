/**
 * fieldVisibility.js — Pure visibility logic for the drawing board.
 *
 * Each field has a visibility setting per profile:
 *   'shown'          — always visible
 *   'hidden_sales'   — hidden when in Sales mode
 *   'hidden_survey'  — hidden when in Survey mode
 *   'hidden_always'  — hidden in both modes
 *
 * Hiding is display-only: validation, pricing, and defaults still use every
 * field's value regardless of visibility.
 *
 * @param {string} visibility  One of the four values above, or undefined/null
 *                              (treated as 'shown').
 * @param {'sales'|'survey'} mode  The active board mode.
 * @param {boolean} showHidden  Admin override — when true, nothing is hidden.
 * @returns {boolean} true if the field should be hidden from the UI.
 */
export function isFieldHidden(visibility, mode, showHidden) {
  if (showHidden) return false
  if (!visibility || visibility === 'shown') return false
  if (visibility === 'hidden_always') return true
  if (visibility === 'hidden_sales' && mode === 'sales') return true
  if (visibility === 'hidden_survey' && mode === 'survey') return true
  return false
}

/**
 * Return a human-readable tag for a hidden field (used when showHidden is on).
 * Returns null if the field is shown normally in the current mode.
 *
 * @param {string} visibility
 * @param {'sales'|'survey'} mode
 * @returns {string|null}
 */
export function hiddenTag(visibility, mode) {
  if (!visibility || visibility === 'shown') return null
  if (visibility === 'hidden_always') return 'hidden'
  if (visibility === 'hidden_sales') return 'hidden in Sales'
  if (visibility === 'hidden_survey') return 'hidden in Survey'
  return null
}
