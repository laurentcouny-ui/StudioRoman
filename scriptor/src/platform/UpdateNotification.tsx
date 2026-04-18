import { useEffect, useState } from 'react'
import { usePlatform } from './PlatformContext'

/**
 * Vérification GitHub lazy : après affichage UI, sans bloquer app_ready.
 */
export default function UpdateNotification() {
  const platformApi = usePlatform()
  const [latest, setLatest] = useState<string | null>(null)

  useEffect(() => {
    const releasesUrl = (import.meta.env?.VITE_RELEASES_LATEST_URL as string | undefined)?.trim()
    if (!releasesUrl) return

    const id = window.setTimeout(() => {
      void platformApi.checkForUpdates().then((r) => {
        if (r.available && r.latestVersion) setLatest(r.latestVersion)
      })
    }, 1200)
    return () => window.clearTimeout(id)
  }, [platformApi])

  if (!latest) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        maxWidth: '22rem',
        padding: '0.65rem 0.85rem',
        borderRadius: '0.5rem',
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(71, 85, 105, 0.85)',
        color: '#e2e8f0',
        fontSize: '0.8rem',
        lineHeight: 1.45,
        zIndex: 99998,
        boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
      }}
    >
      Nouvelle version ({latest}) disponible sur GitHub. Consultez la page des releases pour
      télécharger la dernière build.
    </div>
  )
}
