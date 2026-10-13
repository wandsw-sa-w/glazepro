import { describe, it, expect } from 'vitest'
import { regenerateKeys, clearItemValues, templateGlassNameWarnings, prepareTemplateTree, drawingRowFieldsFromTemplate } from './templates.js'

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

// ── Step AE item 2: glass code guard ─────────────────────────────────────────
// A template must never carry a glass NAME (it prices as "no glass"). The
// guard runs at "Save as template" and at create-from-template, naming the
// template and the field for whoever made it.
describe('templateGlassNameWarnings', () => {
  const treeWithName = {
    key: 'item', part_type: 'drawingItemPart', values: {},
    children: [{
      key: 'f', part_type: 'assemblyFramePart', values: {},
      children: [{
        key: 'p', part_type: 'sashPairPart', values: {},
        children: [{
          key: 't', part_type: 'topSashPart', values: {},
          children: [{
            key: 'g', part_type: 'glassPart',
            values: {
              internalGlassPartNo: '4mm Clear Pilkington K Toughened',  // NAME — must warn
              externalGlassPartNo: 'GL100080',                          // code — fine
            },
            children: [],
          }],
        }],
      }],
    }],
  }

  it('flags a glass NAME, naming the template and the field', () => {
    const w = templateGlassNameWarnings(treeWithName, 'Single Box Sash')
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('Single Box Sash')
    expect(w[0]).toContain('internalGlassPartNo')
    expect(w[0]).toContain('4mm Clear Pilkington K Toughened')
  })

  it('is silent when every glass value is a part code or empty', () => {
    const clean = JSON.parse(JSON.stringify(treeWithName))
    clean.children[0].children[0].children[0].children[0].values = {
      internalGlassPartNo: 'GL100010',
      externalGlassPartNo: 'GL100080',
      singleGlassPartNo:   '',
    }
    expect(templateGlassNameWarnings(clean, 'Clean')).toHaveLength(0)
  })
})

// ── Step AJ: creating a drawing from a template applies the board rules ─────
// prepareTemplateTree is exactly what createDrawingFromTemplate runs, so a
// drawing created from a sash-replacement template arrives with both sashes
// To Be Replaced (the gap: a board-drawn replacement stored null and priced
// with no sashes) and a complete-new template arrives at 45 mm.
describe('prepareTemplateTree', () => {
  function template({ typeOfWork, thickness = 45, replaced = null }) {
    const stored = replaced === null ? {} : { toBeReplaced: replaced }
    return {
      key: 't_item', part_type: 'drawingItemPart',
      values: { typeOfWork, location: 'Front bedroom', sheetQty: 3 },
      children: [{
        key: 't_frame', part_type: 'assemblyFramePart',
        values: { width: 1070, height: 1849 },
        children: [
          { key: 't_cill', part_type: 'cillPart', values: { height: 70 }, children: [] },
          {
            key: 't_pair', part_type: 'sashPairPart', values: { sashThickness: thickness },
            children: [
              { key: 't_top', part_type: 'topSashPart', values: { topHeight: 49, ...stored }, children: [] },
              { key: 't_bot', part_type: 'bottomSashPart', values: { bottomHeight: 88, chamferedBottomRailAngle: 9, ...stored }, children: [] },
            ],
          },
        ],
      }],
    }
  }

  function sashValues(tree) {
    const out = []
    ;(function walk(n) {
      if (n.part_type === 'topSashPart' || n.part_type === 'bottomSashPart') out.push(n.values?.toBeReplaced)
      ;(n.children ?? []).forEach(walk)
    })(tree)
    return out
  }

  it('a sash-replacement template arrives with both sashes To Be Replaced', () => {
    const { tree, adjustments } = prepareTemplateTree(template({ typeOfWork: 'new_pair_of_sashes' }))
    expect(sashValues(tree)).toEqual([true, true])
    expect(adjustments).toEqual(['sashes set To Be Replaced = true (type of work)'])
  })

  it('a draught-seal template arrives with both sashes NOT replaced', () => {
    const { tree } = prepareTemplateTree(template({ typeOfWork: 'draught_seal' }))
    expect(sashValues(tree)).toEqual([false, false])
  })

  it('a complete-new template at 57 mm arrives at 45 mm AND replaced', () => {
    const { tree, adjustments } = prepareTemplateTree(template({ typeOfWork: 'complete_new', thickness: 57 }))
    let pair
    ;(function walk(n) { if (n.part_type === 'sashPairPart') pair = n.values; (n.children ?? []).forEach(walk) })(tree)
    expect(pair.sashThickness).toBe(45)
    expect(sashValues(tree)).toEqual([true, true])
    expect(adjustments).toHaveLength(2)
  })

  it('records nothing when the template already agrees', () => {
    const { adjustments } = prepareTemplateTree(template({ typeOfWork: 'new_pair_of_sashes', replaced: true }))
    expect(adjustments).toEqual([])
  })

  it('still regenerates keys and clears item values', () => {
    const { tree } = prepareTemplateTree(template({ typeOfWork: 'new_pair_of_sashes' }))
    expect(tree.key).not.toBe('t_item')
    expect(tree.values.location).toBeNull()
    expect(tree.values.sheetQty).toBe(1)
  })
})

