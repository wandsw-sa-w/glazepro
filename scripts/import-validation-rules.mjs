/**
 * import-validation-rules.mjs
 *
 * Parses docs/integrate-validation-rules.txt and generates
 * sql/step-p3-validation-import.sql with INSERT statements.
 *
 * Determines which rules are active by:
 *   1. Extracting known variables from computeVariables.js return block
 *   2. Adding per-part variables for each loop target type
 *   3. Checking that every variable/function/list/part-type is known
 *   4. Blocking rules that reference products we don't offer
 *
 * Usage: node scripts/import-validation-rules.mjs
 *
 * Also writes docs/validation-import-report.md with active/blocked breakdown.
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT = resolve(__dirname, '..')

const INPUT  = resolve(PROJECT, 'docs/integrate-validation-rules.txt')
const OUTPUT = resolve(PROJECT, 'sql/step-p3-validation-import.sql')
const REPORT = resolve(PROJECT, 'docs/validation-import-report.md')
const COMPUTE_VARS = resolve(PROJECT, 'src/pricing/computeVariables.js')

// ── Known functions ─────────────────────────────────────────────────────────

const KNOWN_FUNCTIONS = new Set([
  'max', 'min', 'in_list', 'contains', 'empty',
  'round', 'round_to', 'round_up_to_nearest',
])

// ── Lists ────────────────────────────────────────────────────────────────────

// Lists with values — only allowed_sash_thickess has values (35,40,45,50)
const LISTS_WITH_VALUES = new Set(['allowed_sash_thickess'])

// Lists that exist but are empty in GlazePro
const EMPTY_LISTS = new Set(['landvac_fineo', '6_8_acoustic', 'trickle_vents', 'timber'])

const ALL_LISTS = new Set([...LISTS_WITH_VALUES, ...EMPTY_LISTS])

// ── Part types that GlazePro can draw ────────────────────────────────────────

const DRAWABLE_LOOP_TARGETS = new Set([
  'frame', 'sash', 'sliding_sash', 'glass_unit',
])

const UNBUILT_PART_TYPES = new Set([
  'casement_sash', 'door_leaf', 'panel', 'direct_glazed_unit',
  'component', 'surround', 'ironmongery_set', 'ironmongery_part',
])

// ── Products not offered ─────────────────────────────────────────────────────

const PRODUCT_NOT_OFFERED_VARS = new Set([
  'is_heritage_range', 'is_heritage', 'is_yorkshire_range',
  'is_bifolding_door', 'is_sliding_door_set',
])

// Groups that are entirely for products we don't offer
const PRODUCT_NOT_OFFERED_GROUPS = new Set([
  'Heritage',
])

// ── Extract known variables from computeVariables.js ─────────────────────────

function extractReturnBlockVariables() {
  const src = readFileSync(COMPUTE_VARS, 'utf-8')

  // Find the return { ... } block inside the computeVariables function.
  // Look for the marker comment that precedes the main return block.
  const markerIdx = src.indexOf('Return flat object with all variables')
  const searchFrom = markerIdx !== -1 ? markerIdx : 0
  const returnIdx = src.indexOf('return {', searchFrom)
  if (returnIdx === -1) throw new Error('Could not find return { in computeVariables.js')

  // Find matching closing brace
  let braceDepth = 0
  let started = false
  let endIdx = -1
  for (let i = returnIdx; i < src.length; i++) {
    if (src[i] === '{') { braceDepth++; started = true }
    if (src[i] === '}') { braceDepth-- }
    if (started && braceDepth === 0) { endIdx = i; break }
  }
  if (endIdx === -1) throw new Error('Could not find closing } of return block')

  const block = src.slice(returnIdx + 'return {'.length, endIdx)

  // Extract variable names: strip comments, then scan for identifiers
  const cleaned = block
    .replace(/\/\/.*$/gm, '')           // remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')   // remove block comments

  const vars = new Set()
  // Match identifiers that appear as shorthand properties or key: value
  // Shorthand: standalone word before comma or end
  // Named: word followed by colon (key in key: value)
  for (const m of cleaned.matchAll(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g)) {
    const name = m[1]
    // Exclude JS keywords and common non-variable tokens
    if (['return', 'true', 'false', 'null', 'undefined', 'const', 'let', 'var'].includes(name)) continue
    vars.add(name)
  }

  return vars
}

const computeVars = extractReturnBlockVariables()
console.log(`Extracted ${computeVars.size} variables from computeVariables.js return block`)

// Additional item-level aliases that Integrate provides and GlazePro's validation
// context will supply (even if computeVariables.js doesn't return them yet under
// these exact names).  These ensure rules are blocked for the right reason rather
// than "missing variable" when the real issue is something else.
const EXTRA_ITEM_LEVEL_VARS = [
  'sash_thickness',                // sash_replacement_thickness alias
  'is_lambs_tongue_moulding',      // moulding flag
  'gb_qty',                        // glazing bar quantity
  'gb_width',                      // glazing bar width
  'is_docl',                       // alias for is_doc_l
  'is_replacement_sashes_range',   // Integrate product range flag
  'overall_sash_height',           // sash height alias
  'is_heritage_range',             // product range flag (used for product-not-offered check)
  'is_heritage',                   // heritage flag (used for product-not-offered check)
]
for (const v of EXTRA_ITEM_LEVEL_VARS) computeVars.add(v)

// Quote-level variables from computeQuoteVariables()
const QUOTE_LEVEL_VARS = [
  'item_qty',
  'item_installed_by_us_qty',
  'item_qty_with_solid_utile_hardwood_cill',
  'item_qty_with_solid_redwood_cill',
  'item_qty_with_accoya_cill',
  'item_qty_with_oak_cill',
  'item_qty_with_idigbo_cill',
  'item_qty_with_douglas_fir_cill',
  'item_qty_with_white_warm_edge_spacer',
  'item_qty_with_black_warm_edge_spacer',
  'item_qty_with_brown_warm_edge_spacer',
  'item_qty_with_bronze_aluminium_spacer',
  'item_qty_with_4mm_spacer',
  'item_qty_with_6mm_spacer',
  'item_qty_with_8mm_spacer',
  'item_qty_with_10mm_spacer',
  'item_qty_with_12mm_spacer',
  'item_qty_with_14mm_spacer',
  'item_qty_with_16mm_spacer',
  'installation_labour_time',
  'quote_margin',
  'is_open_quote',
  'quote_pricefile_no',
  'latest_pricefile_no',
  'is_pricefile_retired',
  'user_can_access_all_quotes',
  'new_frame_qty',
  'new_sliding_sash_qty',
  'item_with_onsite_decoration_by_us_qty_excl_free_items',
]
for (const v of QUOTE_LEVEL_VARS) computeVars.add(v)

// ── Per-part variables available in loop contexts ────────────────────────────

// Standard per-part variables from validate.js (applied to all loop targets)
const BASE_PART_VARS = new Set([
  'width', 'height', 'to_be_replaced', 'part_key',
  'is_top_sash', 'is_bottom_sash',
])

// glass_unit loop: tree values from glassPart nodes
const GLASS_UNIT_PART_VARS = new Set([
  'glass_unit_thickness', 'spacer_dim', 'single_pane_thickness',
  'outer_pane_part_no', 'inner_pane_part_no', 'single_pane_part_no',
  'unit_gb_qty', 'is_inner_pane_toughened', 'is_outer_pane_toughened',
  'is_single_pane_toughened', 'is_filled_with_krypton', 'is_direct_glazed_unit',
  'actual_width', 'actual_height', 'actual_area',
])

// sliding_sash / sash loop: tree values from sash nodes
const SASH_PART_VARS = new Set([
  'gross_sash_height_in_mm', 'sash_thickness', 'weight_in_kg',
  'is_spiral_hung', 'is_cord_hung',
  'to_be_replaced', 'width', 'height',
  'is_top_sash', 'is_bottom_sash',
  'gross_sash_head_height_in_mm',
  'ironmongery_part_no_list',
])

// casement_sash loop: variables from casement sash parts
const CASEMENT_SASH_PART_VARS = new Set([
  'width', 'height', 'to_be_replaced', 'weight_in_kg',
  'is_storm_proof', 'is_bottom_hung', 'is_top_hung', 'is_side_hung',
  'is_opening', 'is_heritage_range', 'is_fanlight',
  'is_french_casement_sash', 'is_casement_mpls',
  'is_bottom_and_left_hand_hung_viewed_internally',
  'is_bottom_and_right_hand_hung_viewed_internally',
  'gross_bottom_rail_height_in_mm', 'gross_sash_head_height_in_mm',
  'gross_left_sash_stile_width_in_mm', 'gross_right_sash_stile_width_in_mm',
  'gross_sash_width_in_mm', 'gross_sash_height_in_mm',
  'part_key', 'is_top_sash', 'is_bottom_sash',
])

// door_leaf loop: variables from door leaf parts
const DOOR_LEAF_PART_VARS = new Set([
  'width', 'height', 'to_be_replaced', 'weight_in_kg',
  'is_door_mpls', 'is_folding_leaf',
  'gross_sash_height_in_mm', 'gross_sash_width_in_mm',
  'gross_sash_head_height_in_mm',
  'profiled_frame_interior_height_in_mm',
  'part_key', 'is_top_sash', 'is_bottom_sash',
])

// panel loop
const PANEL_PART_VARS = new Set([
  'internal_panel_type', 'external_panel_type',
  'is_tongue_and_groove_panel_externally', 'is_tongue_and_groove_panel_internally',
  'width', 'height', 'to_be_replaced',
  'part_key', 'is_top_sash', 'is_bottom_sash',
])

// ironmongery_part loop
const IRONMONGERY_PART_VARS = new Set([
  'part_no', 'width', 'height', 'to_be_replaced',
  'part_key', 'is_top_sash', 'is_bottom_sash',
])

// component loop
const COMPONENT_PART_VARS = new Set([
  'part_no', 'width', 'height', 'to_be_replaced',
  'part_key', 'is_top_sash', 'is_bottom_sash',
])

// Map loop target -> extra per-part variables
const LOOP_TARGET_VARS = {
  glass_unit:          GLASS_UNIT_PART_VARS,
  sash:                SASH_PART_VARS,
  sliding_sash:        SASH_PART_VARS,
  casement_sash:       CASEMENT_SASH_PART_VARS,
  door_leaf:           DOOR_LEAF_PART_VARS,
  panel:               PANEL_PART_VARS,
  ironmongery_part:    IRONMONGERY_PART_VARS,
  component:           COMPONENT_PART_VARS,
  frame:               BASE_PART_VARS,
  direct_glazed_unit:  BASE_PART_VARS,
  surround:            BASE_PART_VARS,
  ironmongery_set:     BASE_PART_VARS,
}

// ── Build the complete known variable set for a given loop context ───────────

function knownVarsForContext(loopTarget) {
  const vars = new Set(computeVars)

  // expr-eval builtins
  for (const b of ['true', 'false', 'PI', 'E']) vars.add(b)

  // List names are seen as variables by expr-eval
  for (const l of ALL_LISTS) vars.add(l)

  // Base per-part variables (always available in any loop)
  for (const v of BASE_PART_VARS) vars.add(v)

  // Loop-specific per-part variables
  if (loopTarget && LOOP_TARGET_VARS[loopTarget]) {
    for (const v of LOOP_TARGET_VARS[loopTarget]) vars.add(v)
  }

  return vars
}

// ── Extract tokens from a condition expression ───────────────────────────────

/**
 * Tokenise a condition expression into identifiers.
 * Strips numbers, operators, and known language keywords (and/or/not).
 */
