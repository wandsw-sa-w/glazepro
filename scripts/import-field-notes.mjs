/**
 * import-field-notes.mjs
 *
 * Parses docs/integrate-drawingboard-schema.txt for "note:" text on each
 * property. Only emits an UPDATE for a field_key that actually exists in
 * GlazePro's default_field_definitions (verified against the migration
 * and step SQL files in the repo).
 *
 * HTML handling:
 *   - <br> / <br/> / <br /> → newline
 *   - HTML tables: keep the sentence before the table, drop the table
 *   - All remaining HTML tags stripped
 *
 * Outputs:
 *   sql/step-q4b-field-notes-import.sql
 *   docs/field-notes-import-report.md
 *
 * Usage: node scripts/import-field-notes.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT = resolve(__dirname, '..')

const INPUT  = resolve(PROJECT, 'docs/integrate-drawingboard-schema.txt')
const OUTPUT = resolve(PROJECT, 'sql/step-q4b-field-notes-import.sql')
const REPORT = resolve(PROJECT, 'docs/field-notes-import-report.md')

// ── Build the set of real field keys from the repo ───────────────────────────
// Source: supabase/migrations/20260923_step_a2_field_definitions.sql and
// sql/step-*.sql — every string matching 'partType.property' in INSERT or
// UPDATE statements for default_field_definitions.

function extractFieldKeys() {
  const keys = new Set()
  const pattern = /'(\w+Part\.\w+)'/g

  // Migration file
  const migrationDir = resolve(PROJECT, 'supabase/migrations')
  for (const f of readdirSync(migrationDir)) {
    if (!f.endsWith('.sql')) continue
    const content = readFileSync(resolve(migrationDir, f), 'utf8')
    for (const m of content.matchAll(pattern)) keys.add(m[1])
  }

  // Step SQL files — exclude this script's own output to avoid circular key inflation
  const sqlDir = resolve(PROJECT, 'sql')
  const SELF_OUTPUT = 'step-q4b-field-notes-import.sql'
  for (const f of readdirSync(sqlDir)) {
    if (!f.endsWith('.sql')) continue
    if (f === SELF_OUTPUT) continue
    const content = readFileSync(resolve(sqlDir, f), 'utf8')
    for (const m of content.matchAll(pattern)) keys.add(m[1])
  }

  return keys
}

const REAL_FIELD_KEYS = extractFieldKeys()
console.log(`Found ${REAL_FIELD_KEYS.size} real field keys from repo SQL files`)

// ── Parse schema file ────────────────────────────────────────────────────────

const raw = readFileSync(INPUT, 'utf8')
const lines = raw.split('\n')

const entries = []
let currentPartType = null

for (const line of lines) {
  const sectionMatch = line.match(/^## (\w+)\s+/)
  if (sectionMatch) {
    currentPartType = sectionMatch[1]
    continue
  }

  if (!currentPartType) continue
  const noteMatch = line.match(/^- (\w+)\s.*\|\s*note:\s*(.+)$/)
  if (!noteMatch) continue

  const propertyName = noteMatch[1]
  const noteRaw = noteMatch[2].trim()
  const fieldKey = `${currentPartType}.${propertyName}`

  entries.push({ partType: currentPartType, propertyName, noteRaw, fieldKey })
}

console.log(`Parsed ${entries.length} properties with notes from schema file`)

// ── Clean note text ──────────────────────────────────────────────────────────

function cleanNote(raw) {
  let text = raw

  // Drop HTML tables and everything after them (the table may not be
  // closed in the raw note; keep only the sentence before it)
  text = text.replace(/<table[\s\S]*/gi, '')

  // Convert <br> variants to newline
  text = text.replace(/<br\s*\/?>/gi, '\n')

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&quot;/g, '"')

  // Collapse multiple spaces and newlines
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.trim()

  // Skip if empty or just punctuation/whitespace
  if (!text || text.replace(/[\s—\-:.()]/g, '') === '') return null

  return text
}

// ── Categorise entries ───────────────────────────────────────────────────────

const imported = []
const skippedNoField = []  // field key doesn't exist in GlazePro
const skippedEmpty = []    // note empty after cleaning

