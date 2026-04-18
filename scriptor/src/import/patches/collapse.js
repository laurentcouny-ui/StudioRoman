/**
 * Compacte les TYPO_BATCH sur le même nodeId + field (CDC).
 */
export function collapseTypoPatches(patches) {
  const map = new Map()
  for (const p of patches) {
    if (p.type !== 'TYPO_BATCH') continue
    const key = `${p.targetNodeId}::${p.field}`
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...p, operations: [...(p.operations || [])] })
    } else {
      prev.operations = [...(prev.operations || []), ...(p.operations || [])]
      prev.priority = Math.min(prev.priority, p.priority)
    }
  }
  return [...map.values()]
}
