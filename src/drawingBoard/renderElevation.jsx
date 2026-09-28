// renderElevation.js — pure SVG elevation component for a box sash window.
//
// SashElevation({ tree, geometry, refOptions, viewMode, selectedKey, onSelectKey })
//
// geometry must be the output of computeSashGeometry (or null).
// All coordinates are in mm (the SVG coordinate space).

import React from 'react'

// ── Local helpers ─────────────────────────────────────────────────────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

function fmtDim(v) {
  const r = Math.round(v * 10) / 10
  return String(r)
}

// ── Dimension line sub-components ─────────────────────────────────────────────

function HDim({ x1, x2, y, label, dfs, tk, prefix = '' }) {
  if (label == null || label === undefined) return null
  const text = prefix + fmtDim(label)
  const mx   = (x1 + x2) / 2
  return (
    <g stroke="#666" strokeWidth={0.7} fill="none">
      {/* Left tick */}
      <line x1={x1} y1={y - tk} x2={x1} y2={y + tk} />
      {/* Right tick */}
      <line x1={x2} y1={y - tk} x2={x2} y2={y + tk} />
      {/* Horizontal line */}
      <line x1={x1} y1={y} x2={x2} y2={y} />
      {/* Label below centre */}
      <text
        x={mx} y={y + dfs * 1.1}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize={dfs}
        fill="#666"
        stroke="none"
        fontFamily="inherit"
      >
        {text}
      </text>
    </g>
  )
}

function VDim({ x, y1, y2, label, dfs, tk, prefix = '' }) {
  if (label == null || label === undefined) return null
  const text = prefix + fmtDim(label)
  const my   = (y1 + y2) / 2
  return (
    <g stroke="#666" strokeWidth={0.7} fill="none">
      {/* Top tick */}
      <line x1={x - tk} y1={y1} x2={x + tk} y2={y1} />
      {/* Bottom tick */}
      <line x1={x - tk} y1={y2} x2={x + tk} y2={y2} />
      {/* Vertical line */}
      <line x1={x} y1={y1} x2={x} y2={y2} />
      {/* Label to the right */}
      <text
        x={x + dfs * 0.6}
        y={my}
        textAnchor="start"
        dominantBaseline="middle"
        fontSize={dfs}
        fill="#666"
        stroke="none"
        fontFamily="inherit"
      >
        {text}
      </text>
    </g>
  )
}

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  timber:        '#d4b483',
  timberStroke:  '#8b6840',
  glass:         '#d0eaf5',
  glassStroke:   '#7ab8d4',
  selected:      '#dc2626',
  label:         '#1a1a1a',
  opening:       '#eef4f8',
}

// ── Main component ────────────────────────────────────────────────────────────

