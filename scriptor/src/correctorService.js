/**
 * Correcteur français — Brique 5.
 * Clic droit / temps réel mot : **LanguageTool seul** (séquence 2).
 * Analyse complète : `checkFrenchParagraph` dans CorrecteurFacade.
 */

import { checkFrenchParagraphRealtime, toLegacyMatches } from './corrector/CorrecteurFacade.js'
import { isUnderTemporalShield } from './corrector/temporalShield.js'

const USER_DICT_KEY = 'scriptor-user-dictionary'

export function loadUserDictionary() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(USER_DICT_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.map((w) => String(w).toLowerCase().trim()) : []
  } catch {
    return []
  }
}

export function saveUserDictionary(words) {
  if (typeof window === 'undefined') return
  try {
    const list = [...new Set(words.map((w) => String(w).toLowerCase().trim()).filter(Boolean))]
    window.localStorage.setItem(USER_DICT_KEY, JSON.stringify(list))
  } catch {
    // ignore localStorage write failure
  }
}

export function addToUserDictionary(word) {
  const w = String(word).toLowerCase().trim()
  if (!w) return
  const list = loadUserDictionary()
  if (list.includes(w)) return
  saveUserDictionary([...list, w])
}

export function isInUserDictionary(word) {
  const w = String(word).toLowerCase().trim()
  return loadUserDictionary().includes(w)
}

/**
 * @param {string} text
 * @param {{ documentPlain?: string, cursorOffset?: number }} [options] — pour le bouclier temporel (séquence 2)
 * @returns {Promise<{ matches: Array<{ message: string, offset: number, length: number, replacements: string[] }>, linguisticHint?: string, degraded?: boolean, hint?: string, temporalShield?: boolean }>}
 */
export async function checkText(text, options = {}) {
  const trimmed = (text || '').trim()
  if (!trimmed) return { matches: [] }

  const { documentPlain, cursorOffset } = options
  if (
    typeof documentPlain === 'string' &&
    typeof cursorOffset === 'number' &&
    documentPlain.length > 0 &&
    isUnderTemporalShield(documentPlain, Math.max(0, cursorOffset))
  ) {
    return {
      matches: [],
      temporalShield: true,
      hint: 'Passage sous bouclier temporel (flashback / analepse) : suggestions LanguageTool désactivées sur cette position.',
    }
  }

  const userDict = loadUserDictionary()
  const { matches, degraded, localLtError, linguisticHint } = await checkFrenchParagraphRealtime(trimmed, {
    userDict,
    awaitMorphalou: true,
  })
  const legacy = toLegacyMatches(matches)
  return {
    matches: legacy,
    linguisticHint: linguisticHint || undefined,
    degraded: !!degraded,
    hint: degraded
      ? localLtError ||
        'LanguageTool local indisponible. Démarrez le serveur sur http://127.0.0.1:8010 (variable SCRIPTOR_LANGUAGETOOL_URL côté Rust si besoin).'
      : undefined,
  }
}
