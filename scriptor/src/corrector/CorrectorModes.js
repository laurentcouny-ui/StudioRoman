/**
 * Modes d’affichage correcteur — CDC Brique 5 séquence 2.
 */

export const CORRECTOR_MODE = {
  SIMPLE: 'simple',
  SIMPLE_STRICT: 'simple_strict',
  EXPERT: 'expert',
}

const KEY_MODE = 'scriptor-corrector-mode'
const KEY_GRACE_MS = 'scriptor-corrector-grace-ms'
const KEY_ABSOLUTE = 'scriptor-corrector-absolute-confidence'

const DEFAULT_GRACE_MS = 1400

export function getCorrectorMode() {
  if (typeof window === 'undefined') return CORRECTOR_MODE.SIMPLE
  const v = window.localStorage.getItem(KEY_MODE)
  if (v === CORRECTOR_MODE.SIMPLE_STRICT || v === CORRECTOR_MODE.EXPERT) return v
  return CORRECTOR_MODE.SIMPLE
}

export function setCorrectorMode(mode) {
  if (typeof window === 'undefined') return
  if (
    mode === CORRECTOR_MODE.SIMPLE ||
    mode === CORRECTOR_MODE.SIMPLE_STRICT ||
    mode === CORRECTOR_MODE.EXPERT
  ) {
    window.localStorage.setItem(KEY_MODE, mode)
  }
}

export function getGraceDelayMs() {
  if (typeof window === 'undefined') return DEFAULT_GRACE_MS
  const n = parseInt(window.localStorage.getItem(KEY_GRACE_MS) || '', 10)
  if (Number.isFinite(n) && n >= 0 && n <= 30_000) return n
  return DEFAULT_GRACE_MS
}

export function setGraceDelayMs(ms) {
  if (typeof window === 'undefined') return
  const n = Math.max(0, Math.min(30_000, Number(ms) || DEFAULT_GRACE_MS))
  window.localStorage.setItem(KEY_GRACE_MS, String(n))
}

/** Silencieuses actives sauf si l’auteur désactive ailleurs — Simple strict : sans chrome, mais toujours silencieux. */
export function silentAutoEnabledForMode(mode) {
  return (
    mode === CORRECTOR_MODE.SIMPLE ||
    mode === CORRECTOR_MODE.SIMPLE_STRICT ||
    mode === CORRECTOR_MODE.EXPERT
  )
}

/** Journal plume + liste (masqué en Simple strict — CDC séquence 2). */
export function showSilentJournalUi(mode) {
  return mode === CORRECTOR_MODE.SIMPLE || mode === CORRECTOR_MODE.EXPERT
}

/** @deprecated utiliser showSilentJournalUi */
export function showJournalChromeForMode(mode) {
  return showSilentJournalUi(mode)
}

export function showGraceDelayHint(mode) {
  return mode === CORRECTOR_MODE.SIMPLE || mode === CORRECTOR_MODE.EXPERT
}

export function showExpertChrome(mode) {
  return mode === CORRECTOR_MODE.EXPERT
}

/** Soulignements inline après « Analyser » — jamais en Simple strict. */
export function showInlineAnalysisHighlights(mode) {
  return mode !== CORRECTOR_MODE.SIMPLE_STRICT
}

/** Mode confiance absolue : uniquement alertes ≥ ~99,5 % — pas d’arbitre IA ambigu. */
export function getAbsoluteConfidenceMode() {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(KEY_ABSOLUTE) === '1'
}

export function setAbsoluteConfidenceMode(enabled) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY_ABSOLUTE, enabled ? '1' : '0')
}
