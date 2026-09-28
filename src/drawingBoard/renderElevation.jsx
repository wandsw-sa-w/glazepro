// renderElevation.jsx — timber-outline SVG elevation for a box sash window.
//
// SashElevation({ tree, geometry, refOptions, viewMode, selectedKey, onSelectKey })
//
// geometry must be the output of computeSashGeometry (or null).
// All coordinates are in mm (the SVG coordinate space).

import React from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  return String(Math.round(v * 10) / 10)
}

// Convert v to a positive finite number, or return def.
function n(v, def = 0) {
  const x = Number(v)
  return isFinite(x) && x > 0 ? x : def
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

function VDim({ x, y1, y2, label, dfs, tk, prefix = '' }) {
  if (label == null) return null
  const text = prefix + fmtDim(label)
  const my   = (y1 + y2) / 2
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
  selected:     '#dc2626',
  label:        '#1a1a1a',
  opening:      '#eef4f8',
}

// ── Main component ────────────────────────────────────────────────────────────

export function SashElevation({ tree, geometry, refOptions, viewMode = 'internal', selectedKey, onSelectKey }) {
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

  // ── Node references ─────────────────────────────────────────────────────────
  const frame        = findFirst(tree, 'assemblyFramePart')
  const cill         = findFirst(tree, 'cillPart')
  const pair         = findFirst(tree, 'sashPairPart')
  const topSash      = findFirst(tree, 'topSashPart')
  const botSash      = findFirst(tree, 'bottomSashPart')
  const topGlassNode = findFirst(topSash, 'glassPart')
  const botGlassNode = findFirst(botSash, 'glassPart')

  // ── Frame dimensions ────────────────────────────────────────────────────────
  const fv         = frame?.values ?? {}
  const fW         = n(fv.width,  330)
  const fH         = n(fv.height, 1700)
  const leftWidth  = n(fv.leftWidth,  0)
  const rightWidth = n(fv.rightWidth, 0)
  const topHeight  = n(fv.topHeight,  0)
  const cillH      = n(cill?.values?.height, 0)

  // ── Geometry ────────────────────────────────────────────────────────────────
  const { sashWidth, topSashHeight, bottomSashHeight, topGlassHeight, bottomGlassHeight } = geometry

  // ── Sash part dimensions ────────────────────────────────────────────────────
  const pv        = pair?.values ?? {}
  const clearLeft = n(pv.mechanicalClearanceLeft,  0)
  const clearTop  = n(pv.mechanicalClearanceTop,   0)
  const M         = n(pv.midrailHeight, 40)          // meeting rail height
  const topRail   = n(topSash?.values?.topHeight,    49)
  const botRail   = n(botSash?.values?.bottomHeight, 88)
  const stileW    = n(topSash?.values?.stileWidth,   47)
  const glW       = Math.max(sashWidth - 2 * stileW, 0)  // glass clear width

  // ── SVG sizing ──────────────────────────────────────────────────────────────
  // dfs: annotation font size — small relative to frame, min 10
  const dfs = Math.max(Math.min(fW * 0.06, fH * 0.02), 10)
  const lfs = Math.max(fW * 0.075, 12)   // glass label font size
  const tk  = dfs * 0.55                 // dimension tick half-length

  // Right-side columns (4 stacked, each 2.5*dfs apart)
  const R1 = fW + dfs * 1.5
  const R2 = fW + dfs * 4.0
  const R3 = fW + dfs * 6.5
  const R4 = fW + dfs * 9.5
  // Bottom rows (3 stacked)
  const B1 = fH + dfs * 1.5
  const B2 = fH + dfs * 4.0
  const B3 = fH + dfs * 6.5
  // ViewBox — large enough for all dim lines + label text (~6 chars × 0.55*dfs each)
  const VW = fW + dfs * 16
  const VH = fH + dfs * 10

  // ── Coordinates ─────────────────────────────────────────────────────────────
  const OX  = leftWidth
  const OY  = topHeight
  const iW  = fW - leftWidth - rightWidth
  const iH  = fH - topHeight - cillH
  const sx  = OX + clearLeft          // sash left edge
  const ty  = OY + clearTop           // top sash top edge
  const by  = ty + topSashHeight - M  // bottom sash top edge (meeting rail overlap)

  // Glass area centres (for labels)
  const glassCX    = sx + stileW + glW / 2
  const glassCY_t  = ty + topRail + topGlassHeight / 2
  const glassCY_b  = by + M + bottomGlassHeight / 2

  // ── Mirror (external view flips horizontally) ───────────────────────────────
  const mir = viewMode === 'external'
  const mx  = (x) => mir ? fW - x : x   // for labels outside the mirror group

  // ── Operation labels ────────────────────────────────────────────────────────
  const opLabel = (code) =>
    (refOptions?.sash_operation ?? []).find(o => o.code === code)?.label ?? ''
  const topOpCode  = topSash?.values?.operation ?? ''
  const botOpCode  = botSash?.values?.operation ?? ''
  const topArrow   = topOpCode.startsWith('fix') ? '' : ' ↓'
  const botArrow   = botOpCode.startsWith('fix') ? '' : ' ↑'

  // ── Selection stroke ────────────────────────────────────────────────────────
  function ss(key)  { return key === selectedKey ? { stroke: C.selected, strokeWidth: 2.5 } : { stroke: C.timberStroke, strokeWidth: 1 } }
  function sg(key)  { return key === selectedKey ? { stroke: C.selected, strokeWidth: 2.5 } : { stroke: C.glassStroke,  strokeWidth: 1 } }

  // ── Sash timber-outline renderer (stiles + rails + glass) ──────────────────
  // Drawn as separate rects so each timber member is distinct.
  //   sy       = sash top y
  //   h        = total sash height
  //   topRailH = top rail depth
  //   botRailH = bottom rail depth
  //   glassH   = glass clear height (h - topRailH - botRailH)
  function drawSash({ sy, h, topRailH, botRailH, glassH, sKey, gKey }) {
    const glY = sy + topRailH          // glass top y
    return (
      <g style={{ cursor: 'pointer' }} onClick={() => onSelectKey?.(sKey)}>
        {/* Left stile */}
        <rect x={sx}                   y={sy} width={stileW} height={h} fill={C.timber} {...ss(sKey)} />
        {/* Right stile */}
        <rect x={sx + sashWidth - stileW} y={sy} width={stileW} height={h} fill={C.timber} {...ss(sKey)} />
        {/* Top rail */}
        <rect x={sx + stileW} y={sy}  width={glW} height={topRailH} fill={C.timber} {...ss(sKey)} />
        {/* Bottom rail */}
        <rect x={sx + stileW} y={glY + glassH} width={glW} height={botRailH} fill={C.timber} {...ss(sKey)} />
        {/* Glass pane */}
        <rect
          x={sx + stileW} y={glY} width={glW} height={glassH}
          fill={C.glass} {...sg(gKey)}
          style={{ cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); onSelectKey?.(gKey) }}
        />
      </g>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width="100%" height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
      fontFamily="inherit"
    >
      {/* ── All geometry inside mirror group ─────────────────────────────────── */}
      <g transform={mir ? `translate(${fW},0) scale(-1,1)` : undefined}>

        {/* ── Frame ──────────────────────────────────────────────────────────── */}
        {/* Interior background */}
        <rect x={OX} y={OY} width={iW} height={iH} fill={C.opening} stroke="none" />

        {/* Head */}
        {OY > 0 && (
          <rect x={0} y={0} width={fW} height={OY}
            fill={C.timber} {...ss(frame?.key)}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(frame?.key)}
          />
        )}
        {/* Left jamb */}
        {OX > 0 && (
          <rect x={0} y={OY} width={OX} height={iH}
            fill={C.timber} {...ss(frame?.key)}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(frame?.key)}
          />
        )}
        {/* Right jamb */}
        {rightWidth > 0 && (
          <rect x={OX + iW} y={OY} width={rightWidth} height={iH}
            fill={C.timber} {...ss(frame?.key)}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(frame?.key)}
          />
        )}
        {/* Cill */}
        {cillH > 0 && (
          <rect x={OX} y={OY + iH} width={iW} height={cillH}
            fill={C.timber} {...ss(cill?.key)}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectKey?.(cill?.key)}
          />
        )}
        {/* Frame outer border */}
        <rect x={0} y={0} width={fW} height={fH} fill="none" stroke={C.timberStroke} strokeWidth={1.2} />

        {/* ── Bottom sash (behind — drawn first) ─────────────────────────────── */}
        {drawSash({
          sy: by, h: bottomSashHeight,
          topRailH: M, botRailH: botRail, glassH: bottomGlassHeight,
          sKey: botSash?.key, gKey: botGlassNode?.key,
        })}

        {/* ── Top sash (in front — drawn second) ─────────────────────────────── */}
        {drawSash({
          sy: ty, h: topSashHeight,
          topRailH: topRail, botRailH: M, glassH: topGlassHeight,
          sKey: topSash?.key, gKey: topGlassNode?.key,
        })}

      </g>

      {/* ── Labels (outside mirror group so text is never mirrored) ─────────── */}

      {/* Top sash */}
      <text
        x={mx(glassCX)} y={glassCY_t}
        textAnchor="middle" dominantBaseline="middle"
        pointerEvents="none" fontFamily="inherit" fill={C.label}
      >
        <tspan x={mx(glassCX)} dy="-0.6em" fontSize={lfs}>
          {'A1' + topArrow}
        </tspan>
        <tspan x={mx(glassCX)} dy="1.4em" fontSize={lfs * 0.72}>
          {opLabel(topOpCode)}
        </tspan>
      </text>

      {/* Bottom sash */}
      <text
        x={mx(glassCX)} y={glassCY_b}
        textAnchor="middle" dominantBaseline="middle"
        pointerEvents="none" fontFamily="inherit" fill={C.label}
      >
        <tspan x={mx(glassCX)} dy="-0.6em" fontSize={lfs}>
          {'A2' + botArrow}
        </tspan>
        <tspan x={mx(glassCX)} dy="1.4em" fontSize={lfs * 0.72}>
          {opLabel(botOpCode)}
        </tspan>
      </text>

      {/* ── Right dimension lines (4 columns, each 2.5 dfs apart) ───────────── */}
      {/* R1: top sash height */}
      <VDim x={R1} y1={ty}  y2={ty + topSashHeight}    label={topSashHeight}    dfs={dfs} tk={tk} />
      {/* R2: bottom sash height */}
      <VDim x={R2} y1={by}  y2={by + bottomSashHeight}  label={bottomSashHeight} dfs={dfs} tk={tk} />
      {/* R3: F internal height */}
      <VDim x={R3} y1={OY}  y2={OY + iH}               label={iH}               dfs={dfs} tk={tk} prefix="F " />
      {/* R4: F frame height */}
      <VDim x={R4} y1={0}   y2={fH}                    label={fH}               dfs={dfs} tk={tk} prefix="F " />

      {/* ── Bottom dimension lines (3 rows) ─────────────────────────────────── */}
      {/* B1: sash width */}
      <HDim x1={sx}  x2={sx + sashWidth} y={B1} label={sashWidth} dfs={dfs} tk={tk} />
      {/* B2: F internal width */}
      <HDim x1={OX}  x2={OX + iW}        y={B2} label={iW}        dfs={dfs} tk={tk} prefix="F " />
      {/* B3: F frame width */}
      <HDim x1={0}   x2={fW}             y={B3} label={fW}        dfs={dfs} tk={tk} prefix="F " />

    </svg>
  )
}
