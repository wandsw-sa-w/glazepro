// renderElevation.jsx — timber-outline SVG elevation for a box sash window.
//
// SashElevation({ tree, derived, geometry, refOptions, viewMode, selectedKey,
//                 onSelectKey, settings })
//
// geometry: output of computeSashGeometry (or null).
// derived:  output of computeDerived (optional; provides archRadius etc.).
// settings: optional booleans {
//   showOverallSL, showIndividualSL, showGlazingRebate,
//   showTextOnDwg, showGlassLabels, showActiveRulers, showSashCentricDims
// }
// All coordinates are in mm (the SVG coordinate space).

import React from 'react'
import { computeOpeningLayout, computeGlassWidth, mullionThicknessMm } from './sashGeometry.js'
import { resolveTopSashArch } from '../pricing/optionVocabulary.js'
import {
  frameOpenings, openingNodes as casementOpeningNodes,
  FRENCH_PAIR_PART, FRENCH_SASH_TYPES, PAIR_LEAF_TYPES, isPairPart, isLeftLeaf,
} from '../pricing/casementGeometry.js'
import { columnCount, isCasementFrameTree, matrixIndexOf, matrixLabel } from './casementOpenings.js'

// ── Tree helpers ──────────────────────────────────────────────────────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const child of (node.children ?? [])) findAll(child, partType, acc)
  return acc
}

// Direct children of a node with the given part_type
function childrenOfType(node, partType) {
  return (node?.children ?? []).filter(c => c.part_type === partType)
}

function fmtDim(v) {
  return String(Math.round(v * 10) / 10)
}

// Convert v to a positive finite number, or return def.
function n(v, def = 0) {
  const x = Number(v)
  return isFinite(x) && x > 0 ? x : def
}

// ── Arch helpers ──────────────────────────────────────────────────────────────

// Arch radius from chord width w and sagitta h.
function archR(w, h) {
  if (!w || !h || h <= 0) return null
  return (w * w / 4 + h * h) / (2 * h)
}

// Given a circle (radius R, centre cx,cy) and a horizontal position x, return
// the y-coordinate of the circle's upper arc at that x (i.e. the smaller of
// the two solutions — the crown of a shallow window arch, not the bottom of
// the circle). Returns null when x is outside the circle's horizontal span.
function archYAt(cx, cy, R, x) {
  if (!R) return null
  const dx = x - cx
  const disc = R * R - dx * dx
  if (disc < 0) return null
  return cy - Math.sqrt(disc)
}

// ── Dimension line sub-components ─────────────────────────────────────────────

function HDim({ x1, x2, y, label, dfs, tk, prefix = '' }) {
  if (label == null) return null
  const text = prefix + fmtDim(label)
  const mx   = (x1 + x2) / 2
  return (
    <g stroke="#666" strokeWidth={0.7} fill="none">
      <line x1={x1} y1={y - tk} x2={x1} y2={y + tk} />
      <line x1={x2} y1={y - tk} x2={x2} y2={y + tk} />
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <text
        x={mx} y={y + dfs * 1.1}
        textAnchor="middle" dominantBaseline="hanging"
        fontSize={dfs} fill="#666" stroke="none" fontFamily="inherit"
      >{text}</text>
    </g>
  )
}

function VDim({ x, y1, y2, label, dfs, tk, prefix = '', labelY }) {
  if (label == null) return null
  const text = prefix + fmtDim(label)
  const my   = labelY ?? (y1 + y2) / 2
  return (
    <g stroke="#666" strokeWidth={0.7} fill="none">
      <line x1={x - tk} y1={y1} x2={x + tk} y2={y1} />
      <line x1={x - tk} y1={y2} x2={x + tk} y2={y2} />
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <text
        x={x + dfs * 0.5} y={my}
        textAnchor="start" dominantBaseline="middle"
        fontSize={dfs} fill="#666" stroke="none" fontFamily="inherit"
      >{text}</text>
    </g>
  )
}

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  timber:       '#d4b483',
  timberStroke: '#8b6840',
  glass:        '#d0eaf5',
  glassStroke:  '#7ab8d4',
  bar:          '#c8a870',
  barStroke:    '#8b6840',
  selected:     '#dc2626',
  label:        '#1a1a1a',
  opening:      '#eef4f8',
}

// ── Glazing bars ──────────────────────────────────────────────────────────────

