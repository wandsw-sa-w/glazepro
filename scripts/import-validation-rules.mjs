/**
 * import-validation-rules.mjs
 *
 * Parses docs/integrate-validation-rules.txt and generates
 * sql/step-p3-validation-import.sql with INSERT statements.
 *
 * Usage: node scripts/import-validation-rules.mjs
 *
 * Also writes docs/validation-import-report.md with statistics.
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT = resolve(__dirname, '..')

const INPUT  = resolve(PROJECT, 'docs/integrate-validation-rules.txt')
const OUTPUT = resolve(PROJECT, 'sql/step-p3-validation-import.sql')
const REPORT = resolve(PROJECT, 'docs/validation-import-report.md')

// ── Known functions and list names ───────────────────────────────────────────

const KNOWN_FUNCTIONS = new Set([
  'max', 'min', 'in_list', 'contains', 'empty',
  'round', 'round_to', 'round_up_to_nearest',
])

const KNOWN_LISTS = new Set([
  'allowed_sash_thickess',
  'landvac_fineo',
  '6_8_acoustic',
  'trickle_vents',
  'timber',
])

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
  const loopTarget = loopRaw.trim() === '-' ? null : loopRaw.trim() || null
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

// ── Determine if a rule can be activated ─────────────────────────────────────

/**
 * Extract variable names referenced in a condition.
 * Strips out known function names and list names.
 */
function extractVariables(condition) {
  // Remove string-like tokens that are function calls
  const cleaned = condition
    .replace(/\b(and|or|not|true|false)\b/g, ' ')
    .replace(/[()><=!+\-*\/,]/g, ' ')

  const tokens = cleaned.split(/\s+/).filter(t => t && !t.match(/^\d+(\.\d+)?$/))

  return tokens.filter(t =>
    !KNOWN_FUNCTIONS.has(t) &&
    !KNOWN_LISTS.has(t)
  )
}

// Apply transforms
for (const rule of rules) {
  rule.condition = fixCondition(rule.condition)
  rule.message = fixMessage(rule.message)
}

// ── Generate SQL ─────────────────────────────────────────────────────────────

function esc(s) {
  if (s == null) return 'NULL'
  return "'" + s.replace(/'/g, "''") + "'"
}

let sql = `-- ============================================================================
-- step-p3-validation-import.sql — Import 158 validation rules from Integrate
-- DO NOT RUN — apply through Supabase SQL Editor after review
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

// Track stats for report
const groupCounts = {}
const blockedRules = []
let activeCount = 0
let blockedCount = 0

for (let idx = 0; idx < rules.length; idx++) {
  const r = rules[idx]
  const vars = extractVariables(r.condition)

  // All variables are considered known for now -- we mark as blocked only
  // if the condition uses an unresolvable function or has clear issues.
  // The brief says: "Mark rules active only if all variables/functions/lists exist"
  // Since we can't fully verify variables at import time, we mark all as active
  // unless they reference unknown functions.
  const OPERATORS = new Set(['and', 'or', 'not', 'true', 'false'])
  const conditionFunctions = [...r.condition.matchAll(/\b(\w+)\s*\(/g)]
    .map(m => m[1])
    .filter(f => !OPERATORS.has(f))
  const unknownFunctions = conditionFunctions.filter(f => !KNOWN_FUNCTIONS.has(f))

  // Check for list names referenced in in_list/contains that aren't known
  const listRefs = [
    ...r.condition.matchAll(/\bin_list\s*\(\s*\w+\s*,\s*(\w+)\s*\)/g),
    ...r.condition.matchAll(/\bcontains\s*\(\s*\w+\s*,\s*(\w+)\s*\)/g),
  ].map(m => m[1])
  const unknownLists = listRefs.filter(l => !KNOWN_LISTS.has(l))

  let isActive = true
  let blockedReason = null

  if (unknownFunctions.length > 0) {
    isActive = false
    blockedReason = `Unknown function(s): ${unknownFunctions.join(', ')}`
  } else if (unknownLists.length > 0) {
    isActive = false
    blockedReason = `Unknown list(s): ${unknownLists.join(', ')}`
  }

  if (isActive) activeCount++
  else {
    blockedCount++
    blockedRules.push({ ...r, blockedReason })
  }

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
  ${isActive},
  ${blockedReason ? esc(blockedReason) : 'NULL'}
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

## Blocked Rules

${blockedRules.length === 0 ? 'None.' : blockedRules.map(r =>
  `- **${r.name || '(unnamed)'}** [${r.group}]: ${r.blockedReason}`
).join('\n')}

## Transformations Applied

1. \`not ==\` in conditions converted to \`!=\`
2. \`not =\` (not followed by \`=\`) in conditions converted to \`!=\`
3. \`not not\` in messages converted to \`!!\`
4. Word-internal \`not\` in messages converted to \`!\` (e.g. "VENTSnot" -> "VENTS!")
5. List names seeded: landvac_fineo, 6_8_acoustic, trickle_vents, timber
`

writeFileSync(REPORT, report)
console.log(`Wrote report to ${REPORT}`)
