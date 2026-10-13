// drawingBoardScope.test.jsx — Step AY hotfix
//
// The outage: Step AY item 4 added `profile?.code` to two computeVariables
// calls inside ValidationPanel and IronmongeryPanel, where `profile` is
// DrawingBoard's own state and is NOT in scope. ValidationPanel threw a
// ReferenceError on every render, so every drawing board page showed
// "Drawing Board error — profile is not defined"; IronmongeryPanel threw the
// same error into a try/catch, so default ironmongery silently got no
// variables at all and every default rule's condition failed.
//
// Two nets, because the two failures are different shapes:
//
//   1. ESLINT no-undef over src/. This is what would have caught BOTH, and
//      it already existed — `npm run lint` reports exactly
//      "'profile' is not defined" on both lines. It was not run. It cannot
//      be a gate as it stands, because src/ has ~100 pre-existing errors of
//      other kinds (unused vars, react-hooks rules), so this test fails on
//      the REFERENCE rules alone and ignores the rest.
//
//   2. A render test for the panel that took the board down. A scope error
//      in a component's render body fails this immediately, with no DOM and
//      no lint config in the way.

import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { renderToStaticMarkup } from 'react-dom/server'
import { ValidationPanel, IronmongeryPanel } from './DrawingBoard.jsx'

// ── 1. No undefined identifiers anywhere in src/ ────────────────────────────

describe('Step AY hotfix — no undefined identifiers in src/', () => {
  // The rules that catch "this name is not in scope here". Everything else
  // eslint reports is left alone: this test is a net for one class of bug,
  // not a tidy-up of the whole codebase.
  const REFERENCE_RULES = ['no-undef', 'no-obj-calls', 'no-const-assign', 'no-class-assign']

  it('eslint reports no reference errors (this is what would have caught the outage)', async () => {
    // The repo root, from this file — not process.cwd(). src/ is linted as
    // BROWSER code, where `process` is not defined, so reaching for it here
    // would make this very test fail its own check. It did, on the first run,
    // which is the net working.
    const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
    const { ESLint } = await import('eslint')
    const eslint = new ESLint({ cwd: ROOT })
    const results = await eslint.lintFiles(['src'])

    const found = []
    for (const file of results) {
      for (const m of file.messages) {
        if (m.severity !== 2 || !REFERENCE_RULES.includes(m.ruleId)) continue
        const rel = file.filePath.replace(ROOT, '').replace(/\\/g, '/').replace(/^\//, '')
        found.push(`${rel}:${m.line}:${m.column} ${m.message} (${m.ruleId})`)
      }
    }
    // Named, not counted: the message has to say WHERE, because that is the
    // whole value of the net.
    expect(found, found.join('\n')).toEqual([])
  }, 120_000)
})

// ── 2. The panels mount ─────────────────────────────────────────────────────

describe('Step AY hotfix — the board’s panels render', () => {
  // The smallest tree the panels will accept: a casement frame with one sash.
  const TREE = {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: { typeOfWork: 'complete_new', quantity: 1 },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: { ironmongeryFinish: 'PB', ironmongeryLines: [] },
        children: [],
      },
      {
        key: 'frame1',
        part_type: 'assemblyFramePart',
        values: {
          width: 1200, height: 1300, leftWidth: 37, rightWidth: 37,
          topHeight: 47, bottomHeight: 47, frameDepth: 96,
        },
        children: [
          {
            key: 'cas1',
            part_type: 'casementSashPart',
            values: {
              operation: 'left_hand_hung', casementTypeId: 'open_out',
              thickness: 54, topHeight: 62, leftWidth: 62, rightWidth: 62,
              bottomHeight: 83, mechanicalClearanceLeft: 4,
              mechanicalClearanceRight: 4, mechanicalClearanceTop: 4,
              mechanicalClearanceBottom: 4, toBeReplaced: true,
            },
            children: [{ key: 'glass1', part_type: 'glassPart', values: {}, children: [] }],
          },
          { key: 'cill1', part_type: 'cillPart', values: { height: 47, depth: 128 }, children: [] },
        ],
      },
    ],
  }

  it('ValidationPanel renders — the outage was a ReferenceError here', () => {
    // On the broken build this threw "profile is not defined" and the whole
    // page showed "Drawing Board error".
    expect(() => renderToStaticMarkup(
      createElement(ValidationPanel, { tree: TREE, derived: {}, onSelectKey: () => {} }),
    )).not.toThrow()
  })

  it('ValidationPanel renders with a profileCode, and without one', () => {
    for (const profileCode of ['sashes_only', 'casement', null, undefined]) {
      expect(() => renderToStaticMarkup(
        createElement(ValidationPanel, {
          tree: TREE, derived: {}, onSelectKey: () => {}, profileCode,
        }),
      ), String(profileCode)).not.toThrow()
    }
  })

  it('ValidationPanel renders with no tree at all', () => {
    expect(() => renderToStaticMarkup(
      createElement(ValidationPanel, { tree: null, derived: null, onSelectKey: () => {} }),
    )).not.toThrow()
  })

  it('IronmongeryPanel renders', () => {
    const node = TREE.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    expect(() => renderToStaticMarkup(
      createElement(IronmongeryPanel, {
        node, tree: TREE, derived: {}, refOptions: {},
        onChangeField: () => {}, onAutoApplyDefaults: () => {},
        ironmongeryRules: [], ironmongeryProducts: [],
        profileValueMap: {}, profileCode: 'casement',
      }),
    )).not.toThrow()
  })

  it('both panels take the profile code as a PROP, not from a closure', () => {
    // The fix, stated as a property of the components: each accepts
    // profileCode and neither reads a `profile` it does not own. Rendering
    // them in isolation — with no DrawingBoard around them — is what proves
    // it, because a closure read would have nothing to close over.
    expect(ValidationPanel.length, 'ValidationPanel takes one props object').toBe(1)
    expect(IronmongeryPanel.length, 'IronmongeryPanel takes one props object').toBe(1)
    const node = TREE.children.find(c => c.part_type === 'paintAndIronmongeryPart')
    const markup = renderToStaticMarkup(createElement('div', null,
      createElement(ValidationPanel, { tree: TREE, derived: {}, onSelectKey: () => {}, profileCode: 'sashes_only' }),
      createElement(IronmongeryPanel, {
        node, tree: TREE, derived: {}, refOptions: {},
        onChangeField: () => {}, onAutoApplyDefaults: () => {},
        ironmongeryRules: [], ironmongeryProducts: [],
        profileValueMap: {}, profileCode: 'sashes_only',
      }),
    ))
    expect(markup.length).toBeGreaterThan(0)
  })
})
