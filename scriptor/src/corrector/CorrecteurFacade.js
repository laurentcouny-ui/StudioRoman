import { fetchLanguageToolCheck } from './engines/languageToolLocal.js'
import { runHomeDatabase } from './engines/homeDatabaseEngine.js'
import {
  normalizeLanguageToolMatches,
  mergeMatches,
  applyConsensusBoost,
} from './engines/consensus.js'
import { maybeArbitrate } from './engines/aiArbiterEngine.js'
import { runGramalecteParagraph } from './engines/gramalecteEngine.js'
import { ensureLexiqueIndex, isLexiqueForm } from './database/lexiqueIndex.js'
import { ensureMorphalouIndex, isMorphalouForm, startMorphalouLoad } from './database/morphalouIndex.js'
import { demoteLexiqueKnownSpellings } from './database/lexiqueReconcile.js'

/**
 * Pipeline séquence 1 : LanguageTool local + base maison + consensus + zone arbitre 90–97 %.
 *
 * @param {string} text
 * @param {{ userDict?: string[], respectArchaism?: boolean, awaitMorphalou?: boolean }} [opts]
 * @returns {Promise<{ matches: unknown[], degraded: boolean, localLtError: string | null, linguisticHint?: string | null }>}
 */
export async function checkFrenchParagraph(text, opts = {}) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return { matches: [], degraded: false, localLtError: null, linguisticHint: null }

  await ensureLexiqueIndex().catch(() => {})
  if (opts.awaitMorphalou === true) {
    await ensureMorphalouIndex().catch(() => {})
  } else {
    startMorphalouLoad()
  }

  let ltJson = null
  let ltError = null
  try {
    ltJson = await fetchLanguageToolCheck(trimmed, 'fr')
  } catch (e) {
    ltError = e
  }

  let lt = ltJson ? normalizeLanguageToolMatches(ltJson) : []
  lt = demoteLexiqueKnownSpellings(lt, trimmed)
  const home = (await runHomeDatabase(trimmed, opts)).matches
  const gl = await runGramalecteParagraph(trimmed)
  let merged = mergeMatches(lt, home)
  merged = applyConsensusBoost(merged, lt, home)
  merged = mergeMatches(merged, gl.matches)
  if (opts.absoluteConfidence === true) {
    merged = merged.filter((m) => (m.confidence ?? 0) >= 0.995)
  } else {
    merged = await Promise.all(merged.map((m) => maybeArbitrate(m)))
  }

  const userDict = opts.userDict || []
  const filtered = merged.filter((m) => {
    const w = trimmed.slice(m.offset, m.offset + m.length).trim()
    return w && !userDict.includes(w.toLowerCase())
  })

  /** Indication base linguistique (Lexique / Morphalou) quand LT ne remonte rien sur un seul token — onglet Écriture / CDC Brique 5. */
  let linguisticHint = null
  const singleToken = trimmed.length <= 96 && !/\s/.test(trimmed)
  if (singleToken && !ltError && filtered.length === 0) {
    const inLex = isLexiqueForm(trimmed)
    const inMorph = isMorphalouForm(trimmed)
    if (inLex || inMorph) {
      const parts = []
      if (inLex) parts.push('Lexique')
      if (inMorph) parts.push('Morphalou')
      linguisticHint = `Aucune alerte LanguageTool — forme attestée dans ${parts.join(' et ')} (base linguistique Scriptor).`
    }
  }

  return {
    matches: filtered,
    degraded: !!ltError,
    localLtError: ltError ? String(ltError.message || ltError) : null,
    linguisticHint,
  }
}

/**
 * CDC séquence 2 — temps réel / clic droit : **LanguageTool seul** (pas Gramalecte, pas base maison).
 */
export async function checkFrenchParagraphRealtime(text, opts = {}) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return { matches: [], degraded: false, localLtError: null, linguisticHint: null }

  await ensureLexiqueIndex().catch(() => {})
  if (opts.awaitMorphalou === true) {
    await ensureMorphalouIndex().catch(() => {})
  } else {
    startMorphalouLoad()
  }

  let ltJson = null
  let ltError = null
  try {
    ltJson = await fetchLanguageToolCheck(trimmed, 'fr')
  } catch (e) {
    ltError = e
  }

  let lt = ltJson ? normalizeLanguageToolMatches(ltJson) : []
  lt = demoteLexiqueKnownSpellings(lt, trimmed)
  let merged = await Promise.all(lt.map((m) => maybeArbitrate(m)))

  const userDict = opts.userDict || []
  const filtered = merged.filter((m) => {
    const w = trimmed.slice(m.offset, m.offset + m.length).trim()
    return w && !userDict.includes(w.toLowerCase())
  })

  let linguisticHint = null
  const singleToken = trimmed.length <= 96 && !/\s/.test(trimmed)
  if (singleToken && !ltError && filtered.length === 0) {
    const inLex = isLexiqueForm(trimmed)
    const inMorph = isMorphalouForm(trimmed)
    if (inLex || inMorph) {
      const parts = []
      if (inLex) parts.push('Lexique')
      if (inMorph) parts.push('Morphalou')
      linguisticHint = `Aucune alerte LanguageTool — forme attestée dans ${parts.join(' et ')} (base linguistique Scriptor).`
    }
  }

  return {
    matches: filtered,
    degraded: !!ltError,
    localLtError: ltError ? String(ltError.message || ltError) : null,
    linguisticHint,
  }
}

/** Compatibilité avec l’ancien `correctorService.checkText`. */
export function toLegacyMatches(normalized) {
  return (normalized || []).map((m) => ({
    message: m.message,
    offset: m.offset,
    length: m.length,
    replacements: m.replacements || [],
  }))
}
