/**
 * Gramalecte (fr) - couche d integration Scriptor.
 * Les gabarits dans sources/gramalecte/*.unbuilt-template.js.txt ne sont pas executables ;
 * un bundle compile peut etre depose dans database/gramalecte-built/fr-bundle.js (voir BUILD-HINT.txt).
 */

/** @typedef {{ offset: number, length: number, message: string, replacements: string[], confidence: number, source: string, ruleRef?: string }} NormalizedMatch */

let bundleLoadAttempted = false
let bundleModule = null

/**
 * @param {unknown} raw
 * @returns {NormalizedMatch[]}
 */
function normalizeGramalecteMatches(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const m of raw) {
    if (!m || typeof m.offset !== 'number' || typeof m.length !== 'number') continue
    const msg = String(m.message || m.label || 'Grammalecte')
    const repl = Array.isArray(m.replacements)
      ? m.replacements.map((r) => (typeof r === 'string' ? r : r?.value ?? '')).filter(Boolean)
      : m.replacement != null
        ? [String(m.replacement)]
        : []
    out.push({
      offset: m.offset,
      length: m.length,
      message: msg,
      replacements: repl,
      confidence: typeof m.confidence === 'number' ? m.confidence : 0.94,
      source: 'gramalecte',
      ruleRef: m.ruleId || m.rule || 'gramalecte',
    })
  }
  return out
}

async function tryLoadFrBundle() {
  if (bundleLoadAttempted) return bundleModule
  bundleLoadAttempted = true
  try {
    bundleModule = await import(
      /* @vite-ignore */ '../database/gramalecte-built/fr-bundle.js',
    )
  } catch {
    bundleModule = null
  }
  return bundleModule
}

/**
 * @returns {Promise<{ available: boolean, detail: string }>}
 */
export async function getGramalecteIntegrationStatus() {
  const mod = await tryLoadFrBundle()
  if (mod?.GRAMALECTE_BUNDLE_ACTIVE === true && typeof mod.checkFrenchText === 'function') {
    const v = mod.GRAMALECTE_VENDOR_VERSION ? ` v${mod.GRAMALECTE_VENDOR_VERSION}` : ''
    return { available: true, detail: `Gramalecte${v} (worker + /grammalecte-fr/)` }
  }
  return {
    available: false,
    detail:
      'Gramalecte indisponible (fr-bundle ou public/grammalecte-fr/). Voir database/gramalecte-built/BUILD-HINT.txt.',
  }
}

/**
 * @param {string} text
 * @returns {Promise<{ matches: NormalizedMatch[], skipped: boolean }>}
 */
export async function runGramalecteParagraph(text) {
  const raw = String(text || '')
  if (!raw.trim()) return { matches: [], skipped: true }

  const mod = await tryLoadFrBundle()
  if (
    !mod ||
    typeof mod.checkFrenchText !== 'function' ||
    mod.GRAMALECTE_BUNDLE_ACTIVE !== true
  ) {
    return { matches: [], skipped: true }
  }

  try {
    const rawMatches = await Promise.resolve(mod.checkFrenchText(raw))
    return { matches: normalizeGramalecteMatches(rawMatches), skipped: false }
  } catch {
    return { matches: [], skipped: true }
  }
}

/**
 * Installe les polyfills jsex Gramalecte (mutations String/RegExp/Map).
 * A appeler uniquement si fr-bundle.js en a besoin ; jsex_regex utilise RegExp.leftContext (non standard V8).
 */
export async function installGramalecteJsexPolyfills() {
  await import('../database/sources/gramalecte/jsex_string.js')
  await import('../database/sources/gramalecte/jsex_regex.js')
  await import('../database/sources/gramalecte/jsex_map.js')
}
