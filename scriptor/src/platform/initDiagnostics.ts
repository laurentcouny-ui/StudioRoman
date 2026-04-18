/**
 * Journalisation structurée du démarrage (dev / diagnostic uniquement par défaut).
 *
 * Activer :
 * - variable d’environnement `VITE_INIT_DIAGNOSTIC=1` (voir .env.example)
 * - ou URL `?initDiag=1` (mémorisé en session pour la session courante)
 */

const PREFIX = '[Scriptor:init]'

function readSessionFlag(): boolean {
  try {
    return sessionStorage.getItem('scriptor-init-diag') === '1'
  } catch {
    return false
  }
}

function writeSessionFlag(): void {
  try {
    sessionStorage.setItem('scriptor-init-diag', '1')
  } catch {
    /* ignore */
  }
}

export function initDiagnosticEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (import.meta.env.VITE_INIT_DIAGNOSTIC === '1') return true
  if (readSessionFlag()) return true
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('initDiag') === '1') {
      writeSessionFlag()
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

function nowMs(): string {
  if (typeof performance === 'undefined') return '?'
  return performance.now().toFixed(1)
}

export function initDiagLog(step: string, detail?: unknown): void {
  if (!initDiagnosticEnabled()) return
  if (detail !== undefined) {
    console.info(`${PREFIX} [+${nowMs()}ms] ${step}`, detail)
  } else {
    console.info(`${PREFIX} [+${nowMs()}ms] ${step}`)
  }
}

export function initDiagWarn(step: string, detail?: unknown): void {
  if (!initDiagnosticEnabled()) return
  console.warn(`${PREFIX} [+${nowMs()}ms] ${step}`, detail ?? '')
}

export function initDiagError(step: string, err: unknown): void {
  if (!initDiagnosticEnabled()) return
  console.error(`${PREFIX} ÉCHEC — ${step}`, err)
}

/**
 * Exécute une étape async avec logs start/ok/erreur (relance l’erreur).
 */
export async function initDiagStep<T>(step: string, fn: () => Promise<T> | T): Promise<T> {
  initDiagLog(`${step} — début`)
  try {
    const out = await fn()
    initDiagLog(`${step} — ok`)
    return out
  } catch (e) {
    initDiagError(step, e)
    throw e
  }
}

/**
 * Comme initDiagStep mais renvoie undefined en cas d’échec (ne propage pas).
 */
export async function initDiagStepSoft<T>(step: string, fn: () => Promise<T> | T): Promise<T | undefined> {
  initDiagLog(`${step} — début (soft)`)
  try {
    const out = await fn()
    initDiagLog(`${step} — ok`)
    return out
  } catch (e) {
    initDiagWarn(`${step} — ignoré`, e)
    return undefined
  }
}
