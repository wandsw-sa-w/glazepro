#!/usr/bin/env node
/**
 * scripts/seed-drawing-templates.mjs
 *
 * Builds simplified drawing trees for the standard sash templates and writes
 * sql/step-q1b-template-seed.sql with INSERT statements.
 *
 * Run with: node scripts/seed-drawing-templates.mjs
 *
 * Trees are built directly (not via buildNewBoxSash, which requires DB-loaded
 * field definitions). They follow the same node shape as the real builder:
 *   { key, part_type, sort_order, values, children }
 *
 * Keys are UUIDs — each template gets unique keys that will be regenerated
 * when a drawing is created from it.
 */

import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(SCRIPT_DIR, '..', 'sql', 'step-q1b-template-seed.sql')

// ── SQL helpers ─────────────────────────────────────────────────────────────

function sq(s) {
  if (s === null || s === undefined) return 'NULL'
  return `'${String(s).replace(/'/g, "''")}'`
}

// ── Tree node builder ───────────────────────────────────────────────────────

function node(partType, values = {}, children = [], sortOrder = 0) {
  return { key: randomUUID(), part_type: partType, sort_order: sortOrder, values, children }
}

function glass(sortOrder = 0) {
  return node('glassPart', {}, [], sortOrder)
}

function topSash(opts = {}) {
  return node('topSashPart', { operation: opts.operation ?? null }, [glass()], 0)
}

function bottomSash(opts = {}) {
  return node('bottomSashPart', { operation: opts.operation ?? null }, [glass()], 1)
}

function sashPair(opts = {}) {
  return node('sashPairPart', {}, [topSash(opts), bottomSash(opts)], 0)
}

function cill(sortOrder = 1) {
  return node('cillPart', {}, [], sortOrder)
}

function frame(opts = {}, extraChildren = []) {
  const frameValues = {
    archHead: opts.archHead ?? false,
    archSashHead: opts.archSashHead ?? false,
  }
  return node('assemblyFramePart', frameValues, [
    sashPair(opts),
    cill(),
    ...extraChildren,
  ], 0)
}

function paintAndIronmongery(sortOrder = 1) {
  return node('paintAndIronmongeryPart', {}, [], sortOrder)
}

function notesPart(sortOrder = 2) {
  return node('notesPart', {}, [], sortOrder)
}

function pricePart(sortOrder = 3) {
  return node('pricePart', {}, [], sortOrder)
}

function drawingItem(frameNode, opts = {}) {
  const values = {
    typeOfWork: opts.typeOfWork ?? 'complete_new',
  }
  if (opts.sashThickness != null) {
    values.sashThickness = opts.sashThickness
  }
  return node('drawingItemPart', values, [
    frameNode,
    paintAndIronmongery(),
    notesPart(),
    pricePart(),
  ], 0)
}

// ── Mullion helpers for multi-box templates ─────────────────────────────────

function mullion(sortOrder = 0) {
  return node('mullionPart', { thicknessInFrame: 40 }, [], sortOrder)
}

// ── Template definitions ────────────────────────────────────────────────────

const TEMPLATES = []

// ---- Single Box Sash Windows ----

TEMPLATES.push({
  name: 'Box Sash',
  family: 'sash',
  group_name: 'Single Box Sash Windows',
  sort_order: 1,
  window_type: 'Box Sash',
  tree: drawingItem(frame()),
})

TEMPLATES.push({
  name: 'Arched Glass w Square Sash & Frame Head',
  family: 'sash',
  group_name: 'Single Box Sash Windows',
  sort_order: 2,
  window_type: 'Box Sash',
  tree: drawingItem(frame()),
  // Note: arched glass is a glazing-level attribute, not frame arch.
  // The tree shape is the same as a standard box sash — the arch is
  // set at glass level via values (archGlass: true) when the field
  // definitions support it. For now, the basic tree structure is correct.
})

TEMPLATES.push({
  name: 'Arched Sash Head w Square Frame',
  family: 'sash',
  group_name: 'Single Box Sash Windows',
  sort_order: 3,
  window_type: 'Box Sash',
  tree: drawingItem(frame({ archSashHead: true })),
})

