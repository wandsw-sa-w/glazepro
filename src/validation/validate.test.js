import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'
import { validateDrawing, validateQuote, countBySeverity, hasErrors } from './validate.js'
import { computeVariables } from '../pricing/computeVariables.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'
import { BENCHMARK_L34046, BENCHMARK_A35 } from '../pricing/benchmarks/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRule(overrides = {}) {
  return {
    id: 1,
    name: 'Test Rule',
    severity: 'warning',
    condition: 'true',
    message: 'Test message',
    is_active: true,
    level: 'item',
    loop_target: null,
    ...overrides,
  }
}

function makeTree(partType = 'drawingItemPart', children = []) {
  return {
    key: 'root',
    part_type: partType,
    values: {},
    children,
  }
}

// ── validateDrawing ──────────────────────────────────────────────────────────

describe('validateDrawing', () => {
  it('fires a simple true-condition rule', () => {
    const rules = [makeRule({ condition: 'true' })]
    const results = validateDrawing(null, {}, rules, {})
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('fired')
  })

  it('passes a simple false-condition rule', () => {
    const rules = [makeRule({ condition: '1 == 0' })]
    const results = validateDrawing(null, {}, rules, {})
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('passed')
  })

  it('skips inactive rules', () => {
    const rules = [makeRule({ is_active: false })]
    const results = validateDrawing(null, {}, rules, {})
    expect(results).toHaveLength(0)
  })

  it('skips quote-level rules', () => {
    const rules = [makeRule({ level: 'quote' })]
    const results = validateDrawing(null, {}, rules, {})
    expect(results).toHaveLength(0)
  })

  it('evaluates a condition with variables', () => {
    const rules = [makeRule({ condition: 'sash_thickness == 35 and is_double_glazed' })]
    const vars = { sash_thickness: 35, is_double_glazed: true }
    const results = validateDrawing(null, vars, rules, {})
    expect(results[0].status).toBe('fired')
  })

  it('does not fire when variables do not match', () => {
    const rules = [makeRule({ condition: 'sash_thickness == 35' })]
    const vars = { sash_thickness: 40 }
    const results = validateDrawing(null, vars, rules, {})
    expect(results[0].status).toBe('passed')
  })

  it('reports unevaluable when variables are missing', () => {
    const rules = [makeRule({ condition: 'unknown_var == 1' })]
    const results = validateDrawing(null, {}, rules, {})
    expect(results[0].status).toBe('unevaluable')
    expect(results[0].missing).toContain('unknown_var')
  })

  it('interpolates variables into the message', () => {
    const rules = [makeRule({
      condition: 'true',
      message: 'Sash thickness is sash_thickness mm',
    })]
    const vars = { sash_thickness: 45 }
    const results = validateDrawing(null, vars, rules, {})
    expect(results[0].message).toBe('Sash thickness is 45 mm')
  })

  it('handles in_list function', () => {
    const rules = [makeRule({
      condition: 'in_list(sash_thickness, allowed_sash_thickess)',
    })]
    const lists = { allowed_sash_thickess: ['35', '40', '45', '50'] }
    const vars = { sash_thickness: 40 }
    const results = validateDrawing(null, vars, rules, lists)
    expect(results[0].status).toBe('fired')
  })

  it('in_list returns false for non-matching value', () => {
    const rules = [makeRule({
      condition: 'in_list(sash_thickness, allowed_sash_thickess)',
    })]
    const lists = { allowed_sash_thickess: ['35', '40', '45', '50'] }
    const vars = { sash_thickness: 38 }
    const results = validateDrawing(null, vars, rules, lists)
    expect(results[0].status).toBe('passed')
  })

  it('handles contains function', () => {
    const rules = [makeRule({
      condition: 'contains(ironmongery_part_no_list, trickle_vents)',
    })]
    const lists = { trickle_vents: ['TV100', 'TV200'] }
    const vars = { ironmongery_part_no_list: 'TV100,PB001' }
    const results = validateDrawing(null, vars, rules, lists)
    expect(results[0].status).toBe('fired')
  })

  it('handles empty function', () => {
    const rules = [makeRule({ condition: 'empty(internal_finish)' })]
    const vars = { internal_finish: '' }
    const results = validateDrawing(null, vars, rules, {})
    expect(results[0].status).toBe('fired')
  })

  it('empty returns false for non-empty value', () => {
    const rules = [makeRule({ condition: 'empty(internal_finish)' })]
    const vars = { internal_finish: 'clean_white' }
    const results = validateDrawing(null, vars, rules, {})
    expect(results[0].status).toBe('passed')
  })

  it('evaluates loop rules per matching part', () => {
    const tree = makeTree('drawingItemPart', [
      {
        key: 'glass1',
        part_type: 'glassPart',
        values: { width: 400, height: 600 },
        children: [],
      },
      {
        key: 'glass2',
        part_type: 'glassPart',
        values: { width: 200, height: 300 },
        children: [],
      },
    ])
    const rules = [makeRule({
      id: 10,
      loop_target: 'glass_unit',
      condition: 'width < 0.25',  // width in metres (400mm -> 0.4, 200mm -> 0.2)
    })]
    const results = validateDrawing(tree, {}, rules, {})
    // glass1 width 0.4 -> passed, glass2 width 0.2 -> fired
    expect(results).toHaveLength(2)
    const fired = results.filter(r => r.status === 'fired')
    expect(fired).toHaveLength(1)
    expect(fired[0].part_key).toBe('glass2')
  })

  it('skips loop rules when no matching parts exist', () => {
    const tree = makeTree('drawingItemPart', [])
    const rules = [makeRule({ loop_target: 'glass_unit', condition: 'true' })]
    const results = validateDrawing(tree, {}, rules, {})
    expect(results).toHaveLength(0)
  })

  it('evaluates sash loop across top and bottom sash parts', () => {
    const tree = makeTree('drawingItemPart', [
      {
        key: 'top1',
        part_type: 'topSashPart',
        values: { width: 500, height: 800 },
        children: [],
      },
      {
        key: 'bot1',
        part_type: 'bottomSashPart',
        values: { width: 500, height: 1200 },
        children: [],
      },
    ])
    const rules = [makeRule({
      loop_target: 'sliding_sash',
      condition: 'true',
    })]
    const results = validateDrawing(tree, {}, rules, {})
    expect(results).toHaveLength(2)
  })

  it('handles comparison operators including !=', () => {
    const rules = [makeRule({ condition: 'spacer_dim != 14' })]
    const vars = { spacer_dim: 10 }
    const results = validateDrawing(null, vars, rules, {})
    expect(results[0].status).toBe('fired')
  })

  it('handles not operator', () => {
    const rules = [makeRule({ condition: 'not is_heritage' })]
    const vars = { is_heritage: false }
    const results = validateDrawing(null, vars, rules, {})
    expect(results[0].status).toBe('fired')
  })

  it('handles max() and min() built-in functions', () => {
    const rules = [makeRule({
      condition: 'max(a, b) > 10',
    })]
    const vars = { a: 5, b: 12 }
    const results = validateDrawing(null, vars, rules, {})
    expect(results[0].status).toBe('fired')
  })

  it('preserves rule_id and severity in results', () => {
    const rules = [makeRule({ id: 42, severity: 'error', condition: 'true' })]
    const results = validateDrawing(null, {}, rules, {})
    expect(results[0].rule_id).toBe(42)
    expect(results[0].severity).toBe('error')
  })
})

