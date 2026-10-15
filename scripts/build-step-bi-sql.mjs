/**
 * build-step-bi-sql.mjs — the four Configuration 4-7 template trees for
 * sql/step-bi1, generated from the board's own builders.
 *
 * Step BI item 4, the same pattern as the doorsets (step-bh2), the front
 * doors (step-bd3) and the stable doors (step-bf4): the specs live in
 * src/drawingBoard/combinationCasement.js
 * (COMBINATION_CASEMENT_TEMPLATES), the trees are built by the code a
 * surveyor's board runs, and this only prints them.
 *
 * Run:  node scripts/build-step-bi-sql.mjs
 */
import {
  COMBINATION_CASEMENT_TEMPLATES, buildCombinationCasementTemplate,
} from '../src/drawingBoard/combinationCasement.js'

/**
 * Profile 2 (casement) as api.js loadProfileValues returns it, WITH
 * sql/step-as0 run — an ordinary casement bottom rail of 83 and a FANLIGHT
 * rail of 62 (Nathan, 12 Oct). Those two keys are the only reason a template
 * differs from Integrate's, which holds 83 everywhere.
 */
const CASEMENT_PROFILE_VALUES = {
  'assemblyFramePart.leftWidth': 37, 'assemblyFramePart.rightWidth': 37,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 47,
  'assemblyFramePart.frameDepth': 96,
  'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20,
  'assemblyFramePart.cillStopSize': 20,
  'assemblyFramePart.cillAngle': 6,
  'cillPart.height': 47, 'cillPart.depth': 128,
  'mullionPart.thicknessInFrameSolid': 27, 'mullionPart.mullionStopSize': 20,
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.bottomHeight': 83,
  'casementSashPart.defaultFanlightBottomHeight': 62,
  'casementSashPart.mechanicalClearanceLeft': 4,
  'casementSashPart.mechanicalClearanceRight': 4,
  'casementSashPart.mechanicalClearanceTop': 4,
  'casementSashPart.mechanicalClearanceBottom': 4,
  'casementSashPart.btmRailShapeId': 'square',
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 16,
  'glassPart.defaultDoubleGlazingTolerance': 2,
  'glassPart.defaultDirGuStopSize': 20,
  'glassPart.defaultDoubleGlazingRebateWidthForDirGU': 20,
  'glassPart.defaultDoubleGlazingToleranceForDirGU': 2,
}

const out = []
for (const t of COMBINATION_CASEMENT_TEMPLATES) {
  const { tree, missing } = buildCombinationCasementTemplate(t, CASEMENT_PROFILE_VALUES)
  if (missing.length) throw new Error(`${t.name}: missing ${missing.join(', ')}`)
  out.push({
    name: t.name,
    sort_order: t.sort_order,
    group_name: t.group_name,
    tree,
  })
}
process.stdout.write(JSON.stringify(out))
