/**
 * build-step-bh-sql.mjs — the five DOORSET template trees for sql/step-bh2,
 * generated from the board's own builders.
 *
 * Step BH, the same pattern as the front doors (step-bd3) and the stable
 * doors (step-bf4): the specs live in src/drawingBoard/doorOpenings.js
 * (DOORSET_TEMPLATES), the trees are built by the code a surveyor's board
 * runs, and this only prints them.
 *
 * Run:  node scripts/build-step-bh-sql.mjs
 */
import { DOORSET_TEMPLATES, buildDoorsetTemplate } from '../src/drawingBoard/doorOpenings.js'

/**
 * The open_in_doors profile, as the reviewer read it on 14 Oct (Step BG's
 * facts). The one figure that has changed since the stable-door generator is
 * the CILL STOP: the open-in range holds 0, where open_out_doors holds 26.
 */
const OPEN_IN_PROFILE_VALUES = {
  'assemblyFramePart.leftWidth': 47, 'assemblyFramePart.rightWidth': 47,
  'assemblyFramePart.topHeight': 47, 'assemblyFramePart.bottomHeight': 50,
  'assemblyFramePart.frameDepth': 96,
  'assemblyFramePart.frameHeadStopSize': 20,
  'assemblyFramePart.frameStileStopSize': 20,
  'assemblyFramePart.cillStopSize': 0,
  'cillPart.height': 50, 'cillPart.depth': 145,
  'frenchDoorPart.thickness': 54, 'frenchDoorPart.midRail': 198,
  'frenchDoorPart.gapBetweenMeetingStiles': 5,
  'frenchDoorPart.meetingStileOverlap': 27,
  // the OPEN-IN clearances: 3 / 14 / 3 / 3, not the open-out 3 / 3 / 1 / 1
  'frenchDoorPart.mechanicalClearanceTop': 3,
  'frenchDoorPart.mechanicalClearanceBottom': 14,
  'frenchDoorPart.mechanicalClearanceLeft': 3,
  'frenchDoorPart.mechanicalClearanceRight': 3,
  'leftFrenchDoorLeafPart.topHeight': 110,
  'leftFrenchDoorLeafPart.leftWidth': 110,
  'leftFrenchDoorLeafPart.rightWidth': 110,
  'leftFrenchDoorLeafPart.bottomHeight': 170,
  'rightFrenchDoorLeafPart.topHeight': 110,
  'rightFrenchDoorLeafPart.leftWidth': 110,
  'rightFrenchDoorLeafPart.rightWidth': 110,
  'rightFrenchDoorLeafPart.bottomHeight': 170,
  'doorLeafPart.thickness': 54,
  'doorLeafPart.topHeight': 110,
  'doorLeafPart.leftWidth': 110,
  'doorLeafPart.rightWidth': 110,
  'doorLeafPart.bottomHeight': 170,
  'doorLeafPart.mechanicalClearanceTop': 3,
  'doorLeafPart.mechanicalClearanceBottom': 14,
  'doorLeafPart.mechanicalClearanceLeft': 4,
  'doorLeafPart.mechanicalClearanceRight': 4,
  'doorLeafPart.defaultMuntinThickness': 120,
  'doorLeafPart.midrailThickness': 170,
  'transomPart.thicknessInFrame': 41,
  'mullionPart.thicknessInFrameSolid': 41,
  'casementSashPart.thickness': 54, 'casementSashPart.topHeight': 62,
  'casementSashPart.leftWidth': 62, 'casementSashPart.rightWidth': 62,
  'casementSashPart.defaultFanlightBottomHeight': 58,
  'glassPart.defaultDoubleGlazingRebateWidthForSash': 15,
  'glassPart.defaultDoubleGlazingTolerance': 3,
}

const out = []
for (const t of DOORSET_TEMPLATES) {
  const { tree, missing } = buildDoorsetTemplate(t, OPEN_IN_PROFILE_VALUES)
  if (missing.length) throw new Error(`${t.name}: missing ${missing.join(', ')}`)
  out.push({
    name: t.name,
    sort_order: t.sort_order,
    group_name: t.group_name,
    tree,
  })
}
process.stdout.write(JSON.stringify(out))