// ── validateQuote ────────────────────────────────────────────────────────────

describe('validateQuote', () => {
  it('evaluates quote-level rules', () => {
    const rules = [makeRule({
      level: 'quote',
      condition: 'item_qty == 1',
    })]
    const vars = { item_qty: 1 }
    const results = validateQuote(vars, [], rules, {})
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('fired')
  })

  it('skips item-level rules', () => {
    const rules = [makeRule({ level: 'item', condition: 'true' })]
    const results = validateQuote({}, [], rules, {})
    expect(results).toHaveLength(0)
  })

  it('interpolates variables in quote messages', () => {
    const rules = [makeRule({
      level: 'quote',
      condition: 'true',
      message: 'Estimated installation hours: installation_labour_time',
    })]
    const vars = { installation_labour_time: 12.5 }
    const results = validateQuote(vars, [], rules, {})
    expect(results[0].message).toBe('Estimated installation hours: 12.5')
  })
})

// ── countBySeverity ──────────────────────────────────────────────────────────

describe('countBySeverity', () => {
  it('counts fired results by severity', () => {
    const results = [
      { status: 'fired', severity: 'error' },
      { status: 'fired', severity: 'error' },
      { status: 'fired', severity: 'warning' },
      { status: 'fired', severity: 'information' },
      { status: 'passed', severity: 'error' },       // not counted
      { status: 'unevaluable', severity: 'warning' }, // not counted
    ]
    const counts = countBySeverity(results)
    expect(counts.errors).toBe(2)
    expect(counts.warnings).toBe(1)
    expect(counts.info).toBe(1)
  })
})

