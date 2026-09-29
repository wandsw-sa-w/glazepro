import { describe, it, expect } from 'vitest'
import { computePopulatePatch } from './populateQuote.js'

const jobItems = [{ id: 1 }, { id: 2 }, { id: 3 }]

const drawings = [
  { id: 'd1a', job_item_id: 1, deleted_at: null },
  { id: 'd1b', job_item_id: 1, deleted_at: null },
  { id: 'd2a', job_item_id: 2, deleted_at: null },
  { id: 'd3a', job_item_id: 3, deleted_at: '2026-01-01' }, // deleted — should be skipped
]

describe('computePopulatePatch', () => {
  it('"first" picks the first non-deleted drawing of each item', () => {
    const patch = computePopulatePatch('first', 'qA', jobItems, drawings, {})
    expect(patch).toEqual({
      qA_1: 'd1a',
      qA_2: 'd2a',
      qA_3: '', // only drawing for item 3 is deleted
    })
  })

  it('"clear" blanks every item for the quote', () => {
    const draft = { qA_1: 'd1a', qA_2: 'd2a' }
    const patch = computePopulatePatch('clear', 'qA', jobItems, drawings, draft)
    expect(patch).toEqual({ qA_1: '', qA_2: '', qA_3: '' })
  })

  it('"copy:<quoteId>" copies another quote\'s draft selections', () => {
    const draft = { qB_1: 'd1b', qB_2: 'd2a' } // qB_3 not set
    const patch = computePopulatePatch('copy:qB', 'qA', jobItems, drawings, draft)
    expect(patch).toEqual({ qA_1: 'd1b', qA_2: 'd2a', qA_3: '' })
  })

  it('unknown mode returns an empty patch', () => {
    expect(computePopulatePatch('bogus', 'qA', jobItems, drawings, {})).toEqual({})
  })

  it('is a pure function — does not mutate its inputs', () => {
    const draft = { qB_1: 'd1b' }
    const jobItemsCopy = JSON.parse(JSON.stringify(jobItems))
    const drawingsCopy = JSON.parse(JSON.stringify(drawings))
    computePopulatePatch('copy:qB', 'qA', jobItems, drawings, draft)
    expect(jobItems).toEqual(jobItemsCopy)
    expect(drawings).toEqual(drawingsCopy)
    expect(draft).toEqual({ qB_1: 'd1b' })
  })
})
