/**
 * Index Morphalou 3.1 (CSV ATILF, LGPL-LR) — graphies des lemmes + toutes les formes fléchies.
 * Chargement paresseux : démarrer avec startMorphalouLoad() sans await ; fetch + parsing découpé pour ne pas figer l’UI.
 * Fichier : database/sources/morphalou/Morphalou3.1_CSV.csv (?url + fetch).
 */
import morphalouCsvUrl from './sources/morphalou/Morphalou3.1_CSV.csv?url'

/** @type {Set<string> | null} */
let formSet = null
let loadPromise = null
let loadError = null
let lastLoadMs = 0
/** @type {'idle' | 'running' | 'done' | 'error'} */
let loadPhase = 'idle'

/** Lignes de données traitées entre deux cessions au thread UI */
const PARSE_CHUNK_LINES = 12_000

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFC')
    .trim()
}

function yieldToHost() {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 72 })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

/**
 * Parse le CSV sans allouer un tableau d’un million de lignes : balayage séquentiel + pauses.
 * @param {string} text
 * @returns {Promise<Set<string>>}
 */
async function parseMorphalouCsvChunked(text) {
  const forms = new Set()
  const len = text.length
  let pos = 0
  let sawHeader = false
  let dataLineCount = 0

  while (pos < len) {
    const j = text.indexOf('\n', pos)
    const end = j === -1 ? len : j
    let line = text.slice(pos, end)
    pos = j === -1 ? len : j + 1
    if (line.endsWith('\r')) line = line.slice(0, -1)

    if (!sawHeader) {
      if (
        line.includes('GRAPHIE') &&
        line.includes('CATÉGORIE') &&
        line.includes('SOUS CATÉGORIE')
      ) {
        sawHeader = true
      }
      continue
    }

    const t = line.trim()
    if (t && !/^-{3,}$/.test(t) && line.includes(';')) {
      const cols = line.split(';')
      if (cols.length >= 10) {
        const lem = (cols[0] || '').trim()
        const flex = (cols[9] || '').trim()
        if (lem) forms.add(normKey(lem))
        if (flex) forms.add(normKey(flex))
      }
    }

    dataLineCount += 1
    if (dataLineCount % PARSE_CHUNK_LINES === 0) {
      await yieldToHost()
    }
  }

  return forms
}

function runMorphalouLoad() {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  loadPhase = 'running'
  return (async () => {
    try {
      const res = await fetch(morphalouCsvUrl)
      if (!res.ok) throw new Error(`Morphalou fetch ${res.status}`)
      const text = await res.text()
      const forms = await parseMorphalouCsvChunked(text)
      formSet = forms
      loadError = null
      loadPhase = 'done'
    } catch (e) {
      loadError = e
      formSet = new Set()
      loadPhase = 'error'
    } finally {
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      lastLoadMs = t1 - t0
    }
  })()
}

/**
 * Démarre le chargement Morphalou en arrière-plan (sans bloquer). Idempotent.
 * @returns {Promise<void>}
 */
export function ensureMorphalouIndex() {
  if (formSet !== null) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = runMorphalouLoad()
  return loadPromise
}

/**
 * Pareil que ensureMorphalouIndex mais usage explicite côté appelant : ne pas await.
 */
export function startMorphalouLoad() {
  void ensureMorphalouIndex().catch(() => {})
}

/**
 * @returns {{ ready: boolean, loading: boolean, formCount: number, error: string | null, loadMs: number }}
 */
export function getMorphalouIndexStatus() {
  return {
    ready: !!(formSet && formSet.size > 0),
    loading: loadPhase === 'running',
    formCount: formSet?.size ?? 0,
    error: loadError ? String(loadError.message || loadError) : null,
    loadMs: lastLoadMs,
  }
}

/**
 * @param {string} word
 * @returns {boolean}
 */
export function isMorphalouForm(word) {
  if (!formSet || !word) return false
  const w = normKey(word)
  return !!w && formSet.has(w)
}

export function getMorphalouFormCount() {
  return formSet?.size ?? 0
}
