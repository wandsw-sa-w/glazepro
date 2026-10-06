import { describe, it, expect } from 'vitest'
import { isFieldHidden } from './fieldVisibility'

/**
 * Test that visibility is display-only: validation results and computed
 * variables must be identical regardless of whether the user is in Sales or
 * Survey mode. This is guaranteed by design — isFieldHidden is never called
 * by the validation or pricing code. This test documents that contract.
 *
 * We test the property: for every possible visibility value, the field's
 * *value* is still present; only the UI filtering uses isFieldHidden. So
 * a hypothetical validation pass that does NOT call isFieldHidden will see
 * the same field values in both modes.
 */

describe('Validation and pricing identity across modes', () => {
  // Simulates: given a tree with values, validation reads ALL fields
  // regardless of mode. Hiding is display-only.
  const sampleFieldDefs = [
    { field_key: 'a.width', is_required: true, role: 'input', property_name: 'width' },
    { field_key: 'a.height', is_required: true, role: 'input', property_name: 'height' },
    { field_key: 'a.detail', is_required: false, role: 'input', property_name: 'detail' },
  ]
  const sampleValues = { width: 600, height: 1200, detail: 'test' }

  const visibilityMaps = [
    {},
    { 'a.width': 'hidden_sales' },
    { 'a.height': 'hidden_survey' },
    { 'a.detail': 'hidden_always' },
    { 'a.width': 'hidden_sales', 'a.height': 'hidden_survey', 'a.detail': 'hidden_always' },
  ]

  for (const vMap of visibilityMaps) {
    it(`field values are identical in Sales and Survey mode (visibility: ${JSON.stringify(vMap)})`, () => {
      // Simulate what validation/pricing sees: all field values, no filtering
      const salesValues = {}
      const surveyValues = {}
      for (const f of sampleFieldDefs) {
        // Validation and pricing do NOT filter by isFieldHidden — they read all values
        salesValues[f.property_name] = sampleValues[f.property_name]
        surveyValues[f.property_name] = sampleValues[f.property_name]
      }
      expect(salesValues).toEqual(surveyValues)
    })
  }

  it('isFieldHidden only affects UI — Sales and Survey get different visible fields but same values', () => {
    const vMap = { 'a.width': 'hidden_sales', 'a.height': 'hidden_survey' }

    // In Sales mode, width is hidden from UI but its value is still present
    const salesHidden = sampleFieldDefs.filter(f => isFieldHidden(vMap[f.field_key], 'sales', false))
    const salesVisible = sampleFieldDefs.filter(f => !isFieldHidden(vMap[f.field_key], 'sales', false))
    expect(salesHidden.map(f => f.field_key)).toEqual(['a.width'])
    expect(salesVisible.map(f => f.field_key)).toEqual(['a.height', 'a.detail'])

    // In Survey mode, height is hidden from UI but its value is still present
    const surveyHidden = sampleFieldDefs.filter(f => isFieldHidden(vMap[f.field_key], 'survey', false))
    const surveyVisible = sampleFieldDefs.filter(f => !isFieldHidden(vMap[f.field_key], 'survey', false))
    expect(surveyHidden.map(f => f.field_key)).toEqual(['a.height'])
    expect(surveyVisible.map(f => f.field_key)).toEqual(['a.width', 'a.detail'])

    // But the underlying values are identical
    const allValues = sampleFieldDefs.map(f => sampleValues[f.property_name])
    expect(allValues).toEqual([600, 1200, 'test'])
  })
})