// ── hasErrors ────────────────────────────────────────────────────────────────

describe('hasErrors', () => {
  it('returns true when error-severity rules fired', () => {
    const results = [
      { status: 'fired', severity: 'error' },
    ]
    expect(hasErrors(results)).toBe(true)
  })

  it('returns false when no errors fired', () => {
    const results = [
      { status: 'fired', severity: 'warning' },
      { status: 'passed', severity: 'error' },
    ]
    expect(hasErrors(results)).toBe(false)
  })
})

// ── Publish-blocking validation scenario ────────────────────────────────────

describe('publish-blocking: softwood cill error', () => {
  it('fires an error rule when is_solid_redwood_cill is true', () => {
    // Simulates the "Softwood Cill" validation rule: cill material is solid
    // redwood, which is an error that should block publishing.
    const rules = [makeRule({
      id: 99,
      severity: 'error',
      condition: 'is_solid_redwood_cill',
      message: 'Softwood cill selected — use hardwood or Accoya',
      level: 'item',
    })]
    const vars = { is_solid_redwood_cill: true }
    const results = validateDrawing(null, vars, rules, {})
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('fired')
    expect(results[0].severity).toBe('error')
    expect(results[0].message).toBe('Softwood cill selected — use hardwood or Accoya')
    expect(hasErrors(results)).toBe(true)
  })

  it('does not fire the softwood cill rule for accoya cill', () => {
    const rules = [makeRule({
      id: 99,
      severity: 'error',
      condition: 'is_solid_redwood_cill',
      message: 'Softwood cill selected — use hardwood or Accoya',
      level: 'item',
    })]
    const vars = { is_solid_redwood_cill: false }
    const results = validateDrawing(null, vars, rules, {})
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('passed')
    expect(hasErrors(results)).toBe(false)
  })
})

// ── Import SQL verification ─────────────────────────────────────────────────

