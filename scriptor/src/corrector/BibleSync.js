/**
 * Bible du projet : termes pour dictionnaire, cohérence nominale, zone phonétique.
 */
import { getCurrentSaga } from '../projectStore.js'
import { normalizePhoneticKey } from './phoneticUtils.js'

/**
 * @param {unknown} project
 * @returns {string[]}
 */
export function collectBibleSurfaceTerms(project) {
  const saga = getCurrentSaga(project)
  if (!saga || typeof saga !== 'object') return []

  /** @type {Set<string>} */
  const seen = new Set()
  /** @type {string[]} */
  const out = []

  const push = (raw) => {
    const s = String(raw || '').trim()
    if (s.length < 2) return
    const k = s.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push(s)
  }

  const chars = Array.isArray(project?.characters) ? project.characters : []
  for (const c of chars) {
    push(c?.name)
  }

  const bible = saga.bible && typeof saga.bible === 'object' ? saga.bible : {}
  const entries = Array.isArray(bible.entries) ? bible.entries : []
  for (const e of entries) {
    push(e?.title)
  }

  const wm = saga.worldMap && typeof saga.worldMap === 'object' ? saga.worldMap : {}
  const places = Array.isArray(wm.places) ? wm.places : []
  for (const p of places) {
    push(p?.title)
  }

  return out
}

/**
 * @param {string[]} terms
 * @returns {Set<string>}
 */
export function biblePhoneticKeys(terms) {
  const s = new Set()
  for (const t of terms) {
    const k = normalizePhoneticKey(t)
    if (k.length >= 2) s.add(k)
  }
  return s
}

/**
 * @param {string} word
 * @param {Set<string>} keys
 */
export function isPhoneticallyNearBibleTerm(word, keys) {
  const k = normalizePhoneticKey(word)
  return k.length >= 2 && keys.has(k)
}

/**
 * Mot présent comme forme Bible (insensible à la casse).
 * @param {string} word
 * @param {string[]} bibleTerms
 */
export function isWordCanonicallyInBible(word, bibleTerms) {
  const w = String(word || '').trim()
  if (!w) return false
  const lower = w.toLowerCase()
  return bibleTerms.some((t) => String(t).toLowerCase() === lower)
}

/**
 * Tokens mots dans le texte (offsets UTF-16).
 * @param {string} text
 * @returns {{ word: string, offset: number, length: number }[]}
 */
