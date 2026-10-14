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
import { stableDoorPartFor } from '../pricing/doorGeometry.js'

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
  stableDoorPart:          'Stable Door',
  panelPart:               'Panel',
  mullionPart:             'Mullion',
  transomPart:             'Transom',
  verticalGlazingBarPart:  'Vertical GB',
  horizontalGlazingBarPart:'Horizontal GB',
}

/** The part types that are openings of a frame and carry a matrix label. */
const LABELLED_OPENINGS = ['casementSashPart', SINGLE_DOOR_LEAF_PART, 'stableDoorPart']

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

  // Step BF: a STABLE DOOR’s two halves are both door leaves in the same
  // opening, so the opening label alone would name them the same thing
  // twice. The half says which it is, and the opening says where it is:
  // "Stable Door Top A1".
  if (node.part_type === 'doorLeafPart' && node.values?.stableHalf) {
    const half = node.values.stableHalf === 'top' ? 'Top' : 'Bottom'
    const container = tree ? stableDoorPartFor(tree, node) : null
    const where = container && tree ? openingLabel(tree, container) : null
    // the opening label reads "Single Door A1" for the container, so only
    // its matrix part is wanted here
    const matrix = where ? where.split(' ').pop() : null
    return matrix ? `Stable Door ${half} ${matrix}` : `Stable Door ${half}`
  }

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