describe('step-p3 import SQL', () => {
  it('never marks a rule with an unknown variable as active', () => {
    const sqlPath = resolve(__dirname, '../../sql/step-p3-validation-import.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    // Find all INSERT blocks and extract (is_active, blocked_reason, condition)
    const insertBlocks = sql.split(/^-- Rule \d+:/m).slice(1)

    for (const block of insertBlocks) {
      const activeMatch = block.match(/^\s*(true|false),\s*$/m)
      const reasonMatch = block.match(/^\s*(NULL|'[^']*'),?\s*$/m)
      if (!activeMatch) continue

      const isActive = activeMatch[1] === 'true'
      const reason = reasonMatch?.[1]

      // If blocked_reason contains "missing variable", is_active must be false
      if (reason && reason.includes('missing variable')) {
        expect(isActive).toBe(false)
      }

      // If is_active is true, blocked_reason must be NULL
      if (isActive) {
        // The reason line should be NULL (the last value before closing paren)
        const valuesBlock = block.match(/VALUES\s*\(([\s\S]*?)\);/)?.[1]
        if (valuesBlock) {
          const lastValue = valuesBlock.trim().replace(/,\s*$/, '').split(',').pop()?.trim()
          expect(lastValue).toBe('NULL')
        }
      }
    }
  })
})

// ── Part display labels ──────────────────────────────────────────────────────

describe('validateDrawing — part display labels', () => {
  const tree = {
    key: 'item', part_type: 'drawingItemPart', values: {}, children: [
      { key: 'frame', part_type: 'assemblyFramePart', values: {}, children: [
        { key: 'pair', part_type: 'sashPairPart', values: {}, children: [
          { key: 'top', part_type: 'topSashPart', values: { operation: 'cord_hung' }, children: [
            { key: 'glass1', part_type: 'glassPart', values: {}, children: [] },
          ] },
          { key: 'bot', part_type: 'bottomSashPart', values: { operation: 'cord_hung' }, children: [
            { key: 'glass2', part_type: 'glassPart', values: {}, children: [] },
          ] },
        ] },
      ] },
    ],
  }

  it('loop results show display label not internal part type', () => {
    const rule = {
      id: 'r1', name: 'test', condition: 'true', severity: 'warning',
      message: 'test message', is_active: true, level: 'item',
      loop_target: 'glass_unit',
    }
    const results = validateDrawing(tree, {}, [rule], {})
    const fired = results.filter(r => r.status === 'fired')
    expect(fired).toHaveLength(2)
    // Labels should be display names with parent context, not "glassPart"
    expect(fired[0].part_label).toContain('Glazing')
    expect(fired[0].part_label).not.toBe('glassPart')
    // One should be under Top Sash, the other under Bottom Sash
    const labels = fired.map(r => r.part_label).sort()
    expect(labels).toContain('Top Sash > Glazing')
    expect(labels).toContain('Bottom Sash > Glazing')
  })

  it('each loop result has a part_key for click-to-select', () => {
    const rule = {
      id: 'r3', name: 'test', condition: 'true', severity: 'warning',
      message: 'test', is_active: true, level: 'item',
      loop_target: 'glass_unit',
    }
    const results = validateDrawing(tree, {}, [rule], {})
    const fired = results.filter(r => r.status === 'fired')
    for (const r of fired) {
      expect(r.part_key).toBeTruthy()
      expect(r.part_label).toBeTruthy()
      expect(r.part_label).not.toBe(r.part_key) // label is not the key
    }
  })

  it('sliding_sash results show "Top Sash" and "Bottom Sash"', () => {
    const rule = {
      id: 'r2', name: 'test', condition: 'true', severity: 'info',
      message: 'test', is_active: true, level: 'item',
      loop_target: 'sliding_sash',
    }
    const results = validateDrawing(tree, {}, [rule], {})
    const fired = results.filter(r => r.status === 'fired')
    expect(fired).toHaveLength(2)
    const labels = fired.map(r => r.part_label).sort()
    // Sashes are under sashPairPart, so labels include the parent
    expect(labels.some(l => l.includes('Top Sash'))).toBe(true)
    expect(labels.some(l => l.includes('Bottom Sash'))).toBe(true)
  })
})

// ── Import script fixMessage: "cannot" must not become "can!" ────────────────

describe('import-validation-rules fixMessage', () => {
  // Replicate the fixMessage logic here to test it
  function fixMessage(msg) {
    let m = msg
    m = m.replace(/\bnot not\b/g, '!!')
    m = m.replace(/(\w)not\b/g, (match, pre, offset) => {
      const before = m.slice(Math.max(0, offset - 3), offset + 1)
      if (/[Cc]an$/.test(before)) return match
      return pre + '!'
    })
    return m
  }

  it('"cannot" is preserved', () => {
    expect(fixMessage('Quote cannot be published')).toBe('Quote cannot be published')
  })

  it('"Cannot" is preserved', () => {
    expect(fixMessage('Cannot publish with retired price file')).toBe('Cannot publish with retired price file')
  })

  it('"VENTSnot" becomes "VENTS!"', () => {
    expect(fixMessage('VENTSnot ADD')).toBe('VENTS! ADD')
  })

  it('"not not" becomes "!!"', () => {
    expect(fixMessage('not not Please note')).toBe('!! Please note')
  })

  it('mixed: "cannot" kept, "VENTSnot" fixed', () => {
    expect(fixMessage('You cannot use VENTSnot items')).toBe('You cannot use VENTS! items')
  })
})

// ── Step AI: the complete-new 45 mm rule ────────────────────────────────────
// Nathan's business rule (9 Oct 2026, sash windows only): a complete new sash
// window is always made 45 mm thick. The reviewer wrote the rule in
// sql/step-ai1-complete-new-45mm-rule.sql (Nathan runs it); this test reads
// the condition out of that file, so the rule the app will hold is the rule
// under test, and evaluates it against REAL item variables from
// computeVariables on real benchmark drawings.

describe('step-ai1 complete-new 45mm validation rule', () => {
  const sql = readFileSync(resolve(__dirname, '../../sql/step-ai1-complete-new-45mm-rule.sql'), 'utf-8')
  // The condition is the SQL string literal containing sash_thickness
  const condition = sql.match(/'([^']*sash_thickness[^']*)'/)?.[1]

  function itemVars(tree) {
    const derived = computeDerived(tree)
    return computeVariables(tree, derived, {}) ?? {}
  }

  function evaluate(tree) {
    const rules = [makeRule({ condition, level: 'item', loop_target: null, severity: 'warning' })]
    const results = validateDrawing(tree, itemVars(tree), rules, {})
    expect(results).toHaveLength(1)
    return results[0]
  }

  // A complete-new box sash at another thickness: L34046 with 57 mm stored
  function completeNewAt(mm) {
    const tree = JSON.parse(JSON.stringify(BENCHMARK_L34046.tree))
    const frame = tree.children.find(c => c.part_type === 'assemblyFramePart')
    frame.children.find(c => c.part_type === 'sashPairPart').values.sashThickness = mm
    return tree
  }

  it('is the condition the reviewer wrote', () => {
    expect(condition).toBe('is_sw and frame_to_be_replaced and sash_thickness != 45')
  })

  it('evaluates — every variable it names exists (never "unevaluable")', () => {
    for (const tree of [completeNewAt(57), completeNewAt(45), BENCHMARK_A35.tree]) {
      const r = evaluate(tree)
      expect(r.status).not.toBe('unevaluable')
      expect(r.missing).toEqual([])
    }
    const vars = itemVars(completeNewAt(45))
    for (const name of ['is_sw', 'frame_to_be_replaced', 'sash_thickness']) {
      expect(name in vars, name).toBe(true)
    }
  })

  it('fires on a complete-new sash window at 57 mm', () => {
    expect(evaluate(completeNewAt(57)).status).toBe('fired')
  })

  it('does not fire on a complete-new sash window at 45 mm', () => {
    expect(evaluate(completeNewAt(45)).status).toBe('passed')
  })

  it('does not fire on a sash replacement at 35 mm (benchmark A35)', () => {
    const r = evaluate(BENCHMARK_A35.tree)
    expect(itemVars(BENCHMARK_A35.tree).sash_thickness).toBe(35)
    expect(r.status).toBe('passed')
  })
})
