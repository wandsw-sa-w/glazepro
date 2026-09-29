import { describe, it, expect } from 'vitest'
import { treeHash } from './treeHash.js'

const BASE_TREE = {
  part_type: 'drawingItemPart',
  values: { frameMaterialId: 'accoya', doc_l: true },
  children: [
    {
      part_type: 'pricePart',
      values: { vatRate: '20', poa: false },
      children: [],
    },
    {
      part_type: 'assemblyFramePart',
      values: { outerWidth: 900, outerHeight: 1200 },
      children: [],
    },
  ],
}

describe('treeHash', () => {
  it('returns an 8-character hex string', () => {
    const h = treeHash(BASE_TREE)
    expect(h).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is stable — same input produces same hash', () => {
    expect(treeHash(BASE_TREE)).toBe(treeHash(BASE_TREE))
  })

  it('is stable across object key order', () => {
    const reordered = {
      children: BASE_TREE.children,
      values: BASE_TREE.values,
      part_type: BASE_TREE.part_type,
    }
    expect(treeHash(reordered)).toBe(treeHash(BASE_TREE))
  })

  it('changes when a value changes', () => {
    const changed = {
      ...BASE_TREE,
      values: { ...BASE_TREE.values, doc_l: false },
    }
    expect(treeHash(changed)).not.toBe(treeHash(BASE_TREE))
  })

  it('changes when a child value changes', () => {
    const changed = {
      ...BASE_TREE,
      children: [
        BASE_TREE.children[0],
        { ...BASE_TREE.children[1], values: { outerWidth: 950, outerHeight: 1200 } },
      ],
    }
    expect(treeHash(changed)).not.toBe(treeHash(BASE_TREE))
  })

  it('ignores id, key, and _at fields in values', () => {
    const withIds = {
      ...BASE_TREE,
      values: { ...BASE_TREE.values, id: 'some-uuid', created_at: '2026-01-01', key: 'abc' },
    }
    expect(treeHash(withIds)).toBe(treeHash(BASE_TREE))
  })
})
