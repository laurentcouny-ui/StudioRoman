/**
 * Index Lexique 4.x (TSV) — formes graphiques et lemmes pour la base maison.
 * Fichier attendu : database/sources/lexique/Lexique4.tsv (non bundlé en string : ?url + fetch).
 */

import lexiqueTsvUrl from './sources/lexique/Lexique4.tsv?url'

/** @type {Set<string> | null} */
let formSet = null
/** @type {Set<string> | null} */
let lemmaSet = null
let loadPromise = null
let loadError = null
let lastLoadMs = 0

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFC')
    .trim()
}

function parseTsvToSets(text) {
  const forms = new Set()
  const lemmas = new Set()
  const lines = text.split(/\r?\n/)
  const start = lines[0] && lines[0].includes('1_Mot') ? 1 : 0
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.trim()) continue
    const cols = line.split('\t')
    const mot = normKey(cols[0] || '')
    const lem = normKey(cols[3] || '')
    if (mot) forms.add(mot)
    if (lem) lemmas.add(lem)
  }
  return { forms, lemmas }
}

/**
 * @returns {Promise<void>}
 */
export function ensureLexiqueIndex() {
  if (formSet && lemmaSet) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    try {
      const res = await fetch(lexiqueTsvUrl)
      if (!res.ok) throw new Error(`Lexique fetch ${res.status}`)
      const text = await res.text()
      const { forms, lemmas } = parseTsvToSets(text)
      formSet = forms
      lemmaSet = lemmas
      loadError = null
    } catch (e) {
      loadError = e
      formSet = new Set()
      lemmaSet = new Set()
    } finally {
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      lastLoadMs = t1 - t0
    }
  })()
  return loadPromise
}

/**
 * @returns {{ ready: boolean, formCount: number, error: string | null, loadMs: number }}
 */
export function getLexiqueIndexStatus() {
  return {
    ready: !!(formSet && formSet.size > 0),
    formCount: formSet?.size ?? 0,
    error: loadError ? String(loadError.message || loadError) : null,
    loadMs: lastLoadMs,
  }
}

/**
 * @param {string} word
 * @returns {boolean}
 */
export function isLexiqueForm(word) {
  if (!formSet || !word) return false
  const w = normKey(word)
  if (!w) return false
  if (formSet.has(w)) return true
  if (lemmaSet?.has(w)) return true
  return false
}

/**
 * @param {string} word
 */
export function isLexiqueLemma(word) {
  if (!lemmaSet || !word) return false
  return lemmaSet.has(normKey(word))
}
