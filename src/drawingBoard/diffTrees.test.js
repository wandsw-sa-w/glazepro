import { describe, it, expect } from 'vitest'
import { diffTrees } from './diffTrees.js'

// ── Part labels (matching DrawingBoard.jsx PART_LABELS) ───────────────────────

const PART_LABELS = {
  drawingItemPart:         'Item',
  paintAndIronmongeryPart: 'Finish & Ironmongery',
  notesPart:               'Access & H&S',
  pricePart:               'Price',
  assemblyFramePart:       'Frame',
  cillPart:                'Cill',
  sashPairPart:            'Pair of Sashes',
  topSashPart:             'Top Sash',
  bottomSashPart:          'Bottom Sash',
  glassPart:               'Glazing',
  containerPart:           'Container',
  mullionPart:             'Mullion',
  transomPart:             'Transom',
}

// ── Minimal field defs ─────────────────────────────────────────────────────────

const FIELD_DEFS = {
  drawingItemPart: [
    { property_name: 'typeOfWork', label: 'Type of Work', field_key: 'drawingItemPart.typeOfWork', data_type: 'reference', reference_category: 'type_of_work', role: 'input' },
    { property_name: 'location', label: 'Location', field_key: 'drawingItemPart.location', data_type: 'text', role: 'input' },
    { property_name: 'sheetQty', label: 'Quantity', field_key: 'drawingItemPart.sheetQty', data_type: 'number', role: 'input' },
  ],
  assemblyFramePart: [
    { property_name: 'width', label: 'Width', field_key: 'assemblyFramePart.width', data_type: 'number', role: 'input', unit: 'mm' },
    { property_name: 'height', label: 'Height', field_key: 'assemblyFramePart.height', data_type: 'number', role: 'input', unit: 'mm' },
  ],
  topSashPart: [
    { property_name: 'operation', label: 'Operation', field_key: 'topSashPart.operation', data_type: 'reference', reference_category: 'sash_operation', role: 'input' },
  ],
  bottomSashPart: [
    { property_name: 'operation', label: 'Operation', field_key: 'bottomSashPart.operation', data_type: 'reference', reference_category: 'sash_operation', role: 'input' },
  ],
  glassPart: [
    { property_name: 'innerGlass', label: 'Inner Glass', field_key: 'glassPart.innerGlass', data_type: 'reference', reference_category: 'glass_type', role: 'input' },
    { property_name: 'outerGlass', label: 'Outer Glass', field_key: 'glassPart.outerGlass', data_type: 'reference', reference_category: 'glass_type', role: 'input' },
  ],
  cillPart: [
    { property_name: 'height', label: 'Height', field_key: 'cillPart.height', data_type: 'number', role: 'input' },
  ],
  paintAndIronmongeryPart: [
    { property_name: 'internalFinish', label: 'Internal Finish', field_key: 'paintAndIronmongeryPart.internalFinish', data_type: 'text', role: 'input' },
  ],
}

// ── Reference options ───────────────────────────────────────────────────────────

const REF_OPTIONS = {
  type_of_work: [
    { code: 'complete_new', label: 'Complete New Window' },
    { code: 'draught_seal', label: 'Draught Seal & Overhaul' },
  ],
  sash_operation: [
    { code: 'cord_hung', label: 'Cord Hung' },
    { code: 'spring_balanced', label: 'Spring Balanced' },
    { code: 'fixed', label: 'Fixed' },
  ],
  glass_type: [
    { code: '4mm_clear', label: '4mm Clear' },
    { code: '4mm_toughened', label: '4mm Toughened' },
    { code: '6.4mm_lam', label: '6.4mm Laminated' },
  ],
}

// ── Fixture: minimal box sash tree ─────────────────────────────────────────────

function makeTree(overrides = {}) {
  return {
    key: 'root',
    part_type: 'drawingItemPart',
    values: { typeOfWork: 'complete_new', location: 'Kitchen front', sheetQty: 1, ...overrides.item },
    children: [
      {
        key: 'frame',
        part_type: 'assemblyFramePart',
        values: { width: 1075, height: 1630, ...overrides.frame },
        children: [
          {
            key: 'pair',
            part_type: 'sashPairPart',
            values: {},
            children: [
              {
                key: 'top',
                part_type: 'topSashPart',
                values: { operation: 'cord_hung', ...overrides.topSash },
                children: [
                  {
                    key: 'glass-top',
                    part_type: 'glassPart',
                    values: { innerGlass: '4mm_clear', outerGlass: '4mm_clear', ...overrides.glassTop },
                    children: [],
                  },
                ],
              },
              {
                key: 'bot',
                part_type: 'bottomSashPart',
                values: { operation: 'cord_hung', ...overrides.botSash },
                children: [
                  {
                    key: 'glass-bot',
                    part_type: 'glassPart',
                    values: { innerGlass: '4mm_clear', outerGlass: '4mm_clear', ...overrides.glassBot },
                    children: [],
                  },
                ],
              },
            ],
          },
          { key: 'cill', part_type: 'cillPart', values: { height: 67, ...overrides.cill }, children: [] },
        ],
      },
      { key: 'paint', part_type: 'paintAndIronmongeryPart', values: { internalFinish: 'Standard White', ...overrides.paint }, children: [] },
    ],
  }
}