TEMPLATES.push({
  name: 'Arched Sash & Frame Head',
  family: 'sash',
  group_name: 'Single Box Sash Windows',
  sort_order: 4,
  window_type: 'Box Sash',
  tree: drawingItem(frame({ archHead: true, archSashHead: true })),
})

// ---- Double Box Sash Windows ----

function doubleBoxFrame(opts = {}) {
  return node('assemblyFramePart', { archHead: opts.archHead ?? false, archSashHead: opts.archSashHead ?? false }, [
    sashPair(opts),
    mullion(1),
    sashPair(opts),
    cill(3),
  ], 0)
}

TEMPLATES.push({
  name: 'Double Box',
  family: 'sash',
  group_name: 'Double Box Sash Windows',
  sort_order: 1,
  window_type: 'Box Sash',
  tree: drawingItem(doubleBoxFrame()),
})

TEMPLATES.push({
  name: 'Double Arch Sash Head',
  family: 'sash',
  group_name: 'Double Box Sash Windows',
  sort_order: 2,
  window_type: 'Box Sash',
  tree: drawingItem(doubleBoxFrame({ archSashHead: true })),
})

// ---- Triple Box Sash Windows ----

function tripleBoxFrame(opts = {}) {
  return node('assemblyFramePart', { archHead: opts.archHead ?? false }, [
    sashPair(opts),
    mullion(1),
    sashPair(opts),
    mullion(3),
    sashPair(opts),
    cill(5),
  ], 0)
}

TEMPLATES.push({
  name: 'Equal Triple',
  family: 'sash',
  group_name: 'Triple Box Sash Windows',
  sort_order: 1,
  window_type: 'Box Sash',
  tree: drawingItem(tripleBoxFrame()),
})

// ---- Sash Replacement ----

for (const thickness of [35, 40, 45, 50]) {
  TEMPLATES.push({
    name: `${thickness}mm`,
    family: 'sash',
    group_name: 'Sash Replacement',
    sort_order: thickness,
    window_type: 'Box Sash',
    tree: drawingItem(frame(), {
      typeOfWork: 'new_pair_of_sashes',
      sashThickness: thickness,
    }),
  })
}

// ---- Sash Draught Seal and Overhaul ----

TEMPLATES.push({
  name: 'Sash DSO - Single Window',
  family: 'sash',
  group_name: 'Sash Draught Seal and Overhaul',
  sort_order: 1,
  window_type: 'Box Sash',
  tree: drawingItem(frame(), { typeOfWork: 'draught_seal' }),
})

// ── Generate SQL ────────────────────────────────────────────────────────────

function buildSQL() {
  const lines = [
    '-- ============================================================================',
    '-- step-q1b-template-seed.sql -- Seed drawing templates',
    '-- Generated by scripts/seed-drawing-templates.mjs',
    '-- DO NOT RUN -- apply through Supabase SQL Editor after review',
    '-- ============================================================================',
    '',
    '-- Delete existing seed templates (idempotent -- safe to re-run)',
    `DELETE FROM public.drawing_templates WHERE created_by IS NULL;`,
    '',
  ]

  for (const t of TEMPLATES) {
    const treeJson = JSON.stringify(t.tree)
    lines.push(`INSERT INTO public.drawing_templates (name, family, group_name, sort_order, window_type, tree, is_active, created_by)`)
    lines.push(`VALUES (${sq(t.name)}, ${sq(t.family)}, ${sq(t.group_name)}, ${t.sort_order}, ${sq(t.window_type)}, ${sq(treeJson)}::jsonb, true, NULL);`)
    lines.push('')
  }

  return lines.join('\n')
}

// ── Main ────────────────────────────────────────────────────────────────────

const sql = buildSQL()
writeFileSync(OUTPUT, sql, 'utf8')

console.log(`Wrote ${TEMPLATES.length} template(s) to ${OUTPUT}`)
console.log('Templates:')
for (const t of TEMPLATES) {
  console.log(`  [${t.group_name}] ${t.name}`)
}
