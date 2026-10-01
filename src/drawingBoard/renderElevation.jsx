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
import { computeOpeningLayout, computeGlassWidth } from './sashGeometry.js'

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
}) {
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
  const hasArch      = fv.archHead === true
  const archH        = hasArch ? n(fv.archHeight, 0) : 0
  const archRadOuter = hasArch && archH > 0 ? archR(fW, archH) : null
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

  const R1 = fW + dfs * 1.5
  const R2 = fW + dfs * 4.0
  const R3 = fW + dfs * 6.5
  const R4 = fW + dfs * 9.5
  const B1 = fH + dfs * 1.5
  const B2 = fH + dfs * 4.0
  const B3 = fH + dfs * 6.5
  const VW = fW + dfs * 16
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
  const openings = computeOpeningLayout(frameMullions, iW)

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

  // Frame head timber band: outer silhouette arc (archRadOuter, spanning the
  // full frame width) on top, frame-inner arc (archRadFrameInner, spanning
  // the jamb faces) on the bottom, both sharing the arch's centre point —
  // i.e. a proper concentric arched head, not a rectangle with a thin arc
  // stroked on top of it.
  function headTimberPath() {
    if (!hasArch || !archRadOuter || !archRadFrameInner || archH <= 0) return null
    const yOuterL = archAt(archRadOuter, 0)
    const yOuterR = archAt(archRadOuter, fW)
    const yInnerL = archAt(archRadFrameInner, OX)
    const yInnerR = archAt(archRadFrameInner, fW - rightWidth)
    if ([yOuterL, yOuterR, yInnerL, yInnerR].some(v => v == null)) return null
    return (
      `M 0 ${yOuterL}` +
      ` A ${archRadOuter} ${archRadOuter} 0 0 1 ${fW} ${yOuterR}` +
      ` L ${fW - rightWidth} ${yInnerR}` +
      ` A ${archRadFrameInner} ${archRadFrameInner} 0 0 0 ${OX} ${yInnerL}` +
      ` L 0 ${yOuterL}` +
      ` Z`
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
            neighbouring mullion. */}
        {showGlassLabels && (
          <>
            <clipPath id={clipIdTop}><rect x={gx} y={ty + tRail} width={glassW} height={topGlassH} /></clipPath>
            <clipPath id={clipIdBot}><rect x={gx} y={by + mid}   width={glassW} height={botGlassH} /></clipPath>
            <text
              x={mx(glassCX)} y={glassCY_t}
              textAnchor="middle" dominantBaseline="middle"
              pointerEvents="none" fontFamily="inherit" fill={C.label}
              clipPath={`url(#${clipIdTop})`}
            >
              <tspan x={mx(glassCX)} dy="-0.6em" fontSize={topMainFs}>{topMainText}</tspan>
              <tspan x={mx(glassCX)} dy="1.4em"  fontSize={topSubFs}>{topSubText}</tspan>
            </text>
            <text
              x={mx(glassCX)} y={glassCY_b}
              textAnchor="middle" dominantBaseline="middle"
              pointerEvents="none" fontFamily="inherit" fill={C.label}
              clipPath={`url(#${clipIdBot})`}
            >
              <tspan x={mx(glassCX)} dy="-0.6em" fontSize={botMainFs}>{botMainText}</tspan>
              <tspan x={mx(glassCX)} dy="1.4em"  fontSize={botSubFs}>{botSubText}</tspan>
            </text>
          </>
        )}
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
      viewBox={`0 ${-topPad} ${VW} ${VH}`}
      width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
      fontFamily="inherit"
    >
      {/* ── All geometry inside mirror group ──────────────────────────────────── */}
      <g transform={mir ? `translate(${fW},0) scale(-1,1)` : undefined}>

        {/* ── Frame interior background ─────────────────────────────────────── */}
        {!hasArch ? (
          <rect x={OX} y={OY} width={iW} height={iH} fill={C.opening} stroke="none" />
        ) : (
          <path d={interiorOpeningPath(0, iW)} fill={C.opening} stroke="none" />
        )}

        {/* ── Frame head ────────────────────────────────────────────────────── */}
        {headPath ? (
          /* Arched head: draw as path */
          <path
            d={headPath}
            fill={C.timber}
            stroke={C.timberStroke}
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(frame?.key)}
          />
        ) : OY > 0 ? (
          /* Flat head: rect */
          <rect x={0} y={0} width={fW} height={OY}
            fill={C.timber} {...ss(frame?.key)}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(frame?.key)}
          />
        ) : null}

        {/* ── Left jamb ─────────────────────────────────────────────────────── */}
        {OX > 0 && (
          <rect x={0} y={leftJambTopY} width={OX} height={(OY + iH) - leftJambTopY}
            fill={C.timber} {...ss(frame?.key)}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(frame?.key)}
          />
        )}
        {/* ── Right jamb ────────────────────────────────────────────────────── */}
        {rightWidth > 0 && (
          <rect x={OX + iW} y={rightJambTopY} width={rightWidth} height={(OY + iH) - rightJambTopY}
            fill={C.timber} {...ss(frame?.key)}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(frame?.key)}
          />
        )}
        {/* ── Cill ──────────────────────────────────────────────────────────── */}
        {cillH > 0 && (
          <rect x={OX} y={OY + iH} width={iW} height={cillH}
            fill={C.timber} {...ss(cill?.key)}
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
