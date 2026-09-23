// computeDerived(tree) → map of partKey → { propertyName: value }
//
// Pure function. Never returns NaN — missing inputs yield null.
// Derived fields computed:
//   sashPairPart.internalWidth   = frame.width − frame.leftWidth − frame.rightWidth
//   sashPairPart.internalHeight  = frame.height − frame.topHeight − cill.height
//   assemblyFramePart.jambDifference = frame.leftOuterJamb − frame.leftWidth
//   drawingItemPart.newFrame     = (typeOfWork === 'complete_new')
//   drawingItemPart.isBiGlass    = (typeOfWork === 'bi_glass')
//   drawingItemPart.itemWeight   = null (formula pending)
//   topSashPart.weight/travel    = null (formula pending)
//   bottomSashPart.weight/travel = null (formula pending)

// Safely convert to number; null/undefined/NaN → null
function num(v) {
  if (v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// Subtract rest from first; return null if any operand is null
function sub(a, ...rest) {
  const na = num(a)
  if (na === null) return null
  let result = na
  for (const v of rest) {
    const n = num(v)
    if (n === null) return null
    result -= n
  }
  return result
}

// Return the first node in the tree matching part_type (BFS order)
function findFirst(node, partType) {
  if (!node) return null
  if (node.part_type === partType) return node
  for (const child of (node.children ?? [])) {
    const found = findFirst(child, partType)
    if (found) return found
  }
  return null
}

// Return all nodes in the tree matching part_type
function findAll(node, partType, acc = []) {
  if (!node) return acc
  if (node.part_type === partType) acc.push(node)
  for (const child of (node.children ?? [])) findAll(child, partType, acc)
  return acc
}

export function computeDerived(tree) {
  const out = {}

  function entry(key) {
    if (!out[key]) out[key] = {}
    return out[key]
  }

  const item        = findFirst(tree, 'drawingItemPart')
  const frame       = findFirst(tree, 'assemblyFramePart')
  const cill        = findFirst(tree, 'cillPart')
  const pair        = findFirst(tree, 'sashPairPart')
  const topSashes   = findAll(tree, 'topSashPart')
  const botSashes   = findAll(tree, 'bottomSashPart')

  // drawingItemPart: newFrame, isBiGlass, itemWeight
  if (item) {
    const tow = item.values?.typeOfWork ?? null
    entry(item.key).newFrame   = tow !== null ? tow === 'complete_new' : null
    entry(item.key).isBiGlass  = tow !== null ? tow === 'bi_glass'     : null
    entry(item.key).itemWeight = null  // formula pending
  }

  // assemblyFramePart: jambDifference = leftOuterJamb − leftWidth
  if (frame) {
    entry(frame.key).jambDifference = sub(
      frame.values?.leftOuterJamb,
      frame.values?.leftWidth,
    )
  }

  // sashPairPart: internalWidth, internalHeight
  if (pair) {
    entry(pair.key).internalWidth = sub(
      frame?.values?.width,
      frame?.values?.leftWidth,
      frame?.values?.rightWidth,
    )
    entry(pair.key).internalHeight = sub(
      frame?.values?.height,
      frame?.values?.topHeight,
      cill?.values?.height,
    )
  }

  // topSashPart / bottomSashPart: weight and travel (formula pending)
  for (const sash of [...topSashes, ...botSashes]) {
    entry(sash.key).weight = null  // formula pending
    entry(sash.key).travel = null  // formula pending
  }

  return out
}
