import type { PlatformAPI } from './types'
import { getVersion } from '@tauri-apps/api/app'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open } from '@tauri-apps/plugin-shell'
import * as tauriLog from '@tauri-apps/plugin-log'
import { checkGitHubUpdate } from './updateCheckCore'

/*
 * SUPPORT_EMAIL — destinataire optionnel pour les rapports (mailto sans destinataire = client par défaut).
 * const SUPPORT_EMAIL = 'support@example.com'
 */

let fullscreenToggled = false

export const desktopPlatform: PlatformAPI = {
  async log(message: string, level: string): Promise<void> {
    const l = level.toLowerCase()
    try {
      if (l === 'error') await tauriLog.error(message)
      else if (l === 'warn') await tauriLog.warn(message)
      else if (l === 'debug') await tauriLog.debug(message)
      else if (l === 'trace') await tauriLog.trace(message)
      else await tauriLog.info(message)
    } catch {
      /* plugin pas prêt : ne pas faire planter l’UI */
    }
  },

  async reportError(payload: {
    message: string
    stack?: string
    source?: string
  }): Promise<void> {
    let v = 'dev'
    try {
      v = await getVersion()
    } catch {
      /* ignore */
    }
    const subject = `Rapport d'erreur Scriptor [${v}]`
    const combined = [payload.message, payload.source, payload.stack]
      .filter(Boolean)
      .join('\n\n')
    const body = combined.slice(0, 3000)
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    try {
      await open(mailto)
    } catch {
      /* silencieux */
    }
  },

  async toggleFullscreen(): Promise<void> {
    const w = getCurrentWindow()
    fullscreenToggled = !fullscreenToggled
    await w.setFullscreen(fullscreenToggled)
  },

  async checkForUpdates(): Promise<{ available: boolean; latestVersion?: string }> {
    const v = await getVersion()
    return checkGitHubUpdate(v)
  },

  async openMailClient(subject: string, body: string): Promise<void> {
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    await open(mailto)
  },
}
