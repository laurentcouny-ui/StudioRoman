/**
 * Surlignage inline des alertes correcteur dans l'éditeur contenteditable (CDC séquence 2).
 */
import { CORRECTOR_MODE } from './CorrectorModes.js'

function unwrap(node) {
  const parent = node.parentNode
  if (!parent) return
  while (node.firstChild) parent.insertBefore(node.firstChild, node)
  parent.removeChild(node)
}

export function clearLtHighlights(rootEl) {
  if (!rootEl) return
  const marks = rootEl.querySelectorAll('.corrector-lt-mark')
  marks.forEach((m) => unwrap(m))
}

function locateByTextOffset(rootEl, offset) {
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement
      if (!p) return NodeFilter.FILTER_REJECT
      if (p.closest('.corrector-lt-mark')) return NodeFilter.FILTER_ACCEPT
      return NodeFilter.FILTER_ACCEPT
    },
  })
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
 * @param {number} conf
 * @param {string} mode CORRECTOR_MODE
 */
function confidenceClass(conf, mode, m) {
  if (m?.bibleNominal) return 'corrector-lt-bible-nominal'
  const c = conf ?? 0
  if (c >= 0.98) return 'corrector-lt-confidence-strong'
  if (c >= 0.9) {
    return mode === CORRECTOR_MODE.EXPERT
      ? 'corrector-lt-confidence-medium'
      : 'corrector-lt-confidence-medium corrector-lt-simple-uncertain'
  }
  if (mode === CORRECTOR_MODE.EXPERT) return 'corrector-lt-confidence-soft'
  return 'corrector-lt-confidence-strong'
}

/**
 * @param {HTMLElement} rootEl
 * @param {Array<{ offset: number, length: number, confidence?: number }>} matches
 * @param {{ mode?: string }} [options] — mode correcteur pour paliers visuels
 */
export function applyLtHighlights(rootEl, matches, options = {}) {
  if (!rootEl) return
  const mode = options.mode ?? CORRECTOR_MODE.SIMPLE
  clearLtHighlights(rootEl)
  if (mode === CORRECTOR_MODE.SIMPLE_STRICT) return

  const list = [...(matches || [])]
    .filter((m) => Number.isFinite(m.offset) && Number.isFinite(m.length) && m.length > 0)
    .filter((m) => {
      if (m?.bibleNominal && mode === CORRECTOR_MODE.SIMPLE_STRICT) return false
      if (mode === CORRECTOR_MODE.SIMPLE && (m.confidence ?? 1) < 0.9 && !m?.bibleNominal) return false
      return true
    })
    .sort((a, b) => b.offset - a.offset)

  for (const m of list) {
    try {
      const start = locateByTextOffset(rootEl, m.offset)
      const end = locateByTextOffset(rootEl, m.offset + m.length)
      if (!start || !end) continue
      const range = document.createRange()
      range.setStart(start.node, start.localOffset)
      range.setEnd(end.node, end.localOffset)
      if (range.collapsed) continue
      const span = document.createElement('span')
      span.className = `corrector-lt-mark ${confidenceClass(m.confidence || 0, mode, m)}`
      span.dataset.ltOffset = String(m.offset)
      span.dataset.ltLength = String(m.length)
      range.surroundContents(span)
    } catch {
      // Si range.surroundContents échoue (structure complexe), on ignore ce match.
    }
  }
}
