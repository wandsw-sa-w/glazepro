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
  // Step BC: a drawing can hold SEVERAL frames, in a container. The live
  // table already has these two (the brief says so; SECTION 0 of
  // sql/step-bc1 reads them back) — the local map did not.
  'drawingItemPart->containerPart',
  'containerPart->assemblyFramePart',
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

  // Step BD: a FRONT DOOR leaf carries its own GRID — a 120 muntin
  // (mullionPart) as well as a mid rail, with a panel or a glass unit in
  // each cell. The mid rail, the panel and the glass are already allowed
  // above; the muntin is the new pair.
  // sql/step-bd3-front-door-containment.sql adds these three live.
  'doorLeafPart->mullionPart',
  'leftFrenchDoorLeafPart->mullionPart',
  'rightFrenchDoorLeafPart->mullionPart',

  // Step BE: a SIDE LIGHT is a fixed casement sash with the same grid a
  // leaf has — a mid rail, glass above it and a raised-and-fielded panel
  // below (Nathan’s decision g, his drawing 20). The sash already holds
  // glass; the mid rail, the panel and a muntin are new.
  // sql/step-be2 adds these three live.
  'casementSashPart->transomPart',
  'casementSashPart->panelPart',
  'casementSashPart->mullionPart',

  // Step BF: a STABLE DOOR — one container in the frame holding a top and a
  // bottom half, each an ordinary door leaf with its own grid. And a VISION
  // PANEL, which is a glass unit inside a panel (Integrate’s ST2).
  // sql/step-bf2 adds these three live.
  'assemblyFramePart->stableDoorPart',
  'stableDoorPart->doorLeafPart',
  'panelPart->glassPart',
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
/**
 * Every key that appears more than once in a tree, in tree order.
 *
 * Step BC board 3: a tree must never hold two nodes with one key, and the
 * board put one together — splitting an opening in a frame other than the
 * first placed the SAME NODE twice. The parts list showed it twice, clicking
 * either selected the same node, React kept a stale list after Undo, and a
 * save would have stored it. The cause is fixed in gridActions; this is the
 * check that says so if it ever happens again.
 */
export function duplicateKeys(tree) {
  const seen = new Set()
  const dupes = []
  const walk = node => {
    if (!node) return
    const key = node.key
    if (key != null) {
      if (seen.has(key) && !dupes.includes(key)) dupes.push(key)
      seen.add(key)
    }
    for (const c of (node.children ?? [])) walk(c)
  }
  walk(tree)
  return dupes
}

export function assertSaveable(tree, allowed = ALLOWED_PAIRS) {
  const edges = treeEdges(tree)
  if (edges.length === 0) {
    throw new Error('assertSaveable: the tree has no parent->child edges at all')
  }
  const bad = forbiddenEdges(tree, allowed)
  if (bad.length > 0) {
    throw new Error(`save_drawing_parts: forbidden parent->child pair(s): ${bad.join(', ')}`)
  }
  // Step BC board 3: two nodes with one key. save_drawing_parts would store
  // the second over the first, so the drawing would come back missing a part
  // — and the board shows it twice until a reload, which is how it was found.
  const dupes = duplicateKeys(tree)
  if (dupes.length > 0) {
    throw new Error(`save_drawing_parts: duplicate key(s) in the tree: ${dupes.join(', ')}`)
  }
  return true
}