function GlazingBars({ glassNode, derived, gx, gy, glassW, glassH, selectedKey, onSelectKey, ss, archTop }) {
  if (!glassNode) return null
  const vBars = childrenOfType(glassNode, 'verticalGlazingBarPart')
  const hBars = childrenOfType(glassNode, 'horizontalGlazingBarPart')
  if (vBars.length === 0 && hBars.length === 0) return null

  const thickness = 8   // visual thickness of bar in mm (approximate — actual varies by profile)

  // Compute position for each bar (centre-line in mm from edge of glass)
  function barPos(bar, idx, count, span) {
    // If the derived map has a computed position, use it
    if (derived?.[bar.key]?.position != null) return derived[bar.key].position
    // If the bar has a manual offset set, use it
    if (bar.values?.offset > 0) return bar.values.offset
    // Otherwise evenly distribute
    return span / (count + 1) * (idx + 1)
  }

  const clickProps = (key) => ({
    style: { cursor: 'pointer' },
    onClick: (e) => { e.stopPropagation(); onSelectKey?.(key) },
  })

  return (
    <g>
      {vBars.map((bar, i) => {
        const cx = barPos(bar, i, vBars.length, glassW)
        const x  = gx + cx - thickness / 2
        const isPartial = bar.values?.offset2 > 0 && bar.values?.offset > 0
        // Partial bars: offset2>0 means bar ends at offset2 instead of full height.
        // Otherwise, for an arched glass top the bar stops at the curved
        // boundary at its own x (clipped to the arch) instead of the flat gy.
        const y1 = isPartial
          ? gy + bar.values.offset
          : (archTop?.(x + thickness / 2) ?? gy)
        const y2 = gy + (bar.values?.offset2 > 0 ? bar.values.offset2 : glassH)
        const style = bar.key === selectedKey ? { stroke: C.selected, strokeWidth: 2 } : { stroke: C.barStroke, strokeWidth: 0.7 }
        return (
          <rect key={bar.key} x={x} y={y1} width={thickness} height={y2 - y1}
            fill={C.bar} {...style} {...clickProps(bar.key)} />
        )
      })}
      {hBars.map((bar, i) => {
        const cy = barPos(bar, i, hBars.length, glassH)
        const y  = gy + cy - thickness / 2
        const x1 = gx + (bar.values?.offset2 > 0 && bar.values?.offset > 0 ? bar.values.offset : 0)
        const x2 = gx + (bar.values?.offset2 > 0 ? bar.values.offset2 : glassW)
        const style = bar.key === selectedKey ? { stroke: C.selected, strokeWidth: 2 } : { stroke: C.barStroke, strokeWidth: 0.7 }
        return (
          <rect key={bar.key} x={x1} y={y} width={x2 - x1} height={thickness}
            fill={C.bar} {...style} {...clickProps(bar.key)} />
        )
      })}
    </g>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function SashElevation({
  tree,
  derived,
  geometry,
  refOptions,
  viewMode = 'internal',
  selectedKey,
  onSelectKey,
  settings,
  fontFamily: fontFamilyProp,
}) {
  // A casement / direct glazed frame is drawn by CasementElevation: it has no
  // sash PAIRS, so computeSashGeometry returns null for it and none of the
  // box-sash geometry below applies.
  if (isCasementFrameTree(tree)) {
    return (
      <CasementElevation
        tree={tree} refOptions={refOptions} viewMode={viewMode}
        selectedKey={selectedKey} onSelectKey={onSelectKey}
        settings={settings} fontFamily={fontFamilyProp}
      />
    )
  }

  if (!geometry) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#e8e8e8', borderRadius: 8, color: '#888',
        fontSize: 13, padding: 24, textAlign: 'center',
      }}>
        Enter frame and sash dimensions to generate elevation.
      </div>
    )
  }

  const showGlassLabels = settings?.showGlassLabels !== false   // default on
  const showOverallSL   = settings?.showOverallSL   !== false   // default on
  const showIndividualSL = settings?.showIndividualSL !== false  // default on

  // ── Node references ─────────────────────────────────────────────────────────
  const frame   = findFirst(tree, 'assemblyFramePart')
  const cill    = findFirst(tree, 'cillPart')

  // All sash pairs (for multi-opening support)
  const allPairs   = findAll(tree, 'sashPairPart')
  const pair       = allPairs[0] ?? null            // first pair (backward compat)
  const topSash    = findFirst(tree, 'topSashPart')
  const botSash    = findFirst(tree, 'bottomSashPart')

  // Mullions / transoms (direct frame children for opening layout)
  const frameMullions = childrenOfType(frame, 'mullionPart')
    .sort((a, b) => (a.values?.offset ?? 0) - (b.values?.offset ?? 0))
  const frameTransoms = childrenOfType(frame, 'transomPart')
    .sort((a, b) => (a.values?.offset ?? 0) - (b.values?.offset ?? 0))

  // ── Frame dimensions ────────────────────────────────────────────────────────
  const fv          = frame?.values ?? {}
  const fW          = n(fv.width,  330)
  const fH          = n(fv.height, 1700)
  const leftWidth   = n(fv.leftWidth,  0)
  const rightWidth  = n(fv.rightWidth, 0)
  const topHeight   = n(fv.topHeight,  0)
  const cillH       = n(cill?.values?.height, 0)

  // Cill horn extensions — read the same way pricing does (frame part values)
  const leftCillHorn  = n(fv.leftCillHorn,  0)
  const rightCillHorn = n(fv.rightCillHorn, 0)

  const OX  = leftWidth
  const OY  = topHeight
  const iW  = fW - leftWidth - rightWidth
  const iH  = fH - topHeight - cillH

  // ── Arch parameters ──────────────────────────────────────────────────────────
  // Integrate draws the frame head, the inner (spring-line) edge, the sash
  // head and the glass top as CONCENTRIC arcs, sharing one centre point:
  // each inner radius is the outer one minus that layer's material thickness
  // (frame head section, then sash top rail). Confirmed against the L31115
  // reference (1100 x 1600, arch 150): R 1083.3 (frame outer) - 79 (frame
  // head/topHeight) = R 1004.3 (frame inner / sash outer); 1004.3 - 49
  // (sash top rail) = R 955.3 (glass top) — matches Integrate's three
  // radius labels exactly.
  // Step AD: the arch belongs to the top sash, measured at the GLASS
  // (archHeight = rise of the glass sightline arc). The frame head is
  // drawn CONCENTRIC from the sash arch — glass radius + top rail + frame
  // head — which is approximate: Integrate's own outer-jamb label (C:
  // "R 741.8" vs glass "R 708.8") does not follow a derivable offset
  // rule, so the frame-head offset is NOT invented (step-ad brief §1).
  // A legacy frame-level archHead keeps the old frame-anchored radius so
  // existing drawings render unchanged.
  const sashArch     = resolveTopSashArch(tree)
  const hasArch      = sashArch.archHead
  const archH        = hasArch ? n(sashArch.archHeight, 0) : 0
  const glWForArch   = computeGlassWidth(geometry?.sashWidth, n(topSash?.values?.leftWidth, 47))
  const archRadOuter = hasArch && archH > 0
    ? (sashArch.legacyFrameArch || glWForArch == null || glWForArch <= 0
        ? archR(fW, archH)
        : archR(glWForArch, archH) + n(topSash?.values?.topHeight, 49) + topHeight)
    : null
  // Shared centre: crown of the outer arc sits at (fW/2, 0); the centre is
  // directly below it by the outer radius.
  const archCX = fW / 2
  const archCY = archRadOuter ?? 0
  const archRadFrameInner = archRadOuter != null ? archRadOuter - topHeight : null
  const archAt = (R, x) => archYAt(archCX, archCY, R, x)

  // ── Geometry ────────────────────────────────────────────────────────────────
  const { sashWidth, topSashHeight, bottomSashHeight, topGlassHeight, bottomGlassHeight } = geometry

  // ── Sash part dimensions ────────────────────────────────────────────────────
  const pv        = pair?.values ?? {}
  const clearLeft = n(pv.mechanicalClearanceLeft,  0)
  const clearTop  = n(pv.mechanicalClearanceTop,   0)
  const M         = n(pv.midrailHeight, 40)
  const topRail   = n(topSash?.values?.topHeight,    49)
  const botRail   = n(botSash?.values?.bottomHeight, 88)
  const stileW    = n(topSash?.values?.stileWidth,   47)
  const glW       = computeGlassWidth(sashWidth, stileW) ?? 0

  // Sash head / glass top radii — only meaningful for an arched frame's
  // first opening (see drawSashPair's `arch` param).
  const archRadSashOuter = archRadFrameInner
  const archRadGlassTop  = archRadSashOuter != null ? archRadSashOuter - topRail : null

  // ── SVG sizing ──────────────────────────────────────────────────────────────
  const dfs    = Math.max(Math.min(fW * 0.06, fH * 0.02), 10)
  const lfs    = Math.max(fW * 0.075, 12)
  const tk     = dfs * 0.55
  const topPad = hasArch ? dfs * 2.5 + archH * 0.5 : dfs * 2.5

  // Horizontal extent including cill horns (horns extend past the frame).
  // In external view the mirror swaps left/right, so pad both sides by the
  // longer horn to prevent clipping in either view.
  const hornPad = Math.max(leftCillHorn, rightCillHorn)

  const R1 = fW + dfs * 1.5
  const R2 = fW + dfs * 4.0
  const R3 = fW + dfs * 6.5
  const R4 = fW + dfs * 9.5
  const B1 = fH + dfs * 1.5
  const B2 = fH + dfs * 4.0
  const B3 = fH + dfs * 6.5
  const VW = fW + dfs * 16 + hornPad * 2
  const VH = fH + dfs * 10 + topPad

  // Label Y anti-collision for right-side dimensions
  const r3cyBase  = OY + iH / 2
  const r4cyBase  = fH / 2
  const minLabelSep = dfs * 1.6
  let r3LabelY = r3cyBase, r4LabelY = r4cyBase
  if (Math.abs(r4cyBase - r3cyBase) < minLabelSep) {
    const mid = (r3cyBase + r4cyBase) / 2
    r3LabelY  = mid - minLabelSep / 2
    r4LabelY  = mid + minLabelSep / 2
  }

  // ── Opening layout (for single-opening this is just [{x:0, width:iW}]) ──────
  // Render-only thickness fallback: the stored thicknessInFrame (no
  // profile values are plumbed into the SVG; pricing uses the profile's
  // thicknessInFrameHollow — Step AD decision 3)
  const openings = computeOpeningLayout(frameMullions, iW, m => mullionThicknessMm(m, null))

  // ── Mirror (external view flips horizontally) ───────────────────────────────
  const mir = viewMode === 'external'
  const mx  = (x) => mir ? fW - x : x

  // ── Operation labels ────────────────────────────────────────────────────────
  const opLabel = (code) =>
    (refOptions?.sash_operation ?? []).find(o => o.code === code)?.label ?? ''

  // ── Selection helpers ────────────────────────────────────────────────────────
  function ss(key) { return key === selectedKey ? { stroke: C.selected, strokeWidth: 2.5 } : { stroke: C.timberStroke, strokeWidth: 1 } }
  function sg(key) { return key === selectedKey ? { stroke: C.selected, strokeWidth: 2.5 } : { stroke: C.glassStroke, strokeWidth: 1 } }

  // ── Arch path helpers ────────────────────────────────────────────────────────
  // Only used for the first (or only) opening — see the arch-scoping note by
  // the sash pairs map() below.

  // Interior opening background, bounded above by the frame-inner concentric
  // arc (spring points where it meets the vertical jamb faces at x0/x1).
  function interiorOpeningPath(opX, opW) {
    const x0 = OX + opX
    const x1 = OX + opX + opW

    if (!hasArch || !archRadFrameInner) {
      return `M ${x0} ${OY} L ${x1} ${OY} L ${x1} ${OY + iH} L ${x0} ${OY + iH} Z`
    }
    const y0 = archAt(archRadFrameInner, x0)
    const y1 = archAt(archRadFrameInner, x1)
    if (y0 == null || y1 == null) {
      return `M ${x0} ${OY} L ${x1} ${OY} L ${x1} ${OY + iH} L ${x0} ${OY + iH} Z`
    }
    return (
      `M ${x0} ${y0}` +
      ` A ${archRadFrameInner} ${archRadFrameInner} 0 0 1 ${x1} ${y1}` +
      ` L ${x1} ${OY + iH}` +
      ` L ${x0} ${OY + iH}` +
      ` Z`
    )
  }

  // Frame head + both jambs as ONE timber path — outer silhouette (outer
  // jamb edges up to the outer arc, archRadOuter, across the crown) on the
  // outside, frame-inner edges (inner jamb faces up to archRadFrameInner)
  // on the inside, both sharing the arch's centre point (a proper
  // concentric arched head, not a rectangle with a thin arc stroked on top
  // of it). Head and jambs used to be three separate shapes — the head
  // band's left/right edges are the diagonal segments from the outer
  // spring point to the (lower) inner spring point, which don't line up
  // with a jamb rect's flat top at the shoulder, leaving a small triangular
  // gap at each outside corner. Tracing the whole outline in one path
  // removes the seam entirely.
  function headTimberPath() {
    if (!hasArch || !archRadOuter || !archRadFrameInner || archH <= 0) return null
    const yOuterL = archAt(archRadOuter, 0)
    const yOuterR = archAt(archRadOuter, fW)
    const yInnerL = archAt(archRadFrameInner, OX)
    const yInnerR = archAt(archRadFrameInner, fW - rightWidth)
    if ([yOuterL, yOuterR, yInnerL, yInnerR].some(v => v == null)) return null
    const jambBottom = OY + iH
    return (
      `M 0 ${jambBottom}` +                                                   // bottom-left, outer edge
      ` L 0 ${yOuterL}` +                                                     // up the left outer jamb edge to the spring point
      ` A ${archRadOuter} ${archRadOuter} 0 0 1 ${fW} ${yOuterR}` +           // across the outer arc
      ` L ${fW} ${jambBottom}` +                                              // down the right outer jamb edge
      ` L ${fW - rightWidth} ${jambBottom}` +                                 // across the bottom to the right inner edge
      ` L ${fW - rightWidth} ${yInnerR}` +                                    // up the right inner jamb edge to its spring point
      ` A ${archRadFrameInner} ${archRadFrameInner} 0 0 0 ${OX} ${yInnerL}` + // across the inner arc (reverse)
      ` L ${OX} ${jambBottom}` +                                              // down the left inner jamb edge
      ` Z`                                                                    // back across the bottom to the start
    )
  }

  // ── Single-pair sash drawing (draws one sash pair in its opening) ────────────
  // sx = absolute x of sash left edge (within frame), ty = top sash y
  // arch (only for the first/only opening on an arched frame) = { archRadSashOuter, archRadGlassTop, archAt }
  function drawSashPair({
    sx, ty, sW, sSash,
    topSashNode, botSashNode,
    topGlassNode, botGlassNode,
    topGlassH, botGlassH,
    tRail, bRail, mid, stile, glW: glassW,
    pairIdx,
    by,
    arch,
  }) {
    if (!topSashNode && !botSashNode) return null

    const gx = sx + stile   // glass x start within sash
    const prefix = String.fromCharCode(65 + pairIdx)  // A, B, C...
    const topOpCode = topSashNode?.values?.operation ?? ''
    const botOpCode = botSashNode?.values?.operation ?? ''
    const topArrow  = topOpCode.startsWith('fix') ? '' : ' ↓'
    const botArrow  = botOpCode.startsWith('fix') ? '' : ' ↑'
    const glassCX   = sx + stile + glassW / 2
    const glassCY_t = ty + tRail + topGlassH / 2
    const glassCY_b = by + mid  + botGlassH / 2

    // Label sizing: lfs is a single size derived from the whole frame width
    // (fW), so on a multi-opening frame (double/triple box) it's far too
    // big for a single opening's own glass — text bled past the opening
    // into the neighbouring mullion. Fit each line's font size to this
    // opening's own glass width (text-length estimate; exact measurement
    // isn't available at SSR time), and clip to the glass area as a backstop.
    const topMainText = prefix + '1' + topArrow
    const topSubText  = opLabel(topOpCode)
    const botMainText = prefix + '2' + botArrow
    const botSubText  = opLabel(botOpCode)
    function fitFontSize(text, maxWidth, baseFontSize, minFontSize = 7) {
      if (!text) return baseFontSize
      const estWidth = text.length * baseFontSize * 0.62
      return estWidth <= maxWidth ? baseFontSize : Math.max(minFontSize, maxWidth / (text.length * 0.62))
    }
    const labelMaxW = Math.max(glassW * 0.92, 1)
    const topMainFs = fitFontSize(topMainText, labelMaxW, lfs)
    const topSubFs  = fitFontSize(topSubText,  labelMaxW, lfs * 0.72)
    const botMainFs = fitFontSize(botMainText, labelMaxW, lfs)
    const botSubFs  = fitFontSize(botSubText,  labelMaxW, lfs * 0.72)
    const clipIdTop = `glassclip-t-${pairIdx}`
    const clipIdBot = `glassclip-b-${pairIdx}`

    // Arched top sash: outer stiles start where they meet the sash's own
    // outer arc, the head rail is a curved band between the sash-outer and
    // glass-top arcs (same construction as the frame's head band), and the
    // glass top edge follows the glass-top arc instead of a flat rail line.
    const sashSpringL  = arch ? arch.archAt(arch.archRadSashOuter, sx) : null
    const sashSpringR  = arch ? arch.archAt(arch.archRadSashOuter, sx + sW) : null
    const glassSpringL = arch ? arch.archAt(arch.archRadGlassTop, gx) : null
    const glassSpringR = arch ? arch.archAt(arch.archRadGlassTop, gx + glassW) : null
    const archOk = arch && [sashSpringL, sashSpringR, glassSpringL, glassSpringR].every(v => v != null)

    const glassBottomY = ty + tRail + topGlassH
    const topHeadPath = archOk
      ? `M ${sx} ${sashSpringL}` +
        ` A ${arch.archRadSashOuter} ${arch.archRadSashOuter} 0 0 1 ${sx + sW} ${sashSpringR}` +
        ` L ${gx + glassW} ${glassSpringR}` +
        ` A ${arch.archRadGlassTop} ${arch.archRadGlassTop} 0 0 0 ${gx} ${glassSpringL}` +
        ` L ${sx} ${sashSpringL}` +
        ` Z`
      : null
    const topGlassPath = archOk
      ? `M ${gx} ${glassSpringL}` +
        ` A ${arch.archRadGlassTop} ${arch.archRadGlassTop} 0 0 1 ${gx + glassW} ${glassSpringR}` +
        ` L ${gx + glassW} ${glassBottomY}` +
        ` L ${gx} ${glassBottomY}` +
        ` Z`
      : null
    const archTopAt = archOk ? (x => arch.archAt(arch.archRadGlassTop, x)) : null

    return (
      <g key={sSash?.key ?? `pair-${pairIdx}`}>
        {/* Bottom sash (behind) */}
        <g style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(botSashNode?.key)}>
          <rect x={sx}              y={by}  width={stile} height={bottomSashHeight} fill={C.timber} {...ss(botSashNode?.key)} />
          <rect x={sx + sW - stile} y={by}  width={stile} height={bottomSashHeight} fill={C.timber} {...ss(botSashNode?.key)} />
          <rect x={gx}              y={by}  width={glassW} height={mid}  fill={C.timber} {...ss(botSashNode?.key)} />
          <rect x={gx}              y={by + mid + botGlassH} width={glassW} height={bRail} fill={C.timber} {...ss(botSashNode?.key)} />
          <rect x={gx} y={by + mid} width={glassW} height={botGlassH}
            fill={C.glass} {...sg(botGlassNode?.key)}
            style={{ cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); onSelectKey?.(botGlassNode?.key) }}
          />
          <GlazingBars glassNode={botGlassNode} derived={derived}
            gx={gx} gy={by + mid} glassW={glassW} glassH={botGlassH}
            selectedKey={selectedKey} onSelectKey={onSelectKey} ss={ss} />
        </g>

        {/* Top sash (in front) */}
        <g style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(topSashNode?.key)}>
          {archOk ? (
            <>
              <rect x={sx}              y={sashSpringL} width={stile} height={ty + topSashHeight - sashSpringL} fill={C.timber} {...ss(topSashNode?.key)} />
              <rect x={sx + sW - stile} y={sashSpringR} width={stile} height={ty + topSashHeight - sashSpringR} fill={C.timber} {...ss(topSashNode?.key)} />
              <path d={topHeadPath} fill={C.timber} {...ss(topSashNode?.key)}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectKey?.(topSashNode?.key)}
              />
              <rect x={gx}              y={ty + tRail + topGlassH} width={glassW} height={mid} fill={C.timber} {...ss(topSashNode?.key)} />
              <path d={topGlassPath}
                fill={C.glass} {...sg(topGlassNode?.key)}
                style={{ cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); onSelectKey?.(topGlassNode?.key) }}
              />
            </>
          ) : (
            <>
              <rect x={sx}              y={ty}  width={stile} height={topSashHeight} fill={C.timber} {...ss(topSashNode?.key)} />
              <rect x={sx + sW - stile} y={ty}  width={stile} height={topSashHeight} fill={C.timber} {...ss(topSashNode?.key)} />
              <rect x={gx}              y={ty}  width={glassW} height={tRail} fill={C.timber} {...ss(topSashNode?.key)} />
              <rect x={gx}              y={ty + tRail + topGlassH} width={glassW} height={mid} fill={C.timber} {...ss(topSashNode?.key)} />
              <rect x={gx} y={ty + tRail} width={glassW} height={topGlassH}
                fill={C.glass} {...sg(topGlassNode?.key)}
                style={{ cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); onSelectKey?.(topGlassNode?.key) }}
              />
            </>
          )}
          <GlazingBars glassNode={topGlassNode} derived={derived}
            gx={gx} gy={ty + tRail} glassW={glassW} glassH={topGlassH}
            selectedKey={selectedKey} onSelectKey={onSelectKey} ss={ss} archTop={archTopAt} />
        </g>

        {/* Labels — fitted to this opening's own glass width and clipped to it,
            so a narrow opening (double/triple box) never bleeds into a
            neighbouring mullion.
            When mirrored (external view) the parent <g> has scale(-1,1), which
            flips the text backwards. Counter-flip each <text> about its own x
            so glyphs always read left-to-right. */}
        {showGlassLabels && (() => {
          const lx = mx(glassCX)
          // Counter-flip: translate to 2x, scale(-1,1), so text un-mirrors about its own centre
          const counterFlip = mir ? `translate(${2 * lx},0) scale(-1,1)` : undefined
          return (
            <>
              <clipPath id={clipIdTop}><rect x={gx} y={ty + tRail} width={glassW} height={topGlassH} /></clipPath>
              <clipPath id={clipIdBot}><rect x={gx} y={by + mid}   width={glassW} height={botGlassH} /></clipPath>
              <text
                x={lx} y={glassCY_t}
                textAnchor="middle" dominantBaseline="middle"
                pointerEvents="none" fontFamily="inherit" fill={C.label}
                clipPath={`url(#${clipIdTop})`}
                transform={counterFlip}
              >
                <tspan x={lx} dy="-0.6em" fontSize={topMainFs}>{topMainText}</tspan>
                <tspan x={lx} dy="1.4em"  fontSize={topSubFs}>{topSubText}</tspan>
              </text>
              <text
                x={lx} y={glassCY_b}
                textAnchor="middle" dominantBaseline="middle"
                pointerEvents="none" fontFamily="inherit" fill={C.label}
                clipPath={`url(#${clipIdBot})`}
                transform={counterFlip}
              >
                <tspan x={lx} dy="-0.6em" fontSize={botMainFs}>{botMainText}</tspan>
                <tspan x={lx} dy="1.4em"  fontSize={botSubFs}>{botSubText}</tspan>
              </text>
            </>
          )
        })()}
      </g>
    )
  }

  // ── Compute per-opening sash geometries ──────────────────────────────────────
  // For multi-opening, sash pairs are in tree order; geometry currently covers first pair only.
  // Future: compute separate geometry per opening. For now, share geometry across all pairs.

  const sx0   = OX + clearLeft
  const ty0   = OY + clearTop
  const by0   = ty0 + topSashHeight - M

  // ── Transoms: draw as horizontal timber members across each opening ───────────

  function drawTransoms() {
    if (frameTransoms.length === 0) return null
    return frameTransoms.map(t => {
      const tY     = OY + n(t.values?.offset ?? 0)
      const thick  = n(t.values?.thicknessInFrame ?? 40)
      const sKey   = t.key
      const style  = t.key === selectedKey ? { stroke: C.selected, strokeWidth: 2.5 } : { stroke: C.timberStroke, strokeWidth: 1 }
      return (
        <rect key={sKey}
          x={OX} y={tY - thick / 2} width={iW} height={thick}
          fill={C.timber} {...style}
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectKey?.(sKey)}
        />
      )
    })
  }

  // ── Mullion drawing ───────────────────────────────────────────────────────────
  function drawMullions() {
    if (frameMullions.length === 0) return null
    return frameMullions.map((m, i) => {
      const mX    = OX + n(m.values?.offset ?? 0)
      const thick = n(m.values?.thicknessInFrame ?? 40)
      const style = m.key === selectedKey ? { stroke: C.selected, strokeWidth: 2.5 } : { stroke: C.timberStroke, strokeWidth: 1 }
      return (
        <rect key={m.key}
          x={mX - thick / 2} y={OY} width={thick} height={iH}
          fill={C.timber} {...style}
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectKey?.(m.key)}
        />
      )
    })
  }

  // ── Head path (may be arched) ─────────────────────────────────────────────────
  const headPath = headTimberPath()

  // Jamb tops: for a flat head they run straight up to OY. For an arched
  // head, the straight jamb must stop at the shoulder — where the frame's
  // inner (spring-line) arc meets that jamb's inner face — and the curved
  // head band (headTimberPath, drawn separately) covers the wedge above
  // that point up to the outer silhouette. Without this, the jamb rect
  // still ran up to OY, which sits above the arc's spring point, so the
  // rectangle stuck out past the arch at both corners.
  const leftJambTopY  = (hasArch && archRadFrameInner) ? (archAt(archRadFrameInner, OX) ?? OY) : OY
  const rightJambTopY = (hasArch && archRadFrameInner) ? (archAt(archRadFrameInner, fW - rightWidth) ?? OY) : OY

  return (
    <svg
      viewBox={`${-hornPad} ${-topPad} ${VW} ${VH}`}
      width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
      fontFamily={fontFamilyProp || 'inherit'}
    >
      {/* ── All geometry inside mirror group ──────────────────────────────────── */}
      <g transform={mir ? `translate(${fW},0) scale(-1,1)` : undefined}>

        {/* ── Frame interior background ─────────────────────────────────────── */}
        {!hasArch ? (
          <rect x={OX} y={OY} width={iW} height={iH} fill={C.opening} stroke="none" />
        ) : (
          <path d={interiorOpeningPath(0, iW)} fill={C.opening} stroke="none" />
        )}

        {/* ── Frame head + jambs ───────────────────────────────────────────────
            Arched: one combined path (see headTimberPath) so there's no seam
            between the curved head band and the straight jambs. Flat: three
            separate rects, as before. */}
        {headPath ? (
          <path
            d={headPath}
            fill={C.timber}
            stroke={C.timberStroke}
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(frame?.key)}
          />
        ) : (
          <>
            {OY > 0 && (
              <rect x={0} y={0} width={fW} height={OY}
                fill={C.timber} {...ss(frame?.key)}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectKey?.(frame?.key)}
              />
            )}
            {OX > 0 && (
              <rect x={0} y={leftJambTopY} width={OX} height={(OY + iH) - leftJambTopY}
                fill={C.timber} {...ss(frame?.key)}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectKey?.(frame?.key)}
              />
            )}
            {rightWidth > 0 && (
              <rect x={OX + iW} y={rightJambTopY} width={rightWidth} height={(OY + iH) - rightJambTopY}
                fill={C.timber} {...ss(frame?.key)}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectKey?.(frame?.key)}
              />
            )}
          </>
        )}
        {/* ── Cill (full width + horn extensions) ────────────────────────── */}
        {cillH > 0 && (
          <rect data-key={cill?.key} x={-leftCillHorn} y={OY + iH} width={fW + leftCillHorn + rightCillHorn} height={cillH}
            fill={C.timber} stroke={C.timberStroke} strokeWidth={1.2}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(cill?.key)}
          />
        )}

        {/* ── Frame outer border ────────────────────────────────────────────── */}
        {hasArch && archRadOuter ? (
          // Arched outer frame border
          <path
            d={`M 0 ${archH} A ${archRadOuter} ${archRadOuter} 0 0 1 ${fW} ${archH} L ${fW} ${fH} L 0 ${fH} Z`}
            fill="none" stroke={C.timberStroke} strokeWidth={1.2}
          />
        ) : (
          <rect x={0} y={0} width={fW} height={fH} fill="none" stroke={C.timberStroke} strokeWidth={1.2} />
        )}

        {/* ── Transoms ──────────────────────────────────────────────────────── */}
        {drawTransoms()}

        {/* ── Mullions ──────────────────────────────────────────────────────── */}
        {drawMullions()}

        {/* ── Sash pairs ────────────────────────────────────────────────────── */}
        {allPairs.map((p, pairIdx) => {
          const tSash  = findFirst(p, 'topSashPart')
          const bSash  = findFirst(p, 'bottomSashPart')
          const tGlass = findFirst(tSash, 'glassPart')
          const bGlass = findFirst(bSash, 'glassPart')

          // Opening x offset: for multi-pair, each pair aligns to its opening
          const opX = openings[pairIdx]?.x ?? 0

          // Sash width: on a single-opening frame, use the precise
          // (clearance-adjusted) computed sashWidth for the one pair. On a
          // multi-opening frame, EVERY pair — including the first — must
          // use its own opening's width; geometry.sashWidth is derived from
          // the whole frame's interior width with no concept of mullions,
          // so using it for pair 0 made that opening's sash/glass/label
          // centre land near the mullion instead of its own opening
          // (reported as "labels centred on the mullion line").
          const openingW = openings[pairIdx]?.width ?? iW
          const sW  = (pairIdx === 0 && allPairs.length === 1) ? sashWidth : openingW
          const sx  = OX + opX + clearLeft
          const ty  = OY + clearTop
          const by  = ty + (pairIdx === 0 ? topSashHeight : topSashHeight) - M
          const tR  = n(tSash?.values?.topHeight,    49)
          const bR  = n(bSash?.values?.bottomHeight, 88)
          const st  = n(tSash?.values?.stileWidth,   47)
          const gW  = computeGlassWidth(sW, st) ?? 0
          const tGH = pairIdx === 0 ? topGlassHeight    : Math.max(topSashHeight    - tR - M, 0)
          const bGH = pairIdx === 0 ? bottomGlassHeight : Math.max(bottomSashHeight - M  - bR, 0)

          // Arch only applies to the first/only opening — a mullion-divided
          // arched frame isn't modelled (out of scope; other openings
          // render flat rather than crash).
          const archForPair = (pairIdx === 0 && hasArch && archRadSashOuter && archRadGlassTop)
            ? { archRadSashOuter, archRadGlassTop, archAt }
            : null

          return drawSashPair({
            sx, ty, sW, sSash: p,
            topSashNode: tSash, botSashNode: bSash,
            topGlassNode: tGlass, botGlassNode: bGlass,
            topGlassH: tGH, botGlassH: bGH,
            tRail: tR, bRail: bR, mid: M, stile: st, glW: gW,
            pairIdx,
            by,
            arch: archForPair,
          })
        })}

      </g>

      {/* ── Dimension lines (outside mirror group so lines are never mirrored) ── */}
      {showIndividualSL && (
        <>
          <VDim x={R1} y1={ty0} y2={ty0 + topSashHeight}   label={topSashHeight}    dfs={dfs} tk={tk} />
          <VDim x={R2} y1={by0} y2={by0 + bottomSashHeight} label={bottomSashHeight} dfs={dfs} tk={tk} />
        </>
      )}
      {showOverallSL && (
        <>
          <VDim x={R3} y1={OY}  y2={OY + iH}  label={iH}   dfs={dfs} tk={tk} prefix="F " labelY={r3LabelY} />
          <VDim x={R4} y1={0}   y2={fH}        label={fH}   dfs={dfs} tk={tk} prefix="F " labelY={r4LabelY} />
          {openings.length > 1 ? (
            openings.map((op, i) => (
              <HDim key={`op-${i}`} x1={OX + op.x} x2={OX + op.x + op.width} y={B1} label={op.width} dfs={dfs} tk={tk} />
            ))
          ) : (
            <HDim x1={sx0} x2={sx0 + sashWidth}  y={B1} label={sashWidth} dfs={dfs} tk={tk} />
          )}
          <HDim x1={OX}  x2={OX + iW}           y={B2} label={iW}        dfs={dfs} tk={tk} prefix="F " />
          <HDim x1={0}   x2={fW}                y={B3} label={fW}        dfs={dfs} tk={tk} prefix="F " />
        </>
      )}

      {/* Arch height dimension (shown when arch head enabled) */}
      {hasArch && archH > 0 && showOverallSL && (
        <VDim x={R1} y1={OY} y2={OY + archH} label={archH} dfs={dfs} tk={tk} prefix="Arch " />
      )}

      {/* Arch radius labels — outer frame / frame-inner / glass-top, per Integrate */}
      {hasArch && archH > 0 && showOverallSL && (
        <g fontFamily="inherit" fill="#666" fontSize={dfs * 0.85}>
          {archRadGlassTop  != null && <text x={R1} y={dfs * 1.2}>{`R ${fmtDim(archRadGlassTop)}`}</text>}
          {archRadFrameInner != null && <text x={R1} y={dfs * 2.6}>{`R ${fmtDim(archRadFrameInner)}`}</text>}
          {archRadOuter     != null && <text x={R1} y={dfs * 4.0}>{`R ${fmtDim(archRadOuter)} F`}</text>}
        </g>
      )}

    </svg>
  )
}


