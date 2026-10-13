// stormproof.js — stormproof casement windows (Step AU).
//
// Nathan (13 Oct 2026): a stormproof window is stormproof THROUGHOUT — the
// frame and every casement sash. There is no mixed window. So the conversion
// is a whole-window operation, which is also how Integrate does it ("Sash
// Type → Storm Proof → Set for all casement sashes").
//
// THE HEADLINE FINDING (docs/integrate-L31115-stormproof.txt): Integrate has
// NO stormproof pricing, labour, production or allocator rule. Every figure
// on SA, SC and SF comes out exactly with GlazePro's existing casement
// formulas once the TREE carries the stormproof sections. So nothing here
// touches pricing — it changes sections on a tree, and that is all.
//
// Sections, from every drawing the reviewer read:
//   frame   jambs/head 41, bottom 56, depth 69, stops 15/15/15,
//           jambType solid_profiled
//   cill    56 high × 69 deep (71 finished with its 15 stop)
//   sash    54 thick, top and stiles 62, clearance 4 all round,
//           bottom rail 76, stormProofOverlap 7
//   transom / mullion   UNCHANGED: 27 solid with 20 / 20 stops
//   direct glazed unit  UNCHANGED: clearance 20, rebate 20, hidden 18
//
// The 7 mm overlap is DRAWN ONLY — the sash laps 7 mm over the frame on each
// side. No volume, glass size or weight uses it; a sash is still its opening
// minus its clearances. casementGeometry.js therefore never reads it.
//
// The bottom rail is 76 on EVERY stormproof sash, fanlights included
// (Nathan, 13 Oct). Integrate is inconsistent here — 83 on its stormproof
// template, 76 when it converts a flush window — and 76 is the decision.
// Integrate's "Fanlight bottom rail should be reduced to 62mm externally"
// warning therefore fires on a stormproof fanlight, on its drawings and on
// ours, and that is correct.

import {
  casementProfileDefaults, stormproofProfileDefaults, stormproofSectionsFor,
  isStormproofSash, isStormproofWindow,
  SASH_TYPE_STORMPROOF, SASH_TYPE_FLUSH,
} from './casementOpenings.js'

// The sash-type codes, the two predicates and the profile resolution live in
// casementOpenings.js, beside the flush ones they belong with — changeOpening
// and applyFanlightBottomRails there need them, and that module cannot import
// this one. Re-exported here so a caller can take everything stormproof from
// one place.
export {
  stormproofProfileDefaults, stormproofSectionsFor,
  isStormproofSash, isStormproofWindow,
  SASH_TYPE_STORMPROOF, SASH_TYPE_FLUSH,
}

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

// ── Converting a whole window ────────────────────────────────────────────────

/**
 * Turn stormproof on or off for the WHOLE window — Integrate's "Set for all
 * casement sashes".
 *
 * On:  the frame and cill take the stormproof sections, and every casement
 *      sash becomes a stormproof sash (type, 76 bottom rail, 7 mm overlap).
 * Off: the flush values come back from the profile, and the overlap is
 *      removed rather than left at 0, so nothing downstream can read a
 *      stormproof lap on a flush sash.
 *
 * Transoms, mullions and direct glazed units are untouched either way, as
 * Integrate leaves them.
 *
 * A failed conversion changes NOTHING and says what is missing: converting a
 * window to a frame of nulls would silently reprice it.
 *
 * @returns {{tree: Object, changed: string[], missing: string[]}}
 */
export function setStormproof(tree, on, profileValues) {
  const frame = findFirst(tree, 'assemblyFramePart')
  if (!frame) return { tree, changed: [], missing: [] }

  const storm = stormproofProfileDefaults(profileValues)
  const flush = casementProfileDefaults(profileValues)
  const need  = on ? storm : flush
  if (need.missing.length > 0) {
    return { tree, changed: [], missing: need.missing }
  }

  const s = storm.values
  const f = flush.values
  const changed = []

  // The frame's own sections, and the cill's
  const frameValues = on
    ? {
      ...frame.values,
      leftWidth:  s.frameJambLeft,
      rightWidth: s.frameJambRight ?? s.frameJambLeft,
      topHeight:  s.frameHead,
      bottomHeight: s.frameBottom,
      frameDepth: s.frameDepth,
      frameHeadStopSize:  s.headStop,
      frameStileStopSize: s.stileStop,
      cillStopSize:       s.cillStop,
      jambType: 'solid_profiled',
    }
    : {
      ...frame.values,
      leftWidth:  f.frameJambLeft,
      rightWidth: f.frameJambRight ?? f.frameJambLeft,
      topHeight:  f.frameHead,
      bottomHeight: f.frameBottom,
      frameDepth: f.frameDepth,
      frameHeadStopSize:  f.headStop,
      frameStileStopSize: f.stileStop,
      cillStopSize:       f.cillStop,
      ...(f.jambType != null ? { jambType: f.jambType } : {}),
    }

  const nextChildren = (frame.children ?? []).map(child => {
    if (child.part_type === 'cillPart') {
      changed.push(child.key)
      return {
        ...child,
        values: {
          ...child.values,
          height: on ? s.cillHeight : f.cillHeight,
          depth:  on ? s.cillDepth  : f.cillDepth,
        },
      }
    }
    if (child.part_type === 'casementSashPart') {
      changed.push(child.key)
      return { ...child, values: stormproofSashValues(child.values, on, storm.values, flush.values) }
    }
    // Transoms, mullions and direct glazed units: untouched
    return child
  })

  changed.push(frame.key)
  return {
    tree: replaceNode(tree, frame.key, { ...frame, values: frameValues, children: nextChildren }),
    changed,
    missing: [],
  }
}

/**
 * One sash's values, converted. Kept separate so the sash BUILDER and the
 * conversion cannot drift apart.
 *
 * The bottom rail moves only if it is still on a value the PROFILE chose
 * (the flush ordinary rail, the flush fanlight rail, or the stormproof
 * rail). A rail the surveyor typed survives the conversion, exactly as it
 * survives the picker (Step AS item 3).
 */
export function stormproofSashValues(values, on, stormValues, flushValues) {
  const v = values ?? {}
  const next = { ...v }
  next.casementTypeId = on ? SASH_TYPE_STORMPROOF : SASH_TYPE_FLUSH

  const profileRails = [
    flushValues?.sashBottom,
    flushValues?.sashBottomFanlight,
    stormValues?.sashBottom,
  ].filter(x => x != null)
  const current = Number(v.bottomHeight)
  const surveyorSet = isFinite(current) && !profileRails.includes(current)

  if (!surveyorSet) {
    next.bottomHeight = on ? stormValues.sashBottom : flushValues.sashBottom
  }

  if (on) {
    next.stormProofOverlap = stormValues.sashOverlap
  } else {
    // Removed, not zeroed: a flush sash has no lap at all.
    delete next.stormProofOverlap
  }
  return next
}

function replaceNode(tree, key, replacement) {
  if (!tree) return tree
  if (tree.key === key) return replacement
  return { ...tree, children: (tree.children ?? []).map(c => replaceNode(c, key, replacement)) }
}
