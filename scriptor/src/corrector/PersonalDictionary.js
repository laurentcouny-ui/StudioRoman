/**
 * Dictionnaire personnel par projet — noms propres, communs, radicaux (≥ 5 caractères).
 */
import { ensureLexiqueIndex, isLexiqueForm } from './database/lexiqueIndex.js'

function storageKey(projectId) {
  return `scriptor-personal-dict-${projectId || 'default'}`
}

/**
 * @returns {{ entries: Array<{ type: string, value: string, addedAt: number }> }}
 */
export function loadPersonalDictionary(projectId) {
  if (typeof window === 'undefined') return { entries: [] }
  try {
    const raw = window.localStorage.getItem(storageKey(projectId))
    if (!raw) return { entries: [] }
    const o = JSON.parse(raw)
    const entries = Array.isArray(o?.entries) ? o.entries : []
    return {
      entries: entries.filter((e) => e && typeof e.value === 'string' && typeof e.type === 'string'),
    }
  } catch {
    return { entries: [] }
  }
}

function savePersonalDictionary(projectId, data) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(data))
  } catch {
    // ignore
  }
}

/**
 * Liste de mots (minuscules) pour filtrage correcteur.
 * @param {string} projectId
 * @param {string[]} bibleTerms surfaces Bible
 */
export function getMergedUserWordsForProject(projectId, bibleTerms = []) {
  const { entries } = loadPersonalDictionary(projectId)
  const set = new Set()
  for (const t of bibleTerms) {
    const w = String(t).toLowerCase().trim()
    if (w) set.add(w)
  }
  for (const e of entries) {
    const v = String(e.value || '').toLowerCase().trim()
    if (!v) continue
    if (e.type === 'radical' && v.length >= 5) {
      set.add(v)
      continue
    }
    set.add(v)
  }
  return [...set]
}

/**
 * @param {string} projectId
 * @param {'proper' | 'common' | 'radical'} type
 * @param {string} value
 * @returns {{ ok: boolean, error?: string }}
 */
export async function addPersonalEntry(projectId, type, value) {
  const v = String(value || '').trim()
  if (v.length < 1) return { ok: false, error: 'Valeur vide.' }
  if (type === 'radical' && v.length < 5) {
    return { ok: false, error: 'Un radical doit faire au moins 5 caractères.' }
  }

  await ensureLexiqueIndex().catch(() => {})
  if (type === 'radical' && isLexiqueForm(v)) {
    return { ok: false, error: 'Collision avec un mot du lexique général — choisissez un autre radical.' }
  }

  const { entries } = loadPersonalDictionary(projectId)
  const lower = v.toLowerCase()
  if (entries.some((e) => String(e.value).toLowerCase() === lower)) {
    return { ok: false, error: 'Cette entrée existe déjà.' }
  }

  entries.push({ type, value: type === 'proper' ? capitalizeFirst(v) : v, addedAt: Date.now() })
  savePersonalDictionary(projectId, { entries })
  return { ok: true }
}

function capitalizeFirst(s) {
  if (!s) return s
  return s.slice(0, 1).toUpperCase() + s.slice(1)
}

export function removePersonalEntry(projectId, value) {
  const { entries } = loadPersonalDictionary(projectId)
  const lower = String(value).toLowerCase()
  const next = entries.filter((e) => String(e.value).toLowerCase() !== lower)
  savePersonalDictionary(projectId, { entries: next })
}

/** Mot ou préfixe accepté pour ce projet (radical). */
export function matchesPersonalOrBible(word, projectId, bibleTerms) {
  const w = String(word || '').toLowerCase().trim()
  if (!w) return false
  const merged = getMergedUserWordsForProject(projectId, bibleTerms)
  if (merged.includes(w)) return true
  const { entries } = loadPersonalDictionary(projectId)
  for (const e of entries) {
    if (e.type !== 'radical') continue
    const r = String(e.value || '').toLowerCase()
    if (r.length >= 5 && w.startsWith(r)) return true
  }
  return false
}