// ── Casement / direct glazed elevation (Step AP item 4) ──────────────────────
//
// A casement frame has no sash PAIRS, so none of the box-sash geometry above
// applies: each opening holds either one casementSashPart (its own stiles and
// rails, glass inside) or one glassPart glazed straight into the frame. The
// sizes come from casementGeometry.js — the SAME module that prices them — so
// the drawing can never disagree with the price.
//
// Integrate's conventions, from docs/integrate-L31115-direct-glazed.txt:
//   - a sash is labelled "<sash type> <matrix>" — "Open Out A1" — except when
//     its operation is Fix, which is labelled "Fix B1"
//   - the dashed opening lines meet at an APEX ON THE HINGE SIDE seen
//     internally; a fixed sash and a direct glazed unit have no lines
//   - a direct glazed unit is glass only, labelled with its matrix position
//   - dimensions: each sash / visible glass size, each opening ("F 549"), the
//     frame interior and the overall frame
export function CasementElevation({
  tree,
  refOptions,
  viewMode = 'internal',
  selectedKey,
  onSelectKey,
  settings,
  fontFamily: fontFamilyProp,
}) {
  const frame = findFirst(tree, 'assemblyFramePart')
  const cill  = findFirst(tree, 'cillPart')
  const fv    = frame?.values ?? {}
  const fW    = n(fv.width,  1200)
  const fH    = n(fv.height, 1300)
  const OX    = n(fv.leftWidth, 0)
  const OY    = n(fv.topHeight, 0)
  const cillH = n(cill?.values?.height, 0)
  const iW    = fW - OX - n(fv.rightWidth, 0)
  const iH    = fH - OY - cillH

  const showGlassLabels  = settings?.showGlassLabels  !== false
  const showOverallSL    = settings?.showOverallSL    !== false
  const showIndividualSL = settings?.showIndividualSL !== false

  const leftCillHorn  = n(fv.leftCillHorn,  0)
  const rightCillHorn = n(fv.rightCillHorn, 0)
  const hornPad = Math.max(leftCillHorn, rightCillHorn)

  const dfs = Math.max(Math.min(fW * 0.06, fH * 0.02), 10)
  const lfs = Math.max(fW * 0.045, 12)
  const tk  = dfs * 0.55
  const topPad = dfs * 2.5
  const R1 = fW + dfs * 1.5
  const R2 = fW + dfs * 4.0
  const R3 = fW + dfs * 6.5
  const B1 = fH + dfs * 1.5
  const B2 = fH + dfs * 4.0
  const B3 = fH + dfs * 6.5
  const B4 = fH + dfs * 9.5
  const VW = fW + dfs * 13 + hornPad * 2
  const VH = fH + dfs * 12 + topPad

  const mir = viewMode === 'external'
  const mx  = (x) => (mir ? fW - x : x)

  function ss(key) {
    return key === selectedKey
      ? { stroke: C.selected, strokeWidth: 2.5 }
      : { stroke: C.timberStroke, strokeWidth: 1 }
  }
  function sg(key) {
    return key === selectedKey
      ? { stroke: C.selected, strokeWidth: 2.5 }
      : { stroke: C.glassStroke, strokeWidth: 1 }
  }

  const frameMullions = childrenOfType(frame, 'mullionPart')
    .sort((a, b) => (a.values?.offset ?? 0) - (b.values?.offset ?? 0))

  const frameTransoms = childrenOfType(frame, 'transomPart')
    .sort((a, b) => (a.values?.offset ?? 0) - (b.values?.offset ?? 0))
  const nodes = casementOpeningNodes(tree)
  // Step AR: labels are column letter + ROW number, so the matrix needs to
  // know how many columns the frame has.
  const nCols = columnCount(tree)
  // The openings sit in the 2-D grid cells frameOpenings returns (x / y
  // relative to the frame interior).
  const cells = frameOpenings(tree)

  // Step AV: the label is the CELL the opening sits in, not its place in the
  // list — with a spanning opening the two differ. TC1's openings are A1,
  // A2, B2: the fanlight spans both columns and the slot B1 does not exist.
  const cellLabel = idx => {
    const c = cells[idx]
    return c ? matrixLabel(c.col, c.row) : matrixIndexOf(idx, nCols)
  }

  const refLabel = (list, code) =>
    (refOptions?.[list] ?? []).find(o => o.code === code)?.label ?? ''

  // "Open Out A1" / "Fix B1" — the sash type's label, or Fix when it is fixed.
  function sashLabel(sashNode, matrix) {
    const op = String(sashNode.values?.operation ?? '').toLowerCase()
    if (op === 'fix' || op.startsWith('fix')) {
      return `${refLabel('sash_operation', 'fix') || 'Fix'} ${matrix}`
    }
    const typeCode = sashNode.values?.casementTypeId ?? ''
    const typeLabel = refLabel('sash_type', typeCode) || titleCaseCode(typeCode)
    return typeLabel ? `${typeLabel} ${matrix}` : matrix
  }

  // The dashed opening triangle: apex at the midpoint of the HINGE edge,
  // base the two corners of the opposite edge (brief §4). A fixed sash gets
  // no lines, and an operation we do not recognise gets none either rather
  // than a guessed hinge side.
  function openingLines(sashNode, x, y, w, h) {
    const op = String(sashNode.values?.operation ?? '').toLowerCase()
    let apex = null
    if (op.includes('left_hand'))   apex = [x,     y + h / 2]
    if (op.includes('right_hand'))  apex = [x + w, y + h / 2]
    if (op.includes('top_hung'))    apex = [x + w / 2, y]
    if (op.includes('bottom_hung')) apex = [x + w / 2, y + h]
    if (!apex) return null
    // The two corners furthest from the apex edge
    const corners = op.includes('left_hand')  ? [[x + w, y], [x + w, y + h]]
      : op.includes('right_hand')             ? [[x,     y], [x,     y + h]]
      : op.includes('top_hung')               ? [[x, y + h], [x + w, y + h]]
      :                                         [[x, y],     [x + w, y]]
    return (
      <g stroke={C.timberStroke} strokeWidth={1} strokeDasharray="12 8"
         fill="none" pointerEvents="none">
        {corners.map(([cx, cy], i) => (
          <line key={i} x1={cx} y1={cy} x2={apex[0]} y2={apex[1]} />
        ))}
      </g>
    )
  }

  // One opening: a casement sash (border + glass + opening lines) or a
  // direct glazed unit (glass only). Returns its own dimension figures too,
  // so the dimension rows below show exactly what was drawn.
  const drawn = nodes.map((node, idx) => {
    // Step AR: the cell comes from the 2-D grid (columns from mullions, rows
    // from transoms), so a fanlight is drawn in its own row instead of every
    // opening being full height.
    const slot = cells[idx] ?? { x: 0, y: 0, width: iW, height: iH }
    const v = node.values ?? {}
    const clearL = n(v.mechanicalClearanceLeft,   0)
    const clearR = n(v.mechanicalClearanceRight,  0)
    const clearT = n(v.mechanicalClearanceTop,    0)
    const clearB = n(v.mechanicalClearanceBottom, 0)
    const x = OX + slot.x + clearL
    const y = OY + (slot.y ?? 0) + clearT
    const w = slot.width - clearL - clearR
    const h = (slot.height ?? iH) - clearT - clearB
    const matrix = cellLabel(idx)

    if (node.part_type === 'glassPart') {
      // Direct glazed: the glass is glazed into the frame, no sash
      const label = matrix
      return {
        idx, slot, size: { width: w, height: h }, label,
        selected: node.key === selectedKey || (node.children ?? []).some(c => c.key === selectedKey),
        svg: (
          <g key={node.key}>
            <rect x={x} y={y} width={w} height={h}
              fill={C.glass} {...sg(node.key)}
              style={{ cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onSelectKey?.(node.key) }}
            />
            {showGlassLabels && (
              <CasementLabel text={label} cx={mx(x + w / 2)} cy={y + h / 2}
                maxWidth={w * 0.92} lfs={lfs} mir={mir} />
            )}
          </g>
        ),
      }
    }

    // Step AX: a FRENCH pair — two leaves meeting in the middle, no mullion
    // between them. Each leaf is drawn like a casement sash, half the
    // opening wide less the meeting-stile gap, and the MASTER leaf (the one
    // carrying the lock) is marked, as Integrate marks it.
    // Step AZ: a French DOOR pair draws exactly as a French casement pair
    // does — two leaves meeting in the middle with MASTER on the master —
    // so one branch serves both.
    if (isPairPart(node)) {
      const gap = n(v.gapBetweenMeetingStiles, 0)
      const leafW = Math.max((w - gap) / 2, 0)
      const leaves = (node.children ?? [])
        .filter(c => PAIR_LEAF_TYPES.includes(c.part_type))
      return {
        idx, slot, size: { width: w, height: h }, label: cellLabel(idx),
        selected: node.key === selectedKey ||
          leaves.some(l => l.key === selectedKey ||
            (l.children ?? []).some(c => c.key === selectedKey)),
        svg: (
          <g key={node.key}>
            {leaves.map((leaf, li) => {
              const lv = leaf.values ?? {}
              const lx = x + li * (leafW + gap)
              const lStileL = n(lv.leftWidth,    0)
              const lStileR = n(lv.rightWidth,   0)
              const lRailT  = n(lv.topHeight,    0)
              const lRailB  = n(lv.bottomHeight, 0)
              const lLap    = n(lv.stormProofOverlap, 0)
              const lGlass  = (leaf.children ?? []).find(c => c.part_type === 'glassPart')
              const lgx = lx + lStileL
              const lgy = y + lRailT
              const lgW = Math.max(leafW - lStileL - lStileR, 0)
              const lgH = Math.max(h - lRailT - lRailB, 0)
              const matrix = matrixLabel(
                (cells[idx]?.col ?? 0) + (isLeftLeaf(leaf) ? 0 : 1),
                cells[idx]?.row ?? 0)
              const text = sashLabel(leaf, matrix)
              return (
                <g key={leaf.key}>
                  <g style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(leaf.key)}>
                    <rect x={lx - lLap} y={y - lLap}
                      width={leafW + 2 * lLap} height={h + 2 * lLap}
                      fill={C.timber} {...ss(leaf.key)} />
                    <rect x={lgx} y={lgy} width={lgW} height={lgH}
                      fill={C.glass} {...sg(lGlass?.key)}
                      style={{ cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); onSelectKey?.(lGlass?.key) }}
                    />
                  </g>
                  {openingLines(leaf, lgx, lgy, lgW, lgH)}
                  {showGlassLabels && (
                    <CasementLabel text={text} cx={mx(lgx + lgW / 2)} cy={lgy + lgH / 2}
                      maxWidth={lgW * 0.92} lfs={lfs} mir={mir} />
                  )}
                  {showGlassLabels && lv.isMasterLeaf === true && (
                    <CasementLabel text="MASTER" cx={mx(lgx + lgW / 2)} cy={lgy + lgH / 2 + lfs * 1.4}
                      maxWidth={lgW * 0.92} lfs={lfs} mir={mir} />
                  )}
                </g>
              )
            })}
          </g>
        ),
      }
    }

    // Step AU: a STORMPROOF sash laps over the frame — 7 mm each side, as
    // Integrate draws it. DRAWING ONLY: the sash's own size, its glass and
    // every priced quantity are unchanged (the lap is outside its sections),
    // which is why only the drawn rectangle grows.
    const lap = n(v.stormProofOverlap, 0)

    // Casement sash: stiles and rails as timber, glass in the middle
    const stileL = n(v.leftWidth,    0)
    const stileR = n(v.rightWidth,   0)
    const railT  = n(v.topHeight,    0)
    const railB  = n(v.bottomHeight, 0)
    const glass  = (node.children ?? []).find(c => c.part_type === 'glassPart')
    const gx = x + stileL
    const gy = y + railT
    const gW = Math.max(w - stileL - stileR, 0)
    const gH = Math.max(h - railT - railB,   0)
    const label = sashLabel(node, matrix)

    return {
      idx, slot, size: { width: w, height: h }, label,
      selected: node.key === selectedKey || (node.children ?? []).some(c => c.key === selectedKey),
      svg: (
        <g key={node.key}>
          <g style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(node.key)}>
            {/* The sash as one timber rect with the glass cut out of it —
                stiles and rails read as a frame without four separate
                shapes meeting at the corners. A stormproof sash is drawn
                `lap` mm wider and taller on every side, over the frame. */}
            <rect x={x - lap} y={y - lap}
              width={w + 2 * lap} height={h + 2 * lap}
              fill={C.timber} {...ss(node.key)} />
            <rect x={gx} y={gy} width={gW} height={gH}
              fill={C.glass} {...sg(glass?.key)}
              style={{ cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); onSelectKey?.(glass?.key) }}
            />
          </g>
          <GlazingBars glassNode={glass} derived={null}
            gx={gx} gy={gy} glassW={gW} glassH={gH}
            selectedKey={selectedKey} onSelectKey={onSelectKey} ss={ss} />
          {openingLines(node, gx, gy, gW, gH)}
          {showGlassLabels && (
            <CasementLabel text={label} cx={mx(gx + gW / 2)} cy={gy + gH / 2}
              maxWidth={gW * 0.92} lfs={lfs} mir={mir} />
          )}
        </g>
      ),
    }
  })

  return (
    <svg
      viewBox={`${-hornPad} ${-topPad} ${VW} ${VH}`}
      width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
      fontFamily={fontFamilyProp || 'inherit'}
    >
      <g transform={mir ? `translate(${fW},0) scale(-1,1)` : undefined}>
        {/* Frame interior, then head and jambs, then the cill */}
        <rect x={OX} y={OY} width={iW} height={iH} fill={C.opening} stroke="none" />
        {OY > 0 && (
          <rect x={0} y={0} width={fW} height={OY} fill={C.timber} {...ss(frame?.key)}
            style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(frame?.key)} />
        )}
        {OX > 0 && (
          <rect x={0} y={OY} width={OX} height={iH} fill={C.timber} {...ss(frame?.key)}
            style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(frame?.key)} />
        )}
        {n(fv.rightWidth, 0) > 0 && (
          <rect x={OX + iW} y={OY} width={n(fv.rightWidth, 0)} height={iH}
            fill={C.timber} {...ss(frame?.key)}
            style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(frame?.key)} />
        )}
        {cillH > 0 && (
          <rect data-key={cill?.key}
            x={-leftCillHorn} y={OY + iH}
            width={fW + leftCillHorn + rightCillHorn} height={cillH}
            fill={C.timber} stroke={C.timberStroke} strokeWidth={1.2}
            style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(cill?.key)} />
        )}
        <rect x={0} y={0} width={fW} height={fH} fill="none"
          stroke={C.timberStroke} strokeWidth={1.2} />

        {/* Mullions (solid on a casement frame) */}
        {frameMullions.map(m => {
          const thick = n(m.values?.thicknessInFrame, 27)
          // A casement mullion's stored offset is its LEFT face
          const mX = OX + n(m.values?.offset, 0)
          return (
            <rect key={m.key} x={mX} y={OY} width={thick} height={iH}
              fill={C.timber} {...ss(m.key)}
              style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(m.key)} />
          )
        })}

        {/* Transoms (solid on a casement frame; offset = the opening above) */}
        {frameTransoms.map(t => {
          const thick = n(t.values?.thicknessInFrame, 27)
          const tY = OY + n(t.values?.offset, 0)
          return (
            <rect key={t.key} x={OX} y={tY} width={iW} height={thick}
              fill={C.timber} {...ss(t.key)}
              style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(t.key)} />
          )
        })}

        {/* The openings */}
        {drawn.map(d => d.svg)}

        {/* Step AR: the SELECTED opening, outlined in red as Integrate draws
            it, so the parts list and the drawing can never be read as
            different openings. */}
        {drawn.filter(d => d.selected).map(d => (
          <rect key={`sel-${d.idx}`}
            x={OX + d.slot.x} y={OY + (d.slot.y ?? 0)}
            width={d.slot.width} height={d.slot.height ?? iH}
            fill="none" stroke={C.selected} strokeWidth={4} pointerEvents="none" />
        ))}
      </g>

      {/* Dimensions (outside the mirror group, so figures are never flipped) */}
      {showIndividualSL && drawn.length > 0 && (
        <>
          {drawn.map(d => (
            <HDim key={`sash-${d.idx}`}
              x1={OX + d.slot.x} x2={OX + d.slot.x + d.size.width}
              y={B1} label={d.size.width} dfs={dfs} tk={tk} />
          ))}
          <VDim x={R1} y1={OY} y2={OY + drawn[0].size.height}
            label={drawn[0].size.height} dfs={dfs} tk={tk} />
        </>
      )}
      {showOverallSL && (
        <>
          {drawn.map(d => (
            <HDim key={`op-${d.idx}`}
              x1={OX + d.slot.x} x2={OX + d.slot.x + d.slot.width}
              y={B2} label={d.slot.width} dfs={dfs} tk={tk} prefix="F " />
          ))}
          <HDim x1={OX} x2={OX + iW} y={B3} label={iW} dfs={dfs} tk={tk} prefix="F " />
          <HDim x1={0}  x2={fW}      y={B4} label={fW} dfs={dfs} tk={tk} prefix="F " />
          <VDim x={R2} y1={OY} y2={OY + iH} label={iH} dfs={dfs} tk={tk} prefix="F " />
          <VDim x={R3} y1={0}  y2={fH}      label={fH} dfs={dfs} tk={tk} prefix="F " />
        </>
      )}
    </svg>
  )
}

// A label centred on an opening, fitted to its width and un-mirrored in the
// external view (the same treatment the sash labels get).
function CasementLabel({ text, cx, cy, maxWidth, lfs, mir }) {
  if (!text) return null
  const est = text.length * lfs * 0.62
  const fs  = est <= maxWidth ? lfs : Math.max(7, maxWidth / (text.length * 0.62))
  const counterFlip = mir ? `translate(${2 * cx},0) scale(-1,1)` : undefined
  return (
    <text
      x={cx} y={cy}
      textAnchor="middle" dominantBaseline="middle"
      pointerEvents="none" fontFamily="inherit" fill={C.label}
      fontSize={fs} transform={counterFlip}
    >{text}</text>
  )
}

// 'open_out' -> 'Open Out', for when reference_options has not been loaded.
function titleCaseCode(code) {
  return String(code ?? '')
    .split('_').filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
