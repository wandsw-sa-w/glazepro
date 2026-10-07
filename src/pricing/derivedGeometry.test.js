/**
 * derivedGeometry.test.js
 * Step V: one source of frame/sash geometry. assemblyFramePart.width/height
 * are the OVERALL frame; interior and sash sizes come from computeDerived.
 * The real saved tree (L507712 drawing 1, frame 1000 × 1500, board sash
 * width 825) is the reference.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { sashSizes, frameOverallSize } from './derivedGeometry.js'
import { computeVariables } from './computeVariables.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REAL_TREE = JSON.parse(readFileSync(
  resolve(__dirname, 'benchmarks', 'real-trees', 'L507712-drawing1.raw.json'), 'utf8'))

describe('Real tree L507712 drawing 1 — geometry matches the board', () => {
  const derived = computeDerived(REAL_TREE)
  const vars = computeVariables(REAL_TREE, derived, {})
  const sz = sashSizes(REAL_TREE, derived)

  it('frame_width/height are the stored overall 1000 × 1500', () => {
    expect(frameOverallSize(REAL_TREE)).toEqual({ width: 1000, height: 1500 })
    expect(vars.frame_width_in_mm).toBe(1000)
    expect(vars.frame_height_in_mm).toBe(1500)
  })

  it('frame_area is 1.50 m²', () => {
    expect(vars.frame_area).toBe(1.50)
  })

  it('interior = overall minus jambs / head / cill (830 × 1351)', () => {
    expect(sz.internalWidth).toBe(830)   // 1000 − 85 − 85
    expect(sz.internalHeight).toBe(1351) // 1500 − 79 − 70
    expect(vars.profiled_frame_interior_width_in_mm).toBe(830)
    expect(vars.profiled_frame_interior_height_in_mm).toBe(1351)
  })

  it('sash width equals the board’s drawn 825 (interior minus 2 × 2.5 clearance)', () => {
    // The 5 mm the brief asks about: mechanicalClearanceLeft 2.5 +
    // mechanicalClearanceRight 2.5, stored on sashPairPart in the real
    // tree itself (not a profile default read at pricing time).
    expect(sz.sashWidth).toBe(825)
    expect(vars.gross_sash_width_in_mm).toBe(825)
  })

  it('sash heights follow the drawn split (676 top / 715 bottom)', () => {
    // interior 1351 → glass (1351 − 40 − 49 − 88)/2 = 587 each;
    // top = 587 + 49 + 40, bottom = 587 + 88 + 40
    expect(sz.topSashHeight).toBe(676)
    expect(sz.bottomSashHeight).toBe(715)
    expect(sz.topGlassHeight).toBe(587)
    expect(sz.bottomGlassHeight).toBe(587)
  })
})

describe('sashSizes — no sash pair', () => {
  it('returns nulls, never throws', () => {
    const sz = sashSizes({ key: 'x', part_type: 'drawingItemPart', values: {}, children: [] })
    expect(sz.sashWidth).toBeNull()
    expect(sz.internalWidth).toBeNull()
    expect(sz.topGlassHeight).toBeNull()
  })
})
