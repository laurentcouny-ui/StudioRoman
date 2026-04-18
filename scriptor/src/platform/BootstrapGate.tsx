import { useEffect, useState, type ReactNode } from 'react'
import { initializeStorageAdapter } from '../storageAdapter.js'
import {
  initDiagError,
  initDiagLog,
  initDiagStep,
  initDiagStepSoft,
} from './initDiagnostics'

function isTauriShell(): boolean {
  if (typeof window === 'undefined') return false
  // Tauri v2 injecte __TAURI_INTERNALS__ (sans withGlobalTauri).
  // __TAURI__ n'est présent qu'avec withGlobalTauri: true (Tauri v2) ou Tauri v1.
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window
}

/**
 * Monte l’UI React tout de suite (plus de page blanche si le stockage Tauri bloque).
 * Web (Vite, ex. 5173) : pas d’attente — init stockage no-op.
 * Bureau : ferme le splash, puis message jusqu’à storage_init / bootstrap ; erreur affichée si invoke échoue.
 */
export function BootstrapGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'init' | 'ready' | 'error'>(() => (isTauriShell() ? 'init' : 'ready'))
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!isTauriShell()) {
      initDiagLog('BootstrapGate: shell web — init stockage (no-op possible)')
      void initDiagStep('BootstrapGate: initializeStorageAdapter (web)', () =>
        initializeStorageAdapter(),
      ).catch((e) => initDiagError('BootstrapGate: stockage web', e))
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        // Important : ne pas fermer le splash (app_ready) avant que le stockage desktop
        // ait fini de s’initialiser. Sinon, si storage_init / bootstrap bloque, l’utilisateur
        // reste sur la barre de progression du splash sans jamais voir l’erreur BootstrapGate.
        await initDiagStep('BootstrapGate: initializeStorageAdapter (desktop)', () =>
          initializeStorageAdapter(),
        )
        await initDiagStepSoft('BootstrapGate: app_ready (invoke)', async () => {
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('app_ready')
        })
        if (!cancelled) setPhase('ready')
      } catch (e) {
        initDiagError('BootstrapGate: flux Tauri complet', e)
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : String(e))
          setPhase('error')
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (phase === 'error') {
    return (
      <div
        style={{
          minHeight: '100vh',
          padding: '2rem',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Démarrage impossible</h1>
        <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>{err}</p>
        <p style={{ fontSize: '0.9rem' }}>
          Si le problème continue : fermez les autres instances de Scriptor, vérifiez l’antivirus sur le
          dossier Documents, puis relancez l’application.
        </p>
      </div>
    )
  }

  if (phase === 'init') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#94a3b8',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '0.95rem',
        }}
      >
        <p>Préparation de l&apos;espace de travail…</p>
      </div>
    )
  }

  return <>{children}</>
}
