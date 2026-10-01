// defaultProfile.js — the profile every surface falls back to when a
// drawing has no default_profile_id of its own.
//
// Single source so the drawing board (which always builds/loads against
// this profile today — see DrawingBoard.jsx), the quick "Sash" button
// (QuoteMatrixPage.jsx#addDrawingQuick) and the items grid's profile-default
// fallback (QuoteOverview.jsx) can never disagree about which profile that
// is. Previously only the drawing board's loadProfile('sash') call knew
// this code; addDrawingQuick left default_profile_id null on every drawing
// it created, so the grid's "fall back to the profile default" logic (which
// keys off default_profile_id) had nothing to fall back to and showed "—".

export const FALLBACK_PROFILE_CODE = 'sash'

/**
 * Resolve the profile id a drawing's fields should fall back to: its own
 * default_profile_id if set, else the FALLBACK_PROFILE_CODE profile's id.
 *
 * @param {{default_profile_id?: string|null}|null} drawing
 * @param {Array<{id: string, code: string}>} profiles
 * @returns {string|null}
 */
export function effectiveProfileId(drawing, profiles) {
  if (drawing?.default_profile_id) return drawing.default_profile_id
  return profiles?.find(p => p.code === FALLBACK_PROFILE_CODE)?.id ?? null
}
