/**
 * Filtres Mode Focus, score « fautes certaines », catégories pour séquence 4.
 */

/** @typedef {'all' | 'grammar' | 'spelling' | 'punctuation' | 'repetition'} AnalysisFocus */

/**
 * @param {object} m
 * @returns {AnalysisFocus | 'style'}
 */
export function inferMatchCategory(m) {
  const msg = String(m.message || '').toLowerCase()
  const rule = String(m.ruleRef || m.source || '').toLowerCase()
  const combined = `${msg} ${rule}`
  if (m.bibleNominal) return 'style'
  if (/répétition|repetition|anaphor|doublon|deux fois/.test(combined)) return 'repetition'
  if (/ponctuation|virgule|point|deux\s*points|guillemet|tiret/.test(combined)) return 'punctuation'
  if (/orthographe|typo|faute|mot\s+inconnu|spell/.test(combined)) return 'spelling'
  if (/grammaire|accord|conjugaison|syntaxe|verbe|pluriel|singulier/.test(combined)) return 'grammar'
  if ((m.confidence ?? 0) >= 0.9 && (m.confidence ?? 0) < 0.98 && /style|rythme/.test(combined))
    return 'style'
  return 'grammar'
}

/**
 * @param {object[]} matches
 * @param {AnalysisFocus} focus
 */
export function filterMatchesByFocus(matches, focus) {
  if (!focus || focus === 'all') return matches
  return matches.filter((m) => {
    const c = inferMatchCategory(m)
    if (focus === 'repetition') return c === 'repetition'
    if (focus === 'punctuation') return c === 'punctuation'
    if (focus === 'spelling') return c === 'spelling'
    if (focus === 'grammar') return c === 'grammar'
    return true
  })
}

export function matchKey(m) {
  return `${m.offset}-${m.length}`
}

/**
 * Score sur fautes certaines uniquement (≥ 98 %).
 * @param {object[]} matches
 * @param {string} plainText
 */
export function computeCertainScore(matches, plainText) {
  const certain = (matches || []).filter((m) => (m.confidence ?? 0) >= 0.98)
  const applicable = certain.filter(
    (m) => plainText.slice(m.offset, m.offset + m.length) === String(m.excerpt || ''),
  )
  const total = certain.length
  const done = total - applicable.length
  const ratio = total > 0 ? done / total : 1
  return {
    totalCertain: total,
    resolvedCertain: done,
    ratio,
    label:
      total === 0
        ? 'Aucune faute certaine dans cette analyse.'
        : ratio < 0.5
          ? 'Inférieur à 50 %'
          : `${Math.round(ratio * 100)} %`,
  }
}
