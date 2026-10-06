import { describe, it, expect } from 'vitest'

/**
 * loadDrawingHistory returns { data, error } so callers can distinguish
 * a load failure (error set, data null) from an empty history (data [], error null).
 * The HistoryPanel must never show "No history yet" when the load failed.
 */

describe('drawingHistory — load error vs empty', () => {
  it('loadDrawingHistory returns { data, error } signature (source check)', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/drawingBoard/drawingHistory.js', 'utf-8')
    // The function must return an object with data and error, not a plain array
    expect(source).toContain('return { data: null, error:')
    expect(source).toContain('return { data: data')
    // Must NOT return [] on error (the old bug)
    expect(source).not.toMatch(/if\s*\(error\)[\s\S]{0,30}return\s*\[\]/)
  })

  it('HistoryPanel shows "could not be loaded" on error, not "No history yet" (source check)', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/pages/DrawingBoard.jsx', 'utf-8')
    // The error state must be checked before the empty state
    const errorIdx = source.indexOf('History could not be loaded')
    const emptyIdx = source.indexOf('No history yet')
    expect(errorIdx).toBeGreaterThan(-1)
    expect(emptyIdx).toBeGreaterThan(-1)
    expect(errorIdx).toBeLessThan(emptyIdx)
  })

  it('insertDrawingHistory accepts userName parameter (source check)', async () => {
    const fs = await import('fs')
    const source = fs.readFileSync('src/drawingBoard/drawingHistory.js', 'utf-8')
    expect(source).toContain('userName')
    expect(source).toContain('user_name: userName')
  })
})
