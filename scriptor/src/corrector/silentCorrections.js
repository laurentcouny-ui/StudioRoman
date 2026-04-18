/**
 * Corrections automatiques silencieuses (CDC séquence 2) — sur nœuds texte uniquement.
 */

/**
 * @param {string} s
 * @returns {{ text: string, entries: { category: string, label: string }[] }}
 */
export function transformPlainSegment(s) {
  let t = s
  const entries = []
  const push = (category, label) => entries.push({ category, label })

  if (/  +/.test(t)) {
    const n = t.replace(/ {2,}/g, ' ')
    if (n !== t) {
      t = n
      push('spaces', 'Espaces multiples')
    }
  }

  const maj = t.replace(/([.!?])\s+([a-zàâäéèêëïîôùûüç])/gu, (_, punct, letter) => `${punct} ${letter.toUpperCase()}`)
  if (maj !== t) {
    t = maj
    push('typography', 'Majuscule après fin de phrase')
  }

  const emdash = t.replace(/\s--\s/g, '\u00a0—\u00a0')
  if (emdash !== t) {
    t = emdash
    push('typography', 'Tiret cadratin')
  }

  const nbspPunct = t.replace(/\s+([;:!?])/g, '\u202F$1')
  if (nbspPunct !== t) {
    t = nbspPunct
    push('punctuation', 'Espace fine insécable avant ; : ! ?')
  }

  const guillemets = t.replace(/«\s+/g, '«\u202F').replace(/\s+»/g, '\u202F»')
  if (guillemets !== t) {
    t = guillemets
    push('typography', 'Guillemets français')
  }

  if (/\.\.\./.test(t)) {
    t = t.replace(/\.\.\./g, '…')
    push('typography', 'Points de suspension')
  }

  const apos = t.replace(/(\p{L})'(\p{L})/gu, '$1\u2019$2')
  if (apos !== t) {
    t = apos
    push('typography', 'Apostrophe typographique')
  }

  const nums = t.replace(/\b(\d{4,})\b/g, (m) =>
    m.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'),
  )
  if (nums !== t) {
    t = nums
    push('typography', 'Espacement des milliers')
  }

  const lines = t.split('\n')
  const trimmedLines = lines.map((line) => line.replace(/[ \t]+$/, ''))
  const trimmed = trimmedLines.join('\n')
  if (trimmed !== t) {
    t = trimmed
    push('spaces', 'Espaces en fin de ligne')
  }

  return { text: t, entries }
}

/**
 * @param {HTMLElement} rootEl
 * @returns {{ changed: boolean, journalEntries: { category: string, label: string }[] }}
 */
export function applySilentCorrectionsToEditor(rootEl) {
  if (!rootEl) return { changed: false, journalEntries: [] }
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement
      if (!p) return NodeFilter.FILTER_REJECT
      if (p.closest('.writing-annotation')) return NodeFilter.FILTER_REJECT
      if (p.closest('script,style')) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes = []
  let n
  while ((n = walker.nextNode())) nodes.push(n)

  const journalEntries = []
  let changed = false
  for (const node of nodes) {
    const raw = node.textContent || ''
    if (!raw) continue
    const { text, entries } = transformPlainSegment(raw)
    if (text !== raw) {
      node.textContent = text
      changed = true
      journalEntries.push(...entries)
    }
  }
  return { changed, journalEntries }
}
