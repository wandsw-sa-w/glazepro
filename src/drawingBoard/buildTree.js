// Box sash tree builder.
//
// buildNewBoxSash({ profile, fieldDefs, profileValues, containment, refOptions })
//   profile       — default_profiles row (unused in logic; passed for context)
//   fieldDefs     — grouped by part_type from loadFieldDefinitions()
//   profileValues — array of default_profile_values rows
//   containment   — array of part_type_children rows
//   refOptions    — grouped by category from loadReferenceOptions() (optional)
//
// Returns { tree, warnings }
//   tree      — nested node: { key, part_type, sort_order, values, children }
//   warnings  — string[] of reference-value match failures

// Hardcoded template: always include these children for these part types,
// regardless of min_count. Covers optional-by-schema parts that are always
// present in a box sash (e.g. cillPart under assemblyFramePart).
// The generic required-children logic below adds topSashPart, bottomSashPart,
// and glassPart when min_count > 0 (requires step-a migration to have run).
const TEMPLATE_CHILDREN = {
  drawingItemPart:    ['paintAndIronmongeryPart', 'notesPart', 'pricePart', 'assemblyFramePart'],
  assemblyFramePart:  ['cillPart', 'sashPairPart'],
}

export function buildNewBoxSash({
  profile: _profile,
  fieldDefs,
  profileValues,
  containment,
  refOptions = {},
}) {
  const warnings = []

  // Index profile values by field_key for O(1) lookup
  const pvByKey = {}
  for (const pv of (profileValues ?? [])) {
    pvByKey[pv.field_key] = pv
  }

  // Convert a raw profile default_value text to the field's semantic data_type.
  // Returns null on missing value or conversion failure; never throws.
  function convertValue(field, rawValue, sourceRef) {
    if (rawValue === null || rawValue === undefined) return null

    switch (field.data_type) {
      case 'number': {
        const n = Number(rawValue)
        return isNaN(n) ? null : n
      }

      case 'boolean': {
        if (typeof rawValue === 'boolean') return rawValue
        const s = String(rawValue).toLowerCase()
        if (s === '1' || s === 'true'  || s === 'yes') return true
        if (s === '0' || s === 'false' || s === 'no')  return false
        return null
      }

      case 'reference':
      case 'multi_reference': {
        const category = field.reference_category
        if (!category) return null
        const options = refOptions[category] ?? []
        if (options.length === 0) return null

        // 1. Exact code match on default_value
        let match = options.find(o => o.code === rawValue)
        if (match) return match.code

        // 2. source_ref used as a code
        if (sourceRef) {
          match = options.find(o => o.code === sourceRef)
          if (match) return match.code
        }

        // 3. Case-insensitive label match
        const lower = String(rawValue).toLowerCase()
        match = options.find(o => o.label.toLowerCase() === lower)
        if (match) return match.code

        warnings.push(
          `${field.field_key}: no match for "${rawValue}"` +
          (sourceRef ? ` (source_ref: "${sourceRef}")` : '') +
          ` in category "${category}"`
        )
        return null
      }

      case 'text':
        return String(rawValue)

      default:
        return rawValue
    }
  }

  // Build the stored values object for a part type.
  // Only role='input' fields are stored; derived and config fields are omitted.
  function buildValues(partType) {
    const fields = fieldDefs[partType] ?? []
    const values = {}
    for (const field of fields) {
      if (field.role !== 'input') continue
      const pv = pvByKey[field.field_key]
      values[field.property_name] = convertValue(
        field,
        pv?.default_value ?? null,
        pv?.source_ref    ?? null,
      )
    }
    return values
  }

  // Build a part node and recursively include all required children.
  // Template children (from TEMPLATE_CHILDREN) are always included first;
  // then any additional child types with min_count > 0 are appended.
  function buildPart(partType, sortOrder) {
    const templateKids = TEMPLATE_CHILDREN[partType] ?? []

    // Required children from containment (min_count > 0) not already in template
    const requiredKids = (containment ?? [])
      .filter(c => c.parent_code === partType && c.min_count > 0)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(c => c.child_code)

    // Merge preserving template order, deduplicating required that overlap
    const allKidTypes = [...new Set([...templateKids, ...requiredKids])]

    const children = allKidTypes.map((childType, idx) => buildPart(childType, idx))

    return {
      key:        crypto.randomUUID(),
      part_type:  partType,
      sort_order: sortOrder,
      values:     buildValues(partType),
      children,
    }
  }

  const tree = buildPart('drawingItemPart', 0)
  return { tree, warnings }
}
