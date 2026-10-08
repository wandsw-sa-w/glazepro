/**
 * optionVocabulary.test.js
 * The single mapping from real stored option codes to engine flags.
 * The real saved tree (L507712 drawing 1) is the reference: it must map
 * cleanly, with no warnings and no silent falses.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  timberFamily, glazingType, hornKind, hornLengthMm, operationKind,
  spacerDimensionMm, glassSpacerMm, isWarmEdgeSpacerColour,
  isLambsTongueMoulding, collectVocabularyWarnings,
  TIMBER_FAMILY_DENSITIES,
} from './optionVocabulary.js'
import { computeVariables } from './computeVariables.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REAL_TREE = JSON.parse(readFileSync(
  resolve(__dirname, 'benchmarks', 'real-trees', 'L507712-drawing1.raw.json'), 'utf8'))

describe('timberFamily — real timber_species codes', () => {
  it('maps the real codes', () => {
    expect(timberFamily('softwood')).toBe('redwood')       // Integrate "Solid Redwood"
    expect(timberFamily('utile')).toBe('utile_hardwood')   // Integrate "Solid Utile Hardwood"
    expect(timberFamily('accoya')).toBe('accoya')
    expect(timberFamily('oak')).toBe('oak')
    expect(timberFamily('idigbo')).toBe('idigbo')
    expect(timberFamily('douglas_fir')).toBe('douglas_fir')
    expect(timberFamily('meranti')).toBe('meranti')
  })

  it('empty → null; the old fixture-only codes are NOT accepted', () => {
    expect(timberFamily(null)).toBeNull()
    expect(timberFamily('')).toBeNull()
    expect(timberFamily('solid_redwood')).toBeUndefined()
    expect(timberFamily('solid_utile_hardwood')).toBeUndefined()
  })

  it('densities exist for the calibrated families only', () => {
    expect(TIMBER_FAMILY_DENSITIES.redwood).toBe(508.3)
    expect(TIMBER_FAMILY_DENSITIES.utile_hardwood).toBe(780.1)
    expect(TIMBER_FAMILY_DENSITIES.oak).toBeUndefined()
  })
})

describe('glazingType — real glazing_type codes', () => {
  it('maps the real codes and rejects the old fixture-only ones', () => {
    expect(glazingType('double_glazing')).toBe('double')
    expect(glazingType('single_glazing')).toBe('single')
    expect(glazingType('double_glazed')).toBeUndefined()
    expect(glazingType('')).toBeNull()
  })
})

describe('hornKind / operationKind / spacers / moulding', () => {
  it('none and no_horn both mean no horn', () => {
    expect(hornKind('none')).toBe('none')
    expect(hornKind('no_horn')).toBe('none')
    expect(hornKind('victorian')).toBe('victorian')
    expect(hornKind('custom')).toBe('custom')
    expect(hornKind('stub')).toBeUndefined()
  })

  it('horn length: stored wins; else by type (Victorian 75 — both Integrate drawings); custom without a length is an error', () => {
    expect(hornLengthMm('victorian', 75)).toBe(75)
    expect(hornLengthMm('victorian', 60)).toBe(60)   // stored length wins
    expect(hornLengthMm('victorian', null)).toBe(75) // by type
    expect(hornLengthMm('no_horn', null)).toBe(0)
    expect(hornLengthMm('none', 0)).toBe(0)
    expect(hornLengthMm(null, null)).toBe(0)
    expect(hornLengthMm('custom', 90)).toBe(90)
    expect(() => hornLengthMm('custom', null)).toThrow(/Custom horn/)
    expect(hornLengthMm('stub', null)).toBe(0)       // unknown type → 0 + vocabulary warning
  })

  it('operation codes', () => {
    expect(operationKind('cord_hung')).toBe('cord')
    expect(operationKind('spiral_hung')).toBe('spiral')
    expect(operationKind('fix')).toBe('fix')
    expect(operationKind('fixed')).toBe('fix')
    expect(operationKind('tilt')).toBeUndefined()
  })

  it('spacer dimension comes from the spacerDimId code', () => {
    expect(spacerDimensionMm('spacer_16')).toBe(16)
    expect(spacerDimensionMm('spacer_4')).toBe(4)
    expect(spacerDimensionMm('16mm_white_warm_edge')).toBeUndefined()
    expect(glassSpacerMm({ spacerDimId: 'spacer_16' })).toBe(16)
    expect(glassSpacerMm({ spacerHeight: 12 })).toBe(12)   // legacy fixture fallback
    expect(glassSpacerMm({})).toBe(0)
  })

  it('warm edge reads the colour code, not the dimension', () => {
    expect(isWarmEdgeSpacerColour('white_warm_edge')).toBe(true)
    expect(isWarmEdgeSpacerColour('white')).toBe(false)
    expect(isWarmEdgeSpacerColour(null)).toBe(false)
  })

  it('moulding profile code', () => {
    expect(isLambsTongueMoulding('lambs_tongue')).toBe(true)
    expect(isLambsTongueMoulding('ovolo')).toBe(false)
  })
})

describe('collectVocabularyWarnings', () => {
  it('the real L507712 tree produces no vocabulary warnings', () => {
    expect(collectVocabularyWarnings(REAL_TREE)).toEqual([])
  })

  it('an unrecognised code warns, naming the field and the code', () => {
    const tree = JSON.parse(JSON.stringify(REAL_TREE))
    tree.values.sashMaterialId = 'solid_redwood'  // the old fixture-only code
    tree.children.find(c => c.part_type === 'assemblyFramePart')
      .children.find(c => c.part_type === 'sashPairPart')
      .children[0].children[0].values.glazingId = 'double_glazed'
    const warnings = collectVocabularyWarnings(tree)
    expect(warnings).toContain('Unrecognised sashMaterialId code: "solid_redwood"')
    expect(warnings).toContain('Unrecognised glazingId code: "double_glazed"')
  })

  it('real-but-unpriceable codes warn too', () => {
    const tree = JSON.parse(JSON.stringify(REAL_TREE))
    tree.values.typeOfWork = 'no_work'
    tree.values.staffBeadTypeId = 'custom'
    tree.values.sashMaterialId = 'meranti'
    const warnings = collectVocabularyWarnings(tree)
    expect(warnings.some(w => w.includes('"no_work"'))).toBe(true)
    expect(warnings.some(w => w.includes('custom beads'))).toBe(true)
    expect(warnings.some(w => w.includes('No timber density') && w.includes('meranti'))).toBe(true)
  })
})

describe('computeVariables on the real saved tree', () => {
  const derived = computeDerived(REAL_TREE)
  const vars = computeVariables(REAL_TREE, derived, {})

  it('material flags fire from the real codes', () => {
    expect(vars.is_solid_redwood_frame).toBe(true)   // 'softwood'
    expect(vars.is_solid_redwood_sash).toBe(true)
    expect(vars.is_cill_hardwood).toBe(true)         // 'utile'
    expect(vars.is_solid_utile_hardwood_cill).toBe(true)
  })

  it('glazing, docL, jamb and bead flags fire from the real codes', () => {
    expect(vars.is_double_glazed).toBe(true)         // 'double_glazing'
    expect(vars.is_doc_l).toBe(true)                 // stored as isDocL
    expect(vars.is_docl).toBe(true)
    expect(vars.is_hollow_box_jamb).toBe(true)       // 'hollow_box_for_sash'
    expect(vars.is_small_staff_bead).toBe(true)
    expect(vars.is_complete_new).toBe(true)
    expect(vars.is_cord_hung).toBe(true)             // 'cord_hung'
    expect(vars.has_victorian_horn).toBe(true)       // top 'victorian', bottom 'none'
  })
})
