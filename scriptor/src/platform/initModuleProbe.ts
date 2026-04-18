/**
 * En mode diagnostic, importe une liste de modules un par un pour repérer
 * un éventuel échec de chargement / exécution isolé.
 * Les imports sont souvent déjà en cache après le premier chargement de l’app.
 */

import {
  initDiagError,
  initDiagLog,
  initDiagnosticEnabled,
  initDiagStep,
} from './initDiagnostics'

type Probe = readonly [label: string, loader: () => Promise<unknown>]

function buildProbes(isTauri: boolean): Probe[] {
  /** Pas de react/App/storageAdapter ici : déjà importés statiquement (évite avertissements Rollup). */
  const tauriOnly: Probe[] = isTauri
    ? [
        ['module: @tauri-apps/api/core', () => import('@tauri-apps/api/core')],
        ['module: @tauri-apps/api/app', () => import('@tauri-apps/api/app')],
        ['module: platform/desktop (redondant si ok)', () => import('./desktop')],
      ]
    : []

  const lazyChunks: Probe[] = [
    ['module: UpdateNotification (lazy)', () => import('./UpdateNotification')],
    ['module: fullscreenShim', () => import('./fullscreenShim')],
  ]

  return [...tauriOnly, ...lazyChunks]
}

/**
 * À appeler une fois l’UI montée (ex. requestIdleCallback ou setTimeout 0).
 */
export function scheduleInitModuleProbe(): void {
  if (!initDiagnosticEnabled()) return

  const run = async () => {
    const isTauri = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
    initDiagLog('probe: séquence d’imports isolés', { isTauri })
    const probes = buildProbes(isTauri)
    for (const [label, loader] of probes) {
      try {
        await initDiagStep(label, loader)
      } catch (e) {
        initDiagError(`probe: arrêt sur ${label}`, e)
        break
      }
    }
    initDiagLog('probe: séquence terminée')
  }

  const schedule =
    typeof requestIdleCallback !== 'undefined'
      ? (cb: () => void) => requestIdleCallback(cb, { timeout: 5000 })
      : (cb: () => void) => setTimeout(cb, 0)

  schedule(() => {
    void run()
  })
}
