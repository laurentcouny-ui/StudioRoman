/** Verbes et formes d’incise fréquents (CDC Brique 3 — PDF). */
export const INCISE_WORDS = new Set(
  [
    'dit',
    'dis',
    'répond',
    'répondit',
    'répliqua',
    'soupire',
    'soupira',
    'murmure',
    'murmura',
    'chuchote',
    'chuchota',
    'crie',
    'cria',
    'hurle',
    'hurla',
    'demanda',
    'demande',
    'ajouta',
    'ajoute',
    'poursuivit',
    'continua',
    'insista',
    'balbutia',
    'grommela',
    'ricana',
    'sanglota',
  ].map((w) => w.toLowerCase()),
)

export function firstWordLower(s) {
  const t = String(s || '')
    .trim()
    .split(/\s+/)[0]
  if (!t) return ''
  return t.replace(/^[^\p{L}]+/u, '').replace(/[^\p{L}].*$/u, '').toLowerCase()
}

export function startsWithInciseVerb(line) {
  const w = firstWordLower(line)
  if (INCISE_WORDS.has(w)) return true
  // « il dit » / « elle murmura » : 2ᵉ mot parfois le verbe
  const parts = String(line || '')
    .trim()
    .split(/\s+/)
  if (parts.length >= 2) {
    const w2 = firstWordLower(parts[1])
    if (INCISE_WORDS.has(w2)) return true
  }
  return /^[a-zàâäéèêëïîôùûç]+\w*(?:ait|èrent|irent)\b/iu.test(String(line || '').trim())
}
