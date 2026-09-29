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

// SVG arc path string from (x1,y1) to (x2,y2) using given radius, curving upward.
// `upward` = the arc bows toward smaller y (toward the screen top).
function arcPath(x1, y1, x2, y2, R, upward = true) {
  if (!R) return `L ${x2} ${y2}`
  const sweep = upward ? 0 : 1     // 0=ccw goes upward when moving left→right
  const large = 0                   // always minor arc for shallow window arches
  return `A ${R} ${R} 0 ${large} ${sweep} ${x2} ${y2}`
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

// ── Opening layout ────────────────────────────────────────────────────────────

// Given a list of mullions (sorted by offset) and the total interior width,
// return array of { x, width } for each opening (left-to-right).
function openingLayout(mullions, iW) {
  const sorted = [...mullions].sort((a, b) => (a.values?.offset ?? 0) - (b.values?.offset ?? 0))
  const edges  = [0, ...sorted.map(m => n(m.values?.offset ?? 0, 0)), iW]
  const result = []
  for (let i = 0; i < edges.length - 1; i++) {
    result.push({ x: edges[i], width: edges[i + 1] - edges[i] })
  }
  return result
}

// ── Glazing bars ──────────────────────────────────────────────────────────────

function GlazingBars({ glassNode, derived, gx, gy, glassW, glassH, selectedKey, onSelectKey, ss }) {
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
        // Partial bars: offset2>0 means bar ends at offset2 instead of full height
        const y1 = gy + (bar.values?.offset2 > 0 && bar.values?.offset > 0 ? bar.values.offset : 0)
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
  const hasArch   = fv.archHead === true
  const archH     = hasArch ? n(fv.archHeight, 0) : 0
  // Arch radius for interior opening (chord = iW, sagitta = archH)
  const archRad   = hasArch && archH > 0 ? archR(iW, archH) : null

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
  const glW       = Math.max(sashWidth - 2 * stileW, 0)

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
  const openings = openingLayout(frameMullions, iW)

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

  // Arch path for interior opening background:
  // The arch crown is at (OX + opX + opW/2, OY) and spring line at y = OY + archH.
  // opX, opW = opening x offset and width within the interior.
  function interiorOpeningPath(opX, opW, useArch = false, ah = 0, R = null) {
    const x0 = OX + opX
    const x1 = OX + opX + opW
    const yTop    = OY
    const ySpring = OY + ah

    if (!useArch || !R) {
      // Rectangular opening
      return `M ${x0} ${yTop} L ${x1} ${yTop} L ${x1} ${OY + iH} L ${x0} ${OY + iH} Z`
    }
    // Arched opening: from left spring, arc UP to right spring (crown is above spring line)
    return (
      `M ${x0} ${ySpring}` +
      ` A ${R} ${R} 0 0 1 ${x1} ${ySpring}` +   // arc from left spring to right spring (going over crown)
      ` L ${x1} ${OY + iH}` +
      ` L ${x0} ${OY + iH}` +
      ` Z`
    )
  }

  // Arch path for the frame head (timber):
  // Rectangular outer edge with arched lower boundary.
  function headTimberPath(useArch = false, ah = 0, R = null) {
    if (!useArch || !R || ah <= 0) {
      // Flat head (or no arch) — rendered as a rectangle
      return null
    }
    const ySpring = OY + ah
    // Path: outer rectangle top, down to spring line on each side, arc (inner edge of head) back
    return (
      `M 0 0` +
      ` L ${fW} 0` +
      ` L ${fW} ${ySpring}` +
      ` A ${R} ${R} 0 0 0 ${OX} ${ySpring}` +  // arc from right to left, going UP (sweep=0 = ccw)
      ` L 0 ${ySpring}` +
      ` Z`
    )
  }

  // ── Single-pair sash drawing (draws one sash pair in its opening) ────────────
  // sx = absolute x of sash left edge (within frame), ty = top sash y
  function drawSashPair({
    sx, ty, sW, sSash,
    topSashNode, botSashNode,
    topGlassNode, botGlassNode,
    topGlassH, botGlassH,
    tRail, bRail, mid, stile, glW: glassW,
    pairIdx,
    by,
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
          <rect x={sx}              y={ty}  width={stile} height={topSashHeight} fill={C.timber} {...ss(topSashNode?.key)} />
          <rect x={sx + sW - stile} y={ty}  width={stile} height={topSashHeight} fill={C.timber} {...ss(topSashNode?.key)} />
          <rect x={gx}              y={ty}  width={glassW} height={tRail} fill={C.timber} {...ss(topSashNode?.key)} />
          <rect x={gx}              y={ty + tRail + topGlassH} width={glassW} height={mid} fill={C.timber} {...ss(topSashNode?.key)} />
          <rect x={gx} y={ty + tRail} width={glassW} height={topGlassH}
            fill={C.glass} {...sg(topGlassNode?.key)}
            style={{ cursor: 'pointer' }}
            onClick={e => { e.stopPropagation(); onSelectKey?.(topGlassNode?.key) }}
          />
          <GlazingBars glassNode={topGlassNode} derived={derived}
            gx={gx} gy={ty + tRail} glassW={glassW} glassH={topGlassH}
            selectedKey={selectedKey} onSelectKey={onSelectKey} ss={ss} />
        </g>

        {/* Labels */}
        {showGlassLabels && (
          <>
            <text
              x={mx(glassCX)} y={glassCY_t}
              textAnchor="middle" dominantBaseline="middle"
              pointerEvents="none" fontFamily="inherit" fill={C.label}
            >
              <tspan x={mx(glassCX)} dy="-0.6em" fontSize={lfs}>{prefix + '1' + topArrow}</tspan>
              <tspan x={mx(glassCX)} dy="1.4em"  fontSize={lfs * 0.72}>{opLabel(topOpCode)}</tspan>
            </text>
            <text
              x={mx(glassCX)} y={glassCY_b}
              textAnchor="middle" dominantBaseline="middle"
              pointerEvents="none" fontFamily="inherit" fill={C.label}
            >
              <tspan x={mx(glassCX)} dy="-0.6em" fontSize={lfs}>{prefix + '2' + botArrow}</tspan>
              <tspan x={mx(glassCX)} dy="1.4em"  fontSize={lfs * 0.72}>{opLabel(botOpCode)}</tspan>
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
  const headPath = headTimberPath(hasArch, archH, archRad)

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
          <path d={interiorOpeningPath(0, iW, true, archH, archRad)} fill={C.opening} stroke="none" />
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
          <rect x={0} y={OY} width={OX} height={iH}
            fill={C.timber} {...ss(frame?.key)}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(frame?.key)}
          />
        )}
        {/* ── Right jamb ────────────────────────────────────────────────────── */}
        {rightWidth > 0 && (
          <rect x={OX + iW} y={OY} width={rightWidth} height={iH}
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
        {hasArch && archRad ? (
          // Arched outer frame border
          <path
            d={`M 0 ${archH} A ${archR(fW, archH)} ${archR(fW, archH)} 0 0 1 ${fW} ${archH} L ${fW} ${fH} L 0 ${fH} Z`}
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

          // For multi-opening: sash width comes from opening width for the first pair,
          // else fall back to computed sashWidth
          const openingW = openings[pairIdx]?.width ?? iW
          // Use the shared geometry for all pairs (future: per-pair geometry)
          const sW  = pairIdx === 0 ? sashWidth : openingW
          const sx  = OX + opX + clearLeft
          const ty  = OY + clearTop
          const by  = ty + (pairIdx === 0 ? topSashHeight : topSashHeight) - M
          const tR  = n(tSash?.values?.topHeight,    49)
          const bR  = n(bSash?.values?.bottomHeight, 88)
          const st  = n(tSash?.values?.stileWidth,   47)
          const gW  = Math.max(sW - 2 * st, 0)
          const tGH = pairIdx === 0 ? topGlassHeight    : Math.max(topSashHeight    - tR - M, 0)
          const bGH = pairIdx === 0 ? bottomGlassHeight : Math.max(bottomSashHeight - M  - bR, 0)

          return drawSashPair({
            sx, ty, sW, sSash: p,
            topSashNode: tSash, botSashNode: bSash,
            topGlassNode: tGlass, botGlassNode: bGlass,
            topGlassH: tGH, botGlassH: bGH,
            tRail: tR, bRail: bR, mid: M, stile: st, glW: gW,
            pairIdx,
            by,
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
          <HDim x1={sx0} x2={sx0 + sashWidth}  y={B1} label={sashWidth} dfs={dfs} tk={tk} />
          <HDim x1={OX}  x2={OX + iW}           y={B2} label={iW}        dfs={dfs} tk={tk} prefix="F " />
          <HDim x1={0}   x2={fW}                y={B3} label={fW}        dfs={dfs} tk={tk} prefix="F " />
        </>
      )}

      {/* Arch height dimension (shown when arch head enabled) */}
      {hasArch && archH > 0 && showOverallSL && (
        <VDim x={R1} y1={OY} y2={OY + archH} label={archH} dfs={dfs} tk={tk} prefix="Arch " />
      )}

    </svg>
  )
}
