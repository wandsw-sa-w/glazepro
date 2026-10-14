/**
 * build-step-bf-sql.mjs — the three STABLE DOOR template trees for
 * sql/step-bf4, generated from the board's own builders.
 *
 * Step BF part B, the same pattern as the front doors: the specs live in
 * src/drawingBoard/doorOpenings.js (STABLE_DOOR_TEMPLATES), the trees are
 * built by the code a surveyor's board runs, and this only prints them.
 * Run:  node scripts/build-step-bf-sql.mjs
 */
import { buildStableDoorFrame, STABLE_DOOR_TEMPLATES } from '../src/drawingBoard/doorOpenings.js'


/** The open_in_doors profile, as the front-door generator holds it. */
const OPEN_IN_PROFILE_VALUES = {
  'assemblyFramePart.leftWidth': 47, 'assemblyFramePart.rightWidth': 47,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 50,
  'assemblyFramePart.frameDepth': 96,
  'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20,
  'assemblyFramePart.cillStopSize': 26,
  'cillPart.height': 50, 'cillPart.depth': 145,
  'frenchDoorPart.thickness': 54, 'frenchDoorPart.midRail': 198,
  'frenchDoorPart.gapBetweenMeetingStiles': 5,
  'frenchDoorPart.meetingStileOverlap': 27,
  'frenchDoorPart.mechanicalClearanceTop': 3,
  'frenchDoorPart.mechanicalClearanceBottom': 3,
  'frenchDoorPart.mechanicalClearanceLeft': 1,
  'frenchDoorPart.mechanicalClearanceRight': 1,
  'leftFrenchDoorLeafPart.topHeight': 110,
  'leftFrenchDoorLeafPart.leftWidth': 110,
  'leftFrenchDoorLeafPart.rightWidth': 110,
  'rightFrenchDoorLeafPart.topHeight': 110,
  'rightFrenchDoorLeafPart.leftWidth': 110,
  'rightFrenchDoorLeafPart.rightWidth': 110,
  'transomPart.thicknessInFrame': 41,
  'mullionPart.thicknessInFrameSolid': 41,
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.defaultFanlightBottomHeight': 58,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 15,
  'glassPart.defaultDoubleGlazingTolerance': 3,
}

const out = []
for (const t of STABLE_DOOR_TEMPLATES) {
  const { tree, missing } = buildStableDoorFrame(OPEN_IN_PROFILE_VALUES, t.options)
  if (missing.length) throw new Error(`${t.name}: missing ${missing.join(', ')}`)
  out.push({ name: t.name, sort_order: t.sort_order, tree })
}
process.stdout.write(JSON.stringify(out))
