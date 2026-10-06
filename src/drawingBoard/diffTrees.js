// diffTrees.js — Compare two drawing part trees and return a list of changes.
//
// diffTrees(oldTree, newTree, { fieldDefs, refOptions, partLabels })
//   oldTree    — previous saved tree (root node)
//   newTree    — newly saved tree (root node)
//   fieldDefs  — grouped by part_type from loadFieldDefinitions()
//   refOptions — grouped by category from loadReferenceOptions()
//   partLabels — map of part_type → display label (PART_LABELS)
//
// Returns an array of { part, field, from, to } change objects.
// Parts added or removed are recorded with field = '(added)' or '(removed)'.
// No changes → empty array.

/**
 * Resolve a part's display label, including its ancestor path.
 * e.g. "Top Sash > Glazing" for a glassPart under topSashPart.
 */
function resolvePartPath(node, partLabels, ancestors = []) {
  const label = node.label_override || partLabels[node.part_type] || node.part_type
  return [...ancestors, label].join(' > ')
}

/**
 * Find the display label for a reference code.
 * Searches all categories for the code; returns the label if found, otherwise the code itself.
 */
function resolveRefLabel(code, category, refOptions) {
  if (code === null || code === undefined) return null
  if (!category || !refOptions) return code
  const opts = refOptions[category] ?? []
  const match = opts.find(o => o.code === code)
  return match ? match.label : code
}

/**
 * Format a value for display, resolving reference codes to their labels.
 */
function formatValue(value, field, refOptions) {
  if (value === null || value === undefined) return null

  if (field?.data_type === 'reference') {
    return resolveRefLabel(value, field.reference_category, refOptions)
  }

  if (field?.data_type === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  return String(value)
}

/**
 * Flatten a tree into a map keyed by part_type + position, carrying ancestors.
 * Uses part_type + child-index path as the key so structural diffs align correctly
 * even when keys have been regenerated.
 */
function flattenTree(node, ancestors = [], indexPath = '0') {
  if (!node) return []
  const result = [{ node, ancestors, indexPath }]
  for (let i = 0; i < (node.children ?? []).length; i++) {
    const child = node.children[i]
    const label = node.label_override || node.part_type
    result.push(...flattenTree(child, [...ancestors, label], `${indexPath}.${i}`))
  }
  return result
}

/**
 * Build a structural signature for matching old/new nodes.
 * Nodes match when they have the same part_type at the same structural position
 * (by part_type path, not by key, since keys change on template copy).
 */
function buildTypeSignature(node, ancestors = []) {
  return [...ancestors, node.part_type].join('/')
}

/**
 * Compare two trees and return a list of { part, field, from, to } changes.
 *
 * @param {object|null} oldTree - The previously saved tree
 * @param {object|null} newTree - The newly saved tree
 * @param {{ fieldDefs?: object, refOptions?: object, partLabels?: object }} opts
 * @returns {Array<{ part: string, field: string, from: string|null, to: string|null }>}
 */
export function diffTrees(oldTree, newTree, { fieldDefs = {}, refOptions = {}, partLabels = {} } = {}) {
  if (!oldTree && !newTree) return []

  const changes = []

  // Flatten both trees by structural type path
  const oldFlat = flattenByTypePath(oldTree)
  const newFlat = flattenByTypePath(newTree)

  const allPaths = new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)])

  for (const path of allPaths) {
    const oldEntry = oldFlat[path]
    const newEntry = newFlat[path]

    if (!oldEntry && newEntry) {
      // Part added
      const partPath = resolvePartPath(newEntry.node, partLabels, newEntry.ancestors.map(a => partLabels[a] || a))
      changes.push({ part: partPath, field: '(added)', from: null, to: null })
      continue
    }

    if (oldEntry && !newEntry) {
      // Part removed
      const partPath = resolvePartPath(oldEntry.node, partLabels, oldEntry.ancestors.map(a => partLabels[a] || a))
      changes.push({ part: partPath, field: '(removed)', from: null, to: null })
      continue
    }

    // Both exist — compare values
    const oldNode = oldEntry.node
    const newNode = newEntry.node
    const partPath = resolvePartPath(newNode, partLabels, newEntry.ancestors.map(a => partLabels[a] || a))
    const fields = fieldDefs[newNode.part_type] ?? []

    // Build a quick lookup for field definitions by property_name
    const fieldMap = {}
    for (const f of fields) fieldMap[f.property_name] = f

    // Collect all value keys from both old and new
    const allKeys = new Set([
      ...Object.keys(oldNode.values ?? {}),
      ...Object.keys(newNode.values ?? {}),
    ])

    for (const key of allKeys) {
      const oldVal = oldNode.values?.[key] ?? null
      const newVal = newNode.values?.[key] ?? null

      // Skip if unchanged (deep-compare for arrays/objects)
      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue

      const field = fieldMap[key]
      // Skip config/derived fields — only track input changes
      if (field && field.role !== 'input') continue

      const fieldLabel = field?.label ?? key
      const fromDisplay = formatValue(oldVal, field, refOptions)
      const toDisplay = formatValue(newVal, field, refOptions)

      changes.push({
        part: partPath,
        field: fieldLabel,
        from: fromDisplay,
        to: toDisplay,
      })
    }
  }

  return changes
}

/**
 * Flatten tree into a map keyed by the structural type path.
 * When there are multiple children of the same part_type under the same parent,
 * they are disambiguated by appending an occurrence index.
 */
function flattenByTypePath(node, parentPath = '', ancestors = []) {
  if (!node) return {}
  const result = {}

  const myPath = parentPath ? `${parentPath}/${node.part_type}` : node.part_type
  // Check if this path already exists — if so, disambiguate
  const basePath = myPath
  let finalPath = basePath
  let counter = 1
  while (result[finalPath]) {
    counter++
    finalPath = `${basePath}#${counter}`
  }

  result[finalPath] = { node, ancestors }

  // Track child type counts for disambiguation
  const childTypeCounts = {}
  for (const child of (node.children ?? [])) {
    const type = child.part_type
    childTypeCounts[type] = (childTypeCounts[type] ?? 0) + 1
  }

  // Process children, appending occurrence index when there are duplicates
  const childTypeIdx = {}
  for (const child of (node.children ?? [])) {
    const type = child.part_type
    childTypeIdx[type] = (childTypeIdx[type] ?? 0) + 1
    const suffix = childTypeCounts[type] > 1 ? `#${childTypeIdx[type]}` : ''
    const childPath = `${finalPath}/${type}${suffix}`

    const childResult = flattenByTypePathInner(child, childPath, [...ancestors, node.part_type])
    Object.assign(result, childResult)
  }

  return result
}

/**
 * Inner helper for recursive flattening (child nodes already have their path computed).
 */
function flattenByTypePathInner(node, myPath, ancestors) {
  const result = {}
  result[myPath] = { node, ancestors }

  const childTypeCounts = {}
  for (const child of (node.children ?? [])) {
    const type = child.part_type
    childTypeCounts[type] = (childTypeCounts[type] ?? 0) + 1
  }

  const childTypeIdx = {}
  for (const child of (node.children ?? [])) {
    const type = child.part_type
    childTypeIdx[type] = (childTypeIdx[type] ?? 0) + 1
    const suffix = childTypeCounts[type] > 1 ? `#${childTypeIdx[type]}` : ''
    const childPath = `${myPath}/${type}${suffix}`

    const childResult = flattenByTypePathInner(child, childPath, [...ancestors, node.part_type])
    Object.assign(result, childResult)
  }

  return result
}
