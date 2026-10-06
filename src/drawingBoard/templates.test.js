import { describe, it, expect } from 'vitest'
import { regenerateKeys, clearItemValues } from './templates.js'

// ── Fixture: minimal box sash tree ──────────────────────────────────────────

function makeTree() {
  return {
    key: 'root-key',
    part_type: 'drawingItemPart',
    values: { typeOfWork: 'complete_new', location: 'Kitchen front', sheetQty: 3 },
    children: [
      {
        key: 'frame-key',
        part_type: 'assemblyFramePart',
        values: { width: 1075, height: 1630 },
        children: [
          {
            key: 'pair-key',
            part_type: 'sashPairPart',
            values: {},
            children: [
              {
                key: 'top-key',
                part_type: 'topSashPart',
                values: { operation: 'cord_hung' },
                children: [
                  {
                    key: 'glass-top-key',
                    part_type: 'glassPart',
                    values: { glazingId: 'double_glazed' },
                    children: [],
                  },
                ],
              },
              {
                key: 'bot-key',
                part_type: 'bottomSashPart',
                values: { operation: 'cord_hung' },
                children: [
                  {
                    key: 'glass-bot-key',
                    part_type: 'glassPart',
                    values: { glazingId: 'double_glazed' },
                    children: [],
                  },
                ],
              },
            ],
          },
          { key: 'cill-key', part_type: 'cillPart', values: { height: 67 }, children: [] },
        ],
      },
      {
        key: 'paint-key',
        part_type: 'paintAndIronmongeryPart',
        values: { internalFinish: 'Standard White' },
        children: [],
      },
      {
        key: 'notes-key',
        part_type: 'notesPart',
        values: { sowNotes: 'Access via side gate', drawingLabel: 'W1' },
        children: [],
      },
      {
        key: 'price-key',
        part_type: 'pricePart',
        values: { manualPriceLowVat: 500, poa: '["reason"]' },
        children: [],
      },
    ],
  }
}

// ── regenerateKeys ──────────────────────────────────────────────────────────

describe('regenerateKeys', () => {
  it('replaces every key in the tree', () => {
    const original = makeTree()
    const result = regenerateKeys(original)

    // Collect all keys from both trees
    function collectKeys(node) {
      const keys = [node.key]
      for (const c of (node.children ?? [])) keys.push(...collectKeys(c))
      return keys
    }

    const originalKeys = collectKeys(original)
    const resultKeys = collectKeys(result)

    // Same count
    expect(resultKeys.length).toBe(originalKeys.length)

    // No overlap
    for (const key of resultKeys) {
      expect(originalKeys).not.toContain(key)
    }

    // All unique
    expect(new Set(resultKeys).size).toBe(resultKeys.length)
  })

  it('preserves part_type and values', () => {
    const original = makeTree()
    const result = regenerateKeys(original)
    expect(result.part_type).toBe('drawingItemPart')
    expect(result.values.typeOfWork).toBe('complete_new')
    expect(result.children[0].part_type).toBe('assemblyFramePart')
    expect(result.children[0].values.width).toBe(1075)
  })

  it('does not mutate the original tree', () => {
    const original = makeTree()
    const originalKey = original.key
    regenerateKeys(original)
    expect(original.key).toBe(originalKey)
  })

  it('handles null input', () => {
    expect(regenerateKeys(null)).toBeNull()
  })
})

// ── clearItemValues ─────────────────────────────────────────────────────────

describe('clearItemValues', () => {
  it('clears location and resets sheetQty on drawingItemPart', () => {
    const result = clearItemValues(makeTree())
    expect(result.values.location).toBeNull()
    expect(result.values.sheetQty).toBe(1)
    // non-cleared fields preserved
    expect(result.values.typeOfWork).toBe('complete_new')
  })

  it('clears notes fields on notesPart', () => {
    const tree = makeTree()
    const result = clearItemValues(tree)
    const notes = result.children.find(c => c.part_type === 'notesPart')
    expect(notes.values.sowNotes).toBeNull()
    expect(notes.values.drawingLabel).toBeNull()
  })

  it('clears price fields on pricePart', () => {
    const tree = makeTree()
    const result = clearItemValues(tree)
    const price = result.children.find(c => c.part_type === 'pricePart')
    expect(price.values.manualPriceLowVat).toBeNull()
    expect(price.values.poa).toBeNull()
  })

  it('preserves non-cleared part values', () => {
    const result = clearItemValues(makeTree())
    const paint = result.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    expect(paint.values.internalFinish).toBe('Standard White')
  })

  it('preserves frame and sash values', () => {
    const result = clearItemValues(makeTree())
    const frame = result.children.find(c => c.part_type === 'assemblyFramePart')
    expect(frame.values.width).toBe(1075)
    expect(frame.values.height).toBe(1630)
  })

  it('handles null input', () => {
    expect(clearItemValues(null)).toBeNull()
  })
})

// ── Template profile_id ─────────────────────────────────────────────────────

describe('template profile_id handling', () => {
  it('saveAsTemplate stores the drawing default_profile_id (source check)', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/drawingBoard/templates.js', 'utf-8')
    // The insert must use drawingMeta.default_profile_id
    expect(source).toContain('default_profile_id: drawingMeta?.default_profile_id')
  })

  it('DrawingBoard loads default_profile_id in drawingMeta (source check)', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/pages/DrawingBoard.jsx', 'utf-8')
    // The select must include default_profile_id
    expect(source).toMatch(/select\([^)]*default_profile_id/)
  })

  it('createDrawingFromTemplate falls back to sash profile when template has no profile (source check)', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/drawingBoard/templates.js', 'utf-8')
    // The function must look up the sash profile as fallback
    const fnBlock = source.slice(source.indexOf('async function createDrawingFromTemplate'))
    expect(fnBlock).toContain("code === 'sash'")
    // It must never insert null for default_profile_id — the profileId variable
    // is set to the fallback before the insert
    expect(fnBlock).toContain('default_profile_id: profileId')
  })
})
