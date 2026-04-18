/**
 * Snapshot reproductibilité (CDC Brique 3) — version + empreinte des règles actives.
 */
export const PARSER_VERSION = '1.0.0'
const RULES_SEED = 'brique3-rules-v1|typo-groups|spaces|punct|fr-dialogue'

export async function computeRulesChecksum() {
  const buf = new TextEncoder().encode(RULES_SEED)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

export async function buildParserContextSnapshot() {
  return {
    parserVersion: PARSER_VERSION,
    rulesChecksum: await computeRulesChecksum(),
    lexiconVersion: 'bible-v1',
    timestamp: Math.floor(Date.now() / 1000),
  }
}
