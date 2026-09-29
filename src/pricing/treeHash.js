/**
 * treeHash.js
 *
 * Compute a stable short hash of a parts tree.
 * Used to detect when a drawing's tree has changed since its last pricing run.
 *
 * Stable: output is independent of key/id/timestamp fields and key ordering
 * in value objects. Only part_type and user-set values are included.
 */

// Build a stable representation of a tree node, stripping volatile fields.
function cleanNode(node) {
  const cleanValues = {}
  for (const [k, v] of Object.entries(node.values ?? {})) {
    // Skip internal tracking fields that don't affect pricing
    if (k === 'id' || k === 'key' || k.endsWith('_at') || k.endsWith('_id')) continue
    cleanValues[k] = v
  }
  return {
    t: node.part_type,
    v: sortedEntries(cleanValues),
    c: (node.children ?? []).map(cleanNode),
  }
}

// Produce deterministic JSON regardless of object key insertion order
function sortedEntries(obj) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const result = {}
  for (const k of Object.keys(obj).sort()) {
    result[k] = sortedEntries(obj[k])
  }
  return result
}

// djb2 hash — fast, deterministic, 8-char hex output
function djb2(str) {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = (((hash << 5) + hash) ^ str.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Compute a hash string for a parts tree node.
 *
 * @param {object} tree - Root node { part_type, values, children }
 * @returns {string} 8-character hex hash
 */
export function treeHash(tree) {
  const stable = JSON.stringify(cleanNode(tree))
  return djb2(stable)
}