const opts = { fieldDefs: FIELD_DEFS, refOptions: REF_OPTIONS, partLabels: PART_LABELS }

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('diffTrees', () => {
  it('returns empty array when trees are identical', () => {
    const tree = makeTree()
    expect(diffTrees(tree, tree, opts)).toEqual([])
  })

  it('returns empty array when both inputs are null', () => {
    expect(diffTrees(null, null, opts)).toEqual([])
  })

  it('detects a simple value change', () => {
    const oldTree = makeTree()
    const newTree = makeTree({ frame: { width: 1200 } })
    const result = diffTrees(oldTree, newTree, opts)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      part: 'Item > Frame',
      field: 'Width',
      from: '1075',
      to: '1200',
    })
  })

  it('detects multiple changes across parts', () => {
    const oldTree = makeTree()
    const newTree = makeTree({ frame: { width: 1200, height: 1800 } })
    const result = diffTrees(oldTree, newTree, opts)
    expect(result).toHaveLength(2)
    expect(result.find(c => c.field === 'Width')).toEqual({
      part: 'Item > Frame',
      field: 'Width',
      from: '1075',
      to: '1200',
    })
    expect(result.find(c => c.field === 'Height')).toEqual({
      part: 'Item > Frame',
      field: 'Height',
      from: '1630',
      to: '1800',
    })
  })

  it('resolves reference codes to labels', () => {
    const oldTree = makeTree()
    const newTree = makeTree({ topSash: { operation: 'spring_balanced' } })
    const result = diffTrees(oldTree, newTree, opts)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      part: 'Item > Frame > Pair of Sashes > Top Sash',
      field: 'Operation',
      from: 'Cord Hung',
      to: 'Spring Balanced',
    })
  })

  it('resolves nested glass reference codes', () => {
    const oldTree = makeTree()
    const newTree = makeTree({ glassTop: { innerGlass: '4mm_toughened' } })
    const result = diffTrees(oldTree, newTree, opts)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      part: 'Item > Frame > Pair of Sashes > Top Sash > Glazing',
      field: 'Inner Glass',
      from: '4mm Clear',
      to: '4mm Toughened',
    })
  })

  it('detects a value set from null', () => {
    const oldTree = makeTree({ item: { location: null } })
    const newTree = makeTree({ item: { location: 'Kitchen front' } })
    const result = diffTrees(oldTree, newTree, opts)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      part: 'Item',
      field: 'Location',
      from: null,
      to: 'Kitchen front',
    })
  })

  it('detects a value cleared to null', () => {
    const oldTree = makeTree({ item: { location: 'Kitchen front' } })
    const newTree = makeTree({ item: { location: null } })
    const result = diffTrees(oldTree, newTree, opts)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      part: 'Item',
      field: 'Location',
      from: 'Kitchen front',
      to: null,
    })
  })

  it('detects part added (new child)', () => {
    const oldTree = makeTree()
    const newTree = makeTree()
    // Add a mullion to the frame
    newTree.children[0].children.push({
      key: 'mullion-1',
      part_type: 'mullionPart',
      values: {},
      children: [],
    })
    const result = diffTrees(oldTree, newTree, opts)
    const added = result.find(c => c.field === '(added)')
    expect(added).toBeTruthy()
    expect(added.part).toContain('Mullion')
  })

  it('detects part removed', () => {
    const oldTree = makeTree()
    oldTree.children[0].children.push({
      key: 'transom-1',
      part_type: 'transomPart',
      values: {},
      children: [],
    })
    const newTree = makeTree()
    const result = diffTrees(oldTree, newTree, opts)
    const removed = result.find(c => c.field === '(removed)')
    expect(removed).toBeTruthy()
    expect(removed.part).toContain('Transom')
  })

  it('handles deeply identical trees (different keys) as no changes', () => {
    const tree1 = makeTree()
    // Deep clone with different keys but same values
    const tree2 = JSON.parse(JSON.stringify(tree1))
    tree2.key = 'different-root'
    tree2.children[0].key = 'different-frame'
    const result = diffTrees(tree1, tree2, opts)
    expect(result).toEqual([])
  })

  it('works with minimal/empty options', () => {
    const oldTree = makeTree()
    const newTree = makeTree({ frame: { width: 999 } })
    const result = diffTrees(oldTree, newTree, {})
    expect(result).toHaveLength(1)
    // Without partLabels, uses part_type as label
    expect(result[0].part).toContain('assemblyFramePart')
    // Without refOptions, shows raw value
    expect(result[0].from).toBe('1075')
    expect(result[0].to).toBe('999')
  })

  it('uses label_override when present', () => {
    const oldTree = makeTree()
    const newTree = makeTree({ cill: { height: 80 } })
    // The cill is at children[0].children[1] (frame's second child)
    newTree.children[0].children[1] = {
      key: 'cill',
      part_type: 'cillPart',
      label_override: 'Stone Cill',
      values: { height: 80 },
      children: [],
    }
    oldTree.children[0].children[1] = {
      key: 'cill',
      part_type: 'cillPart',
      label_override: 'Stone Cill',
      values: { height: 67 },
      children: [],
    }
    const result = diffTrees(oldTree, newTree, opts)
    expect(result).toHaveLength(1)
    expect(result[0].part).toContain('Stone Cill')
  })
})