export function SashElevation({ tree, geometry, refOptions, viewMode = 'internal', selectedKey, onSelectKey }) {
  if (!geometry) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#e8e8e8',
        borderRadius: 8,
        color: '#888',
        fontSize: 13,
        padding: 24,
        textAlign: 'center',
      }}>
        Enter frame and sash dimensions to generate elevation.
      </div>
    )
  }

  // ── Node references ─────────────────────────────────────────────────────────
  const frame   = findFirst(tree, 'assemblyFramePart')
  const cill    = findFirst(tree, 'cillPart')
  const pair    = findFirst(tree, 'sashPairPart')
  const topSash = findFirst(tree, 'topSashPart')
  const botSash = findFirst(tree, 'bottomSashPart')
  const topGlassNode = findFirst(topSash, 'glassPart')
  const botGlassNode = findFirst(botSash, 'glassPart')

  // ── Frame dimensions ────────────────────────────────────────────────────────
  const fv         = frame?.values ?? {}
  const fW         = Number(fv.width)   || 330
  const fH         = Number(fv.height)  || 1700
  const leftWidth  = Number(fv.leftWidth)  || 0
  const rightWidth = Number(fv.rightWidth) || 0
  const topHeight  = Number(fv.topHeight)  || 0
  const cillH      = Number(cill?.values?.height) || 0

  // ── Geometry unpacked ───────────────────────────────────────────────────────
  const {
    sashWidth,
    topSashHeight,
    bottomSashHeight,
    topGlassHeight,
    bottomGlassHeight,
  } = geometry

  const pv          = pair?.values ?? {}
  const clearLeft   = Number(pv.mechanicalClearanceLeft)  || 0
  const clearTop    = Number(pv.mechanicalClearanceTop)   || 0
  const M           = Number(pv.midrailHeight) || 40
  const topRail     = Number(topSash?.values?.topHeight)  || 49
  const stileW      = Number(topSash?.values?.stileWidth) ?? 47

  // ── SVG sizing constants ────────────────────────────────────────────────────
  const dfs  = Math.max(fH * 0.026, 18)   // dimension text font size
  const lfs  = Math.max(fH * 0.030, 20)   // glass pane label font size
  const tk   = dfs * 0.5                  // tick half-length
  const DIM_R = dfs * 7.5
  const DIM_B = dfs * 5.0
  const VW   = fW + DIM_R
  const VH   = fH + DIM_B

  // ── Coordinate helpers ──────────────────────────────────────────────────────
  const OX   = leftWidth
  const OY   = topHeight
  const iW   = fW - leftWidth - rightWidth
  const iH   = fH - topHeight - cillH
  const sx   = OX + clearLeft
  const ty   = OY + clearTop
  const by   = ty + topSashHeight - M
  const glW  = sashWidth - 2 * stileW

  // Mirror (external view flips horizontally)
  const mir  = viewMode === 'external'

  // ── Operation label lookup ──────────────────────────────────────────────────
  const opLabel = (code) =>
    (refOptions?.sash_operation ?? []).find(o => o.code === code)?.label ?? ''

  const topOpCode = topSash?.values?.operation ?? ''
  const botOpCode = botSash?.values?.operation ?? ''
  const topOpLabel = opLabel(topOpCode)
  const botOpLabel = opLabel(botOpCode)

  // Show ↓/↑ arrows unless operation code starts with 'fix'
  const topArrow = topOpCode.startsWith('fix') ? '' : ' ↓'
  const botArrow = botOpCode.startsWith('fix') ? '' : ' ↑'

  // ── Selection stroke helper ─────────────────────────────────────────────────
  function selStroke(key) {
    return key === selectedKey ? { stroke: C.selected, strokeWidth: 3 } : { stroke: C.timberStroke, strokeWidth: 1 }
  }
  function selGlassStroke(key) {
    return key === selectedKey ? { stroke: C.selected, strokeWidth: 3 } : { stroke: C.glassStroke, strokeWidth: 1 }
  }

  // ── Mirror x helper (for labels outside the mirror group) ──────────────────
  const mx = (x) => mir ? fW - x : x

  const glassCX_top = sx + stileW + glW / 2
  const glassCY_top = ty + topRail + topGlassHeight / 2
  const glassCX_bot = sx + stileW + glW / 2
  const glassCY_bot = by + M + bottomGlassHeight / 2

  // Dimension offsets
  const R1 = fW + dfs * 1.2
  const R2 = fW + dfs * 2.8
  const R3 = fW + dfs * 4.4
  const R4 = fW + dfs * 6.0
  const B1 = fH + dfs * 1.2
  const B2 = fH + dfs * 2.8
  const B3 = fH + dfs * 4.4

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
      fontFamily="inherit"
    >
      {/* ── Mirror group (all geometry) ─────────────────────────────────────── */}
      <g transform={mir ? `translate(${fW}, 0) scale(-1, 1)` : undefined}>

        {/* Frame outer rect */}
        <rect
          x={0} y={0} width={fW} height={fH}
          fill={C.timber}
          {...selStroke(frame?.key)}
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectKey?.(frame?.key)}
        />

        {/* Opening rect */}
        <rect
          x={OX} y={OY} width={iW} height={iH}
          fill={C.opening}
          stroke="none"
        />

        {/* Cill band */}
        <rect
          x={OX} y={OY + iH} width={iW} height={cillH}
          fill={C.timber}
          {...selStroke(cill?.key)}
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectKey?.(cill?.key)}
        />

        {/* Bottom sash rect */}
        <rect
          x={sx} y={by} width={sashWidth} height={bottomSashHeight}
          fill={C.timber}
          {...selStroke(botSash?.key)}
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectKey?.(botSash?.key)}
        />

        {/* Bottom glass pane */}
        <rect
          x={sx + stileW} y={by + M} width={glW} height={bottomGlassHeight}
          fill={C.glass}
          {...selGlassStroke(botGlassNode?.key)}
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onSelectKey?.(botGlassNode?.key) }}
        />

        {/* Top sash rect */}
        <rect
          x={sx} y={ty} width={sashWidth} height={topSashHeight}
          fill={C.timber}
          {...selStroke(topSash?.key)}
          style={{ cursor: 'pointer' }}
          onClick={() => onSelectKey?.(topSash?.key)}
        />

        {/* Top glass pane */}
        <rect
          x={sx + stileW} y={ty + topRail} width={glW} height={topGlassHeight}
          fill={C.glass}
          {...selGlassStroke(topGlassNode?.key)}
          style={{ cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onSelectKey?.(topGlassNode?.key) }}
        />

        {/* Frame outline (clean border on top) */}
        <rect
          x={0} y={0} width={fW} height={fH}
          fill="none"
          stroke={C.timberStroke}
          strokeWidth={1}
        />

      </g>

      {/* ── Labels (outside mirror group — text is never mirrored) ─────────── */}

      {/* Top sash label */}
      <text
        x={mx(glassCX_top)}
        y={glassCY_top}
        textAnchor="middle"
        dominantBaseline="middle"
        pointerEvents="none"
        fontFamily="inherit"
        fill={C.label}
      >
        <tspan x={mx(glassCX_top)} dy="-0.6em" fontSize={lfs}>
          {'A1' + topArrow}
        </tspan>
        <tspan x={mx(glassCX_top)} dy="1.4em" fontSize={lfs * 0.72}>
          {topOpLabel}
        </tspan>
      </text>

      {/* Bottom sash label */}
      <text
        x={mx(glassCX_bot)}
        y={glassCY_bot}
        textAnchor="middle"
        dominantBaseline="middle"
        pointerEvents="none"
        fontFamily="inherit"
        fill={C.label}
      >
        <tspan x={mx(glassCX_bot)} dy="-0.6em" fontSize={lfs}>
          {'A2' + botArrow}
        </tspan>
        <tspan x={mx(glassCX_bot)} dy="1.4em" fontSize={lfs * 0.72}>
          {botOpLabel}
        </tspan>
      </text>

      {/* ── Right dimension lines ────────────────────────────────────────────── */}
      <VDim x={R1} y1={ty}       y2={ty + topSashHeight}    label={topSashHeight}    dfs={dfs} tk={tk} />
      <VDim x={R2} y1={by}       y2={by + bottomSashHeight} label={bottomSashHeight} dfs={dfs} tk={tk} />
      <VDim x={R3} y1={OY}       y2={OY + iH}               label={iH}               dfs={dfs} tk={tk} prefix="F " />
      <VDim x={R4} y1={0}        y2={fH}                    label={fH}               dfs={dfs} tk={tk} prefix="F " />

      {/* ── Bottom dimension lines ───────────────────────────────────────────── */}
      <HDim x1={sx}  x2={sx + sashWidth} y={B1} label={sashWidth} dfs={dfs} tk={tk} />
      <HDim x1={OX}  x2={OX + iW}        y={B2} label={iW}        dfs={dfs} tk={tk} prefix="F " />
      <HDim x1={0}   x2={fW}             y={B3} label={fW}        dfs={dfs} tk={tk} prefix="F " />

    </svg>
  )
}
