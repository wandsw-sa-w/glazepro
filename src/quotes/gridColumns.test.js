import { describe, it, expect } from 'vitest'
import { readColumnValue, writeColumnValue, GRID_COLUMNS } from './gridColumns.js'

function makeTree() {
  return {
    key: 'root', part_type: 'drawingItemPart', values: {},
    children: [
      {
        key: 'glass', part_type: 'glassPart',
        values: { spacerColourId: 'white', gasFillId: 'argon' },
        children: [],
      },
      {
        key: 'notes', part_type: 'notesPart',
        values: { cutBackPlaster: false },
        children: [],
      },
      {
        key: 'pair', part_type: 'sashPairPart',
        values: { midrailHeight: 40 },
        children: [],
      },
    ],
  }
}

describe('readColumnValue', () => {
  it('reads a reference field from anywhere in the tree', () => {
    const col = { partType: 'glassPart', property: 'spacerColourId' }
    expect(readColumnValue(makeTree(), col)).toBe('white')
  })

  it('reads a number field', () => {
    const col = { partType: 'sashPairPart', property: 'midrailHeight' }
    expect(readColumnValue(makeTree(), col)).toBe(40)
  })

  it('reads a boolean (tick box) field', () => {
    const col = { partType: 'notesPart', property: 'cutBackPlaster' }
    expect(readColumnValue(makeTree(), col)).toBe(false)
  })

  it('returns null when the part type is not in the tree', () => {
    const col = { partType: 'mullionPart', property: 'offset' }
    expect(readColumnValue(makeTree(), col)).toBeNull()
  })

  it('returns null when the property is missing on an existing part', () => {
    const col = { partType: 'glassPart', property: 'notARealProperty' }
    expect(readColumnValue(makeTree(), col)).toBeNull()
  })

  it('returns null for columns with no partType/property (skip -> "—" in the UI)', () => {
    const col = { partType: null, property: null }
    expect(readColumnValue(makeTree(), col)).toBeNull()
  })

  it('returns null when the tree itself is null', () => {
    const col = { partType: 'glassPart', property: 'spacerColourId' }
    expect(readColumnValue(null, col)).toBeNull()
  })
})

describe('writeColumnValue', () => {
  it('writes back a reference field without disturbing the rest of the tree', () => {
    const col = { partType: 'glassPart', property: 'spacerColourId' }
    const next = writeColumnValue(makeTree(), col, 'black')
    expect(readColumnValue(next, col)).toBe('black')
    // sibling value on the same part is untouched
    expect(readColumnValue(next, { partType: 'glassPart', property: 'gasFillId' })).toBe('argon')
  })

  it('writes back a number field', () => {
    const col = { partType: 'sashPairPart', property: 'midrailHeight' }
    const next = writeColumnValue(makeTree(), col, 44)
    expect(readColumnValue(next, col)).toBe(44)
  })

  it('writes back a boolean (tick box) field', () => {
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
})
