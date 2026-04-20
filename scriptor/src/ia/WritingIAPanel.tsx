import { useEffect, useState } from 'react'
import { AIPanel } from './AIPanel'
import { checkIaBackendHealth } from './apiClient'

const SESSION_KEY_PREFIX = 'scriptor_last_session_'

type Props = {
  editorText: string
  sceneId?: string | null
  sceneTitle?: string | null
  /** Périmètre « projet » pour la fiche de reprise (>24 h) : ex. id de saga courante. */
  sessionScopeId?: string | null
}

/**
 * Panneau IA intégré à l’onglet Écriture : reçoit le texte de la scène courante.
 */
export default function WritingIAPanel({
  editorText,
  sceneId,
  sceneTitle,
  sessionScopeId,
}: Props) {
  const [autoTriggerResume, setAutoTriggerResume] = useState(false)
  const [backendIssue, setBackendIssue] = useState<string | null>(null)

  const sessionKey =
    typeof sessionScopeId === 'string' && sessionScopeId.length > 0
      ? `${SESSION_KEY_PREFIX}${sessionScopeId}`
      : `${SESSION_KEY_PREFIX}default`

  useEffect(() => {
    let cancelled = false
    void checkIaBackendHealth().then((r) => {
      if (cancelled) return
      setBackendIssue(r.ok ? null : r.message || 'API IA indisponible')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const lastSessionStr = localStorage.getItem(sessionKey)
    const now = Date.now()
    if (lastSessionStr) {
      const lastSession = parseInt(lastSessionStr, 10)
      if (Number.isFinite(lastSession) && now - lastSession > 86400000) {
        queueMicrotask(() => setAutoTriggerResume(true))
      }
    }
    localStorage.setItem(sessionKey, now.toString())
    const interval = setInterval(() => {
      localStorage.setItem(sessionKey, Date.now().toString())
    }, 60000)
    return () => clearInterval(interval)
  }, [sessionKey])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {backendIssue ? (
        <div
          className="mb-2 rounded-md border border-amber-600/60 bg-amber-950/40 px-2 py-2 text-xs text-amber-100"
          role="alert"
        >
          <strong className="block text-amber-200">Studio Roman IA — connexion API</strong>
          <p className="mt-1 text-amber-100/90">{backendIssue}</p>
        </div>
      ) : null}
      {(sceneId || sceneTitle) && (
        <p className="mb-2 px-1 text-xs text-slate-500 dark:text-slate-400">
          Scène : <strong className="text-slate-700 dark:text-slate-200">{sceneTitle || 'Sans titre'}</strong>
        </p>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AIPanel editorText={editorText} autoTriggerResume={autoTriggerResume} />
      </div>
    </div>
  )
}
