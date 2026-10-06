/**
 * import-field-visibility.mjs
 *
 * Parses docs/integrate-drawingboard-schema.txt for "hidden:" entries on the
 * Integrate range "Standard". Maps S -> hidden_sales, V -> hidden_survey,
 * SV -> hidden_always. Only emits rows for field keys that genuinely exist
 * in GlazePro's default_field_definitions (from the migration and step SQL
 * files in the repo, EXCLUDING this script's own output).
 *
 * Skips any field that is marked is_required in the definitions.
 *
 * Target profile: code 'sash'.
 * Uses INSERT ... ON CONFLICT (profile_id, field_key) DO NOTHING.
 *
 * Outputs:
 *   sql/step-r4-field-visibility-import.sql
 *   docs/field-visibility-import-report.md
 *
 * Usage: node scripts/import-field-visibility.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT = resolve(__dirname, '..')

const INPUT  = resolve(PROJECT, 'docs/integrate-drawingboard-schema.txt')
const OUTPUT = resolve(PROJECT, 'sql/step-r4-field-visibility-import.sql')
const REPORT = resolve(PROJECT, 'docs/field-visibility-import-report.md')

// ── Build the set of real field keys from the repo ───────────────────────────
// Source: supabase/migrations/*.sql and sql/step-*.sql
// Every string matching 'partType.property' in INSERT or UPDATE statements.

function extractFieldKeys() {
  const keys = new Set()
  const pattern = /'(\w+Part\.\w+)'/g

  // Migration files
  const migrationDir = resolve(PROJECT, 'supabase/migrations')
  for (const f of readdirSync(migrationDir)) {
    if (!f.endsWith('.sql')) continue
    const content = readFileSync(resolve(migrationDir, f), 'utf8')
    for (const m of content.matchAll(pattern)) keys.add(m[1])
  }

  // Step SQL files — exclude this script's own output
  const sqlDir = resolve(PROJECT, 'sql')
  const SELF_OUTPUT = 'step-r4-field-visibility-import.sql'
  for (const f of readdirSync(sqlDir)) {
    if (!f.endsWith('.sql')) continue
    if (f === SELF_OUTPUT) continue
    const content = readFileSync(resolve(sqlDir, f), 'utf8')
    for (const m of content.matchAll(pattern)) keys.add(m[1])
  }

  return keys
}

// ── Extract field keys that are is_required ──────────────────────────────────
// Look for INSERT statements where the last column value is TRUE (is_required).
// The pattern in the migration is: ('partType', 'partType.prop', ..., TRUE)

function extractRequiredKeys() {
  const required = new Set()

  // Read all SQL files for INSERT patterns where is_required is TRUE
  const migrationDir = resolve(PROJECT, 'supabase/migrations')
  const sqlDir = resolve(PROJECT, 'sql')
  const SELF_OUTPUT = 'step-r4-field-visibility-import.sql'

  const allFiles = [
    ...readdirSync(migrationDir).filter(f => f.endsWith('.sql')).map(f => resolve(migrationDir, f)),
    ...readdirSync(sqlDir).filter(f => f.endsWith('.sql') && f !== SELF_OUTPUT).map(f => resolve(sqlDir, f)),
  ]

  for (const filePath of allFiles) {
    const content = readFileSync(filePath, 'utf8')
    // Match field_key followed eventually by TRUE) at end of a VALUES tuple
    // Pattern: 'partType.prop' ... TRUE) or TRUE),
    const tuplePattern = /'\s*(\w+Part\.\w+)\s*'[^)]*?,\s*TRUE\s*\)/g
    for (const m of content.matchAll(tuplePattern)) {
      required.add(m[1])
    }
  }

  return required
}

const REAL_FIELD_KEYS = extractFieldKeys()
const REQUIRED_KEYS = extractRequiredKeys()
console.log(`Found ${REAL_FIELD_KEYS.size} real field keys from repo SQL files`)
console.log(`Found ${REQUIRED_KEYS.size} required field keys: ${[...REQUIRED_KEYS].join(', ')}`)

// ── Parse schema file for Standard range hidden: entries ────────────────────

const raw = readFileSync(INPUT, 'utf8')
const lines = raw.split('\n')

// Map of fieldKey -> visibility
const hiddenMap = new Map()
let currentPartType = null

for (const line of lines) {
  const sectionMatch = line.match(/^## (\w+)\s+/)
  if (sectionMatch) {
    currentPartType = sectionMatch[1]
    continue
  }

  if (!currentPartType) continue
  if (!line.startsWith('- ')) continue

  const propMatch = line.match(/^- (\w+)\s*\|/)
  if (!propMatch) continue
  const propertyName = propMatch[1]

  // Check for hidden: entries
  const hiddenMatch = line.match(/hidden:\s*(.+?)(?:\s*\||$)/)
  if (!hiddenMatch) continue

  const hiddenStr = hiddenMatch[1]

  // Parse ranges — each is "RangeName:Code" separated by spaces
  const rangeEntries = hiddenStr.trim().split(/\s+/)
  let standardCode = null
  for (const entry of rangeEntries) {
    const [range, code] = entry.split(':')
    if (range === 'Standard' && code) {
      standardCode = code
      break
    }
  }
  if (!standardCode) continue

  // Map S/V/SV to visibility values
  let visibility
  if (standardCode === 'SV') visibility = 'hidden_always'
  else if (standardCode === 'S') visibility = 'hidden_sales'
  else if (standardCode === 'V') visibility = 'hidden_survey'
  else continue

  const fieldKey = `${currentPartType}.${propertyName}`

  // Don't overwrite — first occurrence wins (properties can appear in different sections
  // with different hidden: settings; we take the canonical one from the part type header)
  if (!hiddenMap.has(fieldKey)) {
    hiddenMap.set(fieldKey, visibility)
  }
}

console.log(`Parsed ${hiddenMap.size} Standard-range hidden entries from schema`)

// ── Filter and classify ─────────────────────────────────────────────────────

const imported = { hidden_sales: [], hidden_survey: [], hidden_always: [] }
const skippedNoField = []
const skippedRequired = []

for (const [fieldKey, visibility] of hiddenMap) {
  if (!REAL_FIELD_KEYS.has(fieldKey)) {
    skippedNoField.push(fieldKey)
    continue
  }
  if (REQUIRED_KEYS.has(fieldKey)) {
    skippedRequired.push(fieldKey)
    continue
  }
  imported[visibility].push(fieldKey)
}

// Sort for deterministic output
for (const arr of Object.values(imported)) arr.sort()
skippedNoField.sort()
skippedRequired.sort()

const totalImported = imported.hidden_sales.length + imported.hidden_survey.length + imported.hidden_always.length

console.log(`\nImport summary:`)
console.log(`  hidden_sales:  ${imported.hidden_sales.length}`)
console.log(`  hidden_survey: ${imported.hidden_survey.length}`)
console.log(`  hidden_always: ${imported.hidden_always.length}`)
console.log(`  total imported: ${totalImported}`)
console.log(`  skipped (no field): ${skippedNoField.length}`)
console.log(`  skipped (required): ${skippedRequired.length}`)

// ── Generate SQL ────────────────────────────────────────────────────────────

const allImported = [
  ...imported.hidden_sales.map(k => [k, 'hidden_sales']),
  ...imported.hidden_survey.map(k => [k, 'hidden_survey']),
  ...imported.hidden_always.map(k => [k, 'hidden_always']),
]

let sql = `-- =============================================================================
-- step-r4-field-visibility-import.sql — Import Integrate Standard range settings
-- DO NOT RUN directly — paste into Supabase SQL Editor after review.
--
-- Run order: 2 of 2 (run after step-r1-field-visibility.sql)
--
-- Generated by: node scripts/import-field-visibility.mjs
-- Source: docs/integrate-drawingboard-schema.txt (Standard range only)
-- Target: profile code 'sash'
-- =============================================================================

BEGIN;

INSERT INTO public.field_visibility (profile_id, field_key, visibility, updated_by)
SELECT
  p.id,
  v.field_key,
  v.visibility,
  'import-field-visibility.mjs'
FROM (VALUES
`

const valueLines = allImported.map(([key, vis]) => `  ('${key}', '${vis}')`)
sql += valueLines.join(',\n')

sql += `
) AS v(field_key, visibility)
CROSS JOIN public.default_profiles p
WHERE p.code = 'sash'
ON CONFLICT (profile_id, field_key) DO NOTHING;

COMMIT;

-- =============================================================================
-- ROLLBACK — DO NOT RUN unless reverting step R4
-- =============================================================================
-- BEGIN;
-- DELETE FROM public.field_visibility
-- WHERE profile_id = (SELECT id FROM public.default_profiles WHERE code = 'sash')
--   AND updated_by = 'import-field-visibility.mjs';
-- COMMIT;
`

writeFileSync(OUTPUT, sql)
console.log(`\nWrote ${OUTPUT}`)

// ── Generate report ─────────────────────────────────────────────────────────

let report = `# Field Visibility Import Report

Generated by \`node scripts/import-field-visibility.mjs\`

## Counts

| Category | Count |
|----------|-------|
| Imported: hidden_sales | ${imported.hidden_sales.length} |
| Imported: hidden_survey | ${imported.hidden_survey.length} |
| Imported: hidden_always | ${imported.hidden_always.length} |
| **Total imported** | **${totalImported}** |
| Skipped: no matching field in GlazePro | ${skippedNoField.length} |
| Skipped: field is required | ${skippedRequired.length} |

## Imported fields

### hidden_sales (${imported.hidden_sales.length})
${imported.hidden_sales.map(k => `- \`${k}\``).join('\n') || '_none_'}

### hidden_survey (${imported.hidden_survey.length})
${imported.hidden_survey.map(k => `- \`${k}\``).join('\n') || '_none_'}

### hidden_always (${imported.hidden_always.length})
${imported.hidden_always.map(k => `- \`${k}\``).join('\n') || '_none_'}

## Skipped: no matching field in GlazePro (${skippedNoField.length})
${skippedNoField.map(k => `- \`${k}\``).join('\n') || '_none_'}

## Skipped: field is required (${skippedRequired.length})
These fields exist in GlazePro and have a hidden setting in Integrate, but are
marked \`is_required\` in the field definitions. Nathan should review whether
hiding them is appropriate.

${skippedRequired.map(k => `- \`${k}\``).join('\n') || '_none_'}
`

writeFileSync(REPORT, report)
console.log(`Wrote ${REPORT}`)
