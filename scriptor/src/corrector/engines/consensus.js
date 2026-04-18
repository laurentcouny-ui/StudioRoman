/**
 * Règles de consensus multi-moteurs (CDC séquence 1).
 * Mécanique pure LT → confiance haute ; LT + base d’accord → renfort ; etc.
 */

/**
 * @typedef {object} NormalizedMatch
 * @property {number} offset
 * @property {number} length
 * @property {string} message
 * @property {string[]} replacements
 * @property {number} confidence
 * @property {string} source
 * @property {string} [ruleRef]
 */

function inferLtConfidence(m) {
  const it = m.rule?.issueType || ''
  const cat = m.rule?.category?.id || ''
  if (it === 'misspelling' || cat === 'TYPOS') return 0.99
  if (it === 'grammar') return 0.97
  if (it === 'typographical') return 0.98
  return 0.96
}

/**
 * @param {object} ltJson réponse /v2/check
 * @returns {NormalizedMatch[]}
 */
export function normalizeLanguageToolMatches(ltJson) {
  const list = ltJson?.matches || []
  return list.map((m) => ({
    offset: m.offset ?? 0,
    length: m.length ?? 0,
    message: m.message || m.shortMessage || 'LanguageTool',
    replacements: (m.replacements || [])
      .map((r) => (typeof r === 'string' ? r : r?.value ?? ''))
      .filter(Boolean),
    confidence: inferLtConfidence(m),
    source: 'languagetool',
    ruleRef: m.rule?.id || m.rule?.description || 'lt',
  }))
}

export function overlapsMatch(m, o) {
  return m.offset < o.offset + o.length && m.offset + m.length > o.offset
}

/**
 * Fusion : priorité à la plus forte confiance, sans chevauchement.
 * @param {NormalizedMatch[]} a
 * @param {NormalizedMatch[]} b
 */
export function mergeMatches(a, b) {
  const all = [...a, ...b].filter((m) => m.length > 0)
  all.sort((x, y) => y.confidence - x.confidence || x.offset - y.offset)
  const out = []
  for (const m of all) {
    if (out.some((o) => overlapsMatch(m, o))) continue
    out.push(m)
  }
  out.sort((x, y) => x.offset - y.offset)
  return out
}

/**
 * CDC : cas standard → LanguageTool **et** base d’accord → confiance ≥ 98 %.
 * Toute suggestion fusionnée qui chevauche à la fois une alerte LT et une règle maison est renforcée.
 *
 * @param {NormalizedMatch[]} merged résultat de mergeMatches(lt, home)
 * @param {NormalizedMatch[]} lt
 * @param {NormalizedMatch[]} home
 * @returns {NormalizedMatch[]}
 */
export function applyConsensusBoost(merged, lt, home) {
  return merged.map((m) => {
    const fromLt = lt.some((x) => overlapsMatch(x, m))
    const fromHome = home.some((x) => overlapsMatch(x, m))
    if (fromLt && fromHome) {
      return { ...m, confidence: Math.max(m.confidence ?? 0, 0.98) }
    }
    return m
  })
}
