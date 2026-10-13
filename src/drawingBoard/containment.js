// containment.js — the client's mirror of part_type_children.
//
// The database function save_drawing_parts rejects a save whose tree contains
// a parent->child pair that part_type_children does not hold:
//   "save_drawing_parts: forbidden parent->child pair(s): A -> B"
// Nothing on the client used to check that, so the first time a shape was
// wrong was the Save button in production.
//
// Step AQ: this list used to live inside containment.test.js, which is why
// the Step AP board-path tests could build and price a direct glazed unit
// that could never be SAVED — they priced trees, and the only mirror of the
// containment rules was in a test file that priced nothing. The list is now a
// module both test files import, and `assertSaveable` is the check every
// board-path test runs, so a save-blocking tree fails CI instead.
//
// When you add a part_type_children row in SQL, add the pair here too.

/**
 * Every parent->child pair the live part_type_children table holds.
 *
 * The box-sash pairs are proven by every successful save before Step J; the
 * Step J pairs by sql/step-j2-containment.sql. The casement pairs are proven
 * by the reviewer's live test on 12 Oct (L507712 item 8 from the Double Flush
 * Casement template saved with two casement sashes, each with a glass child),
 * except assemblyFramePart->glassPart, which that same test proved MISSING —
 * sql/step-aq0-casement-live-fixes.sql adds it.
 */
export const ALLOWED_PAIRS = new Set([
  // Base box-sash tree (buildNewBoxSash / Step A+G)
  'drawingItemPart->paintAndIronmongeryPart',
  'drawingItemPart->notesPart',
  'drawingItemPart->pricePart',
  'drawingItemPart->assemblyFramePart',
  'assemblyFramePart->cillPart',
  'assemblyFramePart->sashPairPart',
  'sashPairPart->topSashPart',
  'sashPairPart->bottomSashPart',
  'topSashPart->glassPart',
  'bottomSashPart->glassPart',

  // sql/step-j2-containment.sql
  'assemblyFramePart->mullionPart',
  'assemblyFramePart->transomPart',
  'glassPart->verticalGlazingBarPart',
  'glassPart->horizontalGlazingBarPart',

  // Casement and direct glazed (Steps AO/AP). A casement sash sits in the
  // frame and holds its own glass; a DIRECT GLAZED unit is a glassPart that
  // is a direct child of the frame — Integrate's model, and the pair the
  // reviewer's SQL adds.
  'assemblyFramePart->casementSashPart',
  'casementSashPart->glassPart',
  'assemblyFramePart->glassPart',

  // Step AX: a FRENCH casement is one opening holding a pair — the frame
  // holds the frenchCasementPart, which holds a left and a right sash, each
  // with its own glass. There is no mullion between them.
  // sql/step-ax1-french-containment.sql adds these pairs live.
  'assemblyFramePart->frenchCasementPart',
  'frenchCasementPart->leftFrenchCasementSashPart',
  'frenchCasementPart->rightFrenchCasementSashPart',
  'leftFrenchCasementSashPart->glassPart',
  'rightFrenchCasementSashPart->glassPart',

  // Step AZ: a FRENCH DOOR. The same shape as a French casement — the frame
  // holds the pair, the pair holds a left and a right leaf, each leaf holds
  // its own glass — and a doorset also puts a TRANSOM and a casement sash
  // (the fanlight) in the frame beside the pair, which the casement pairs
  // above already allow.
  // sql/step-az2-door-containment.sql adds these pairs live.
  'assemblyFramePart->frenchDoorPart',
  'frenchDoorPart->leftFrenchDoorLeafPart',
  'frenchDoorPart->rightFrenchDoorLeafPart',
  'leftFrenchDoorLeafPart->glassPart',
  'rightFrenchDoorLeafPart->glassPart',

  // Step BA: a PANELLED leaf. Integrate splits the leaf with a TransomPart
  // inside it (isMidrail) and puts a PanelPart below the rail, so a leaf
  // holds three kinds of child: its mid rail, its glass and its panel.
  // sql/step-ba1-door-variant-containment.sql adds these four pairs live.
  'leftFrenchDoorLeafPart->transomPart',
  'rightFrenchDoorLeafPart->transomPart',
  'leftFrenchDoorLeafPart->panelPart',

  // Step BB: a SINGLE door. Integrate stores it as a plain doorLeafPart
  // DIRECTLY in a frame opening, with no pair part — so the frame has to be
  // allowed to hold one, and the leaf its own glass, its mid rail and its
  // panel. sql/step-bb1-single-door-containment.sql adds these live.
  'assemblyFramePart->doorLeafPart',
  'doorLeafPart->glassPart',
  'doorLeafPart->transomPart',
  'doorLeafPart->panelPart',
  'rightFrenchDoorLeafPart->panelPart',
])

/** Every parent->child edge in a tree, as "parentType->childType" strings. */
export function treeEdges(node, acc = []) {
  if (!node) return acc
  for (const child of (node.children ?? [])) {
    acc.push(`${node.part_type}->${child.part_type}`)
    treeEdges(child, acc)
  }
  return acc
}

/**
 * The edges in a tree that part_type_children does not allow — i.e. exactly
 * what save_drawing_parts would refuse. Empty means the tree can be saved.
 *
 * @returns {string[]} unique offending edges, in the order first met
 */
export function forbiddenEdges(tree, allowed = ALLOWED_PAIRS) {
  const seen = new Set()
  const bad = []
  for (const edge of treeEdges(tree)) {
    if (allowed.has(edge) || seen.has(edge)) continue
    seen.add(edge)
    bad.push(edge)
  }
  return bad
}

/** True when every edge in the tree is allowed. */
export function isSaveable(tree, allowed = ALLOWED_PAIRS) {
  return forbiddenEdges(tree, allowed).length === 0
}

/**
 * Throw the way save_drawing_parts fails, so a test reads like the live
 * error. A tree with no edges at all is a mistake in the caller, not a pass.
 */
export function assertSaveable(tree, allowed = ALLOWED_PAIRS) {
  const edges = treeEdges(tree)
  if (edges.length === 0) {
    throw new Error('assertSaveable: the tree has no parent->child edges at all')
  }
  const bad = forbiddenEdges(tree, allowed)
  if (bad.length > 0) {
    throw new Error(`save_drawing_parts: forbidden parent->child pair(s): ${bad.join(', ')}`)
  }
  return true
}
