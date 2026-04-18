import { lazy, Suspense, useEffect, useState } from 'react'
import { isDesktop, platform } from './index'
import { initDiagLog, initDiagStepSoft } from './initDiagnostics'
import {
  createManualSnapshot,
  getStorageReadonlyState,
  getConflictPayload,
  notifyCloudSyncSuccess,
  resolveConflict,
  resolveConflictMerge,
  restoreLatestSnapshot,
  setSafeMode,
  setStorageReadonly,
} from '../storageAdapter.js'

/** Découpe en paragraphes (double saut de ligne), aligné CDC Ghost Merge. */
function splitParagraphs(raw: string): string[] {
  const t = (raw || '').replace(/\r\n/g, '\n')
  if (!t.trim()) return ['']
  const parts = t.split(/\n\n+/).map((p) => p.trim())
  return parts.length ? parts : ['']
}

function padParagraphs(arr: string[], n: number): string[] {
  const c = [...arr]
  while (c.length < n) c.push('')
  return c
}

const UpdateNotification = lazy(() => import('./UpdateNotification'))

/**
 * Effets réservés au shell desktop : shim plein écran,
 * erreurs globales, bannière de mise à jour (lazy).
 * Aucune logique dans App.jsx.
 */
export function DesktopBootstrap() {
  const [storageStatus, setStorageStatus] = useState<{
    level: 'ok' | 'warn' | 'error'
    message?: string
    readonly?: boolean
    safeMode?: boolean
  } | null>(null)
  const [doubleInstance, setDoubleInstance] = useState(false)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [activeConflict, setActiveConflict] = useState<{
    path: string
    kind: string
    sceneId?: string
    localText: string
    conflictText: string
  } | null>(null)
  const [paraChoices, setParaChoices] = useState<('local' | 'external')[]>([])

  useEffect(() => {
    if (!isDesktop()) return

    let cancelled = false

    initDiagLog('DesktopBootstrap: effets shell desktop — début')

    void initDiagStepSoft('DesktopBootstrap: plugin-log attachConsole', async () => {
      const m = await import('@tauri-apps/plugin-log')
      await m.attachConsole()
    })

    void initDiagStepSoft('DesktopBootstrap: fullscreenShim', async () => {
      const { installFullscreenShim } = await import('./fullscreenShim')
      if (!cancelled) installFullscreenShim()
    })

    void initDiagStepSoft('DesktopBootstrap: backupService subscribeBackupStatus', async () => {
      const { subscribeBackupStatus } = await import('../backupService.js')
      const unsub = subscribeBackupStatus((snapshot: any) => {
        if (!snapshot?.lastSuccessAt) return
        void notifyCloudSyncSuccess(Number(snapshot.lastSuccessAt))
      })
      if (cancelled) unsub()
    })

    const prevOnError = window.onerror
    window.onerror = (message, source, lineno, colno, error) => {
      void platform.reportError({
        message: String(message),
        source: source ? `${source}:${String(lineno)}:${String(colno)}` : undefined,
        stack: error?.stack,
      })
      if (typeof prevOnError === 'function') {
        return prevOnError.call(window, message, source, lineno, colno, error)
      }
      return false
    }

    const onRejection = (ev: PromiseRejectionEvent) => {
      const reason = ev.reason
      void platform.reportError({
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      })
    }
    window.addEventListener('unhandledrejection', onRejection)
    const onStorageStatus = (ev: Event) => {
      const detail = (ev as CustomEvent).detail || {}
      const level =
        detail.level === 'error' ? 'error' : detail.level === 'warn' ? 'warn' : 'ok'
      let message = detail.message || ''
      if (!message) {
        if (detail.readonly) {
          message =
            "Scriptor ne peut pas écrire dans Documents/. Vérifiez vos droits ou votre antivirus."
        } else if (detail.safeMode) {
          message = 'Safe Mode actif'
        } else {
          message = 'Système de fichiers local opérationnel'
        }
      }
      if (detail.doubleInstance !== undefined) {
        setDoubleInstance(!!detail.doubleInstance)
      }
      setStorageStatus({
        level,
        message,
        readonly: !!detail.readonly,
        safeMode: !!detail.safeMode,
      })
    }
    window.addEventListener('scriptor-storage-status', onStorageStatus)
    const onConflicts = (ev: Event) => {
      const d = (ev as CustomEvent).detail || {}
      setConflicts(Array.isArray(d.files) ? d.files : [])
    }
    window.addEventListener('scriptor-storage-conflicts', onConflicts)

    return () => {
      cancelled = true
      window.onerror = prevOnError
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('scriptor-storage-status', onStorageStatus)
      window.removeEventListener('scriptor-storage-conflicts', onConflicts)
    }
  }, [])

  useEffect(() => {
    if (!activeConflict || activeConflict.kind !== 'scene') {
      setParaChoices([])
      return
    }
    const lp = splitParagraphs(activeConflict.localText)
    const cp = splitParagraphs(activeConflict.conflictText)
    const n = Math.max(lp.length, cp.length, 1)
    setParaChoices(Array.from({ length: n }, () => 'local'))
  }, [activeConflict])

  if (!isDesktop()) return null

  return (
    <Suspense fallback={null}>
      {doubleInstance ? (
        <div
          style={{
            position: 'fixed',
            left: 12,
            right: 12,
            top: 12,
            zIndex: 10001,
            fontSize: 11,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(251,191,36,0.45)',
            color: '#fef3c7',
            background: 'rgba(120,53,15,0.92)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
          }}
          role="status"
        >
          Une autre instance de Scriptor semble déjà ouverte (verrou présent). Risque de conflits si les deux
          écrivent — fermez l&apos;autre fenêtre ou travaillez sur un seul poste à la fois.
        </div>
      ) : null}
      {storageStatus ? (
        <div
          style={{
            position: 'fixed',
            right: 12,
            top: 86,
            bottom: 'auto',
            zIndex: 9999,
            fontSize: 11,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#f8fafc',
            background:
              storageStatus.level === 'error'
                ? '#991b1b'
                : storageStatus.level === 'warn'
                  ? '#a16207'
                  : '#166534',
            maxWidth: 460,
            boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
          }}
          title="État du stockage local"
        >
          {storageStatus.level === 'error'
            ? '🔴'
            : storageStatus.level === 'warn'
              ? '🟠'
              : '🟢'}{' '}
          {storageStatus.message}
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {storageStatus.readonly || getStorageReadonlyState() ? (
              <button
                type="button"
                onClick={() => {
                  void setStorageReadonly(false)
                }}
                style={{
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  color: '#fff',
                  background: 'rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                }}
              >
                Réactiver écriture
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void createManualSnapshot().then((p) => {
                  if (!p) return
                  window.dispatchEvent(
                    new CustomEvent('scriptor-storage-status', {
                      detail: {
                        level: 'warn',
                        message: `Snapshot manuel créé: ${String(p)}`,
                      },
                    }),
                  )
                })
              }}
              style={{
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 6,
                padding: '3px 8px',
                color: '#fff',
                background: 'rgba(0,0,0,0.25)',
                cursor: 'pointer',
              }}
            >
              Snapshot manuel
            </button>
            {storageStatus.safeMode ? (
              <button
                type="button"
                onClick={() => {
                  void setSafeMode(false)
                }}
                style={{
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  color: '#fff',
                  background: 'rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                }}
              >
                Quitter Safe Mode
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void setSafeMode(true)
                }}
                style={{
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 6,
                  padding: '3px 8px',
                  color: '#fff',
                  background: 'rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                }}
              >
                Activer Safe Mode
              </button>
            )}
          </div>
        </div>
      ) : null}
      {conflicts.length > 0 ? (
        <div
          style={{
            position: 'fixed',
            right: 12,
            top: 184,
            bottom: 'auto',
            zIndex: 9999,
            fontSize: 11,
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#f8fafc',
            background: '#7c2d12',
            maxWidth: 560,
            boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
          }}
        >
          🟠 Conflits détectés ({conflicts.length}). Les versions non choisies sont conservées.
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                const first = conflicts[0]
                if (!first) return
                void getConflictPayload(first).then((p) => {
                  if (p) setActiveConflict(p as any)
                })
              }}
              style={{
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 6,
                padding: '3px 8px',
                color: '#fff',
                background: 'rgba(0,0,0,0.25)',
                cursor: 'pointer',
              }}
            >
              Ouvrir le 1er conflit
            </button>
            <button
              type="button"
              onClick={() => {
                void restoreLatestSnapshot()
              }}
              style={{
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 6,
                padding: '3px 8px',
                color: '#fff',
                background: 'rgba(0,0,0,0.25)',
                cursor: 'pointer',
              }}
            >
              Restaurer dernier snapshot
            </button>
          </div>
        </div>
      ) : null}
      {activeConflict ? (
        <div
          style={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 10000,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.2)',
            background: '#0f172a',
            color: '#e2e8f0',
            padding: 10,
            maxHeight: 'min(70vh, 520px)',
            overflow: 'auto',
          }}
        >
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            Résolution conflit {activeConflict.kind === 'scene' ? 'scène' : 'manifest'}{' '}
            {activeConflict.sceneId ? `(${activeConflict.sceneId})` : ''}
          </div>
          {activeConflict.kind === 'scene' ? (
            <>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                Ghost merge : un paragraphe = bloc séparé par une ligne vide. Les boutons [&lt;] / [&gt;] choisissent
                la variante pour ce bloc. « Appliquer la fusion » enregistre le texte fusionné sur le disque et
                retire le fichier de conflit.
              </div>
              {(() => {
                const lp = splitParagraphs(activeConflict.localText)
                const cp = splitParagraphs(activeConflict.conflictText)
                const n = Math.max(lp.length, cp.length, 1)
                const localP = padParagraphs(lp, n)
                const conflictP = padParagraphs(cp, n)
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 88px',
                        gap: 6,
                        fontSize: 10,
                        color: '#94a3b8',
                      }}
                    >
                      <span>Local</span>
                      <span>Externe</span>
                      <span>Choix</span>
                    </div>
                    {Array.from({ length: n }, (_, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 88px',
                          gap: 6,
                          alignItems: 'start',
                          padding: 6,
                          borderRadius: 6,
                          background:
                            (paraChoices[i] ?? 'local') === 'external'
                              ? 'rgba(124,45,18,0.25)'
                              : 'rgba(6,95,70,0.2)',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: 120,
                            overflow: 'auto',
                          }}
                        >
                          {localP[i]}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            maxHeight: 120,
                            overflow: 'auto',
                          }}
                        >
                          {conflictP[i]}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => {
                              setParaChoices((prev) => {
                                const next = [...prev]
                                next[i] = 'local'
                                return next
                              })
                            }}
                            style={{
                              border: '1px solid rgba(255,255,255,0.25)',
                              borderRadius: 4,
                              padding: '3px 6px',
                              fontSize: 10,
                              color: '#fff',
                              background:
                                (paraChoices[i] ?? 'local') === 'local'
                                  ? '#065f46'
                                  : 'rgba(0,0,0,0.25)',
                              cursor: 'pointer',
                            }}
                          >
                            [&lt;] Local
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setParaChoices((prev) => {
                                const next = [...prev]
                                next[i] = 'external'
                                return next
                              })
                            }}
                            style={{
                              border: '1px solid rgba(255,255,255,0.25)',
                              borderRadius: 4,
                              padding: '3px 6px',
                              fontSize: 10,
                              color: '#fff',
                              background:
                                (paraChoices[i] ?? 'local') === 'external'
                                  ? '#7c2d12'
                                  : 'rgba(0,0,0,0.25)',
                              cursor: 'pointer',
                            }}
                          >
                            [&gt;] Ext.
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
              <textarea
                readOnly
                value={(() => {
                  const lp = splitParagraphs(activeConflict.localText)
                  const cp = splitParagraphs(activeConflict.conflictText)
                  const n = Math.max(lp.length, cp.length, 1)
                  const localP = padParagraphs(lp, n)
                  const conflictP = padParagraphs(cp, n)
                  return localP
                    .map((loc, i) =>
                      (paraChoices[i] ?? 'local') === 'external' ? conflictP[i] : loc,
                    )
                    .join('\n\n')
                })()}
                style={{
                  marginTop: 8,
                  width: '100%',
                  minHeight: 72,
                  background: '#020617',
                  color: '#94a3b8',
                  borderRadius: 6,
                  fontSize: 11,
                }}
                title="Aperçu de la fusion"
              />
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <textarea
                readOnly
                value={activeConflict.localText || ''}
                style={{ minHeight: 140, background: '#111827', color: '#cbd5e1', borderRadius: 6 }}
              />
              <textarea
                readOnly
                value={activeConflict.conflictText || ''}
                style={{ minHeight: 140, background: '#111827', color: '#cbd5e1', borderRadius: 6 }}
              />
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {activeConflict.kind === 'scene' ? (
              <button
                type="button"
                onClick={() => {
                  const lp = splitParagraphs(activeConflict.localText)
                  const cp = splitParagraphs(activeConflict.conflictText)
                  const n = Math.max(lp.length, cp.length, 1)
                  const localP = padParagraphs(lp, n)
                  const conflictP = padParagraphs(cp, n)
                  const merged = localP
                    .map((loc, i) =>
                      (paraChoices[i] ?? 'local') === 'external' ? conflictP[i] : loc,
                    )
                    .join('\n\n')
                  void resolveConflictMerge(activeConflict.path, merged).then((ok) => {
                    if (ok) setActiveConflict(null)
                  })
                }}
                style={{
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  color: '#fff',
                  background: '#1e3a5f',
                  cursor: 'pointer',
                }}
              >
                Appliquer la fusion
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void resolveConflict(activeConflict.path, 'local').then((ok) => {
                  if (ok) setActiveConflict(null)
                })
              }}
              style={{
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 6,
                padding: '4px 10px',
                color: '#fff',
                background: '#065f46',
                cursor: 'pointer',
              }}
            >
              {'[<] Tout local'}
            </button>
            <button
              type="button"
              onClick={() => {
                void resolveConflict(activeConflict.path, 'conflict').then((ok) => {
                  if (ok) setActiveConflict(null)
                })
              }}
              style={{
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 6,
                padding: '4px 10px',
                color: '#fff',
                background: '#7c2d12',
                cursor: 'pointer',
              }}
            >
              {'[>] Tout externe'}
            </button>
            <button
              type="button"
              onClick={() => setActiveConflict(null)}
              style={{
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 6,
                padding: '4px 10px',
                color: '#fff',
                background: 'rgba(0,0,0,0.25)',
                cursor: 'pointer',
              }}
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}
      <UpdateNotification />
    </Suspense>
  )
}
