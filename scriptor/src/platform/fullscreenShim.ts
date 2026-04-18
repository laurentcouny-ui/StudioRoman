/**
 * Redirige les API plein écran DOM vers la fenêtre Tauri (sans modifier le code métier).
 * Conserve la cohérence avec getFullscreenElement via rustFs + getter document.
 */
import { getCurrentWindow } from '@tauri-apps/api/window'

let rustFs = false

export function installFullscreenShim(): void {
  const win = getCurrentWindow()

  HTMLElement.prototype.requestFullscreen = function (
    this: HTMLElement,
    ..._args: unknown[]
  ) {
    rustFs = true
    return win.setFullscreen(true).then(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    }) as Promise<void>
  }

  Document.prototype.exitFullscreen = function (this: Document, ..._args: unknown[]) {
    rustFs = false
    return win.setFullscreen(false).then(() => {
      document.dispatchEvent(new Event('fullscreenchange'))
    }) as Promise<void>
  }

  const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'fullscreenElement')
  const origGet = desc?.get
  if (origGet) {
    Object.defineProperty(Document.prototype, 'fullscreenElement', {
      configurable: true,
      get(this: Document) {
        if (rustFs) return this.documentElement
        return origGet.call(this)
      },
    })
  }

  void (async () => {
    try {
      const { listen } = await import('@tauri-apps/api/event')
      await listen('tauri://resize', async () => {
        const fs = await win.isFullscreen().catch(() => false)
        if (!fs && rustFs) {
          rustFs = false
          document.dispatchEvent(new Event('fullscreenchange'))
        }
      })
    } catch {
      /* ignore */
    }
  })()
}
