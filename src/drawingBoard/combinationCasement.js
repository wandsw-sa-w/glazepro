// combinationCasement.js — the combination flush casement templates, as code.
//
// Step BI item 4. Integrate's own templates from DrawingBoard Config, CW
// family, group "3. Combination Flush Casements"
// (docs/integrate-L31115-configurations-4-7.txt, read 15 Oct 2026; Nathan:
// all four are sold):
//
//   89818  "Configuration 4"  1299 x 1307  opener | fixed | opener
//   89819  "Configuration 5"  1699 x 1307  opener | fixed | fixed | opener
//    6601  "Configuration 6"  1499 x 1199  a full-height opener each side and
//                                          a top-hung fanlight over a fixed
//                                          sash in the MIDDLE column
//    6602  "Configuration 7"  1499 x 1199  three columns, a light over each
//
// ONE DEFINITION FOR THREE READERS, as DOORSET_TEMPLATES is: the SQL
// generator (scripts/build-step-bi-sql.mjs) prints these trees into
// sql/step-bi1, the board builds the same tree when a surveyor starts from
// one, and the tests price it and put it through the save round trip. Nothing
// here is a second copy of a tree written out by hand.
//
// WHAT A TEMPLATE HOLDS, and how it differs from the benchmark fixtures.
// TC4-TC7 in fixtureCasement.js are Integrate's drawings AS READ — unsaved,
// so they carry Integrate's stored ironmongery list, its stored surround list
// including the nosing, and 83 bottom rails on the fanlights too. A GlazePro
// template carries none of that (Nathan's decisions, as Configurations 1-3):
//
//   * fanlight bottom rails 62, casements 83 — sql/step-as0 put 83 on
//     casementSashPart.bottomHeight and 62 on defaultFanlightBottomHeight,
//     and applyFanlightBottomRails decides which sash is which from the
//     CELLS, so C6's middle light gets 62 and its two spanning openers keep
//     83;
//   * NO stored surround list and so no nosing — Integrate recalculates the
//     surround on the first save and never produces one, so carrying it
//     would make every GlazePro drawing 30 minutes of install labour dearer
//     than the same drawing in Integrate (sql/step-ax3);
//   * NO stored ironmongery list — the default_ironmongery rules price it
//     and follow the openings (difference 4 in docs/integrate-differences.md);
//   * Casement MPLS on, Solid Redwood frame and sashes, utile cill.
//
// The GEOMETRY is Integrate's, cell for cell. The board's pickers lay out
// EQUAL columns and rows; Integrate's own templates do not (C4's columns are
// 393 | 385 | 393, not three of 390.3), so each spec carries Integrate's
// stored offsets and they are written onto the dividers the picker made —
// which is exactly what a surveyor does when they type an offset after
// picking a grid.

import {
  buildCasementFrame, setCasementOperation, applyFanlightBottomRails,
  openingNodes,
} from './casementOpenings.js'
import { applyDividers, addDividerInCell } from './gridActions.js'
import { frameInterior } from '../pricing/casementGeometry.js'

/** The frame of an item tree. */
const frameOf = tree =>
  (tree?.children ?? []).find(c => c.part_type === 'assemblyFramePart')

/**
 * DrawingBoard's short-keyed profileValueMap, which is what the pickers take
 * (`buildCasementFrame` reads the full `partType.field` keys instead).
 */
function pickerValues(profileValues) {
  const at = key => profileValues?.[key]
  return {
    thicknessInFrameSolid: Number(at('mullionPart.thicknessInFrameSolid')),
    mullionStopSize: Number(at('mullionPart.mullionStopSize')),
    frameStileStopSize: Number(at('assemblyFramePart.frameStileStopSize')),
  }
}

/**
 * Write Integrate's stored offsets onto the dividers of one type, in offset
 * order — the first offset to the leftmost mullion (or topmost transom).
 *
 * The picker's own offsets are equal divisions, and these replace them. The
 * ORDER is preserved by every spec below (393 < 805 replacing 390.3 < 807.7),
 * so no divider ever crosses another, and a spec that got that wrong would
 * show up as a changed cell in the tests rather than silently.
 */
function setDividerOffsets(tree, partType, offsets) {
  if (!offsets?.length) return tree
  const frame = frameOf(tree)
  const order = (frame?.children ?? [])
    .filter(c => c.part_type === partType)
    .slice()
    .sort((a, b) => (Number(a.values?.offset) || 0) - (Number(b.values?.offset) || 0))
    .map(c => c.key)
  if (order.length !== offsets.length) {
    throw new Error(
      `combination casement template: ${offsets.length} ${partType} offsets ` +
      `given but the picker made ${order.length}`)
  }
  const want = new Map(order.map((key, i) => [key, offsets[i]]))
  return {
    ...tree,
    children: (tree.children ?? []).map(child =>
      child.part_type !== 'assemblyFramePart' ? child : {
        ...child,
        children: (child.children ?? []).map(node => !want.has(node.key) ? node : {
          ...node,
          values: { ...node.values, offset: want.get(node.key) },
        }),
      }),
  }
}

