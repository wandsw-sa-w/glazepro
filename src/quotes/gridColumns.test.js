import { describe, it, expect } from 'vitest'
import { readColumnValue, writeColumnValue, GRID_COLUMNS } from './gridColumns.js'

// ── Known valid (partType, property) pairs ────────────────────────────────────
// Derived from default_field_definitions (step-a2) + J1 additions.
// The schema-integrity test below fails if any GRID_COLUMN references a pair
// not in this set — which catches typos before they reach the live app.
const KNOWN_FIELDS = new Map([
  ['drawingItemPart',        new Set(['typeOfWork', 'supplyOption', 'sashMaterialId', 'frameMaterialId', 'staffBeadTypeId', 'staffBeadId', 'isBiGlass'])],
  ['cillPart',               new Set(['cillMaterialId', 'height', 'depth', 'width'])],
  ['sashPairPart',           new Set(['sashThickness', 'topHornTypeShortName', 'bottomHornTypeShortName', 'midrailHeight', 'mechanicalClearanceLeft', 'mechanicalClearanceRight', 'mechanicalClearanceTop', 'mechanicalClearanceBottom', 'sashSplitId', 'fixedSashHeight', 'topHornLengthMm', 'bottomHornLengthMm'])],
  ['topSashPart',            new Set(['topHeight', 'bottomHeight', 'stileWidth', 'archHead', 'archHeight'])],
  ['bottomSashPart',         new Set(['topHeight', 'bottomHeight', 'stileWidth', 'archHead', 'archHeight'])],
  ['glassPart',              new Set(['singleGlassPartNo', 'internalGlassPartNo', 'externalGlassPartNo', 'spacerColourId', 'gasFillId', 'archHead', 'archHeight'])],
  ['paintAndIronmongeryPart',new Set(['internalFinish', 'externalFinish', 'cillFinish', 'ironmongeryFinish', 'ironmongeryFinishId', 'cutOutBrickReveal'])],
  ['pricePart',              new Set(['poa', 'priceOverride'])],
  ['notesPart',              new Set(['installationMethod', 'fireEgress', 'internalHazard', 'internalAccess', 'landingAccess', 'externalAccessId', 'hazardBelow', 'cableAlarm', 'dormerIssue', 'cutBackPlaster', 'cutBackReveal', 'quoteNotes', 'installationNotes', 'productionNotes', 'drawingLabel'])],
  ['assemblyFramePart',      new Set(['width', 'height', 'topHeight', 'leftWidth', 'rightWidth', 'frameDepth', 'jambType', 'leftOuterJamb', 'rightOuterJamb', 'leftCillHorn', 'rightCillHorn', 'archHead', 'archHeight'])],
  ['mullionPart',            new Set(['offset', 'offset2'])],
  ['transomPart',            new Set(['offset'])],
  ['verticalGlazingBarPart', new Set(['barWidth', 'offset'])],
  ['horizontalGlazingBarPart',new Set(['barWidth', 'offset'])],
])

// ── Tree fixture ──────────────────────────────────────────────────────────────

