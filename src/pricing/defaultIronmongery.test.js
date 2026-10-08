import { describe, it, expect } from 'vitest'
import { defaultIronmonger } from './defaultIronmongery'
// Profile rebate/tolerance for the measured sash-weight glass cut (Sash profile: 14 / 2)
const PV = { defaultDoubleGlazingRebateWidthForSash: 14, defaultDoubleGlazingTolerance: 2 }

// ── Fixture tree — L34046 Item 7 (same as partAllocator.test.js) ──────────────
const FIXTURE_TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:      'complete_new',
    sashMaterialId:  'solid_redwood',
    frameMaterialId: 'solid_redwood',
    cillMaterialId:  'solid_utile_hardwood',
    floorLevel:      'ground_floor',
    decoration:      false,
  },
  children: [
    {
      key: 'notes1',
      part_type: 'notesPart',
      values: { installationMethod: 'internally' },
      children: [],
    },
    {
      key: 'frame1',
      part_type: 'assemblyFramePart',
      values: {
        width: 1075, height: 1630, topHeight: 79,
        leftWidth: 85, rightWidth: 85, frameDepth: 165,
        leftOuterJamb: 101, rightOuterJamb: 101,
        leftCillHorn: 50, rightCillHorn: 50,
        outerWidth: 1255, outerHeight: 1775,
      },
      children: [
        {
          key: 'cill1',
          part_type: 'cillPart',
          values: { height: 70, depth: 200, profiledHeight: 45 },
          children: [],
        },
        {
          key: 'pair1',
          part_type: 'sashPairPart',
          values: {
            sashThickness: 45, midrailHeight: 40,
            topHornTypeShortName: 'victorian',
            bottomHornTypeShortName: 'none',
          },
          children: [
            {
              key: 'top1',
              part_type: 'topSashPart',
              values: { topHeight: 49, leftWidth: 47, rightWidth: 47, operation: 'cord_hung', toBeReplaced: null },
              children: [
                {
                  key: 'glass1',
                  part_type: 'glassPart',
                  values: {
                    glazingId: 'double_glazed', barsWide: 2, barsHigh: 1,
                    internalGlassPartNo: 'GL100010', externalGlassPartNo: 'GL100080', spacerHeight: 16,
                  },
                  children: [],
                },
              ],
            },
            {
              key: 'bot1',
              part_type: 'bottomSashPart',
              values: { bottomHeight: 88, leftWidth: 47, rightWidth: 47, operation: 'cord_hung', toBeReplaced: null },
              children: [
                {
                  key: 'glass2',
                  part_type: 'glassPart',
                  values: {
                    glazingId: 'double_glazed', barsWide: 2, barsHigh: 1,
                    internalGlassPartNo: 'GL100010', externalGlassPartNo: 'GL100080', spacerHeight: 16,
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

// ── Item 7 base variables ─────────────────────────────────────────────────────
const BASE_VARS = {
  is_complete_new:      true,
  is_cord_hung:         true,
  frame_to_be_replaced: true,
  is_sw:                true,
  is_box_sash:          true,
  door_leaf_qty:        0,
  is_front_door:        false,
  is_heritage_range:    false,
}

// ── Minimal default ironmongery rules for Item 7 ──────────────────────────────
// Converted from Integrate format: [var] → var, && → and, || → or, ! → not
const ITEM7_RULES = [
  {
    id: 'ir0', sort_order: 0, group_name: 'sash_windows', loop_target: 'sliding_sash',
    label: 'Box Frame',
    condition: 'is_complete_new and is_cord_hung',
    qty_expr: '0.5',
    product_short_name: 'z-claw_fastener_kit_wpulleys',
    finish_code: 'PB',
    rule_family: 'default_ironmongery', is_active: true,
  },
  {
    id: 'ir50', sort_order: 50, group_name: 'sash_windows', loop_target: null,
    label: 'Trickle Vent',
    condition: 'frame_to_be_replaced and not is_front_door and not is_heritage_range',
    qty_expr: '1',
    product_short_name: 'trickle_vent_xr16',
    finish_code: 'Wht',
    rule_family: 'default_ironmongery', is_active: true,
  },
]

// ── A rule that should be inactive ────────────────────────────────────────────
const INACTIVE_RULE = {
  id: 'ir20', sort_order: 20, group_name: 'sash_windows', loop_target: null,
  label: 'Yorkshire',
  condition: 'is_yorkshire_sash_window',
  qty_expr: '1',
  product_short_name: 'yorkshire_sash_kit',
  finish_code: 'PB',
  rule_family: 'default_ironmongery', is_active: false,
}

describe('defaultIronmonger — Item 7 (complete new, cord hung)', () => {
  it('allocates z-claw_fastener_kit_wpulleys with an EMPTY finish (follows the item finish) and qty 1 (0.5 × 2 sashes)', () => {
    // Step Z: default lines no longer carry the rule's own metal finish —
    // empty means "use the item's ironmongery finish", resolved at
    // pricing/display time
    const result = defaultIronmonger(FIXTURE_TREE, BASE_VARS, ITEM7_RULES, {}, PV)
    const claw = result.find(l => l.product_short_name === 'z-claw_fastener_kit_wpulleys')
    expect(claw).toBeDefined()
    expect(claw.finish_code).toBe('')
    expect(claw.qty).toBeCloseTo(1.0, 6)
  })

  it('allocates trickle_vent_xr16 Wht with qty 1', () => {
    const result = defaultIronmonger(FIXTURE_TREE, BASE_VARS, ITEM7_RULES, {}, PV)
    const vent = result.find(l => l.product_short_name === 'trickle_vent_xr16')
    expect(vent).toBeDefined()
    expect(vent.finish_code).toBe('Wht')
    expect(vent.qty).toBeCloseTo(1.0, 6)
  })

  it('returns exactly two lines for Item 7', () => {
    const result = defaultIronmonger(FIXTURE_TREE, BASE_VARS, ITEM7_RULES, {}, PV)
    expect(result).toHaveLength(2)
  })

  it('skips inactive rules', () => {
    const result = defaultIronmonger(FIXTURE_TREE, BASE_VARS, [...ITEM7_RULES, INACTIVE_RULE], {}, PV)
    const yorkshire = result.find(l => l.product_short_name === 'yorkshire_sash_kit')
    expect(yorkshire).toBeUndefined()
  })
})

describe('defaultIronmonger — condition failures', () => {
  it('does not allocate claw fastener when is_complete_new is false', () => {
    const repairVars = { ...BASE_VARS, is_complete_new: false }
    const result = defaultIronmonger(FIXTURE_TREE, repairVars, ITEM7_RULES, {}, PV)
    const claw = result.find(l => l.product_short_name === 'z-claw_fastener_kit_wpulleys')
    expect(claw).toBeUndefined()
  })

  it('does not allocate trickle vent when is_front_door', () => {
    const doorVars = { ...BASE_VARS, is_front_door: true }
    const result = defaultIronmonger(FIXTURE_TREE, doorVars, ITEM7_RULES, {}, PV)
    const vent = result.find(l => l.product_short_name === 'trickle_vent_xr16')
    expect(vent).toBeUndefined()
  })
})
