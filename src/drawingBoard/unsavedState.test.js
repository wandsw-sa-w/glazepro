// unsavedState.test.js — Step BM item 3
//
// Selecting a part must never clear unsaved state.
//
// "Finish & Ironmongery" auto-applies the default ironmongery when its panel
// opens, through `handleAutoApplyDefaults`. That handler used to do:
//
//     savedTreeRef.current = newTree     // the WHOLE current tree
//     setDirty(false)
//
// The current tree holds whatever the surveyor has changed and not yet saved,
// so the handler adopted those edits as the saved baseline and then said the
// drawing was clean. The Unsaved marker cleared, Save greyed out, and a reload
// brought the drawing back WITHOUT them — the reviewer lost a glazing bar and
// an opening type that way.
//
// The intent was only ever "the default itself is not a change". So the fix
// applies the SAME default to the baseline as to the tree — one patch, not a
// replacement — and recomputes dirty instead of forcing it.
//
// `handleAutoApplyDefaults` lives inside the DrawingBoard component and is not
// exported, so this models the handler's three lines exactly and asserts the
// behaviour both ways round, and a source-level guard below checks the
// component still does it that way. That is the same pattern
// profileCodeCallers.test.js uses, and for the same reason: the fault is
// invisible without a browser.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The board's own updateNodeValues, in the shape the handler uses it. */
function updateNodeValues(tree, key, patch) {
  if (!tree) return tree
  if (tree.key === key) return { ...tree, values: { ...tree.values, ...patch } }
  return { ...tree, children: (tree.children ?? []).map(c => updateNodeValues(c, key, patch)) }
}

const isDirty = (candidate, baseline) =>
  JSON.stringify(candidate) !== JSON.stringify(baseline)

/**
 * The board's state as the handler sees it: the tree, the saved baseline and
 * the dirty flag.
 */
function board(tree) {
  return { tree, saved: tree, dirty: false }
}

/** A surveyor's edit — what `commit` does. */
function edit(state, key, patch) {
  const tree = updateNodeValues(state.tree, key, patch)
  return { ...state, tree, dirty: isDirty(tree, state.saved) }
}

/** The FIXED handleAutoApplyDefaults: patch both, then recompute. */
function autoApplyDefault(state, key, property, value) {
  const patch = { [property]: value }
  const tree = updateNodeValues(state.tree, key, patch)
  const saved = state.saved ? updateNodeValues(state.saved, key, patch) : tree
  return { tree, saved, dirty: isDirty(tree, saved) }
}

/** What it used to do, kept so the test says what it is protecting against. */
function autoApplyDefaultOld(state, key, property, value) {
  const tree = updateNodeValues(state.tree, key, { [property]: value })
  return { tree, saved: tree, dirty: false }
}

const TREE = {
  key: 'item1', part_type: 'drawingItemPart', values: { typeOfWork: 'complete_new' },
  children: [
    { key: 'paint1', part_type: 'paintAndIronmongeryPart', values: {}, children: [] },
    {
      key: 'frame1', part_type: 'assemblyFramePart', values: { width: 1200, height: 1300 },
      children: [
        { key: 'cas1', part_type: 'casementSashPart', values: { operation: 'top_hung' }, children: [] },
      ],
    },
  ],
}

describe('Step BM item 3 — a default must not swallow unsaved edits', () => {
  it('an edit, then the default: the edit is STILL unsaved', () => {
    const edited = edit(board(TREE), 'cas1', { operation: 'fix' })
    expect(edited.dirty).toBe(true)

    const after = autoApplyDefault(edited, 'paint1', 'ironmongeryFinish', 'PB')
    expect(after.dirty, 'selecting Finish & Ironmongery must not clear it').toBe(true)
    // the edit is still in the tree AND still not in the baseline
    const sashOf = t => t.children[1].children[0].values.operation
    expect(sashOf(after.tree)).toBe('fix')
    expect(sashOf(after.saved)).toBe('top_hung')
    // and the default landed on both, so it is not itself a change
    const finishOf = t => t.children[0].values.ironmongeryFinish
    expect(finishOf(after.tree)).toBe('PB')
    expect(finishOf(after.saved)).toBe('PB')
  })

  it('the OLD behaviour is what lost the edit', () => {
    const edited = edit(board(TREE), 'cas1', { operation: 'fix' })
    const after = autoApplyDefaultOld(edited, 'paint1', 'ironmongeryFinish', 'PB')
    expect(after.dirty).toBe(false)                     // Save greys out
    // and the baseline now CONTAINS the unsaved edit, so a reload loses it
    expect(after.saved.children[1].children[0].values.operation).toBe('fix')
  })

  it('on a CLEAN drawing the default still marks nothing dirty', () => {
    // The whole point of the handler: default ironmongery on load must not
    // make a freshly opened drawing look edited.
    const after = autoApplyDefault(board(TREE), 'paint1', 'ironmongeryFinish', 'PB')
    expect(after.dirty).toBe(false)
  })

  it('and SAVING after the default keeps the edit — the brief’s round trip', () => {
    // edit -> select F&I -> save -> reload
    const edited = edit(board(TREE), 'cas1', { operation: 'fix' })
    const afterPanel = autoApplyDefault(edited, 'paint1', 'ironmongeryFinish', 'PB')
    expect(afterPanel.dirty).toBe(true)
    // a save writes the tree and makes it the baseline
    const saved = { tree: afterPanel.tree, saved: afterPanel.tree, dirty: false }
    // a reload reads back what was written
    const reloaded = board(saved.tree)
    expect(reloaded.tree.children[1].children[0].values.operation).toBe('fix')
    expect(reloaded.tree.children[0].values.ironmongeryFinish).toBe('PB')
    expect(reloaded.dirty).toBe(false)
  })

  it('the BOARD still does it that way', () => {
    // A source-level guard: the fault cannot be seen without a browser, so
    // what is worth testing is that the handler has not gone back.
    const src = readFileSync(resolve(SRC, 'pages/DrawingBoard.jsx'), 'utf8')
    const at = src.indexOf('const handleAutoApplyDefaults')
    expect(at, 'the handler').toBeGreaterThan(-1)
    const body = src.slice(at, src.indexOf('}, [tree])', at))
    // it patches the baseline rather than replacing it
    expect(body).toContain('savedTreeRef.current = savedTreeRef.current')
    expect(body).toContain('updateNodeValues(savedTreeRef.current, nodeKey, patch)')
    // and recomputes dirty rather than forcing it false
    expect(body).toContain('setDirty(isDirtyVsSaved(newTree))')
    expect(body, 'dirty must not be forced false any more').not.toContain('setDirty(false)')
  })
})
