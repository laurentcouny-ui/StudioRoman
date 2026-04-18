/**
 * Opérations texte par offsets "plain text" sur contenteditable.
 */

function locateByTextOffset(rootEl, offset) {
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT)
  let n = walker.nextNode()
  let total = 0
  while (n) {
    const len = n.textContent?.length || 0
    if (offset <= total + len) {
      return { node: n, localOffset: Math.max(0, offset - total) }
    }
    total += len
    n = walker.nextNode()
  }
  return null
}

/**
 * @param {HTMLElement} rootEl
 * @param {number} offset
 * @param {number} length
 * @param {string} replacement
 */
export function replaceTextByOffset(rootEl, offset, length, replacement) {
  if (!rootEl || !Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) {
    return false
  }
  const start = locateByTextOffset(rootEl, offset)
  const end = locateByTextOffset(rootEl, offset + length)
  if (!start || !end) return false
  try {
    const range = document.createRange()
    range.setStart(start.node, start.localOffset)
    range.setEnd(end.node, end.localOffset)
    range.deleteContents()
    const node = document.createTextNode(String(replacement || ''))
    range.insertNode(node)
    return true
  } catch {
    return false
  }
}