export function tokenizeWordsWithOffsets(text) {
  const s = String(text || '')
  const re = /[\p{L}\p{M}']+/gu
  const out = []
  let m
  while ((m = re.exec(s)) !== null) {
    out.push({ word: m[0], offset: m.index, length: m[0].length })
  }
  return out
}

/**
 * Détecte plusieurs surfaces distinctes pour une même clé phonétique liée à la Bible.
 * @param {string} plainText
 * @param {string[]} bibleTerms
 * @returns {Array<{ offset: number, length: number, confidence: number, message: string, replacements: string[], source: string, bibleNominal: boolean }>}
 */
export function findNominalCoherenceIssues(plainText, bibleTerms) {
  const keys = biblePhoneticKeys(bibleTerms)
  if (keys.size === 0) return []

  const tokens = tokenizeWordsWithOffsets(plainText)
  /** @type {Map<string, Set<string>>} */
  const keyToSurfaces = new Map()

  for (const { word } of tokens) {
    const pk = normalizePhoneticKey(word)
    if (pk.length < 2 || !keys.has(pk)) continue
    if (!keyToSurfaces.has(pk)) keyToSurfaces.set(pk, new Set())
    keyToSurfaces.get(pk).add(word)
  }

  /** @type {Set<string>} */
  const conflictKeys = new Set()
  for (const [pk, surfaces] of keyToSurfaces) {
    if (surfaces.size >= 2) conflictKeys.add(pk)
  }
  if (conflictKeys.size === 0) return []

  const msg =
    'Vérifier la cohérence avec la Bible — deux orthographes détectées pour un même nom.'
  /** @type {Array<{ offset: number, length: number, confidence: number, message: string, replacements: string[], source: string, bibleNominal: boolean }>} */
  const issues = []

  for (const { word, offset, length } of tokens) {
    const pk = normalizePhoneticKey(word)
    if (!conflictKeys.has(pk)) continue
    issues.push({
      offset,
      length,
      confidence: 0.99,
      message: msg,
      replacements: [],
      source: 'bible-sync',
      bibleNominal: true,
    })
  }

  return issues
}

/**
 * Graphie du texte ≠ entrée Bible (même famille phonétique) — une seule surface fautive suffit.
 * @param {string} plainText
 * @param {string[]} bibleTerms
 * @returns {Array<{ offset: number, length: number, confidence: number, message: string, replacements: string[], source: string, bibleNominal: boolean }>}
 */
export function findBibleCanonOrthographyIssues(plainText, bibleTerms) {
  const terms = (bibleTerms || []).map((t) => String(t).trim()).filter((t) => t.length >= 2)
  if (terms.length === 0) return []

  /** @type {Map<string, Set<string>>} */
  const pkToAllowedLower = new Map()
  for (const t of terms) {
    const pk = normalizePhoneticKey(t)
    if (pk.length < 2) continue
    if (!pkToAllowedLower.has(pk)) pkToAllowedLower.set(pk, new Set())
    pkToAllowedLower.get(pk).add(t.toLowerCase())
  }

  const msg =
    'Graphie différente de celle enregistrée dans la Bible pour ce nom (ou ce lieu).'
  /** @type {Array<{ offset: number, length: number, confidence: number, message: string, replacements: string[], source: string, bibleNominal: boolean }>} */
  const issues = []
  const tokens = tokenizeWordsWithOffsets(plainText)

  for (const { word, offset, length } of tokens) {
    if (word.length < 3) continue
    const pk = normalizePhoneticKey(word)
    if (pk.length < 2 || !pkToAllowedLower.has(pk)) continue
    const allowed = pkToAllowedLower.get(pk)
    const wl = word.toLowerCase()
    if (allowed.has(wl)) continue
    issues.push({
      offset,
      length,
      confidence: 0.99,
      message: msg,
      replacements: [],
      source: 'bible-sync',
      bibleNominal: true,
    })
  }

  return issues
}

const SNAPSHOT_KEY = 'scriptor-bible-names-snapshot'

/**
 * Compare l’état actuel des noms à un snapshot session ; retourne un message discret si renommage détecté.
 * @param {unknown} project
 * @returns {string | null}
 */
export function detectBibleRenameSinceLastSnapshot(project) {
  if (typeof window === 'undefined') return null
  const saga = getCurrentSaga(project)
  const sagaId = saga?.id ? String(saga.id) : ''
  if (!sagaId) return null

  const names = collectBibleSurfaceTerms(project)
    .map((n) => n.toLowerCase())
    .sort()
  const payload = JSON.stringify({ sagaId, names })

  try {
    const prev = window.sessionStorage.getItem(SNAPSHOT_KEY)
    window.sessionStorage.setItem(SNAPSHOT_KEY, payload)
    if (!prev) return null
    const o = JSON.parse(prev)
    if (o?.sagaId !== sagaId) return null
    const prevNames = Array.isArray(o.names) ? o.names : []
    const lost = prevNames.filter((n) => !names.includes(n))
    const gained = names.filter((n) => !prevNames.includes(n))
    if (lost.length === 0 && gained.length === 0) return null
    if (lost.length && gained.length) {
      return `Un personnage ou lieu a été renommé dans la Bible — pensez à harmoniser le texte (${gained[0] || '…'}).`
    }
    if (gained.length && !lost.length) {
      return 'De nouveaux noms Bible sont disponibles pour le correcteur.'
    }
    return 'La Bible a été modifiée — vérifiez les occurrences dans le manuscrit.'
  } catch {
    return null
  }
}