for (const entry of entries) {
  if (!REAL_FIELD_KEYS.has(entry.fieldKey)) {
    skippedNoField.push(entry)
    continue
  }

  const cleaned = cleanNote(entry.noteRaw)
  if (!cleaned) {
    skippedEmpty.push(entry)
    continue
  }

  imported.push({ ...entry, noteCleaned: cleaned })
}

// ── Generate SQL ─────────────────────────────────────────────────────────────

function esc(str) {
  return str.replace(/'/g, "''")
}

const sqlLines = [
  '-- ============================================================================',
  '-- step-q4b-field-notes-import.sql — Import field notes from Integrate schema',
  '-- Run order: after step-q4-field-notes.sql',
  '-- Rollback: DELETE is safe (sets info_note back to NULL)',
  '-- ============================================================================',
  '',
  '-- Generated by: node scripts/import-field-notes.mjs',
  `-- Source: docs/integrate-drawingboard-schema.txt`,
  `-- Real field keys source: supabase/migrations/ + sql/step-*.sql`,
  `-- Date: ${new Date().toISOString().slice(0, 10)}`,
  `-- Imported: ${imported.length}, Skipped (no field): ${skippedNoField.length}, Skipped (empty): ${skippedEmpty.length}`,
  '',
  'BEGIN;',
  '',
]

for (const entry of imported) {
  sqlLines.push(
    `UPDATE public.default_field_definitions`,
    `  SET info_note = '${esc(entry.noteCleaned)}'`,
    `  WHERE field_key = '${esc(entry.fieldKey)}';`,
    '',
  )
}

sqlLines.push('COMMIT;')
sqlLines.push('')

writeFileSync(OUTPUT, sqlLines.join('\n'), 'utf8')

// ── Generate report ──────────────────────────────────────────────────────────

const reportLines = [
  '# Field Notes Import Report',
  '',
  `Generated: ${new Date().toISOString().slice(0, 10)}`,
  '',
  '## Summary',
  '',
  `- **Source**: docs/integrate-drawingboard-schema.txt`,
  `- **Real field keys source**: supabase/migrations/20260923_step_a2_field_definitions.sql + sql/step-*.sql`,
  `- **Total properties with notes**: ${entries.length}`,
  `- **Imported**: ${imported.length}`,
  `- **Skipped (no such field in GlazePro)**: ${skippedNoField.length}`,
  `- **Skipped (empty after cleaning)**: ${skippedEmpty.length}`,
  '',
  '## Imported',
  '',
  '| Field key | Note (first 100 chars) |',
  '|---|---|',
]

for (const entry of imported) {
  const preview = entry.noteCleaned.replace(/\n/g, ' ').slice(0, 100)
  reportLines.push(`| \`${entry.fieldKey}\` | ${preview} |`)
}

reportLines.push('')
reportLines.push('## Skipped — field not in GlazePro yet')
reportLines.push('')

if (skippedNoField.length === 0) {
  reportLines.push('None.')
} else {
  reportLines.push('| Integrate field key | Raw note (first 80 chars) |')
  reportLines.push('|---|---|')
  for (const entry of skippedNoField) {
    reportLines.push(`| \`${entry.fieldKey}\` | ${entry.noteRaw.replace(/\n/g, ' ').slice(0, 80)} |`)
  }
}

reportLines.push('')
reportLines.push('## Skipped — empty after HTML cleaning')
reportLines.push('')

if (skippedEmpty.length === 0) {
  reportLines.push('None.')
} else {
  reportLines.push('| Field key | Raw note |')
  reportLines.push('|---|---|')
  for (const entry of skippedEmpty) {
    reportLines.push(`| \`${entry.fieldKey}\` | ${entry.noteRaw.slice(0, 80)} |`)
  }
}

reportLines.push('')
writeFileSync(REPORT, reportLines.join('\n'), 'utf8')

console.log(`\nResults:`)
console.log(`  Imported: ${imported.length}`)
console.log(`  Skipped (no field): ${skippedNoField.length}`)
console.log(`  Skipped (empty): ${skippedEmpty.length}`)
console.log(`  SQL:    ${OUTPUT}`)
console.log(`  Report: ${REPORT}`)
