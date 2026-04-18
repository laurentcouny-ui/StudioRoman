import type { PlatformAPI } from './types'
import { checkGitHubUpdate } from './updateCheckCore'

function getFullscreenElement(): Element | null {
  const d = document
  return (
    d.fullscreenElement ||
    (d as unknown as { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ||
    null
  )
}

async function requestAppFullscreen(): Promise<void> {
  const el = document.documentElement
  const fn =
    el.requestFullscreen ||
    (el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen
  if (!fn) return
  await Promise.resolve((fn as () => Promise<void> | void).call(el)).catch(() => {})
}

async function exitAppFullscreen(): Promise<void> {
  const d = document
  const fn =
    d.exitFullscreen ||
    (d as unknown as { webkitExitFullscreen?: () => Promise<void> }).webkitExitFullscreen
  if (!fn) return
  await Promise.resolve((fn as () => Promise<void> | void).call(d)).catch(() => {})
}

export const webPlatform: PlatformAPI = {
  async log(message: string, level: string): Promise<void> {
    const l = level.toLowerCase()
    if (l === 'error') console.error(message)
    else if (l === 'warn') console.warn(message)
    else console.log(message)
  },

  async reportError(payload: {
    message: string
    stack?: string
    source?: string
  }): Promise<void> {
    const lines = [payload.message, payload.source, payload.stack].filter(Boolean).join('\n')
    console.error('[Scriptor erreur]', lines)
  },

  async toggleFullscreen(): Promise<void> {
    if (getFullscreenElement()) await exitAppFullscreen()
    else await requestAppFullscreen()
  },

  async checkForUpdates(): Promise<{ available: boolean; latestVersion?: string }> {
    return checkGitHubUpdate(
      String(import.meta.env.VITE_APP_VERSION ?? '0.0.0'),
    )
  },

  async openMailClient(subject: string, body: string): Promise<void> {
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = url
  },
}
