/**
 * partLabels.js — what the parts list calls a part.
 *
 * Step BC board: lifted out of DrawingBoard.jsx so it can be tested. It moved
 * because a coupled set showed its door leaf as **"doorLeafPart"** — the raw
 * part type, because `PART_LABELS` had no entry for it and the opening-label
 * branch only covered a casement sash and a direct glazed unit.
 *
 * Two rules, and they are Integrate's:
 *  - an OPENING is named for what it is and where it sits — "Single Door B2",
 *    "Fanlight A1", "Casement Sash C2" — so the parts list cannot be read in a
 *    different order from the drawing;
 *  - on a COUPLED SET the frames are named by their place in it, "Frame A",
 *    "Frame B", because "Frame" three times over tells a surveyor nothing.
 */

import {
  isCasementFrameTree, openingLabel, openingNodes,
} from './casementOpenings.js'
import {
  isDirectGlazedUnit, itemFrames, SINGLE_DOOR_LEAF_PART,
} from '../pricing/casementGeometry.js'

export const PART_LABELS = {
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
  containerPart:           'Frames',
  visionPanelGlassPart:    'Vision Panel Glazing',
  casementSashPart:        'Casement Sash',
  frenchCasementPart:          'French Casement',
  leftFrenchCasementSashPart:  'French Casement Sash Left',
  rightFrenchCasementSashPart: 'French Casement Sash Right',
  frenchDoorPart:              'French Door',
  leftFrenchDoorLeafPart:      'French Door Leaf Left',
  rightFrenchDoorLeafPart:     'French Door Leaf Right',
  doorLeafPart:            'Single Door',
  panelPart:               'Panel',
  mullionPart:             'Mullion',
  transomPart:             'Transom',
  verticalGlazingBarPart:  'Vertical GB',
  horizontalGlazingBarPart:'Horizontal GB',
}

/** The part types that are openings of a frame and carry a matrix label. */
const LABELLED_OPENINGS = ['casementSashPart', SINGLE_DOOR_LEAF_PART]

/** "Frame A" on a coupled set, "Frame" on a one-frame drawing. */
function frameLabel(tree, node) {
  const frames = itemFrames(tree)
  if (frames.length <= 1) return PART_LABELS.assemblyFramePart
  const i = frames.findIndex(f => f.key === node.key)
  if (i < 0) return PART_LABELS.assemblyFramePart
  return `Frame ${String.fromCharCode(65 + i)}`
}

/**
 * @param {Object} node
 * @param {Object} [tree] needed to tell a direct glazed unit from a sash's
 *        glass, to find an opening's matrix position, and to number a frame
 *        of a coupled set. Without it the label is the plain part type.
 */
export function partLabel(node, tree = null) {
  if (node?.label_override) return node.label_override
  if (!node) return ''

  if (tree && node.part_type === 'assemblyFramePart') return frameLabel(tree, node)

  // An opening of a casement or door frame: Integrate's own name and its
  // matrix position, which on a coupled set runs on across the frames.
  if (tree && isCasementFrameTree(tree) &&
      (LABELLED_OPENINGS.includes(node.part_type) ||
       (node.part_type === 'glassPart' && isDirectGlazedUnit(tree, node)))) {
    const label = openingLabel(tree, node)
    if (label) return label
  }
  if (tree && node.part_type === 'glassPart' && isDirectGlazedUnit(tree, node)) {
    return 'Direct Glazed Unit'
  }
  return PART_LABELS[node.part_type] || node.part_type
}

/** Every opening of every frame, in reading order — for a parts list. */
export function allOpenings(tree) {
  return itemFrames(tree).flatMap(f => openingNodes(tree, f))
}
