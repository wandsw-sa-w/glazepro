/**
 * computeVariables.test.js
 * Vitest unit tests for the new tree-based computeVariables function.
 */

import { describe, it, expect } from 'vitest'
import { computeVariables, computeQuoteVariables } from './computeVariables.js'
import { computeDerived } from '../drawingBoard/computeDerived.js'

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeBoxSashTree(overrides = {}) {
  return {
    key: 'item1',
    part_type: 'drawingItemPart',
    values: {
      typeOfWork:       'complete_new',
      frameMaterialId:  'softwood',
      sashMaterialId:   'softwood',
      cillMaterialId:   'utile',
      fitToPreparedOpening: false,
      decoration:       false,
      ...overrides.item,
    },
    children: [
      {
        key: 'paint1',
        part_type: 'paintAndIronmongeryPart',
        values: {
          internalFinish: 'clean_white',
          externalFinish: 'clean_white',
          cillFinish:     'clean_white',
          ...overrides.paint,
        },
        children: [],
      },
      {
        key: 'frame1',
        part_type: 'assemblyFramePart',
        values: {
          width:          1075,
          height:         1630,
          topHeight:      79,
          leftWidth:      85,
          rightWidth:     85,
          frameDepth:     165,
          jambType:       'solid_profiled',
          leftOuterJamb:  101,
          rightOuterJamb: 101,
          leftCillHorn:   50,
          rightCillHorn:  50,
          ...overrides.frame,
        },
        children: [
          {
            key: 'cill1',
            part_type: 'cillPart',
            values: {
              height: 70,
              depth:  200,
              ...overrides.cill,
            },
            children: [],
          },
          {
            key: 'pair1',
            part_type: 'sashPairPart',
            values: {
              sashThickness:             45,
              midrailHeight:             40,
              mechanicalClearanceLeft:   2.5,
              mechanicalClearanceRight:  2.5,
              mechanicalClearanceTop:    0,
              mechanicalClearanceBottom: 0,
              topHornTypeShortName:    'victorian',
              bottomHornTypeShortName: 'none',
              sashSplit:               'half_half',
              ...overrides.pair,
            },
            children: [
              {
                key: 'top1',
                part_type: 'topSashPart',
                values: {
                  topHeight:    49,
                  leftWidth:    47,
                  rightWidth:   47,
                  operation:    'cord_hung',
                  toBeReplaced: null,
                  ...overrides.topSash,
                },
                children: [
                  {
                    key: 'glass1',
                    part_type: 'glassPart',
                    values: {
                      glazingId:         'double_glazing',
                      isIndividualPanes: false,
                      spacerDimId:       '16mm_white_warm_edge',
                      ...overrides.topGlass,
                    },
                    children: [],
                  },
                ],
              },
              {
                key: 'bot1',
                part_type: 'bottomSashPart',
                values: {
                  bottomHeight: 88,
                  leftWidth:    47,
                  rightWidth:   47,
                  operation:    'cord_hung',
                  toBeReplaced: null,
                  ...overrides.botSash,
                },
                children: [
                  {
                    key: 'glass2',
                    part_type: 'glassPart',
                    values: {
                      glazingId:         'double_glazing',
                      isIndividualPanes: false,
                      spacerDimId:       '16mm_white_warm_edge',
                      ...overrides.botGlass,
                    },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeVariables — box sash complete new (solid redwood / utile cill)', () => {
  const tree    = makeBoxSashTree()
  const derived = computeDerived(tree)
  const vars    = computeVariables(tree, derived)

  it('returns a non-null object', () => {
    expect(vars).not.toBeNull()
    expect(typeof vars).toBe('object')
  })

  it('detects box sash window type', () => {
    expect(vars.is_box_sash).toBe(true)
    expect(vars.is_sash_window).toBe(true)
    expect(vars.is_casement_window).toBe(false)
    expect(vars.is_door).toBe(false)
  })

  it('detects complete_new service type', () => {
    expect(vars.is_complete_new).toBe(true)
    expect(vars.nj_involved).toBe(true)
    expect(vars.frame_to_be_replaced).toBe(true)
    expect(vars.is_sash_replacement).toBe(false)
  })

  it('detects solid redwood frame material', () => {
    expect(vars.is_frame_redwood).toBe(true)
    expect(vars.is_solid_redwood_frame).toBe(true)
    expect(vars.is_frame_accoya).toBe(false)
    expect(vars.is_sash_redwood).toBe(true)
  })

  it('detects solid utile hardwood cill', () => {
    expect(vars.is_cill_hardwood).toBe(true)
    expect(vars.is_solid_utile_hardwood_cill).toBe(true)
    expect(vars.is_cill_accoya).toBe(false)
  })

  it('detects cord hung operations on both sashes', () => {
    expect(vars.is_top_sash_cord_hung).toBe(true)
    expect(vars.is_bottom_sash_cord_hung).toBe(true)
    expect(vars.has_cord_hung_sash).toBe(true)
    expect(vars.is_cord_hung).toBe(true)
    expect(vars.is_top_sash_spiral_hung).toBe(false)
    expect(vars.is_top_sash_fixed).toBe(false)
  })

  it('detects victorian horn on top sash only', () => {
    expect(vars.is_top_sash_victorian_horn).toBe(true)
    expect(vars.is_bottom_sash_victorian_horn).toBe(false)
    expect(vars.has_victorian_horn).toBe(true)
    expect(vars.horn_count).toBe(1)
  })

  it('detects double glazed glass', () => {
    expect(vars.is_double_glazed).toBe(true)
    expect(vars.is_single_glazed).toBe(false)
  })

  it('has correct sliding sash counts for complete_new', () => {
    expect(vars.sliding_sash_qty).toBe(2)
    expect(vars.new_sliding_sash_qty).toBe(2)
    expect(vars.frame_qty).toBe(1)
    expect(vars.new_frame_qty).toBe(1)
    // complete_new includes the cill via frame_to_be_replaced; new_cill_qty is for cill-only replacements
    expect(vars.new_cill_qty).toBe(0)
  })

  it('has correct frame dimensions', () => {
    // frame_width/height are OUTER dimensions: inner + leftWidth + rightWidth / inner + topHeight + cill.height
    // 1075 + 85 + 85 = 1245, 1630 + 79 + 70 = 1779
    expect(vars.frame_width).toBe(1245)
    expect(vars.frame_height).toBe(1779)
    expect(vars.frame_width_in_mm).toBe(1245)
    expect(vars.frame_height_in_mm).toBe(1779)
  })

  it('has non-zero timber volumes for complete_new redwood', () => {
    expect(vars.frame_excl_cill_volume_m3).toBeGreaterThan(0)
    expect(vars.redwood_frame_volume_m3).toBeGreaterThan(0)
    expect(vars.accoya_frame_volume_m3).toBe(0)
    expect(vars.cill_volume_m3).toBeGreaterThan(0)
    expect(vars.hardwood_cill_volume_m3).toBeGreaterThan(0)
    expect(vars.accoya_cill_volume_m3).toBe(0)
    expect(vars.total_sash_volume_m3).toBeGreaterThan(0)
    expect(vars.redwood_sash_volume_m3).toBeGreaterThan(0)
    expect(vars.accoya_sash_volume_m3).toBe(0)
  })

  it('has clean_white finish flags', () => {
    expect(vars.is_internal_clean_white).toBe(true)
    expect(vars.is_external_clean_white).toBe(true)
    expect(vars.is_painted).toBe(false)
    expect(vars.is_standard_finish_internally_and_externally).toBe(true)
  })
})

describe('computeVariables — sash replacement, accoya frame', () => {
  const tree = makeBoxSashTree({
    item: {
      typeOfWork:      'new_pair_of_sashes',
      frameMaterialId: 'accoya',
      sashMaterialId:  'accoya',
      cillMaterialId:  'utile',
    },
    topSash: { toBeReplaced: true },
    botSash: { toBeReplaced: true },
  })
  const derived = computeDerived(tree)
  const vars    = computeVariables(tree, derived)

  it('is not complete_new', () => {
    expect(vars.is_complete_new).toBe(false)
  })

  it('detects accoya frame material', () => {
    expect(vars.is_frame_accoya).toBe(true)
    expect(vars.is_accoya_frame).toBe(true)
    expect(vars.is_frame_redwood).toBe(false)
  })

  it('detects accoya sash material', () => {
    expect(vars.is_sash_accoya).toBe(true)
    expect(vars.is_accoya_sash).toBe(true)
  })

  it('counts 2 new_sliding_sash_qty from toBeReplaced flags', () => {
    expect(vars.new_sliding_sash_qty).toBe(2)
    expect(vars.new_frame_qty).toBe(0)
    expect(vars.new_cill_qty).toBe(0)
  })

  it('has zero frame volume (not complete_new)', () => {
    expect(vars.frame_excl_cill_volume_m3).toBe(0)
    expect(vars.cill_volume_m3).toBe(0)
  })

  it('has non-zero accoya sash volume', () => {
    expect(vars.accoya_sash_volume_m3).toBeGreaterThan(0)
    expect(vars.redwood_sash_volume_m3).toBe(0)
  })

  it('has nj_involved true', () => {
    expect(vars.nj_involved).toBe(true)
  })
})

describe('computeVariables — null / empty tree', () => {
  it('returns null for null tree', () => {
    const result = computeVariables(null, {})
    expect(result).toBeNull()
  })

  it('returns null for undefined tree', () => {
    const result = computeVariables(undefined, {})
    expect(result).toBeNull()
  })
})

describe('computeVariables — Integrate aliases present', () => {
  const tree    = makeBoxSashTree()
  const derived = computeDerived(tree)
  const vars    = computeVariables(tree, derived)

  it('is_sw === is_box_sash', () => {
    expect(vars.is_sw).toBe(vars.is_box_sash)
  })

  it('is_accoya_frame === is_frame_accoya', () => {
    expect(vars.is_accoya_frame).toBe(vars.is_frame_accoya)
  })

  it('is_accoya_sash === is_sash_accoya', () => {
    expect(vars.is_accoya_sash).toBe(vars.is_sash_accoya)
  })

  it('is_cord_hung === has_cord_hung_sash', () => {
    expect(vars.is_cord_hung).toBe(vars.has_cord_hung_sash)
  })

  it('frame_width_in_mm === frame_width', () => {
    expect(vars.frame_width_in_mm).toBe(vars.frame_width)
  })

  it('frame_height_in_mm === frame_height', () => {
    expect(vars.frame_height_in_mm).toBe(vars.frame_height)
  })
})

describe('computeVariables — sliding sash counts for complete_new', () => {
  const tree = makeBoxSashTree()
  const derived = computeDerived(tree)
  const vars    = computeVariables(tree, derived)

  it('new_sliding_sash_qty is 2 for complete_new with 1 pair', () => {
    expect(vars.new_sliding_sash_qty).toBe(2)
  })

  it('sliding_sash_qty is 2 for 1 pair', () => {
    expect(vars.sliding_sash_qty).toBe(2)
  })

  it('fixed_sliding_sash_qty is 0 for cord hung sashes', () => {
    expect(vars.fixed_sliding_sash_qty).toBe(0)
  })
})

describe('computeVariables — fixed sash detection', () => {
  const tree = makeBoxSashTree({
    topSash: { operation: 'fix' },
    botSash: { operation: 'cord_hung' },
  })
  const derived = computeDerived(tree)
  const vars    = computeVariables(tree, derived)

  it('detects top sash as fixed', () => {
    expect(vars.is_top_sash_fixed).toBe(true)
    expect(vars.is_top_sash_cord_hung).toBe(false)
  })

  it('fixed_sliding_sash_qty is 1', () => {
    expect(vars.fixed_sliding_sash_qty).toBe(1)
  })

  it('opening_sash_count is 1', () => {
    expect(vars.opening_sash_count).toBe(1)
    expect(vars.fixed_sash_count).toBe(1)
  })
})

describe('computeVariables — floor level flags', () => {
  function makeWithFloor(floorLevel) {
    const tree    = makeBoxSashTree({ item: { floorLevel } })
    const derived = computeDerived(tree)
    return computeVariables(tree, derived)
  }

  it('ground floor', () => {
    const v = makeWithFloor('ground_floor')
    expect(v.is_ground_floor).toBe(true)
    expect(v.is_floor_set_as_ground_floor).toBe(true)
    expect(v.is_first_floor).toBe(false)
    expect(v.is_upper_floor).toBe(false)
  })

  it('first floor', () => {
    const v = makeWithFloor('first_floor')
    expect(v.is_first_floor).toBe(true)
    expect(v.is_upper_floor).toBe(true)
    expect(v.is_ground_floor).toBe(false)
  })

  it('second floor', () => {
    const v = makeWithFloor('second_floor')
    expect(v.is_second_floor).toBe(true)
    expect(v.is_upper_floor).toBe(true)
  })

  it('half landing', () => {
    const v = makeWithFloor('half_landing')
    expect(v.is_half_landing).toBe(true)
    expect(v.is_floor_set_as_half_landing).toBe(true)
  })
})

describe('computeVariables — glazing bars (6-over-6)', () => {
  const tree = makeBoxSashTree({
    topGlass: { barsWide: 2, barsHigh: 1 },
    botGlass: { barsWide: 2, barsHigh: 1 },
  })
  const derived = computeDerived(tree)
  const vars    = computeVariables(tree, derived)

  it('detects has_glazing_bars', () => {
    expect(vars.has_glazing_bars).toBe(true)
  })

  it('counts 3 bars per sash (2 wide + 1 high)', () => {
    expect(vars.top_sash_glazing_bar_count).toBe(3)
    expect(vars.bottom_sash_glazing_bar_count).toBe(3)
    expect(vars.total_glazing_bar_count).toBe(6)
  })

  it('gb_to_be_replaced_qty is 6 for complete_new with 6-over-6', () => {
    expect(vars.gb_to_be_replaced_qty).toBe(6)
  })

  it('pane count is 6 per sash (3 cols × 2 rows)', () => {
    expect(vars.top_sash_pane_count).toBe(6)
    expect(vars.bottom_sash_pane_count).toBe(6)
    expect(vars.total_pane_count).toBe(12)
  })
})

describe('computeVariables — new_cill_qty for cill-only replacement', () => {
  it('is 1 when cill.toBeReplaced=true and not complete_new', () => {
    const tree = makeBoxSashTree({
      item: { typeOfWork: 'draught_seal' },
      cill: { toBeReplaced: true },
    })
    const derived = computeDerived(tree)
    const vars    = computeVariables(tree, derived)
    expect(vars.new_cill_qty).toBe(1)
    expect(vars.is_complete_new).toBe(false)
  })

  it('is 0 for complete_new even without cill.toBeReplaced', () => {
    const tree    = makeBoxSashTree()
    const derived = computeDerived(tree)
    const vars    = computeVariables(tree, derived)
    expect(vars.new_cill_qty).toBe(0)
    expect(vars.is_complete_new).toBe(true)
  })
})

// ── New validation-unblocking variables ─────────────────────────────────────

describe('computeVariables — is_solid_redwood_cill', () => {
  it('is true when cillMaterialId is solid_redwood', () => {
    const tree = makeBoxSashTree({ item: { cillMaterialId: 'softwood' } })
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived)
    expect(vars.is_solid_redwood_cill).toBe(true)
  })

  it('is false when cillMaterialId is solid_utile_hardwood', () => {
    const tree = makeBoxSashTree()
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived)
    expect(vars.is_solid_redwood_cill).toBe(false)
  })
})

describe('computeVariables — glass_unit_thickness (item-level)', () => {
  it('is 0 when no pane thicknesses are set', () => {
    const tree = makeBoxSashTree()
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived)
    // No innerPaneThickness/outerPaneThickness/spacerHeight on glassPart
    expect(vars.glass_unit_thickness).toBe(0)
  })

  it('computes correctly when pane thicknesses and spacer are set', () => {
    const tree = makeBoxSashTree({
      topGlass: { innerPaneThickness: 4, outerPaneThickness: 4, spacerHeight: 16 },
    })
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived)
    expect(vars.glass_unit_thickness).toBe(24)  // 4 + 16 + 4
  })
})

describe('computeVariables — frame_depth', () => {
  it('comes from the frame part in metres', () => {
    const tree = makeBoxSashTree()
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived)
    expect(vars.frame_depth).toBe(0.165)  // 165mm -> 0.165m
  })
})

describe('computeVariables — is_docl alias', () => {
  it('is false when isDocL not set', () => {
    const tree = makeBoxSashTree()
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived)
    expect(vars.is_docl).toBe(false)
    expect(vars.is_doc_l).toBe(false)
  })

  it('is true when item isDocL is true (the key the board stores)', () => {
    const tree = makeBoxSashTree({ item: { isDocL: true } })
    const derived = computeDerived(tree)
    const vars = computeVariables(tree, derived)
    expect(vars.is_docl).toBe(true)
    expect(vars.is_doc_l).toBe(true)
  })
})

describe('computeVariables — oak and idigbo material flags', () => {
  it('detects oak cill', () => {
    const tree = makeBoxSashTree({ item: { cillMaterialId: 'oak' } })
    const vars = computeVariables(tree, computeDerived(tree))
    expect(vars.is_oak_cill).toBe(true)
  })

  it('detects idigbo frame and sash', () => {
    const tree = makeBoxSashTree({
      item: { frameMaterialId: 'idigbo', sashMaterialId: 'idigbo' },
    })
    const vars = computeVariables(tree, computeDerived(tree))
    expect(vars.is_idigbo_frame).toBe(true)
    expect(vars.is_idigbo_sash).toBe(true)
  })
})

describe('computeVariables — glass_unit_qty', () => {
  it('counts glass parts in the tree', () => {
    const tree = makeBoxSashTree()
    const vars = computeVariables(tree, computeDerived(tree))
    expect(vars.glass_unit_qty).toBe(2)  // 1 top + 1 bottom
  })
})

describe('computeVariables — cill_depth and cill_height', () => {
  it('computes cill dimensions in metres', () => {
    const tree = makeBoxSashTree()
    const vars = computeVariables(tree, computeDerived(tree))
    expect(vars.cill_depth).toBe(0.2)   // 200mm -> 0.2m
    expect(vars.cill_height).toBe(0.07) // 70mm -> 0.07m
  })
})

describe('computeVariables — gb_qty alias', () => {
  it('equals total_glazing_bar_count', () => {
    const tree = makeBoxSashTree({
      topGlass: { barsWide: 2, barsHigh: 1 },
      botGlass: { barsWide: 2, barsHigh: 1 },
    })
    const vars = computeVariables(tree, computeDerived(tree))
    expect(vars.gb_qty).toBe(vars.total_glazing_bar_count)
    expect(vars.gb_qty).toBe(6)
  })
})

describe('computeVariables — sash_thickness alias', () => {
  it('equals sashThickness from pair', () => {
    const tree = makeBoxSashTree()
    const vars = computeVariables(tree, computeDerived(tree))
    expect(vars.sash_thickness).toBe(45)
  })
})

describe('computeVariables — new_sash_with_curved_head_qty', () => {
  it('is 0 when no curved heads', () => {
    const tree = makeBoxSashTree()
    const vars = computeVariables(tree, computeDerived(tree))
    expect(vars.new_sash_with_curved_head_qty).toBe(0)
  })
})

describe('computeVariables — stub variables present', () => {
  const tree = makeBoxSashTree()
  const vars = computeVariables(tree, computeDerived(tree))

  it('surround_row_qty is 0', () => expect(vars.surround_row_qty).toBe(0))
  it('encapsulated_leaded_light_qty is 0', () => expect(vars.encapsulated_leaded_light_qty).toBe(0))
  it('eq_glazing_is_out is false', () => expect(vars.eq_glazing_is_out).toBe(false))
  it('is_survey_drawing is false', () => expect(vars.is_survey_drawing).toBe(false))
  it('is_surveyor_specified is false', () => expect(vars.is_surveyor_specified).toBe(false))
  it('has_unmodified_default_measurement is false', () => expect(vars.has_unmodified_default_measurement).toBe(false))
  it('internal_finish and external_finish are set', () => {
    expect(vars.internal_finish).toBe('clean_white')
    expect(vars.external_finish).toBe('clean_white')
  })
})

// ── Quote-level variables ───────────────────────────────────────────────────

describe('computeQuoteVariables', () => {
  it('counts items', () => {
    const tree1 = makeBoxSashTree()
    const tree2 = makeBoxSashTree({ item: { cillMaterialId: 'softwood' } })
    const vars1 = computeVariables(tree1, computeDerived(tree1))
    const vars2 = computeVariables(tree2, computeDerived(tree2))
    const qv = computeQuoteVariables([vars1, vars2])

    expect(qv.item_qty).toBe(2)
    expect(qv.item_installed_by_us_qty).toBe(2)
    expect(qv.item_qty_with_solid_redwood_cill).toBe(1)
    expect(qv.item_qty_with_solid_utile_hardwood_cill).toBe(1)
  })

  it('defaults quote_margin to 1000', () => {
    const qv = computeQuoteVariables([])
    expect(qv.quote_margin).toBe(1000)
  })

  it('uses quoteContext overrides', () => {
    const qv = computeQuoteVariables([], {
      status: 'draft',
      pricefileNo: 30,
      latestPricefileNo: 31,
      isPricefileRetired: true,
      quoteMargin: 1100,
    })
    expect(qv.is_open_quote).toBe(false)
    expect(qv.quote_pricefile_no).toBe(30)
    expect(qv.latest_pricefile_no).toBe(31)
    expect(qv.is_pricefile_retired).toBe(true)
    expect(qv.quote_margin).toBe(1100)
    expect(qv.user_can_access_all_quotes).toBe(true)
  })

  it('installation_labour_time uses totalInstallMinutes from context', () => {
    const qv = computeQuoteVariables([], { totalInstallMinutes: 450 })
    expect(qv.installation_labour_time).toBe(7.5) // 450 / 60
  })

  it('installation_labour_time falls back to 0 when no context', () => {
    const qv = computeQuoteVariables([])
    expect(qv.installation_labour_time).toBe(0)
  })
})