/**
 * The four specs. `cols` / `rows` is the grid the whole-frame picker lays
 * out; `shortTransom` is the picker's SECOND mode (a transom in one column
 * only), which stores startDivider / endDivider as Integrate does.
 */
export const COMBINATION_CASEMENT_TEMPLATES = [
  {
    name: 'Opener, Fixed, Opener (Configuration 4)',
    sort_order: 72,
    group_name: 'Combination Flush Casements',
    integrate: 'template 89818 "Configuration 4"',
    // internal 1225 x 1213 = 393 + 27 + 385 + 27 + 393
    layout: {
      width: 1299, height: 1307, cols: 3, rows: 1,
      mullions: [393, 805],
      ops: ['left_hand_hung', 'fix', 'right_hand_hung'],
    },
  },
  {
    name: 'Opener, Two Fixed, Opener (Configuration 5)',
    sort_order: 74,
    group_name: 'Combination Flush Casements',
    integrate: 'template 89819 "Configuration 5"',
    // internal 1625 x 1213 = 389 + 27 + 383 + 27 + 383 + 27 + 389
    layout: {
      width: 1699, height: 1307, cols: 4, rows: 1,
      mullions: [389, 799, 1209],
      ops: ['left_hand_hung', 'fix', 'fix', 'right_hand_hung'],
    },
  },
  {
    name: 'Openers Either Side Of A Fanlight Over Fixed (Configuration 6)',
    sort_order: 76,
    group_name: 'Combination Flush Casements',
    integrate: 'template 6601 "Configuration 6"',
    // internal 1425 x 1105. Both mullions run head to cill; the transom
    // stops at BOTH of them, so only the middle column is split and the two
    // side openers run the full 1105. Openings come out row-major —
    // A1 (spanning), B1 the fanlight, C1 (spanning), then B2.
    layout: {
      width: 1499, height: 1199, cols: 3, rows: 1,
      mullions: [459, 937],
      shortTransom: { axis: 'transom', index: 1, offset: 356 },
      ops: ['left_hand_hung', 'top_hung', 'right_hand_hung', 'fix'],
    },
  },
  {
    name: 'Three Casements With A Light Over Each (Configuration 7)',
    sort_order: 78,
    group_name: 'Combination Flush Casements',
    integrate: 'template 6602 "Configuration 7"',
    // The same frame and mullions as Configuration 6, but the transom runs
    // jamb to jamb: a plain 3 x 2 grid.
    layout: {
      width: 1499, height: 1199, cols: 3, rows: 2,
      mullions: [459, 937], transoms: [356],
      ops: ['top_hung', 'fix', 'top_hung',
        'left_hand_hung', 'fix', 'right_hand_hung'],
    },
  },
]

/**
 * Build one template the way the board does: the casement template, the
 * whole-frame picker, the picker's second mode where the layout needs it,
 * Integrate's offsets, the operation buttons, then Nathan's fanlight rails.
 *
 * @returns {{ tree: Object|null, missing: string[] }} as every builder here
 */
export function buildCombinationCasementTemplate(template, profileValues) {
  const L = template?.layout
  if (!L) return { tree: null, missing: ['layout'] }

  const built = buildCasementFrame(profileValues, {
    width: L.width, height: L.height,
    openings: ['opening_casement'],
  })
  if (!built.tree) return { tree: null, missing: built.missing }

  const picker = pickerValues(profileValues)
  if (!isFinite(picker.thicknessInFrameSolid) || picker.thicknessInFrameSolid <= 0) {
    return { tree: null, missing: ['mullionPart.thicknessInFrameSolid'] }
  }

  let tree = built.tree
  const interior = frameInterior(tree)
  tree = applyDividers(tree, frameOf(tree).key, L.cols, L.rows,
    interior.width, interior.height, picker, 'solid')

  // Integrate's own offsets, onto the dividers the picker made.
  tree = setDividerOffsets(tree, 'mullionPart', L.mullions)
  tree = setDividerOffsets(tree, 'transomPart', L.transoms)

  // The second picker mode: a transom in ONE column, bounded by the mullions
  // either side of it. Integrate stores that as startDivider / endDivider.
  if (L.shortTransom) {
    tree = addDividerInCell(tree, frameOf(tree).key, {
      ...L.shortTransom, profileValues: picker,
    })
  }

  const nodes = openingNodes(tree)
  if (nodes.length !== L.ops.length) {
    return {
      tree: null,
      missing: [`${template.name}: ${L.ops.length} operations given for ` +
        `${nodes.length} openings`],
    }
  }
  for (let i = 0; i < L.ops.length; i++) {
    tree = setCasementOperation(tree, openingNodes(tree)[i].key, L.ops[i]).tree
  }

  // Nathan (12 Oct): a fanlight's bottom rail is 62, a casement's 83. Which
  // sash is which comes from the cells, so C6's middle light gets 62 and its
  // two spanning openers keep 83.
  tree = applyFanlightBottomRails(tree, profileValues).tree

  return { tree, missing: [] }
}
