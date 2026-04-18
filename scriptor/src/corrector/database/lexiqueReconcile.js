/**
 * Ajuste les matches LanguageTool quand la forme est deja dans Lexique ou Morphalou (faux positifs orthographe).
 */
import { isLexiqueForm } from './lexiqueIndex.js'
import { isMorphalouForm } from './morphalouIndex.js'

/** @typedef {{ offset: number, length: number, message: string, replacements: string[], confidence: number, source: string, ruleRef?: string }} NormMatch */

function looksLikeSpellingMatch(m) {
  const ref = String(m.ruleRef || '').toLowerCase()
  const msg = String(m.message || '').toLowerCase()
  if (ref.includes('spell') || ref.includes('typo')) return true
  if (msg.includes('orthographe') || msg.includes('orthographic') || msg.includes('faute')) return true
  return m.confidence >= 0.98 && m.source === 'languagetool'
}

/**
 * @param {NormMatch[]} matches
 * @param {string} text
 * @returns {NormMatch[]}
 */
export function demoteLexiqueKnownSpellings(matches, text) {
  const raw = String(text || '')
  return matches.map((m) => {
    if (m.source !== 'languagetool' || !looksLikeSpellingMatch(m)) return m
    const slice = raw.slice(m.offset, m.offset + m.length)
    const inLex = isLexiqueForm(slice)
    const inMorph = isMorphalouForm(slice)
    if (!inLex && !inMorph) return m
    let hint = ''
    if (inLex && inMorph) hint = 'forme présente dans Lexique et Morphalou'
    else if (inLex) hint = 'forme présente dans Lexique'
    else hint = 'forme répertoriée dans Morphalou'
    return {
      ...m,
      confidence: Math.min(m.confidence, 0.86),
      message: `${m.message} (${hint} — vérifier le contexte)`,
    }
  })
}