// ── Step AZ hotfix item 2: the drawing row's materials and window type ──────
//
// A new drawing from the live "French Doors" template had material_frame /
// material_sash 'Solid Redwood' and material_cill 'Solid Utile Hardwood' —
// the table's own defaults — while its TREE, the board and the pricing all
// said utile. The quote matrix card read "Door · Solid Redwood".
// createDrawingFromTemplate never wrote the material columns at all.

describe('drawingRowFieldsFromTemplate — Step AZ hotfix item 2', () => {
  const doorTemplate = {
    name: 'French Doors', family: 'door', window_type: 'French Door',
    tree: {
      part_type: 'drawingItemPart',
      values: {
        typeOfWork: 'complete_new',
        frameMaterialId: 'utile', sashMaterialId: 'utile', cillMaterialId: 'utile',
      },
      children: [{ part_type: 'assemblyFramePart', values: {}, children: [
        { part_type: 'frenchDoorPart', values: {}, children: [] },
      ] }],
    },
  }

  it('takes the materials from the template tree, as labels the row holds', () => {
    const row = drawingRowFieldsFromTemplate(doorTemplate)
    expect(row.material_frame).toBe('Solid Utile Hardwood')
    expect(row.material_sash).toBe('Solid Utile Hardwood')
    expect(row.material_cill).toBe('Solid Utile Hardwood')
  })

  it('keeps the template’s own window_type', () => {
    expect(drawingRowFieldsFromTemplate(doorTemplate).window_type).toBe('French Door')
  })

  it('a box sash template: softwood frame and sashes, utile cill', () => {
    const row = drawingRowFieldsFromTemplate({
      window_type: 'Box Sash',
      tree: {
        part_type: 'drawingItemPart',
        values: { frameMaterialId: 'softwood', sashMaterialId: 'softwood', cillMaterialId: 'utile' },
        children: [],
      },
    })
    expect(row.material_frame).toBe('Solid Redwood')
    expect(row.material_sash).toBe('Solid Redwood')
    expect(row.material_cill).toBe('Solid Utile Hardwood')
    expect(row.window_type).toBe('Box Sash')
  })

  it('an Accoya casement template', () => {
    const row = drawingRowFieldsFromTemplate({
      window_type: 'Flush Casement',
      tree: {
        part_type: 'drawingItemPart',
        values: { frameMaterialId: 'accoya', sashMaterialId: 'accoya', cillMaterialId: 'accoya' },
        children: [],
      },
    })
    expect(row.material_frame).toBe('Accoya')
    expect(row.material_sash).toBe('Accoya')
    expect(row.material_cill).toBe('Accoya')
  })

  it('reads an older tree’s timberType parts too, as the quote PDF does', () => {
    const row = drawingRowFieldsFromTemplate({
      window_type: 'Box Sash',
      tree: {
        part_type: 'drawingItemPart', values: {},
        children: [{ part_type: 'assemblyFramePart', values: {}, children: [
          { part_type: 'frameMaterialPart', values: { timberType: 'accoya' }, children: [] },
          { part_type: 'sashMaterialPart',  values: { timberType: 'accoya' }, children: [] },
          { part_type: 'cillPart',          values: { timberType: 'utile' },  children: [] },
        ] }],
      },
    })
    expect(row.material_frame).toBe('Accoya')
    expect(row.material_cill).toBe('Solid Utile Hardwood')
  })

  it('a material code with no label is left UNSET, never guessed', () => {
    // oak and meranti are real price-file species with no option in the
    // drawer's list. A wrong label on the card is worse than none: the
    // column stays null and the reader falls back to its own default.
    const row = drawingRowFieldsFromTemplate({
      window_type: 'Box Sash',
      tree: { part_type: 'drawingItemPart', values: { frameMaterialId: 'oak' }, children: [] },
    })
    expect('material_frame' in row).toBe(false)
  })

  it('a door template with no window_type is NOT called a Box Sash', () => {
    // The old fallback was `template.window_type ?? 'Box Sash'`, which would
    // label a French door template a box sash on the matrix card.
    const { window_type: wt } = drawingRowFieldsFromTemplate({
      ...doorTemplate, window_type: null,
    })
    expect(wt).toBe('French Door')
  })

  it('a tree it cannot read keeps the old Box Sash fallback', () => {
    expect(drawingRowFieldsFromTemplate({ window_type: null, tree: null }).window_type)
      .toBe('Box Sash')
  })

  it('createDrawingFromTemplate writes those fields on the insert (source check)', async () => {
    const fs = await import('fs')
    const src = fs.readFileSync('src/drawingBoard/templates.js', 'utf-8')
    expect(src).toMatch(/\.\.\.drawingRowFieldsFromTemplate\(template\)/)
  })
})
