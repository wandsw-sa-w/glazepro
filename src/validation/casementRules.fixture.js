/**
 * casementRules.fixture.js
 * The 11 casement-sash validation rules, EXACTLY as the reviewer's
 * sql/step-as0-validation-parity.sql switches them on — same names, same
 * loop_target, same conditions, same severities.
 *
 * These are Integrate's own rules, imported into GlazePro switched off
 * ("part type not built yet"). Nathan runs the SQL after this step deploys,
 * so the tests cannot read them from the database; copying the conditions
 * here is how the step is checked before the switch is thrown.
 *
 * If a condition here and in the SQL ever disagree, the SQL is right: it is
 * the file that reaches the live table.
 *
 * Rule numbers are Integrate's (docs/integrate-validation-active-flags.txt).
 */

export const CASEMENT_VALIDATION_RULES = [
  // ── Stormproof (42–46). Silent until a sash is stormproof — the next step
  {
    id: 'as-42', sort_order: 42, level: 'item', severity: 'warning',
    name: 'Storm Proof Sash Replacement', loop_target: 'casement_sash',
    condition: 'is_storm_proof and not is_complete_new',
    message: 'Storm proof sash replacement', is_active: true,
  },
  {
    id: 'as-43', sort_order: 43, level: 'item', severity: 'warning',
    name: 'Storm proof casement windows (not flush)', loop_target: 'casement_sash',
    condition: 'is_storm_proof',
    message: 'Storm proof casement windows (not flush)', is_active: true,
  },
  {
    id: 'as-44', sort_order: 44, level: 'item', severity: 'warning',
    name: 'Bottom Hung Stormproof Casements', loop_target: 'casement_sash',
    condition: 'is_storm_proof and is_bottom_hung',
    message: 'Bottom hung stormproof casements', is_active: true,
  },
  {
    id: 'as-45', sort_order: 45, level: 'item', severity: 'warning',
    name: 'Tilt and Turn Windows', loop_target: 'casement_sash',
    condition: 'is_bottom_and_left_hand_hung_viewed_internally or is_bottom_and_right_hand_hung_viewed_internally',
    message: 'Tilt and turn windows', is_active: true,
  },
  {
    id: 'as-46', sort_order: 46, level: 'item', severity: 'warning',
    name: 'Top Hung Casement Width', loop_target: 'casement_sash',
    condition: 'is_storm_proof and is_top_hung and width <= 0.31',
    message: 'Top hung casement width', is_active: true,
  },

  // ── Rule 75: the one Integrate shows on Q
  {
    id: 'as-75', sort_order: 75, level: 'item', severity: 'warning',
    name: 'Fanlight bottom rail', loop_target: 'casement_sash',
    condition: 'is_fanlight and to_be_replaced and gross_bottom_rail_height_in_mm > 62',
    message: 'Fanlight bottom rail should be reduced to 62mm externally', is_active: true,
  },

  // ── Rule 120: the one Integrate shows on P
  {
    id: 'as-120', sort_order: 120, level: 'item', severity: 'error',
    name: 'Over 24kg Casement Sash', loop_target: 'casement_sash',
    condition: 'weight_in_kg > 45 and is_opening and is_side_hung',
    message: 'We cannot do side hung opening casement sashes over 45kg', is_active: true,
  },

  // ── Casement espags (122–125)
  {
    id: 'as-122', sort_order: 122, level: 'item', severity: 'warning',
    name: 'Not MPLS', loop_target: 'casement_sash',
    condition: 'not is_heritage_range and not is_casement_mpls and is_opening',
    message: 'Not MPLS', is_active: true,
  },
  {
    id: 'as-123', sort_order: 123, level: 'item', severity: 'warning',
    name: 'Too Long', loop_target: 'casement_sash',
    condition: 'is_opening and is_top_hung and gross_sash_width_in_mm > 2798',
    message: 'Too long', is_active: true,
  },
  {
    id: 'as-124', sort_order: 124, level: 'item', severity: 'warning',
    name: 'Short Casement Espag', loop_target: 'casement_sash',
    condition: 'is_top_hung and gross_sash_width_in_mm < 306 and is_casement_mpls',
    message: 'Short casement espag', is_active: true,
  },
  {
    id: 'as-125', sort_order: 125, level: 'item', severity: 'warning',
    name: 'Short Casement Espag', loop_target: 'casement_sash',
    condition: 'is_side_hung and gross_sash_height_in_mm < 306 and is_casement_mpls',
    message: 'Short casement espag', is_active: true,
  },
]
