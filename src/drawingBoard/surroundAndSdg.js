// surroundAndSdg.js — Step BN
//
// Two things the surveyor answers on Finish & Ironmongery, and what the
// pricing engine reads from each.
//
// ── The SURROUND ────────────────────────────────────────────────────────────
//
// Integrate keeps a PRESET on its Paint & Ironmongery part
// (autoCalcSurroundComponents) and makes a component list from it:
//
//   architrave_and_bullnose        architrave
//   architrave_and_w_board         architrave + window board
//   architrave_lining_and_w_board  linings + architrave + window board
//   architrave_bullnose_and_packer architrave (+ bullnose, packer)
//   0                              none
//
// NATHAN (16 Oct): tick boxes, not Integrate's preset list. So GlazePro asks
// the four questions independently and reaches the same rules.
//
// Only three rules read the surround, besides the architrave's own component
// cost, and every one of them is install_labour:
//
//   Linings         180 min  has_lining
//   Windowboard      30 min  has_deep_window_board
//   External Lining 180 min  loop component, part_no == external_lining
//
// `external_lining` is a VARIABLE in Integrate, not a bare string:
// docs/integrate-rules-export.txt line 126 reads `external_lining=AA03`. So
// that rule means "this component's part number is AA03". GlazePro's
// evaluator reads an unquoted word as a variable too, so defining
// external_lining = 'AA03' makes rule 252 behave exactly as Integrate's does,
// with the live rule untouched.
//
// AA01, AA02 and AA03 are Integrate's own placeholder components for the
// lining, the window board and the external lining
// (docs/integrate-part-allocator.txt lines 141-143). They carry a cost in the
// price file (50 / 30 / 75) but are allocated at measure 1 mm, and a
// `surrounds` component rounds
//
//     floor((ceil(1/10) * 10 + 50) / 100) / 10  =  floor(0.6) / 10  =  0 m
//
// so they price at ZERO. That is the brief's "placeholder length 1, width 0:
// only their labour moves", and it is why ticking Linings or Window board
// adds labour and no materials.
//
// ── EXISTING SDG / obstruction ──────────────────────────────────────────────
//
// Copy Integrate (Nathan, 16 Oct): two dropdowns, "what is below or in front
// of the existing item" and what to do with it. Integrate's own ids, wording
// and variable names.

/** The four surround questions, in the order they are asked. */
export const SURROUND_TICKS = [
  {
    key: 'surroundArchitrave',
    label: 'Architrave',
    default: true,
    hint: 'The Ogee architrave round the frame. Ticked by default: it is what GlazePro has always allocated.',
  },
  {
    key: 'surroundLinings',
    label: 'Linings',
    default: false,
    hint: 'Fires "Linings" 180 min. No material cost — Integrate\'s lining component is a placeholder.',
  },
  {
    key: 'surroundWindowBoard',
    label: 'Window board',
    default: false,
    hint: 'Fires "Windowboard" 30 min. A deep window board, which is a window board but NOT a bullnose.',
  },
  {
    key: 'surroundExternalLining',
    label: 'External lining',
    default: false,
    hint: 'Fires "External Lining" 180 min, via Integrate\'s AA03 component.',
  },
]

/** Integrate's part code for the external lining — `external_lining` = AA03. */
export const EXTERNAL_LINING_PART_CODE = 'AA03'

/** Integrate's placeholder components, by the tick that asks for them. */
export const SURROUND_PLACEHOLDER_PARTS = {
  surroundLinings:        { part_code: 'AA01', label: 'Lining (Integrate placeholder)' },
  surroundWindowBoard:    { part_code: 'AA02', label: 'Window board (Integrate placeholder)' },
  surroundExternalLining: { part_code: EXTERNAL_LINING_PART_CODE, label: 'External lining' },
}

/** The defaults a new drawing starts with: architrave only. */
export function defaultSurroundValues() {
  const out = {}
  for (const t of SURROUND_TICKS) out[t.key] = t.default
  return out
}

/**
 * Read one tick off the Finish & Ironmongery part.
 *
 * An OLDER drawing has none of these keys. It must behave exactly as it did
 * before this step, which is "architrave allocated, nothing else" — so an
 * absent value falls back to the tick's default rather than to false. That is
 * what keeps every existing drawing and every existing benchmark still.
 */
export function surroundTick(paintValues, key) {
  const tick = SURROUND_TICKS.find(t => t.key === key)
  if (!tick) return false
  const stored = paintValues?.[key]
  return stored == null ? tick.default : stored === true
}

// ── Existing SDG / obstruction ──────────────────────────────────────────────

/** Integrate's existingSurroundTypeId list, its ids and its wording. */
export const SDG_TYPES = [
  { id: 0, label: 'N/A' },
  { id: 1, label: 'Fixed SDG' },
  { id: 2, label: 'Hinged SDG' },
  { id: 3, label: 'Vertical Sliding SDG' },
  { id: 4, label: 'Horizontal Sliding SDG' },
  { id: 5, label: 'Plantation Shutters' },
  { id: 6, label: 'Shutter Boxes' },
  { id: 7, label: 'Panelling' },
  { id: 8, label: 'Security Grills' },
]

/** Integrate's existingSurroundActionId list. */
export const SDG_ACTIONS = [
  { id: 0, label: 'Leave in Situ' },
  { id: 1, label: 'Remove and Re-fit' },
  { id: 2, label: 'Remove and Dispose' },
  { id: 3, label: 'Customer to Remove' },
]

const num = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * The twelve variables Integrate's dictionary defines for "what is below or in
 * front of the existing item", from the two dropdowns.
 *
 * Which rules read them, all `frame_qty` x minutes and all install_labour:
 *
 *   Remove and Refit   Fixed / Vertical / Horizontal SDG  75
 *                      Shutters                           75
 *                      Panelling (panelling OR shutter boxes)  900
 *   Remove and Dispose Fixed / Vertical / Horizontal SDG  35
 *
 * So HINGED SDG, SECURITY GRILLS, "Leave in Situ" and "Customer to Remove"
 * fire nothing at all — there is no rule for them, and that is Integrate's
 * own gap, not a GlazePro one.
 */
export function sdgVariables(paintValues) {
  const type   = num(paintValues?.existingSurroundTypeId)
  const action = num(paintValues?.existingSurroundActionId)
  return {
    has_fixed_secondary_glazing:              type === 1,
    has_hinged_secondary_glazing:             type === 2,
    has_vertical_sliding_secondary_glazing:   type === 3,
    has_horizontal_sliding_secondary_glazing: type === 4,
    has_secondary_glazing:                    type >= 1 && type <= 4,
    has_plantation_shutters:                  type === 5,
    has_shutter_boxes:                        type === 6,
    has_panelling:                            type === 7,
    has_security_grills:                      type === 8,
    has_sdg_or_panel:                         type !== 0,
    remove_and_refit_existing_sdg_or_panel:   action === 1,
    remove_and_dispose_existing_sdg_or_panel: action === 2,
  }
}
