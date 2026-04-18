/**
 * Mémoire d’intention — amorçage (règle de l’indignation → « Style »).
 */

function key(projectId) {
  return `scriptor-intention-memory-${projectId || 'default'}`
}

/**
 * L’auteur indique que le correcteur s’est trompé en révisant — la correction reste appliquée.
 * Amélioration moteur : à brancher plus tard (télémétrie / backlog).
 */
export function recordIndignationCorrectionKept(projectId, contextSnippet) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(key(projectId)) || '[]'
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return
    arr.push({
      at: Date.now(),
      source: 'indignation-error',
      snippet: String(contextSnippet || '').slice(0, 280),
    })
    window.localStorage.setItem(key(projectId), JSON.stringify(arr.slice(-80)))
  } catch {
    // ignore
  }
}

export function recordCestMonStyle(projectId, opts = {}) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(key(projectId)) || '[]'
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return
    arr.push({
      at: Date.now(),
      source: 'cest-mon-style',
      scope: opts.scope === 'dialogues' ? 'dialogues' : 'book',
      pattern: String(opts.pattern || '').slice(0, 200),
      message: String(opts.message || '').slice(0, 120),
    })
    window.localStorage.setItem(key(projectId), JSON.stringify(arr.slice(-80)))
  } catch {
    // ignore
  }
}

export function recordStyleIndignation(projectId, contextSnippet) {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(key(projectId)) || '[]'
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return
    arr.push({
      at: Date.now(),
      source: 'indignation-restore',
      snippet: String(contextSnippet || '').slice(0, 280),
    })
    window.localStorage.setItem(key(projectId), JSON.stringify(arr.slice(-80)))
  } catch {
    // ignore
  }
}

export function countIntentionRules(projectId) {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(key(projectId)) || '[]'
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.length : 0
  } catch {
    return 0
  }
}

/** Statistique de liberté (certificat / profil) — règles issues de la mémoire d’intention. */
export function getLibertyStatistics(projectId) {
  const n = countIntentionRules(projectId)
  return {
    rulesCount: n,
    summary:
      n === 0
        ? 'Aucune règle de style personnelle enregistrée pour ce projet.'
        : `${n} entrée(s) dans la mémoire d’intention (indignation, style).`,
  }
}
