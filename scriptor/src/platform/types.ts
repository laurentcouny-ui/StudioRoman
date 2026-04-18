/**
 * Couche plateforme : toutes les méthodes retournent des Promise pour ne pas bloquer
 * le thread UI côté WebView desktop.
 */
export interface PlatformAPI {
  log(message: string, level: string): Promise<void>
  reportError(payload: {
    message: string
    stack?: string
    source?: string
  }): Promise<void>
  toggleFullscreen(): Promise<void>
  checkForUpdates(): Promise<{ available: boolean; latestVersion?: string }>
  openMailClient(subject: string, body: string): Promise<void>
}
