// applyOperationDefaults(tree, profileValues, refOptions) → new tree (pure, immutable)
//
// Reads cord/spiral size defaults from the profile and stamps them onto the
// assemblyFramePart and cillPart, based on whether either sash is spiral.
//
// profileValues — array of { field_key, default_value } rows from default_profile_values
// refOptions    — same shape as loadReferenceOptions() — grouped by category.
//   Used to:  (1) detect spiral mode (sash_operation options whose label ∋ "Spiral")
//             (2) map defaultCordFrameJambType / defaultSpiralFrameJambType to a
//                 jamb_type code by label match.
//
// The caller is responsible for passing the right refOptions.
// Skips application when sashPairPart.updateFrameDetailsOnOperationChange is
// explicitly false/0/no in profileValues; treats missing as true.

// ── Tree helpers ──────────────────────────────────────────────────────────────

function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

// Apply fn to every node, returning a new tree.
function mapTree(node, fn) {
  if (!node) return node
  const mapped = fn(node)
  return {
    ...mapped,
    children: (mapped.children ?? []).map(c => mapTree(c, fn)),
  }
}

// ── Reference helpers ─────────────────────────────────────────────────────────

function isSpiralCode(code, sashOpOptions) {
  if (!code) return false
  const opt = sashOpOptions.find(o => o.code === code)
  return opt ? opt.label.toLowerCase().includes('spiral') : false
}

// Map a raw jambType value (label or code) to a jamb_type option code.
function resolveJambTypeCode(raw, jambTypeOptions) {
  if (!raw) return null
  // Exact code match first
  let m = jambTypeOptions.find(o => o.code === raw)
  if (m) return m.code
  // Case-insensitive label match
  const lower = String(raw).toLowerCase()
  m = jambTypeOptions.find(o => o.label.toLowerCase() === lower)
  return m ? m.code : String(raw)
}

// ── Main export ───────────────────────────────────────────────────────────────

export function applyOperationDefaults(tree, profileValues, refOptions = {}) {
  if (!tree) return tree

  // Index profile values by field_key
  const pv = {}
  for (const row of (profileValues ?? [])) {
    pv[row.field_key] = row
  }

  // Honour updateFrameDetailsOnOperationChange (missing = treat as true)
  const updateRaw = pv['sashPairPart.updateFrameDetailsOnOperationChange']?.default_value
  if (updateRaw !== undefined && updateRaw !== null) {
    const v = String(updateRaw).toLowerCase().trim()
    if (v === '0' || v === 'false' || v === 'no') return tree
  }

  const sashOps   = refOptions['sash_operation'] ?? []
  const jambTypes = refOptions['jamb_type']       ?? []

  // Determine mode from topSash/bottomSash operation values
  const topSash = findFirst(tree, 'topSashPart')
  const botSash = findFirst(tree, 'bottomSashPart')
  const mode    =
    isSpiralCode(topSash?.values?.operation, sashOps) ||
    isSpiralCode(botSash?.values?.operation, sashOps)
      ? 'spiral' : 'cord'

  const pfx = mode === 'cord' ? 'Cord' : 'Spiral'

  // Safely read a numeric profile value
  function getNum(fieldKey) {
    const row = pv[fieldKey]
    if (!row?.default_value) return null
    const n = Number(row.default_value)
    return isNaN(n) ? null : n
  }

  const frameHead  = getNum(`sashPairPart.default${pfx}FrameHead`)
  const frameJamb  = getNum(`sashPairPart.default${pfx}FrameJamb`)
  const frameDepth = getNum(`sashPairPart.default${pfx}FrameDepth`)
  const cillHeight = getNum(`sashPairPart.default${pfx}CillHeight`)
  const cillDepth  = getNum(`sashPairPart.default${pfx}CillDepth`)

  const rawJambType = pv[`sashPairPart.default${pfx}FrameJambType`]?.default_value ?? null
  const jambType    = resolveJambTypeCode(rawJambType, jambTypes)

  return mapTree(tree, node => {
    if (node.part_type === 'assemblyFramePart') {
      return {
        ...node,
        values: {
          ...node.values,
          ...(frameHead  !== null ? { topHeight:  frameHead  } : {}),
          ...(frameJamb  !== null ? { leftWidth:  frameJamb  } : {}),
          ...(frameJamb  !== null ? { rightWidth: frameJamb  } : {}),
          ...(frameDepth !== null ? { frameDepth: frameDepth } : {}),
          ...(jambType   !== null ? { jambType:   jambType   } : {}),
        },
      }
    }
    if (node.part_type === 'cillPart') {
      return {
        ...node,
        values: {
          ...node.values,
          ...(cillHeight !== null ? { height: cillHeight } : {}),
          ...(cillDepth  !== null ? { depth:  cillDepth  } : {}),
        },
      }
    }
    return node
  })
}
