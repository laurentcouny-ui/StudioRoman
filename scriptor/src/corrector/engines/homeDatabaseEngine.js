/**
 * Moteur 2 — base maison : règles mécaniques embarquées + hooks pour corpus externes (Lexique, Morphalou, etc.).
 */
import sampleRules from '../database/rules/sample-rules.json'
import { ensureLexiqueIndex } from '../database/lexiqueIndex.js'
import { startMorphalouLoad } from '../database/morphalouIndex.js'

function applyRegexRules(text) {
  const matches = []
  const doubleSpace = / {2,}/g
  let m
  while ((m = doubleSpace.exec(text)) !== null) {
    matches.push({
      offset: m.index,
      length: m[0].length,
      message: 'Espaces multiples',
      replacements: [' '],
      confidence: 0.995,
      source: 'home-db',
      ruleRef: 'mechanical-double-space',
    })
  }

  for (const rule of sampleRules) {
    try {
      const re = new RegExp(rule.pattern, 'g')
      let hit
      while ((hit = re.exec(text)) !== null) {
        const repl = rule.replacement.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
          String.fromCodePoint(parseInt(h, 16)),
        )
        matches.push({
          offset: hit.index,
          length: hit[0].length,
          message: rule.mentor || rule.id,
          replacements: [repl],
          confidence: rule.confidence ?? 0.95,
          source: 'home-db',
          ruleRef: rule.id,
        })
      }
    } catch {
      // regex invalide dans le JSON — ignorer
    }
  }

  return matches
}

/**
 * @param {string} text
 * @param {{ respectArchaism?: boolean }} [opts]
 */
export async function runHomeDatabase(text, opts = {}) {
  if (opts?.respectArchaism) {
    // Séquence 3 : bascule index archaïsme (Brachet / Acad. 1798) — pas encore branché.
  }
  await ensureLexiqueIndex().catch(() => {})
  startMorphalouLoad()
  const raw = String(text || '')
  if (!raw) return { matches: [] }
  return { matches: applyRegexRules(raw) }
}
