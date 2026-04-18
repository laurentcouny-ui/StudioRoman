/**
 * Utilitaires DOM éditeur (snapshot paragraphe, bouclier temporel, chemins).
 */

const BLOCK = new Set([
  'P',
  'DIV',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
])

/**
 * @param {Node} node
 * @param {HTMLElement} rootEl
 * @returns {HTMLElement | null}
 */
export function findBlockAncestor(node, rootEl) {
  if (!node || !rootEl || !rootEl.contains(node)) return null
  let n = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
  while (n && n !== rootEl) {
    if (
      n.nodeType === Node.ELEMENT_NODE &&
      BLOCK.has(n.tagName)
    ) {
      return n
    }
    n = n.parentElement
  }
  return rootEl
}

/**
 * @param {HTMLElement} rootEl
 * @param {string} pathStr indices séparés par « . » depuis rootEl.childNodes
 * @returns {ChildNode | null}
 */
export function resolvePathToNode(rootEl, pathStr) {
  if (!rootEl || !pathStr || pathStr === '_') return null
  const parts = pathStr.split('.').map((x) => parseInt(x, 10))
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null
  let node = /** @type {ChildNode | HTMLElement | null} */ (rootEl)
  for (const i of parts) {
    node = node?.childNodes[i] ?? null
    if (node == null) return null
  }
  return node
}

/**
 * @param {Node} anchorNode
 * @param {HTMLElement} rootEl
 */
export function getDomPathKeyFromNode(anchorNode, rootEl) {
  if (!anchorNode || !rootEl || !rootEl.contains(anchorNode)) return '_'
  const el =
    anchorNode.nodeType === Node.TEXT_NODE
      ? anchorNode.parentElement
      : anchorNode
  if (!el || !rootEl.contains(el)) return '_'
  const parts = []
  let cur = el
  while (cur && cur !== rootEl) {
    const parent = cur.parentElement
    if (!parent) break
    const idx = [...parent.childNodes].indexOf(cur)
    parts.unshift(Number.isFinite(idx) && idx >= 0 ? idx : 0)
    cur = parent
  }
  return parts.length ? parts.join('.') : '0'
}

/**
 * Offset « texte visible » jusqu’au point (container, offset) — aligné sur Range.toString().
 * @param {HTMLElement} editorEl
 * @param {Node} container
 * @param {number} offset
 */
export function getPlainOffsetUpTo(editorEl, container, offset) {
  try {
    const r = document.createRange()
    r.selectNodeContents(editorEl)
    r.setEnd(container, offset)
    return r.toString().length
  } catch {
    return 0
  }
}
