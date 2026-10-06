import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'
import { validateDrawing, validateQuote, countBySeverity, hasErrors } from './validate.js'

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