function extractTokens(condition) {
  const cleaned = condition
    .replace(/[()><=!+\-*\/,]/g, ' ')

  const tokens = cleaned.split(/\s+/).filter(t => t && !t.match(/^\d+(\.\d+)?$/))

  // "and", "or", "not" are expr-eval operators, not variables
  return tokens.filter(t => !['and', 'or', 'not'].includes(t))
}

/**
 * Extract function names from a condition.
 */
function extractFunctions(condition) {
  return [...condition.matchAll(/\b([a-zA-Z_]\w*)\s*\(/g)]
    .map(m => m[1])
    .filter(f => !['and', 'or', 'not', 'true', 'false'].includes(f))
}

/**
 * Extract list names referenced via in_list(x, list) or contains(x, list).
 */
function extractListRefs(condition) {
  const refs = []
  for (const m of condition.matchAll(/\bin_list\s*\(\s*[^,]+,\s*(\w+)\s*\)/g)) {
    refs.push(m[1])
  }
  for (const m of condition.matchAll(/\bcontains\s*\(\s*[^,]+,\s*(\w+)\s*\)/g)) {
    refs.push(m[1])
  }
  return refs
}

// ── Parse the text file ──────────────────────────────────────────────────────

const lines = readFileSync(INPUT, 'utf-8').split('\n')

let currentGroup = null
const rules = []

let i = 0
while (i < lines.length) {
  const line = lines[i].trimEnd()

  // Group header: ====... then group name then ====...
  if (line.startsWith('===')) {
    i++
    // Next non-blank line is the group name
    while (i < lines.length && lines[i].trim() === '') i++
    if (i < lines.length && !lines[i].startsWith('===')) {
      const groupLine = lines[i].trim()
      // Strip trailing "(Level = Quote)" etc.
      currentGroup = groupLine.replace(/\s*\(.*$/, '').trim()
      i++
      // Skip the closing ===
      while (i < lines.length && lines[i].startsWith('===')) i++
    }
    continue
  }

  // Stop at "OTHER NOTES" section
  if (line.includes('OTHER NOTES FROM THE SAME REVIEW')) break

  // Skip header/preamble lines
  if (!currentGroup || !line.match(/^\s*-?\d+\s*\|/)) {
    i++
    continue
  }

  // Parse rule header:  sort | loop | severity | name
  const headerMatch = line.match(/^\s*(-?\d+)\s*\|\s*([^|]*?)\s*\|\s*(\w+)\s*\|\s*(.*)$/)
  if (!headerMatch) {
    i++
    continue
  }

  const [, sortStr, loopRaw, severity, nameRaw] = headerMatch
  const sortOrder = parseInt(sortStr, 10)
  const loopTarget = loopRaw.trim() === '-' ? null : loopRaw.trim().replace(/ /g, '_') || null
  const name = nameRaw.trim() === '(no name)' ? '' : nameRaw.trim()
  const level = currentGroup === 'Quote Summary' ? 'quote' : 'item'

  i++

  // Parse IF line
  let condition = ''
  while (i < lines.length) {
    const l = lines[i].trimEnd()
    if (l.match(/^\s*IF:\s*/)) {
      condition = l.replace(/^\s*IF:\s*/, '').trim()
      i++
      // Continuation lines (indented, not MSG/NOTE/another rule)
      while (i < lines.length) {
        const cont = lines[i]
        if (cont.match(/^\s*(MSG:|NOTE:|IF:)/) || cont.match(/^\s*-?\d+\s*\|/) || cont.startsWith('===')) break
        if (cont.trim()) {
          condition += ' ' + cont.trim()
        }
        i++
      }
      break
    }
    i++
  }

  // Parse MSG line
  let message = ''
  if (i < lines.length && lines[i].match(/^\s*MSG:\s*/)) {
    message = lines[i].replace(/^\s*MSG:\s*/, '').trim()
    i++
    // Continuation
    while (i < lines.length) {
      const cont = lines[i]
      if (cont.match(/^\s*(NOTE:|IF:|MSG:)/) || cont.match(/^\s*-?\d+\s*\|/) || cont.startsWith('===')) break
      if (cont.trim()) {
        message += ' ' + cont.trim()
      }
      i++
    }
  }

  // Parse optional NOTE line
  let comment = null
  if (i < lines.length && lines[i].match(/^\s*NOTE:\s*/)) {
    comment = lines[i].replace(/^\s*NOTE:\s*/, '').trim()
    i++
    // Continuation
    while (i < lines.length) {
      const cont = lines[i]
      if (cont.match(/^\s*(NOTE:|IF:|MSG:)/) || cont.match(/^\s*-?\d+\s*\|/) || cont.startsWith('===')) break
      if (cont.trim()) {
        comment += ' ' + cont.trim()
      }
      i++
    }
  }

  rules.push({
    group: currentGroup,
    sortOrder,
    loopTarget,
    severity,
    name,
    level,
    condition,
    message,
    comment,
  })
}

console.log(`Parsed ${rules.length} rules from ${INPUT}`)
if (rules.length !== 158) {
  console.warn(`WARNING: Expected 158 rules, got ${rules.length}`)
}

// ── Transform conditions and messages ────────────────────────────────────────

/**
 * Convert Integrate's "not" notation back to proper operators:
 *   "x not =14"      -> "x != 14"
 *   "x not ==1100"   -> "x != 1100"
 */
function fixCondition(cond) {
  let c = cond
  // "not ==" -> "!="
  c = c.replace(/\bnot\s*==/g, '!=')
  // "not =" (not followed by =) -> "!="
  c = c.replace(/\bnot\s*=(?!=)/g, '!=')
  return c
}

/**
 * Convert message "not" back to "!":
 *   "not not Please note" -> "!! Please note"
 *   "VENTSnot ADD"        -> "VENTS! ADD"
 */
function fixMessage(msg) {
  let m = msg
  // "not not " at start or after space -> "!! "
  m = m.replace(/\bnot not\b/g, '!!')
  // Word-internal "not" -> "!" (e.g. "VENTSnot" -> "VENTS!")
  m = m.replace(/(\w)not\b/g, '$1!')
  return m
}

// Apply transforms
for (const rule of rules) {
  rule.condition = fixCondition(rule.condition)
  rule.message = fixMessage(rule.message)
}

// ── Determine if each rule can be activated ──────────────────────────────────

/**
 * Check whether a condition references any "product not offered" variables.
 */
function referencesProductNotOffered(condition, group) {
  // Check group-level exclusion
  if (PRODUCT_NOT_OFFERED_GROUPS.has(group)) return true

  // Check condition for product-not-offered variable references
  const tokens = extractTokens(condition)
  for (const t of tokens) {
    if (PRODUCT_NOT_OFFERED_VARS.has(t)) return true
  }
  return false
}

// Track stats
const activeRules = []
const blockedByReason = {}  // reason -> rule[]
const missingVarCounts = {} // variable -> count of rules it blocks
let activeCount = 0
let blockedCount = 0

function addBlocked(rule, reason) {
  blockedCount++
  if (!blockedByReason[reason]) blockedByReason[reason] = []
  blockedByReason[reason].push(rule)
  rule.isActive = false
  rule.blockedReason = reason
}

for (const rule of rules) {
  // 1. Check for product not offered (highest priority)
  if (referencesProductNotOffered(rule.condition, rule.group)) {
    addBlocked(rule, 'product not offered')
    continue
  }

  // 2. Check loop target is a part type we can draw
  if (rule.loopTarget) {
    if (UNBUILT_PART_TYPES.has(rule.loopTarget)) {
      addBlocked(rule, `part type not built yet: ${rule.loopTarget}`)
      continue
    }
    if (!DRAWABLE_LOOP_TARGETS.has(rule.loopTarget)) {
      addBlocked(rule, `unknown loop target: ${rule.loopTarget}`)
      continue
    }
  }

  // 3. Check all functions are known
  const fns = extractFunctions(rule.condition)
  const unknownFns = fns.filter(f => !KNOWN_FUNCTIONS.has(f))
  if (unknownFns.length > 0) {
    addBlocked(rule, `unknown function: ${unknownFns.join(', ')}`)
    continue
  }

  // 4. Check list references — list must exist AND have values
  const listRefs = extractListRefs(rule.condition)
  const emptyListRefs = listRefs.filter(l => EMPTY_LISTS.has(l))
  const unknownListRefs = listRefs.filter(l => !ALL_LISTS.has(l))
  if (unknownListRefs.length > 0) {
    addBlocked(rule, `unknown list: ${unknownListRefs.join(', ')}`)
    continue
  }
  if (emptyListRefs.length > 0) {
    addBlocked(rule, `empty list: ${emptyListRefs.join(', ')}`)
    continue
  }

  // 5. Check all variables in the condition are known
  const knownVars = knownVarsForContext(rule.loopTarget)
  const tokens = extractTokens(rule.condition)
  // Variables = tokens that aren't functions or list names
  const fnSet = new Set(fns)
  const variables = tokens.filter(t => !fnSet.has(t) && !ALL_LISTS.has(t))
  const missingVars = variables.filter(v => !knownVars.has(v))

  if (missingVars.length > 0) {
    // Track missing vars for the report
    for (const v of missingVars) {
      missingVarCounts[v] = (missingVarCounts[v] || 0) + 1
    }
    addBlocked(rule, `missing variable: ${[...new Set(missingVars)].join(', ')}`)
    continue
  }

  // All checks passed — rule is active
  activeCount++
  rule.isActive = true
  rule.blockedReason = null
  activeRules.push(rule)
}

console.log(`Active: ${activeCount}, Blocked: ${blockedCount}`)

// ── Generate SQL ─────────────────────────────────────────────────────────────

function esc(s) {
  if (s == null) return 'NULL'
  return "'" + s.replace(/'/g, "''") + "'"
}

let sql = `-- ============================================================================
-- step-p3-validation-import.sql -- Import 158 validation rules from Integrate
-- Apply through Supabase SQL Editor after review
-- Generated by: node scripts/import-validation-rules.mjs
-- ============================================================================

-- Ensure all referenced lists exist (beyond the allowed_sash_thickess seed)
INSERT INTO public.validation_lists (name, description) VALUES
  ('landvac_fineo', 'LandVac / Fineo single-pane part numbers'),
  ('6_8_acoustic', '6.8mm acoustic laminated glass part numbers'),
  ('trickle_vents', 'Trickle vent ironmongery part numbers'),
  ('timber', 'Custom off-the-shelf timber part numbers')
ON CONFLICT (name) DO NOTHING;

-- ── Rules ────────────────────────────────────────────────────────────────────

`

const groupCounts = {}

for (let idx = 0; idx < rules.length; idx++) {
  const r = rules[idx]
  groupCounts[r.group] = (groupCounts[r.group] || 0) + 1

  sql += `-- Rule ${idx + 1}: ${r.name || '(unnamed)'} [${r.group}]
INSERT INTO public.validation_rules (group_id, name, sort_order, loop_target, level, severity, condition, message, comment, is_active, blocked_reason)
VALUES (
  (SELECT id FROM public.validation_groups WHERE name = ${esc(r.group)}),
  ${esc(r.name)},
  ${r.sortOrder},
  ${r.loopTarget ? esc(r.loopTarget) : 'NULL'},
  ${esc(r.level)},
  ${esc(r.severity)},
  ${esc(r.condition)},
  ${esc(r.message)},
  ${r.comment ? esc(r.comment) : 'NULL'},
  ${r.isActive},
  ${r.blockedReason ? esc(r.blockedReason) : 'NULL'}
);

`
}

sql += `-- ══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ══════════════════════════════════════════════════════════════════════════════
-- DELETE FROM public.validation_rules
--   WHERE group_id IN (SELECT id FROM public.validation_groups);
--
-- DELETE FROM public.validation_lists WHERE name IN (
--   'landvac_fineo', '6_8_acoustic', 'trickle_vents', 'timber'
-- );
`

writeFileSync(OUTPUT, sql)
console.log(`Wrote ${rules.length} INSERT statements to ${OUTPUT}`)

// ── Generate report ──────────────────────────────────────────────────────────

// Missing variables ranked by how many rules each would unblock
const sortedMissing = Object.entries(missingVarCounts)
  .sort((a, b) => b[1] - a[1])

let report = `# Validation Rules Import Report

Generated: ${new Date().toISOString().slice(0, 10)}

## Summary

| Metric | Value |
|--------|-------|
| Total rules parsed | ${rules.length} |
| Active | ${activeCount} |
| Blocked | ${blockedCount} |

## Rules per Group

| Group | Count |
|-------|-------|
${Object.entries(groupCounts).map(([g, c]) => `| ${g} | ${c} |`).join('\n')}

## Active Rules

${activeRules.map(r => `- ${r.name || '(unnamed)'} [${r.group}]`).join('\n')}

## Blocked Rules by Reason

${Object.entries(blockedByReason).map(([reason, ruleList]) =>
  `### ${reason}\n\n${ruleList.map(r => `- ${r.name || '(unnamed)'} [${r.group}]`).join('\n')}`
).join('\n\n')}

## Missing Variables (ranked by rules blocked)

${sortedMissing.length === 0 ? 'None.' :
  `| Variable | Rules blocked |
|----------|---------------|
${sortedMissing.map(([v, c]) => `| \`${v}\` | ${c} |`).join('\n')}`}

## Transformations Applied

1. \`not ==\` in conditions converted to \`!=\`
2. \`not =\` (not followed by \`=\`) in conditions converted to \`!=\`
3. \`not not\` in messages converted to \`!!\`
4. Word-internal \`not\` in messages converted to \`!\` (e.g. "VENTSnot" -> "VENTS!")
5. List names seeded: landvac_fineo, 6_8_acoustic, trickle_vents, timber
`

writeFileSync(REPORT, report)
console.log(`Wrote report to ${REPORT}`)
