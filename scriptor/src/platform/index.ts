import { webPlatform } from './web'
import type { PlatformAPI } from './types'
import { initDiagLog } from './initDiagnostics'

let _isDesktop: boolean | null = null

export function isDesktop(): boolean {
  if (_isDesktop === null) {
    if (typeof window === 'undefined') {
      _isDesktop = false
    } else {
      // Tauri v2 injecte __TAURI_INTERNALS__ (sans withGlobalTauri).
      // __TAURI__ n'est présent qu'avec withGlobalTauri: true ou Tauri v1.
      _isDesktop = '__TAURI_INTERNALS__' in window || '__TAURI__' in window
    }
  }
  return _isDesktop
}

// Chargement sécurisé du module desktop : si l'import échoue (API Tauri absente,
// WebView2 en cours d'init), on bascule silencieusement sur webPlatform.
let _desktopModule: { desktopPlatform: PlatformAPI } | null = null
if (isDesktop()) {
  try {
    initDiagLog('platform: import dynamique ./desktop — début')
    _desktopModule = await import('./desktop')
    initDiagLog('platform: import dynamique ./desktop — ok')
  } catch (e) {
    initDiagLog('platform: import dynamique ./desktop — échec, fallback web', e)
    // Tauri APIs indisponibles — fallback web
  }
}

export const platform: PlatformAPI = _desktopModule?.desktopPlatform ?? webPlatform
