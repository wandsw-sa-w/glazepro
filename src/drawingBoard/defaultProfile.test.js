import { describe, it, expect } from 'vitest'
import { effectiveProfileId, FALLBACK_PROFILE_CODE } from './defaultProfile.js'

const profiles = [
  { id: 'prof-sash', code: 'sash', label: 'Box Sash' },
  { id: 'prof-casement', code: 'casement', label: 'Casement' },
]

describe('effectiveProfileId', () => {
  it('returns the drawing\'s own default_profile_id when set', () => {
    const drawing = { default_profile_id: 'prof-casement' }
    expect(effectiveProfileId(drawing, profiles)).toBe('prof-casement')
  })

  it('falls back to the FALLBACK_PROFILE_CODE profile when default_profile_id is null', () => {
    const drawing = { default_profile_id: null }
    expect(effectiveProfileId(drawing, profiles)).toBe('prof-sash')
  })

  it('falls back when default_profile_id is missing entirely', () => {
    expect(effectiveProfileId({}, profiles)).toBe('prof-sash')
  })

  it('returns null when the fallback profile itself is not in the list', () => {
    const noSash = [{ id: 'prof-casement', code: 'casement', label: 'Casement' }]
    expect(effectiveProfileId({ default_profile_id: null }, noSash)).toBeNull()
  })

  it('returns null for a null drawing with no fallback available', () => {
    expect(effectiveProfileId(null, [])).toBeNull()
  })

  it('FALLBACK_PROFILE_CODE is "sash" — matches what DrawingBoard.jsx loads', () => {
    expect(FALLBACK_PROFILE_CODE).toBe('sash')
  })
})
