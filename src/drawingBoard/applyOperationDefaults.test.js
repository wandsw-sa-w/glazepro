import { describe, it, expect } from 'vitest'
import { applyOperationDefaults } from './applyOperationDefaults'

// ── Helpers ───────────────────────────────────────────────────────────────────

function findFirst(node, type) {
  if (!node) return null
  if (node.part_type === type) return node
  for (const c of (node.children ?? [])) {
    const f = findFirst(c, type)
    if (f) return f
  }
  return null
}

// Minimal tree: drawingItemPart → assemblyFramePart → [cillPart, sashPairPart → [top, bot]]
function makeTree(topOp = null, botOp = null) {
  return {
    key: 'item', part_type: 'drawingItemPart', values: {}, children: [
      {
        key: 'frame', part_type: 'assemblyFramePart',
        values: { topHeight: 0, leftWidth: 0, rightWidth: 0 },
        children: [
          { key: 'cill', part_type: 'cillPart', values: {}, children: [] },
          {
            key: 'pair', part_type: 'sashPairPart', values: {}, children: [
              { key: 'top', part_type: 'topSashPart',    values: { operation: topOp }, children: [] },
              { key: 'bot', part_type: 'bottomSashPart', values: { operation: botOp }, children: [] },
            ],
          },
        ],
      },
    ],
  }
}

const refOptions = {
  sash_operation: [
    { code: 'cord_hung',       label: 'Cord Hung'        },
    { code: 'spiral_balance',  label: 'Spiral Balance'   },
  ],
  jamb_type: [
    { code: 'hollow_box_for_sash',   label: 'Hollow Box for Sash'   },
    { code: 'solid_spiral_for_sash', label: 'Solid Spiral for Sash' },
  ],
}

// Values matching the "Integrate check" in computeDerived.test.js
const profileValues = [
  // Cord defaults
  { field_key: 'sashPairPart.defaultCordFrameHead',      default_value: '79'                 },
  { field_key: 'sashPairPart.defaultCordFrameJamb',      default_value: '85'                 },
  { field_key: 'sashPairPart.defaultCordFrameDepth',     default_value: '140'                },
  { field_key: 'sashPairPart.defaultCordFrameJambType',  default_value: 'Hollow Box for Sash'},
  { field_key: 'sashPairPart.defaultCordCillHeight',     default_value: '70'                 },
  { field_key: 'sashPairPart.defaultCordCillDepth',      default_value: '140'                },
  // Spiral defaults
  { field_key: 'sashPairPart.defaultSpiralFrameHead',    default_value: '95'                 },
  { field_key: 'sashPairPart.defaultSpiralFrameJamb',    default_value: '28'                 },
  { field_key: 'sashPairPart.defaultSpiralFrameDepth',   default_value: '140'                },
  { field_key: 'sashPairPart.defaultSpiralFrameJambType',default_value: 'Solid Spiral for Sash'},
  { field_key: 'sashPairPart.defaultSpiralCillHeight',   default_value: '70'                 },
  { field_key: 'sashPairPart.defaultSpiralCillDepth',    default_value: '140'                },
  // Gate flag
  { field_key: 'sashPairPart.updateFrameDetailsOnOperationChange', default_value: 'true' },
]


// ── Cord mode ─────────────────────────────────────────────────────────────────

describe('applyOperationDefaults — cord mode (both sashes cord_hung)', () => {
  const tree  = makeTree('cord_hung', 'cord_hung')
  const out   = applyOperationDefaults(tree, profileValues, refOptions)
  const frame = findFirst(out, 'assemblyFramePart')
  const cill  = findFirst(out, 'cillPart')

  it('frame.topHeight = 79',  () => expect(frame.values.topHeight).toBe(79))
  it('frame.leftWidth = 85',  () => expect(frame.values.leftWidth).toBe(85))
  it('frame.rightWidth = 85', () => expect(frame.values.rightWidth).toBe(85))
  it('frame.frameDepth = 140', () => expect(frame.values.frameDepth).toBe(140))
  it('frame.jambType = hollow_box_for_sash', () =>
    expect(frame.values.jambType).toBe('hollow_box_for_sash'))
  it('cill.height = 70',  () => expect(cill.values.height).toBe(70))
  it('cill.depth = 140',  () => expect(cill.values.depth).toBe(140))
})


// ── Spiral mode ───────────────────────────────────────────────────────────────

describe('applyOperationDefaults — spiral mode (top sash spiral)', () => {
  const tree  = makeTree('spiral_balance', 'cord_hung')
  const out   = applyOperationDefaults(tree, profileValues, refOptions)
  const frame = findFirst(out, 'assemblyFramePart')

  it('frame.leftWidth = 28',  () => expect(frame.values.leftWidth).toBe(28))
  it('frame.rightWidth = 28', () => expect(frame.values.rightWidth).toBe(28))
})

describe('applyOperationDefaults — spiral mode (bottom sash spiral)', () => {
  const tree  = makeTree('cord_hung', 'spiral_balance')
  const out   = applyOperationDefaults(tree, profileValues, refOptions)
  const frame = findFirst(out, 'assemblyFramePart')

  it('frame.leftWidth = 28',  () => expect(frame.values.leftWidth).toBe(28))
  it('frame.rightWidth = 28', () => expect(frame.values.rightWidth).toBe(28))
})


// ── Gate flag ─────────────────────────────────────────────────────────────────

describe('applyOperationDefaults — gate flag false → tree unchanged', () => {
  const pvOff = profileValues.map(r =>
    r.field_key === 'sashPairPart.updateFrameDetailsOnOperationChange'
      ? { ...r, default_value: 'false' }
      : r
  )
  const tree = makeTree('cord_hung', 'cord_hung')
  const out  = applyOperationDefaults(tree, pvOff, refOptions)
  const frame = findFirst(out, 'assemblyFramePart')

  it('topHeight unchanged (= 0)', () => expect(frame.values.topHeight).toBe(0))
})


// ── Immutability ──────────────────────────────────────────────────────────────

describe('applyOperationDefaults — returns new objects (immutable)', () => {
  const tree = makeTree('cord_hung', 'cord_hung')
  const out  = applyOperationDefaults(tree, profileValues, refOptions)

  it('out !== tree', () => expect(out).not.toBe(tree))
  it('assemblyFramePart is new object', () =>
    expect(findFirst(out, 'assemblyFramePart')).not.toBe(findFirst(tree, 'assemblyFramePart')))
})


// ── Edge cases ────────────────────────────────────────────────────────────────

describe('applyOperationDefaults — edge cases', () => {
  it('null tree returns null', () =>
    expect(applyOperationDefaults(null, profileValues, refOptions)).toBe(null))

  it('null operations → cord mode (neither is spiral)', () => {
    const tree  = makeTree(null, null)
    const out   = applyOperationDefaults(tree, profileValues, refOptions)
    const frame = findFirst(out, 'assemblyFramePart')
    expect(frame.values.topHeight).toBe(79)  // cord default
  })

  it('missing profileValues → no changes (no crash)', () => {
    const tree = makeTree('cord_hung', 'cord_hung')
    const out  = applyOperationDefaults(tree, [], refOptions)
    const frame = findFirst(out, 'assemblyFramePart')
    expect(frame.values.topHeight).toBe(0)   // unchanged
  })
})
