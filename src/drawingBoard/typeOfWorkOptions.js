// typeOfWorkOptions.js — which Types of Work a drawing may be set to.
//
// Step BJ follow-up. This used to be three lines inside `PropertyField`, and
// the blocker it caused is why it is a module: a casement drawing's Type of
// Work select offered only Complete New and No Work, so Bi-Glass could not be
// chosen at all and `applyBiGlassCasement` was unreachable from the board.
// Step BJ's own tests drove the rule directly and never went through the
// select, so nothing caught it.
//
// Pulled out here so it can be tested at the level the reviewer hit — the
// OPTIONS a drawing offers — without a DOM. `PropertyField` calls this and
// renders what it returns, so the test and the select cannot disagree.
//
// THE RULE, as Step AP set it and this step widens it:
//
//   a BOX SASH (or anything this does not recognise) — every option, as
//     before. New Pair of Sashes, Draught Seal, Bi-Glass and Cill Only are
//     all sash-window services and all belong here.
//
//   a CASEMENT or DOOR frame — Complete New and No Work only. Every other
//     type of work is a sash-window service, and the sash-only board rules
//     (sashThickness, sashesReplaced, internalSize, cillReplacement) are
//     gated on isSashWindow so they never run here.
//
//   ... PLUS BI-GLASS where a switch would actually apply and price, which
//     is `canBeBiGlass`: a casement WINDOW, never a door, never a French
//     casement pair, never a direct-glazed-only frame. The reasons are in
//     biGlassCasement.js, and the predicate is shared with the rule itself
//     so the control and the behaviour cannot drift apart.

import { isCasementFrameTree } from './casementOpenings.js'
import { canBeBiGlass } from './biGlassCasement.js'

/** What a casement or door frame may be, before bi-glass is considered. */
export const CASEMENT_TYPES_OF_WORK = ['complete_new', 'no_work']

export const BI_GLASS_CODE = 'bi_glass'

/**
 * Filter a Type of Work reference list for this drawing.
 *
 * @param {Object} tree     the drawing's part tree
 * @param {Array}  options  reference_options rows for `type_of_work`
 * @returns {Array} the rows to render, in the order given
 */
export function typeOfWorkOptionsFor(tree, options) {
  const opts = options ?? []
  // A box sash, a spiral, or anything with no frame at all: unchanged.
  if (!isCasementFrameTree(tree)) return opts

  const allowed = canBeBiGlass(tree)
    ? [...CASEMENT_TYPES_OF_WORK, BI_GLASS_CODE]
    : CASEMENT_TYPES_OF_WORK

  return opts.filter(o => allowed.includes(o.code))
}

/**
 * Just the codes, for a test or a log that does not care about labels.
 */
export function typeOfWorkCodesFor(tree, options) {
  return typeOfWorkOptionsFor(tree, options).map(o => o.code)
}
