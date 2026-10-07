/**
 * fixtureL34046.js
 * L34046 Item 7 — Complete new box sash window.
 * Extracted from PricingBenchmark.jsx so page and tests share the same fixture.
 */

// ── Part cost map (from integrate-part-allocator.txt "Referenced parts") ──────
const PART_COST_MAP = {
  TP68: 2.85,   // Ogee Architrave 20x70 MDF £2.85/m
  TP74: 4.50,   // Chamfered Architrave 20x70 MDF £4.50/m
  TT69: 2.59,   // Pencil Round Architrave 20x70 MDF £2.59/m
  TP61: 2.76,   // Nosing 25x50 Redwood £2.76/m
  TP01: 2.59,   // Small staff bead 20x15 Redwood £2.59/m
  TP02: 2.95,   // Large staff bead 25x15 Redwood £2.95/m
  TP03: 2.22,   // Standard parting bead 8x25 Redwood £2.22/m
  AA01: 50.00,  // Internal Linings MDF (nominal each)
  AA02: 30.00,  // Windowboard MDF (nominal each)
  AA03: 75.00,  // External Linings Utile (nominal each)
}

// ── Fixture tree ─────────────────────────────────────────────────────────────
const TREE = {
  key: 'item1',
  part_type: 'drawingItemPart',
  values: {
    typeOfWork:          'complete_new',
    frameMaterialId:     'solid_redwood',
    sashMaterialId:      'solid_redwood',
    cillMaterialId:      'solid_utile_hardwood',
    fitToPreparedOpening: false,
    decoration:          false,
    floorLevel:          'ground_floor',
    bayFullyCoupledFrames: false,
    frameInKitForm:      false,
    bayPoleRequired:     false,
  },
  children: [
    {
      key: 'paint1',
      part_type: 'paintAndIronmongeryPart',
      values: {
        internalFinish:    'clean_white',
        externalFinish:    'clean_white',
        cillFinish:        'clean_white',
        cutOutBrickReveal: false,
        ironmongeryFinish: 'ABs',
      },
      children: [],
    },
    {
      key: 'notes1',
      part_type: 'notesPart',
      values: {
        installationMethod: 'internally',
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
        rakeFrame:      false,
        archHead:       false,
        outerWidth:  1255,
        outerHeight: 1775,
      },
      children: [
        {
          key: 'cill1',
          part_type: 'cillPart',
          values: {
            height: 70,
            depth:  200,
            profiledHeight: 45,
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
          },
          children: [
            {
              key: 'top1',
              part_type: 'topSashPart',
              values: {
                topHeight:    49,
                leftWidth:    50.75,
                rightWidth:   50.75,
                operation:    'cord_hung',
                toBeReplaced: null,
                archHead:     false,
              },
              children: [
                {
                  key: 'glass1',
                  part_type: 'glassPart',
                  values: {
                    glazingId:            'double_glazed',
                    isIndividualPanes:    false,
                    spacerDimId:          '16mm_white_warm_edge',
                    barsWide:             2,
                    barsHigh:             1,
                    internalGlassPartNo:  'GL100010',
                    externalGlassPartNo:  'GL100080',
                    spacerHeight:         16,
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
                leftWidth:    50.75,
                rightWidth:   50.75,
                operation:    'cord_hung',
                toBeReplaced: null,
                archHead:     false,
              },
              children: [
                {
                  key: 'glass2',
                  part_type: 'glassPart',
                  values: {
                    glazingId:            'double_glazed',
                    isIndividualPanes:    false,
                    spacerDimId:          '16mm_white_warm_edge',
                    barsWide:             2,
                    barsHigh:             1,
                    internalGlassPartNo:  'GL100010',
                    externalGlassPartNo:  'GL100080',
                    spacerHeight:         16,
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

// ── Targets ──────────────────────────────────────────────────────────────────
// Glass area now uses CUT SIZE (sightline + 2*cover per edge, cover = rebateWidth - tolerance = 12 mm).
// This increases glass area, which increases sash weight, which changes weight band pricing.
// Targets updated to match the cut-size-based engine output.
const TARGETS = {
  total_cost:  1213.82,
  total_price: 2399.57,
  manufacture_minutes: 1337,
  install_minutes:     450,
  group_cost: {
    manufacture:           574.08,
    labour:                301.58,
    manufacture_materials: 115.47,
    glass_done:            136.66,
    installation_materials: 86.03,
  },
}

// ── Assumptions ──────────────────────────────────────────────────────────────
const ASSUMPTIONS = [
  'Outer frame: 1255x1775 mm (set explicitly; inner opening is 1075x1630)',
  'Stile width: 50.75 mm (gross stile incl. sash lip = 47 + 3.75 mm)',
  'Top rail: 49 mm, bottom rail: 88 mm, midrail: 40 mm (profile defaults)',
  'Cill profiled height: 45 mm (height excluding frame stop)',
  'Glass: GL100010 (4mm Clear Pilkington K Toughened), GL100080 (4mm Clear Toughened)',
  'Ironmongery finish: ABs (Antique Brass)',
]

// ── Glass catalogue ──────────────────────────────────────────────────────────
const GLASS_CATALOGUE = {
  GL100010: { cost_per_m2: 32.00, thickness_mm: 4 },   // 4mm Clear Pilkington K Toughened
  GL100080: { cost_per_m2: 25.50, thickness_mm: 4 },   // 4mm Clear Toughened
}

export const BENCHMARK_L34046 = {
  name:   'L34046 Item 7 — Complete new box sash',
  tree:   TREE,
  targets: TARGETS,
  partCostMap: PART_COST_MAP,
  glassCatalogue: GLASS_CATALOGUE,
  assumptions: ASSUMPTIONS,
}