function makeTree() {
  return {
    key: 'root', part_type: 'drawingItemPart',
    values: { sashMaterialId: 'solid_redwood', typeOfWork: 'complete_new' },
    children: [
      {
        key: 'paint1', part_type: 'paintAndIronmongeryPart',
        values: { internalFinish: 'clean_white', externalFinish: 'clean_white', cillFinish: 'clean_white', ironmongeryFinish: 'PB' },
        children: [],
      },
      {
        key: 'frame1', part_type: 'assemblyFramePart',
        values: { width: 1000, height: 1500, topHeight: 79, leftWidth: 85, rightWidth: 85 },
        children: [
          {
            key: 'cill1', part_type: 'cillPart',
            values: { height: 70, cillMaterialId: 'solid_utile_hardwood' },
            children: [],
          },
          {
            key: 'pair1', part_type: 'sashPairPart',
            values: { sashThickness: 57, topHornTypeShortName: 'victorian', bottomHornTypeShortName: 'none' },
            children: [
              {
                key: 'top1', part_type: 'topSashPart',
                values: { topHeight: 49, bottomHeight: 49, stileWidth: 47 },
                children: [
                  {
                    key: 'glass1', part_type: 'glassPart',
                    values: { spacerColourId: 'white', gasFillId: 'argon' },
                    children: [],
                  },
                ],
              },
              {
                key: 'bot1', part_type: 'bottomSashPart',
                values: { topHeight: 49, bottomHeight: 88, stileWidth: 47 },
                children: [
                  {
                    key: 'glass2', part_type: 'glassPart',
                    values: {},
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        key: 'glass3', part_type: 'glassPart',
        values: { spacerColourId: 'white', gasFillId: 'argon' },
        children: [],
      },
      {
        key: 'notes1', part_type: 'notesPart',
        values: { cutBackPlaster: false, quoteNotes: 'Test note', productionNotes: 'Prod note' },
        children: [],
      },
      {
        key: 'price1', part_type: 'pricePart',
        values: { poa: false },
        children: [],
      },
    ],
  }
}

// ── Schema integrity ──────────────────────────────────────────────────────────

describe('GRID_COLUMNS schema integrity', () => {
  it('every column with partType.property references a known field key', () => {
    const errors = []
    for (const col of GRID_COLUMNS) {
      if (!col.partType || !col.property) continue
      const knownProps = KNOWN_FIELDS.get(col.partType)
      if (!knownProps) {
        errors.push(`Unknown partType "${col.partType}" in column "${col.key}"`)
      } else if (!knownProps.has(col.property)) {
        errors.push(`Unknown property "${col.property}" on ${col.partType} in column "${col.key}"`)
      }
    }
    expect(errors).toEqual([])
  })
})

// ── readColumnValue ────────────────────────────────────────────────────────────

describe('readColumnValue', () => {
  it('reads a reference field from anywhere in the tree', () => {
    const col = { partType: 'glassPart', property: 'spacerColourId' }
    expect(readColumnValue(makeTree(), col)).toBe('white')
  })

  it('reads a number field', () => {
    const col = { partType: 'sashPairPart', property: 'sashThickness' }
    expect(readColumnValue(makeTree(), col)).toBe(57)
  })

  it('reads a boolean field', () => {
    const col = { partType: 'notesPart', property: 'cutBackPlaster' }
    expect(readColumnValue(makeTree(), col)).toBe(false)
  })

  it('reads a computed sash-width column using the geometry engine', () => {
    const col = GRID_COLUMNS.find(c => c.key === 'sash_width')
    const val = readColumnValue(makeTree(), col)
    // frame 1000 - leftWidth 85 - rightWidth 85 = 830 interior; no clearances → sashWidth 830
    expect(val).toBeCloseTo(830, 0)
  })

  it('reads a computed sash-height column', () => {
    const col = GRID_COLUMNS.find(c => c.key === 'sash_height')
    const val = readColumnValue(makeTree(), col)
    // internalHeight = 1500 − 79 − 70 = 1351; topRail=49, botRail=88, M=40
    // totalGlass = 1351 − 40 − 49 − 88 = 1174; half = 587
    // topSashHeight = 587 + 49 + 40 = 676
    expect(val).toBeCloseTo(676, 0)
  })

  it('reads a text field', () => {
    const col = { partType: 'notesPart', property: 'quoteNotes' }
    expect(readColumnValue(makeTree(), col)).toBe('Test note')
  })

  it('returns null when the part type is not in the tree', () => {
    const col = { partType: 'mullionPart', property: 'offset' }
    expect(readColumnValue(makeTree(), col)).toBeNull()
  })

  it('returns null when the property is missing on an existing part', () => {
    const col = { partType: 'glassPart', property: 'notARealProperty' }
    expect(readColumnValue(makeTree(), col)).toBeNull()
  })

  it('returns null for columns with no partType/property and no compute (-> "—" in the UI)', () => {
    const col = { partType: null, property: null }
    expect(readColumnValue(makeTree(), col)).toBeNull()
  })

  it('returns null when the tree itself is null', () => {
    const col = { partType: 'glassPart', property: 'spacerColourId' }
    expect(readColumnValue(null, col)).toBeNull()
  })
})

// ── writeColumnValue ──────────────────────────────────────────────────────────

describe('writeColumnValue', () => {
  it('writes back a reference field without disturbing the rest of the tree', () => {
    const col = { partType: 'glassPart', property: 'spacerColourId' }
    const next = writeColumnValue(makeTree(), col, 'black')
    expect(readColumnValue(next, col)).toBe('black')
    expect(readColumnValue(next, { partType: 'glassPart', property: 'gasFillId' })).toBe('argon')
  })

  it('writes back a number field', () => {
    const col = { partType: 'sashPairPart', property: 'sashThickness' }
    const next = writeColumnValue(makeTree(), col, 45)
    expect(readColumnValue(next, col)).toBe(45)
  })

  it('writes back a boolean field', () => {
    const col = { partType: 'notesPart', property: 'cutBackPlaster' }
    const next = writeColumnValue(makeTree(), col, true)
    expect(readColumnValue(next, col)).toBe(true)
  })

  it('is immutable — the original tree is unchanged', () => {
    const tree = makeTree()
    const col = { partType: 'glassPart', property: 'spacerColourId' }
    writeColumnValue(tree, col, 'black')
    expect(readColumnValue(tree, col)).toBe('white')
  })

  it('is a no-op for columns with no partType/property', () => {
    const tree = makeTree()
    const col = { partType: null, property: null }
    expect(writeColumnValue(tree, col, 'anything')).toBe(tree)
  })
})

// ── GRID_COLUMNS metadata ─────────────────────────────────────────────────────

describe('GRID_COLUMNS', () => {
  it('every column has a unique key and a label', () => {
    const keys = new Set()
    for (const col of GRID_COLUMNS) {
      expect(col.key).toBeTruthy()
      expect(col.label).toBeTruthy()
      expect(keys.has(col.key)).toBe(false)
      keys.add(col.key)
    }
  })

  it('every reference column has a referenceCategory', () => {
    const missing = GRID_COLUMNS.filter(c => c.type === 'reference' && c.partType && !c.referenceCategory)
    expect(missing.map(c => c.key)).toEqual([])
  })
})
