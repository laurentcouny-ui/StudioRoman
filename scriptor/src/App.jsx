import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import WritingTab from './WritingTab.jsx'
import CharactersTab from './CharactersTab.jsx'
import DashboardTab from './DashboardTab.jsx'
import BibleTab from './BibleTab.jsx'
import TimelineTab from './TimelineTab.jsx'
import WorldMapTab from './WorldMapTab.jsx'
import BackupTab from './BackupTab.jsx'
import PublisherTab from './PublisherTab.jsx'
import ImportTab from './ImportTab.jsx'
import UserGuideTab from './UserGuideTab.jsx'
import CorrectorOnboarding from './CorrectorOnboarding.jsx'
import GlobalBackupAlert from './GlobalBackupAlert.jsx'
import { requestCharacterDetectionOnSave } from './characterDetectionClient.js'
import { requestChapterSummaryOnSave } from './chapterSummaryClient.js'
import { scheduleUniverseSyncToBackend } from './ia/universeSync.ts'
import {
  STORAGE_KEY,
  loadInitialProject,
  computeStats,
  countWords,
  loadSceneText,
  saveSceneText,
  getCurrentSaga,
  createEmptyScene,
  createEmptyChapter,
  createEmptyVolume,
  createEmptySaga,
  getCharacterTemplate,
  exportFullBackup,
  clearSagaCover,
  removeVolumeFromSaga,
  clearSceneTexts,
  tryHydrateProjectFromRaw,
  isLikelyPristineDefaultProject,
  consumeAllowShrinkPersist,
  LAST_KNOWN_GOOD_KEY,
  recoverSceneTextFromIdb,
} from './projectStore.js'
import {
  completeDropboxAuth,
  completeGoogleAuth,
  CLOUD_AUTH_CHANGED_EVENT,
  startAutoUpload,
  pauseAutoUploadTimers,
  installCloudBackupUnloadFlush,
  subscribeBackupStatus,
  getBackupStatusSnapshot,
  emitStorageWarning,
} from './backupService.js'

// ─── Icônes SVG inline ────────────────────────────────────────────────────────
const Icon = {
  Writing: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5zM10 4l2 2"/>
    </svg>
  ),
  Dashboard: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="2" y="2" width="5" height="5" rx="0.75"/>
      <rect x="9" y="2" width="5" height="5" rx="0.75"/>
      <rect x="2" y="9" width="5" height="5" rx="0.75"/>
      <rect x="9" y="9" width="5" height="5" rx="0.75"/>
    </svg>
  ),
  Bible: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
      <path d="M8 2v12M5.5 6.5h5"/>
    </svg>
  ),
  Characters: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="8" cy="5.5" r="2.5"/>
      <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/>
    </svg>
  ),
  Timeline: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="2" y1="9" x2="14" y2="9"/>
      <circle cx="4.5" cy="9" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="8.5" cy="9" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="12.5" cy="9" r="1.5" fill="currentColor" stroke="none"/>
      <path d="M4.5 9V5.5M8.5 9V4M12.5 9V6.5"/>
    </svg>
  ),
  WorldMap: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6"/>
      <path d="M2 8h12M8 2c-1.5 2-2 4-2 6s.5 4 2 6M8 2c1.5 2 2 4 2 6s-.5 4-2 6"/>
    </svg>
  ),
  Publisher: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v9M5 5l3-3 3 3"/>
      <path d="M3 11v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2"/>
    </svg>
  ),
  Import: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 11V2M5 8l3 3 3-3"/>
      <path d="M3 11v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2"/>
    </svg>
  ),
  Backup: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 13H12a3 3 0 0 0 0-6h-.5A5 5 0 1 0 4 13h1.5"/>
      <path d="M8 10v4M6 12l2 2 2-2"/>
    </svg>
  ),
  Guide: () => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="8" cy="8" r="6"/>
      <path d="M6.5 6.2C6.5 5 7 4.5 8 4.5c1 0 1.5.7 1.5 1.5C9.5 7.5 8 8 8 9.5"/>
      <circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none"/>
    </svg>
  ),
}

const TABS = [
  { id: 'writing',    label: 'Écriture',   icon: Icon.Writing },
  { id: 'dashboard',  label: 'Tableau',    icon: Icon.Dashboard },
  { id: 'bible',      label: 'Bible',      icon: Icon.Bible },
  { id: 'characters', label: 'Personnages', icon: Icon.Characters },
  { id: 'timeline',   label: 'Chronologie', icon: Icon.Timeline },
  { id: 'worldmap',   label: 'Carte',      icon: Icon.WorldMap },
  { id: 'publisher',  label: 'Export',     icon: Icon.Publisher },
  { id: 'import',     label: 'Import',     icon: Icon.Import },
  { id: 'backup',     label: 'Sauvegarde', icon: Icon.Backup },
  { id: 'guide',      label: 'Guide',      icon: Icon.Guide },
]

function getFirstSceneIds(project) {
  const saga = getCurrentSaga(project)
  const volume = saga?.volumes?.[0]
  const chapter = volume?.chapters?.[0]
  const scene = chapter?.scenes?.[0]
  return {
    volumeId: volume?.id ?? null,
    chapterId: chapter?.id ?? null,
    sceneId: scene?.id ?? null,
  }
}

function cloneProject(prev) {
  return structuredClone ? structuredClone(prev) : JSON.parse(JSON.stringify(prev))
}

/** Clone du projet avec une scène retirée (pour calculer la sélection après suppression). */
function projectAfterDeletingScene(project, sceneIdToDelete) {
  const next = cloneProject(project)
  const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
  if (!saga?.volumes) return null
  for (const volume of saga.volumes) {
    for (const chapter of volume.chapters || []) {
      const scenes = Array.isArray(chapter?.scenes) ? chapter.scenes : []
      const index = scenes.findIndex((s) => s.id === sceneIdToDelete)
      if (index !== -1) {
        scenes.splice(index, 1)
        return next
      }
    }
  }
  return null
}

/** Élément en plein écran navigateur (API standard + préfixes). */
function getFullscreenElement() {
  const d = document
  return (
    d.fullscreenElement ||
    d.webkitFullscreenElement ||
    d.mozFullScreenElement ||
    d.msFullscreenElement ||
    null
  )
}

function requestAppFullscreen() {
  const el = document.documentElement
  const fn =
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen
  if (!fn) return
  Promise.resolve(fn.call(el)).catch(() => {})
}

function exitAppFullscreen() {
  const d = document
  const fn =
    d.exitFullscreen ||
    d.webkitExitFullscreen ||
    d.mozCancelFullScreen ||
    d.msExitFullscreen
  if (!fn) return
  Promise.resolve(fn.call(d)).catch(() => {})
}

function App() {
  const initialProject = useMemo(() => loadInitialProject(), [])

  const [activeTab, setActiveTab] = useState('writing')
  const [project, setProject] = useState(() => initialProject)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(() => getFirstSceneIds(initialProject))
  const [sceneText, setSceneText] = useState(() => {
    const ids = getFirstSceneIds(initialProject)
    return ids.sceneId ? loadSceneText(ids.sceneId) || '' : ''
  })
  const [pendingDelete, setPendingDelete] = useState(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState(() => initialProject?.characters?.[0]?.id ?? null)
  const [backupStatus, setBackupStatus] = useState(() => getBackupStatusSnapshot())
  const [globalStorageWarning, setGlobalStorageWarning] = useState('')
  const wordCountUpdateTimerRef = useRef(null)
  const [sagaMenuOpen, setSagaMenuOpen] = useState(false)
  const sagaMenuRef = useRef(null)
  const [nowTs, setNowTs] = useState(() => Date.now())

  const CORRECTOR_ONBOARDING_DONE_KEY = 'scriptor-onboarding-tour-v2-done'
  const [correctorOnboardingOpen, setCorrectorOnboardingOpen] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(CORRECTOR_ONBOARDING_DONE_KEY) !== '1') {
        setCorrectorOnboardingOpen(true)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const onReplay = () => setCorrectorOnboardingOpen(true)
    window.addEventListener('scriptor-replay-corrector-tour', onReplay)
    return () => window.removeEventListener('scriptor-replay-corrector-tour', onReplay)
  }, [])

  const completeCorrectorOnboarding = useCallback(() => {
    try {
      window.localStorage.setItem(CORRECTOR_ONBOARDING_DONE_KEY, '1')
    } catch {
      // ignore
    }
    setCorrectorOnboardingOpen(false)
  }, [])

  const handleToggleFocus = () => {
    setIsFocusMode((prev) => {
      if (prev) {
        exitAppFullscreen()
        return false
      }
      requestAppFullscreen()
      return true
    })
  }

  useEffect(() => {
    const syncFocusWithFullscreen = () => {
      if (!getFullscreenElement()) {
        setIsFocusMode((fm) => (fm ? false : fm))
      }
    }
    document.addEventListener('fullscreenchange', syncFocusWithFullscreen)
    document.addEventListener('webkitfullscreenchange', syncFocusWithFullscreen)
    return () => {
      document.removeEventListener('fullscreenchange', syncFocusWithFullscreen)
      document.removeEventListener('webkitfullscreenchange', syncFocusWithFullscreen)
    }
  }, [])

  const currentSaga = useMemo(() => getCurrentSaga(project), [project])

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTs(Date.now())
    }, 30000)
    return () => window.clearInterval(id)
  }, [])

  const formatRelativeTime = useCallback((ts) => {
    if (!ts) return 'jamais'
    const diffSec = Math.max(0, Math.floor((nowTs - ts) / 1000))
    if (diffSec < 60) return "à l'instant"
    if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`
    if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`
    return `il y a ${Math.floor(diffSec / 86400)} j`
  }, [nowTs])

  const formatInTime = useCallback((ts) => {
    if (ts == null || Number.isNaN(ts)) return 'non planifiée'
    const diffSec = Math.max(0, Math.floor((ts - nowTs) / 1000))
    if (diffSec < 60) return "dans moins d'une minute"
    if (diffSec < 3600) return `dans ${Math.floor(diffSec / 60)} min`
    if (diffSec < 86400) return `dans ${Math.floor(diffSec / 3600)} h`
    return `dans ${Math.floor(diffSec / 86400)} j`
  }, [nowTs])

  const nextCloudBackupLabel = useMemo(() => {
    const c = backupStatus?.connected
    const hasCloud = Boolean(c?.drive || c?.dropbox)
    if (!hasCloud) {
      return 'non planifiée (connectez Google Drive ou Dropbox dans Sauvegarde)'
    }
    const t = backupStatus?.nextAttemptAt
    if (t == null || Number.isNaN(t)) return 'planification en cours…'
    return formatInTime(t)
  }, [backupStatus, formatInTime])

  const globalBackupSeverity = useMemo(() => {
    if (globalStorageWarning || backupStatus?.lastError) return 'critical'
    const failures = backupStatus?.consecutiveFailures || 0
    if (failures >= 2 || backupStatus?.pendingQueue) return 'degraded'
    return 'ok'
  }, [backupStatus, globalStorageWarning])

  const globalBackupMessage = useMemo(() => {
    if (globalBackupSeverity === 'critical') {
      return backupStatus?.lastError
        ? `Erreur cloud: ${backupStatus.lastError}`
        : globalStorageWarning
    }
    if (globalBackupSeverity === 'degraded') {
      return backupStatus?.pendingQueue
        ? 'Sauvegarde en mode reprise: une file d’attente locale est en attente d’envoi.'
        : 'Sauvegarde dégradée: plusieurs échecs récents détectés.'
    }
    return 'Sauvegarde cloud opérationnelle.'
  }, [backupStatus, globalBackupSeverity, globalStorageWarning])

  useEffect(() => {
    completeDropboxAuth()
    completeGoogleAuth()
    queueMicrotask(() => {
      startAutoUpload(exportFullBackup)
      installCloudBackupUnloadFlush()
      setBackupStatus(getBackupStatusSnapshot())
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorageWarning = (e) => {
      const scope = e?.detail?.scope || 'stockage'
      const hint = e?.detail?.message ? ` ${e.detail.message}` : ''
      setGlobalStorageWarning(
        `Alerte sauvegarde locale (${scope}).${hint} Exportez une sauvegarde locale (JSON).`,
      )
    }
    window.addEventListener('scriptor-storage-warning', onStorageWarning)
    return () => window.removeEventListener('scriptor-storage-warning', onStorageWarning)
  }, [])

  useEffect(() => {
    return () => pauseAutoUploadTimers()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const kick = () => {
      startAutoUpload(exportFullBackup)
      queueMicrotask(() => setBackupStatus(getBackupStatusSnapshot()))
    }
    window.addEventListener(CLOUD_AUTH_CHANGED_EVENT, kick)
    return () => window.removeEventListener(CLOUD_AUTH_CHANGED_EVENT, kick)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const sync = () => {
      startAutoUpload(exportFullBackup)
      queueMicrotask(() => setBackupStatus(getBackupStatusSnapshot()))
    }
    window.addEventListener('focus', sync)
    const onVis = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    const list = project.characters || []
    if (!selectedCharacterId || !list.some((c) => c.id === selectedCharacterId)) {
      queueMicrotask(() => {
        setSelectedCharacterId(list[0]?.id ?? null)
      })
    }
  }, [project.characters, selectedCharacterId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const serialized = JSON.stringify(project)
      const existing = window.localStorage.getItem(STORAGE_KEY)
      const MIN_PREVIOUS_BYTES = 3500
      const wouldClobberBigData =
        existing &&
        existing.length >= MIN_PREVIOUS_BYTES &&
        isLikelyPristineDefaultProject(project) &&
        !consumeAllowShrinkPersist()

      if (wouldClobberBigData) {
        const recovered = tryHydrateProjectFromRaw(existing)
        if (recovered) {
          queueMicrotask(() => {
            setGlobalStorageWarning(
              "Scriptor a évité d'écraser votre projet : l'affichage correspondait au projet vierge par défaut alors qu'une copie locale plus complète existait. Vos sagas ont été réalignées sur cette copie — exportez un fichier JSON (Sauvegarde locale) pour sécuriser.",
            )
            setProject(recovered)
            const ids = getFirstSceneIds(recovered)
            setSelectedIds(ids)
            setSceneText(ids.sceneId ? loadSceneText(ids.sceneId) || '' : '')
          })
          return
        }
        queueMicrotask(() => {
          setGlobalStorageWarning(
            'Écriture locale bloquée : données navigateur incohérentes. Rechargez la page ou restaurez un fichier JSON (Sauvegarde locale).',
          )
        })
        return
      }

      window.localStorage.setItem(STORAGE_KEY, serialized)
      if (serialized.length >= 800) {
        try {
          window.localStorage.setItem(LAST_KNOWN_GOOD_KEY, serialized)
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      let message =
        "Impossible d'enregistrer le projet dans le stockage du navigateur (localStorage)."
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        message =
          typeof window !== 'undefined' &&
          ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
            ? 'Quota du cache WebView (localStorage) dépassé — ce n’est pas l’espace disque. Le bureau enregistre aussi sur le disque : rechargez l’app après mise à jour, ou exportez un JSON. En navigation web seule, libérez le localStorage (F12 → Stockage).'
            : 'Quota localStorage dépassé : le navigateur limite souvent ce stockage à environ 5–10 Mo pour ce site — ce n’est pas lié à l’espace libre sur le disque. Exportez tout de suite un JSON (Sauvegarde locale), puis ouvrez les outils développeur (F12) → Stockage / Application → « Local storage » et supprimez d’anciennes clés scriptor-* ou videz les données du site pour ce domaine.'
      } else if (err?.name === 'SecurityError') {
        message =
          'Accès au stockage local refusé (navigation privée, cadre sécurisé ou paramètres du navigateur).'
      } else if (err?.message) {
        message = String(err.message)
      }
      emitStorageWarning('project-root-write', message)
    }
    startAutoUpload(exportFullBackup)
    queueMicrotask(() => setBackupStatus(getBackupStatusSnapshot()))
  }, [project])

  useEffect(() => {
    if (typeof window === 'undefined') return () => {}
    return scheduleUniverseSyncToBackend(project, 2200)
  }, [project])

  useEffect(() => {
    const unsub = subscribeBackupStatus((snapshot) => setBackupStatus(snapshot))
    return () => unsub()
  }, [])

  useEffect(() => {
    return () => {
      if (wordCountUpdateTimerRef.current) {
        clearTimeout(wordCountUpdateTimerRef.current)
        wordCountUpdateTimerRef.current = null
      }
    }
  }, [])

  // Ferme le menu saga au clic extérieur
  useEffect(() => {
    if (!sagaMenuOpen) return
    const onPointerDown = (e) => {
      if (sagaMenuRef.current?.contains(e.target)) return
      setSagaMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [sagaMenuOpen])

  const stats = useMemo(() => computeStats(project), [project])

  const applyWritingSelection = (ids) => {
    setSelectedIds(ids)
    const text = ids.sceneId ? loadSceneText(ids.sceneId) || '' : ''
    setSceneText(text)
    // Si localStorage vide, tentative de récupération depuis IndexedDB
    if (ids.sceneId && !text) {
      recoverSceneTextFromIdb(ids.sceneId).then((recovered) => {
        if (recovered) setSceneText(recovered)
      })
    }
  }

  const applyChapterSummaryToCurrentChapter = useCallback(
    (summaryText) => {
      if (!summaryText) return
      const { volumeId, chapterId } = selectedIds
      if (!volumeId || !chapterId) return

      setProject((prev) => {
        const next = structuredClone
          ? structuredClone(prev)
          : JSON.parse(JSON.stringify(prev))
        const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
        if (!saga?.volumes) return prev
        const volume = saga.volumes.find((v) => v.id === volumeId)
        if (!volume) return prev
        const chapter = volume.chapters.find((c) => c.id === chapterId)
        if (!chapter) return prev
        chapter.aiSummary = summaryText
        chapter.aiSummaryUpdatedAt = Date.now()
        return next
      })
    },
    [selectedIds],
  )

  const applyDetectedCharactersToCurrentScene = useCallback(
    (detectedNames) => {
      const { volumeId, chapterId, sceneId } = selectedIds
      if (!volumeId || !chapterId || !sceneId) return
      if (!Array.isArray(detectedNames) || detectedNames.length === 0) return

      const normalize = (s) =>
        String(s || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, ' ')
          .trim()

      const namesSet = new Set(detectedNames.map(normalize).filter(Boolean))
      if (namesSet.size === 0) return

      setProject((prev) => {
        const next = structuredClone
          ? structuredClone(prev)
          : JSON.parse(JSON.stringify(prev))
        const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
        if (!saga?.volumes) return prev
        const volume = saga.volumes.find((v) => v.id === volumeId)
        if (!volume) return prev
        const chapter = volume.chapters.find((c) => c.id === chapterId)
        if (!chapter) return prev
        const scene = chapter.scenes.find((s) => s.id === sceneId)
        if (!scene) return prev

        const mergedIds = Array.isArray(scene.charactersInScene)
          ? scene.charactersInScene.filter(Boolean)
          : []
        const byName = new Map(
          (next.characters || [])
            .filter((c) => c?.id && c?.name)
            .map((c) => [normalize(c.name), c.id]),
        )

        let changed = false
        for (const n of namesSet) {
          const id = byName.get(n)
          if (id && !mergedIds.includes(id)) {
            mergedIds.push(id)
            changed = true
          }
        }
        if (!changed) return prev
        scene.charactersInScene = mergedIds
        return next
      })
    },
    [selectedIds],
  )

  const runExplicitSaveIAHooks = useCallback(() => {
    if (!selectedIds?.sceneId) return
    void requestCharacterDetectionOnSave(sceneText).then(applyDetectedCharactersToCurrentScene)
    const chapter = currentSaga?.volumes
      ?.find((v) => v.id === selectedIds.volumeId)
      ?.chapters?.find((c) => c.id === selectedIds.chapterId)
    void requestChapterSummaryOnSave(chapter).then(applyChapterSummaryToCurrentChapter)
  }, [
    selectedIds,
    sceneText,
    currentSaga,
    applyDetectedCharactersToCurrentScene,
    applyChapterSummaryToCurrentChapter,
  ])

  /** CDC Phase 2/3 — hooks IA uniquement sur déclencheur explicite de sauvegarde. */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key !== 's' && e.key !== 'S') return
      if (activeTab !== 'writing') return
      if (!selectedIds?.sceneId) return
      e.preventDefault()
      runExplicitSaveIAHooks()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    activeTab,
    selectedIds,
    runExplicitSaveIAHooks,
  ])

  const handleUpdateSceneField = (field, value) => {
    const { volumeId, chapterId, sceneId } = selectedIds
    if (!volumeId || !chapterId || !sceneId) return

    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga?.volumes) return prev
      const volume = saga.volumes.find((v) => v.id === volumeId)
      if (!volume) return prev
      const chapter = volume.chapters.find((c) => c.id === chapterId)
      if (!chapter) return prev
      const scene = chapter.scenes.find((s) => s.id === sceneId)
      if (!scene) return prev
      scene[field] = value
      return next
    })

    // CDC: déclencheur explicite "fin de scène" (statut Terminé) => analyse personnages à la demande.
    if (field === 'status' && value === 'done') {
      runExplicitSaveIAHooks()
    }
  }

  const handleUpdateChapterField = (volumeId, chapterId, field, value) => {
    if (!volumeId || !chapterId) return
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga?.volumes) return prev
      const volume = saga.volumes.find((v) => v.id === volumeId)
      if (!volume) return prev
      const chapter = volume.chapters.find((c) => c.id === chapterId)
      if (!chapter) return prev
      chapter[field] = value
      return next
    })
  }

  const handleUpdateSagaTitle = (sagaId, value) => {
    if (!sagaId) return
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === sagaId)
      if (!saga) return prev
      saga.title = value ?? ''
      return next
    })
  }

  const handleUpdateVolumeTitle = (volumeId, value) => {
    if (!volumeId) return
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga?.volumes) return prev
      const volume = saga.volumes.find((v) => v.id === volumeId)
      if (!volume) return prev
      volume.title = value ?? ''
      return next
    })
  }

  const getDefaultVolumeAndChapter = () => {
    const vol = currentSaga?.volumes?.[0]
    const ch = vol?.chapters?.[0]
    return { volumeId: vol?.id ?? null, chapterId: ch?.id ?? null }
  }

  const handleAddScene = () => {
    let { volumeId, chapterId } = selectedIds
    const volume = currentSaga?.volumes?.find((v) => v.id === volumeId)
    const chapter = volume?.chapters?.find((c) => c.id === chapterId)
    if (!volume || !chapter) {
      const def = getDefaultVolumeAndChapter()
      volumeId = def.volumeId
      chapterId = def.chapterId
    }
    if (!volumeId || !chapterId) return
    handleAddSceneToChapter(volumeId, chapterId)
  }

  const handleAddSceneToChapter = (volumeId, chapterId) => {
    if (!volumeId || !chapterId) return
    const newScene = createEmptyScene()

    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga?.volumes) return prev
      const volume = saga.volumes.find((v) => v.id === volumeId)
      if (!volume) return prev
      const chapter = volume.chapters.find((c) => c.id === chapterId)
      if (!chapter) return prev
      chapter.scenes.push(newScene)
      return next
    })

    applyWritingSelection({
      volumeId,
      chapterId,
      sceneId: newScene.id,
    })
  }

  const handleDeleteScene = (sceneIdToDelete) => {
    const shouldReselect = selectedIds.sceneId === sceneIdToDelete
    const nextForSelection = shouldReselect
      ? projectAfterDeletingScene(project, sceneIdToDelete)
      : null

    setProject((prev) => {
      const result = projectAfterDeletingScene(prev, sceneIdToDelete)
      return result || prev
    })

    if (shouldReselect && nextForSelection) {
      applyWritingSelection(getFirstSceneIds(nextForSelection))
    }
    setPendingDelete(null)
  }

  const handleAddChapter = (explicitVolumeId) => {
    const volumeId = explicitVolumeId ?? selectedIds.volumeId
    if (!volumeId) return
    const newChapter = createEmptyChapter()
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga?.volumes) return prev
      const volume = saga.volumes.find((v) => v.id === volumeId)
      if (!volume) return prev
      volume.chapters.push(newChapter)
      return next
    })
    applyWritingSelection({
      volumeId,
      chapterId: newChapter.id,
      sceneId: newChapter.scenes[0]?.id || null,
    })
  }

  const handleDeleteChapter = (volumeId, chapterId) => {
    // Calcule la sélection depuis l'état courant avant la mise à jour
    const saga = project.sagas?.find((s) => s.id === project.currentSagaId)
    const volume = saga?.volumes?.find((v) => v.id === volumeId)
    const idx = volume ? volume.chapters.findIndex((c) => c.id === chapterId) : -1
    const chaptersAfterDelete = volume ? volume.chapters.filter((c) => c.id !== chapterId) : []
    const nextChapter = chaptersAfterDelete[idx] || chaptersAfterDelete[idx - 1] || chaptersAfterDelete[0] || null
    const nextSelection = {
      volumeId: volumeId || null,
      chapterId: nextChapter?.id || null,
      sceneId: nextChapter?.scenes?.[0]?.id || null,
    }

    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga?.volumes) return prev
      const volume = saga.volumes.find((v) => v.id === volumeId)
      if (!volume) return prev
      const idx = volume.chapters.findIndex((c) => c.id === chapterId)
      if (idx === -1) return prev
      volume.chapters.splice(idx, 1)
      return next
    })
    applyWritingSelection(nextSelection)
    setPendingDelete(null)
  }

  const handleReorderScenes = (volumeId, chapterId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga?.volumes) return prev
      const volume = saga.volumes.find((v) => v.id === volumeId)
      if (!volume) return prev
      const chapter = volume.chapters.find((c) => c.id === chapterId)
      if (!chapter || !chapter.scenes) return prev
      const [removed] = chapter.scenes.splice(fromIndex, 1)
      chapter.scenes.splice(toIndex, 0, removed)
      return next
    })
  }

  const handleReorderChapters = (volumeId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga?.volumes) return prev
      const volume = saga.volumes.find((v) => v.id === volumeId)
      if (!volume || !volume.chapters) return prev
      const [removed] = volume.chapters.splice(fromIndex, 1)
      volume.chapters.splice(toIndex, 0, removed)
      return next
    })
  }

  const handleAddVolume = () => {
    const newVolume = createEmptyVolume()
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga) return prev
      saga.volumes = saga.volumes || []
      saga.volumes.push(newVolume)
      return next
    })
    applyWritingSelection({
      volumeId: newVolume.id,
      chapterId: newVolume.chapters[0]?.id || null,
      sceneId: newVolume.chapters[0]?.scenes?.[0]?.id || null,
    })
  }

  const handleDeleteVolume = (volumeId) => {
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga?.volumes) return prev
      saga.volumes = saga.volumes.filter((v) => v.id !== volumeId)
      return next
    })
    const remaining = currentSaga?.volumes?.filter((v) => v.id !== volumeId) || []
    const first = remaining[0]
    applyWritingSelection({
      volumeId: first?.id || null,
      chapterId: first?.chapters?.[0]?.id || null,
      sceneId: first?.chapters?.[0]?.scenes?.[0]?.id || null,
    })
    setPendingDelete(null)
  }

  const handleAddSaga = () => {
    const newSaga = createEmptySaga()
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      next.sagas = next.sagas || []
      next.sagas.push(newSaga)
      next.currentSagaId = newSaga.id
      return next
    })
    const vol = newSaga.volumes?.[0]
    applyWritingSelection({
      volumeId: vol?.id ?? null,
      chapterId: vol?.chapters?.[0]?.id ?? null,
      sceneId: vol?.chapters?.[0]?.scenes?.[0]?.id ?? null,
    })
  }

  const handleImportFromText = (parsed, opts) => {
    if (!parsed?.chapters?.length || !currentSaga) return null
    const deferSceneWrite = Boolean(opts?.deferSceneWrite)
    const newVolume = createEmptyVolume()
    newVolume.title = parsed.volumeTitle || 'Import'
    newVolume.chapters = []
    const sceneIds = []
    const scenePairs = []
    for (const ch of parsed.chapters) {
      const newChapter = createEmptyChapter()
      newChapter.title = ch.title || 'Sans titre'
      newChapter.scenes = []
      for (const sc of ch.scenes || [{ title: 'Scène 1', text: '' }]) {
        const newScene = createEmptyScene()
        newScene.title = sc.title || 'Scène'
        if (!deferSceneWrite) {
          saveSceneText(newScene.id, sc.text || '')
        }
        scenePairs.push({ id: newScene.id, text: sc.text || '' })
        newChapter.scenes.push(newScene)
        sceneIds.push(newScene.id)
      }
      newVolume.chapters.push(newChapter)
    }
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga?.volumes) return prev
      saga.volumes.push(newVolume)
      return next
    })
    const firstChapter = newVolume.chapters[0]
    const firstScene = firstChapter?.scenes?.[0]
    if (firstScene) {
      applyWritingSelection({
        volumeId: newVolume.id,
        chapterId: firstChapter.id,
        sceneId: firstScene.id,
      })
    }
    return {
      volumeId: newVolume.id,
      sceneIds,
      sagaId: currentSaga.id,
      scenePairs: deferSceneWrite ? scenePairs : undefined,
    }
  }

  const handleSelectSaga = (sagaId) => {
    if (sagaId === project.currentSagaId) return
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      next.currentSagaId = sagaId
      return next
    })
    const saga = project.sagas?.find((s) => s.id === sagaId)
    const vol = saga?.volumes?.[0]
    applyWritingSelection({
      volumeId: vol?.id ?? null,
      chapterId: vol?.chapters?.[0]?.id ?? null,
      sceneId: vol?.chapters?.[0]?.scenes?.[0]?.id ?? null,
    })
  }

  const handleDeleteSaga = () => {
    clearSagaCover(project.currentSagaId)

    // Calcule la sélection depuis l'état courant avant la mise à jour
    const remainingSagas = (project.sagas || []).filter((s) => s.id !== project.currentSagaId)
    const newEmptySaga = remainingSagas.length === 0 ? createEmptySaga() : null
    const selectedSaga = newEmptySaga ?? remainingSagas[0]
    const vol = selectedSaga?.volumes?.[0]
    const nextSelection = {
      volumeId: vol?.id ?? null,
      chapterId: vol?.chapters?.[0]?.id ?? null,
      sceneId: vol?.chapters?.[0]?.scenes?.[0]?.id ?? null,
    }

    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      next.sagas = (next.sagas || []).filter((s) => s.id !== next.currentSagaId)
      if (next.sagas.length === 0) {
        next.sagas = [newEmptySaga]
        next.currentSagaId = newEmptySaga.id
      } else {
        next.currentSagaId = next.sagas[0].id
      }
      return next
    })
    applyWritingSelection(nextSelection)
    setPendingDelete(null)
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    switch (pendingDelete.type) {
      case 'scene':
        handleDeleteScene(pendingDelete.id)
        break
      case 'chapter':
        handleDeleteChapter(pendingDelete.volumeId, pendingDelete.chapterId)
        break
      case 'volume':
        handleDeleteVolume(pendingDelete.volumeId)
        break
      case 'saga':
        handleDeleteSaga()
        break
      default:
        setPendingDelete(null)
    }
  }

  const handleSelectScene = (volumeId, chapterId, sceneId) => {
    applyWritingSelection({ volumeId, chapterId, sceneId })
  }

  const handleUpdateBible = (action, payload) => {
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga) return prev
      if (!saga.bible) saga.bible = { entries: [] }
      if (!saga.bible.entries) saga.bible.entries = []
      if (!Array.isArray(saga.bible.categories)) saga.bible.categories = []

      if (action === 'addCategory') {
        saga.bible.categories.push(payload)
      } else if (action === 'addCategoryAndEntry' && payload?.category && payload?.entry) {
        saga.bible.categories.push(payload.category)
        saga.bible.entries.push(payload.entry)
      } else if (action === 'addSubcategory') {
        const cat = saga.bible.categories.find((c) => c.id === payload?.categoryId)
        if (cat) {
          cat.subcategories = Array.isArray(cat.subcategories) ? cat.subcategories : []
          if (payload?.subcategory) cat.subcategories.push(payload.subcategory)
        }
      } else if (
        action === 'addSubcategoryAndEntry' &&
        payload?.categoryId &&
        payload?.subcategory &&
        payload?.entry
      ) {
        const cat = saga.bible.categories.find((c) => c.id === payload.categoryId)
        if (cat) {
          cat.subcategories = Array.isArray(cat.subcategories) ? cat.subcategories : []
          cat.subcategories.push(payload.subcategory)
          saga.bible.entries.push(payload.entry)
        }
      } else if (action === 'updateCategory' && payload?.id && payload?.field) {
        const ci = saga.bible.categories.findIndex((c) => c.id === payload.id)
        if (ci >= 0) {
          const prev = saga.bible.categories[ci]
          const nextCats = [...saga.bible.categories]
          nextCats[ci] = { ...prev, [payload.field]: payload.value }
          saga.bible.categories = nextCats
        }
      } else if (action === 'updateSubcategory' && payload?.categoryId && payload?.subcategoryId && payload?.field) {
        const cat = saga.bible.categories.find((c) => c.id === payload.categoryId)
        if (cat && Array.isArray(cat.subcategories)) {
          const si = cat.subcategories.findIndex((s) => s.id === payload.subcategoryId)
          if (si >= 0) {
            const prev = cat.subcategories[si]
            const nextSubs = [...cat.subcategories]
            nextSubs[si] = { ...prev, [payload.field]: payload.value }
            cat.subcategories = nextSubs
          }
        }
      } else if (action === 'ensureBucketEntry' && payload?.entry) {
        const entry = payload.entry
        const wantSub = entry.subcategoryId ?? null
        const has = saga.bible.entries.some((e) => {
          if (e.categoryId !== entry.categoryId) return false
          const es = e.subcategoryId ?? null
          return wantSub ? es === wantSub : !es
        })
        if (!has) saga.bible.entries.push(entry)
      } else if (action === 'add') {
        saga.bible.entries.push(payload)
      } else if (action === 'delete') {
        saga.bible.entries = saga.bible.entries.filter((e) => e.id !== payload)
      } else if (action === 'deleteCategory' && typeof payload === 'string') {
        const catId = payload
        saga.bible.categories = saga.bible.categories.filter((c) => c.id !== catId)
        saga.bible.entries = saga.bible.entries.filter((e) => e.categoryId !== catId)
      } else if (action === 'update' && payload?.id) {
        const ei = saga.bible.entries.findIndex((e) => e.id === payload.id)
        if (ei >= 0 && payload.field) {
          const prev = saga.bible.entries[ei]
          const nextEntries = [...saga.bible.entries]
          nextEntries[ei] = { ...prev, [payload.field]: payload.value }
          saga.bible.entries = nextEntries
        }
      }
      return next
    })
  }

  const handleUpdateTimeline = (action, payload) => {
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga) return prev
      if (!saga.timeline) saga.timeline = { events: [] }
      if (!saga.timeline.events) saga.timeline.events = []

      if (action === 'add') {
        saga.timeline.events.push(payload)
      } else if (action === 'delete') {
        saga.timeline.events = saga.timeline.events.filter((e) => e.id !== payload)
      } else if (action === 'update' && payload?.id) {
        const ev = saga.timeline.events.find((e) => e.id === payload.id)
        if (ev && payload.field) ev[payload.field] = payload.value
      }
      return next
    })
  }

  const handleUpdateWorldMap = (action, payload) => {
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
      if (!saga) return prev
      if (!saga.worldMap) saga.worldMap = { mapImage: null, places: [] }
      if (!saga.worldMap.places) saga.worldMap.places = []

      if (action === 'setMapImage') {
        saga.worldMap.mapImage = payload ?? null
      } else if (action === 'add') {
        saga.worldMap.places.push(payload)
      } else if (action === 'delete') {
        saga.worldMap.places = saga.worldMap.places.filter((p) => p.id !== payload)
      } else if (action === 'update' && payload?.id) {
        const place = saga.worldMap.places.find((p) => p.id === payload.id)
        if (place && payload.field) place[payload.field] = payload.value
      } else if (action === 'setPromptWizard') {
        saga.worldMap.promptWizard = payload || null
      }
      return next
    })
  }

  // Récupération IDB pour la scène initiale si localStorage vide au démarrage
  useEffect(() => {
    const ids = getFirstSceneIds(initialProject)
    if (!ids.sceneId) return
    if (loadSceneText(ids.sceneId)) return
    recoverSceneTextFromIdb(ids.sceneId).then((recovered) => {
      if (recovered) setSceneText(recovered)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSceneTextChange = (text) => {
    const { sceneId, volumeId, chapterId } = selectedIds
    setSceneText(text)
    if (!sceneId || !volumeId || !chapterId) return

    const wordCount = countWords(text)
    saveSceneText(sceneId, text)
    // Evite un structuredClone complet à chaque frappe (fluide sur gros projets)
    if (wordCountUpdateTimerRef.current) clearTimeout(wordCountUpdateTimerRef.current)
    wordCountUpdateTimerRef.current = setTimeout(() => {
      setProject((prev) => {
        const next = structuredClone
          ? structuredClone(prev)
          : JSON.parse(JSON.stringify(prev))
        const saga = next.sagas?.find((s) => s.id === next.currentSagaId)
        if (!saga?.volumes) return prev
        const volume = saga.volumes.find((v) => v.id === volumeId)
        if (!volume) return prev
        const chapter = volume.chapters.find((c) => c.id === chapterId)
        if (!chapter) return prev
        const scene = chapter.scenes.find((s) => s.id === sceneId)
        if (!scene) return prev
        scene.wordCount = wordCount
        return next
      })
    }, 350)
  }

  const handleAddCharacter = (optionsOrOnAdded, onAdded) => {
    const options = typeof optionsOrOnAdded === 'function' ? {} : optionsOrOnAdded || {}
    const callback = typeof optionsOrOnAdded === 'function' ? optionsOrOnAdded : onAdded
    const templateMode = options?.templateMode || options?.template || 'standard'

    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `char-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const t = getCharacterTemplate(templateMode === 'empty' ? 'empty' : 'standard')
    const newChar = { ...t, id }
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))
      next.characters = next.characters || []
      next.characters.push(newChar)
      return next
    })
    if (typeof callback === 'function') setTimeout(() => callback(id), 0)
  }

  const handleUpdateCharacterField = (characterId, field, value) => {
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))

      next.characters = next.characters || []
      const character = next.characters.find((c) => c.id === characterId)
      if (!character) return prev
      character[field] = value
      return next
    })
  }

  const handleDeleteCharacter = (characterId) => {
    setProject((prev) => {
      const next = structuredClone
        ? structuredClone(prev)
        : JSON.parse(JSON.stringify(prev))

      next.characters = (next.characters || []).filter(
        (c) => c.id !== characterId,
      )

      next.sagas?.forEach((saga) => {
        saga.volumes?.forEach((volume) => {
          volume.chapters?.forEach((chapter) => {
            chapter.scenes?.forEach((scene) => {
              if (Array.isArray(scene.charactersInScene)) {
                scene.charactersInScene = scene.charactersInScene.filter(
                  (id) => id !== characterId,
                )
              }
            })
          })
        })
      })

      return next
    })
  }

  const handleSelectCharacter = (characterId) => {
    if (!characterId) return
    setSelectedCharacterId(characterId)
    setActiveTab('characters')
  }

  const renderTabContent = () => {
    if (activeTab === 'writing') {
      return (
        <WritingTab
          project={project}
          currentSaga={currentSaga}
          selectedIds={selectedIds}
          sceneText={sceneText}
          characters={project.characters || []}
          isFocusMode={isFocusMode}
          onToggleFocus={handleToggleFocus}
          onSelectScene={handleSelectScene}
            onSelectCharacter={handleSelectCharacter}
          onAddScene={handleAddScene}
          onAddSceneToChapter={handleAddSceneToChapter}
          onRequestDeleteScene={(id) => setPendingDelete({ type: 'scene', id })}
          onAddChapter={handleAddChapter}
          onRequestDeleteChapter={(volumeId, chapterId) =>
            setPendingDelete({ type: 'chapter', volumeId, chapterId })
          }
          onReorderScenes={handleReorderScenes}
          onReorderChapters={handleReorderChapters}
          onUpdateSceneField={handleUpdateSceneField}
          onUpdateChapterField={handleUpdateChapterField}
          onUpdateVolumeTitle={handleUpdateVolumeTitle}
          onChangeSceneText={handleSceneTextChange}
        />
      )
    }

    if (activeTab === 'dashboard') {
      return <DashboardTab project={project} currentSaga={currentSaga} />
    }

    if (activeTab === 'guide') {
      return <UserGuideTab />
    }

    if (activeTab === 'bible') {
      return (
        <BibleTab
          currentSaga={currentSaga}
          onUpdateBible={handleUpdateBible}
        />
      )
    }

    if (activeTab === 'characters') {
      return (
        <CharactersTab
          characters={project.characters || []}
          onAddCharacter={handleAddCharacter}
          onUpdateCharacterField={handleUpdateCharacterField}
          onDeleteCharacter={handleDeleteCharacter}
              selectedId={selectedCharacterId}
              onSelectCharacter={setSelectedCharacterId}
        />
      )
    }

    if (activeTab === 'timeline') {
      return (
        <TimelineTab
          currentSaga={currentSaga}
          onUpdateTimeline={handleUpdateTimeline}
        />
      )
    }

    if (activeTab === 'worldmap') {
      return (
        <WorldMapTab
          currentSaga={currentSaga}
          onUpdateWorldMap={handleUpdateWorldMap}
        />
      )
    }

    if (activeTab === 'publisher') {
      return <PublisherTab project={project} />
    }

    if (activeTab === 'import') {
      return (
        <ImportTab
          project={project}
          currentSaga={currentSaga}
          onImport={handleImportFromText}
          onRollbackVolume={(sagaId, volumeId, sceneIds) => {
            setProject((prev) => removeVolumeFromSaga(prev, sagaId, volumeId))
            clearSceneTexts(sceneIds)
          }}
        />
      )
    }

    if (activeTab === 'backup') {
      return (
        <BackupTab
          onRestored={(restoredProject) => {
            setProject(restoredProject)
            applyWritingSelection(getFirstSceneIds(restoredProject))
          }}
        />
      )
    }

    return (
      <div className="placeholder">
        <h2>{TABS.find((t) => t.id === activeTab)?.label}</h2>
        <p>
          Ce module sera développé après la stabilisation complète de
          l&apos;écriture. Pour l&apos;instant, concentrez-vous sur la
          construction de votre texte.
        </p>
      </div>
    )
  }

  return (
    <div className={`app-shell${isFocusMode ? ' is-focus-mode' : ''}`}>

      {/* ── Top navigation bar ──────────────────────────────────────────── */}
      {!isFocusMode && (
        <header className="topnav">

          {/* Brand */}
          <div className="topnav-brand">
            <img src="/logo-scriptor.png" alt="Studio Roman" className="topnav-logo" />
          </div>

          {/* Saga selector + dropdown */}
          <div className="topnav-saga" ref={sagaMenuRef}>
            <button
              type="button"
              className={`topnav-saga-btn${sagaMenuOpen ? ' is-open' : ''}`}
              onClick={() => setSagaMenuOpen((v) => !v)}
              title="Gérer les sagas et les tomes"
            >
              <span className="topnav-saga-name">
                {currentSaga?.title || 'Sans titre'}
              </span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={`topnav-saga-chevron${sagaMenuOpen ? ' is-open' : ''}`}>
                <path d="M2 4l4 4 4-4"/>
              </svg>
            </button>

            {sagaMenuOpen && (
              <div className="saga-dd">
                {/* Liste des sagas */}
                {project.sagas?.length > 1 && (
                  <div className="saga-dd-section">
                    {project.sagas.map((saga) => (
                      <button
                        key={saga.id}
                        type="button"
                        className={`saga-dd-item${saga.id === project.currentSagaId ? ' is-active' : ''}`}
                        onClick={() => { handleSelectSaga(saga.id); setSagaMenuOpen(false) }}
                      >
                        {saga.title || 'Sans titre'}
                      </button>
                    ))}
                    <div className="saga-dd-sep" />
                  </div>
                )}

                {/* Renommer saga */}
                {currentSaga && (
                  <div className="saga-dd-section">
                    <label className="saga-dd-field-label">Titre de la saga</label>
                    <input
                      className="saga-dd-input"
                      value={currentSaga.title ?? ''}
                      onChange={(e) => handleUpdateSagaTitle(currentSaga.id, e.target.value)}
                      placeholder="Titre de la saga"
                    />
                  </div>
                )}

                <div className="saga-dd-sep" />

                {/* Actions création */}
                <div className="saga-dd-section">
                  <button type="button" className="saga-dd-item" onClick={() => { handleAddSaga(); setSagaMenuOpen(false) }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="6.5" y1="2" x2="6.5" y2="11"/><line x1="2" y1="6.5" x2="11" y2="6.5"/></svg>
                    Nouvelle saga
                  </button>
                  <button type="button" className="saga-dd-item" onClick={() => { handleAddVolume(); setSagaMenuOpen(false) }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="6.5" y1="2" x2="6.5" y2="11"/><line x1="2" y1="6.5" x2="11" y2="6.5"/></svg>
                    Nouveau tome
                  </button>
                </div>

                <div className="saga-dd-sep" />

                {/* Actions destructives */}
                <div className="saga-dd-section">
                  {currentSaga?.volumes?.length > 0 && (
                    <button
                      type="button"
                      className="saga-dd-item saga-dd-item--danger"
                      onClick={() => {
                        setSagaMenuOpen(false)
                        setPendingDelete({ type: 'volume', volumeId: selectedIds.volumeId || currentSaga.volumes?.[0]?.id })
                      }}
                    >
                      Supprimer le tome actif
                    </button>
                  )}
                  <button
                    type="button"
                    className="saga-dd-item saga-dd-item--danger"
                    onClick={() => { setSagaMenuOpen(false); setPendingDelete({ type: 'saga' }) }}
                  >
                    Supprimer cette saga
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation tabs */}
          <nav className="topnav-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`topnav-tab${activeTab === tab.id ? ' is-active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
              >
                <span className="topnav-tab-icon"><tab.icon /></span>
                <span className="topnav-tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Meta : mots + sauvegarde */}
          <div className="topnav-meta">
            <span className="topnav-wordcount">
              {stats.totalWords.toLocaleString('fr-FR')}&nbsp;mots
            </span>
            <button
              type="button"
              className={`backup-health-pill backup-health-${globalBackupSeverity}`}
              onClick={() => setActiveTab('backup')}
              title={globalBackupMessage}
            >
              <span className="backup-health-dot" />
              <span className="backup-health-label">
                {globalBackupSeverity === 'ok' ? 'Sauvegarde' : globalBackupSeverity === 'degraded' ? 'Dégradée' : 'Critique'}
              </span>
            </button>
          </div>
        </header>
      )}

      {/* ── Zone de contenu ─────────────────────────────────────────────── */}
      <main className="main-area">
        <GlobalBackupAlert
          severity={globalBackupSeverity}
          message={globalBackupMessage}
          lastSuccessText={formatRelativeTime(backupStatus?.lastSuccessAt)}
          nextAttemptText={nextCloudBackupLabel}
          showDismiss={Boolean(backupStatus?.lastError || globalStorageWarning)}
          onDismiss={() => {
            setGlobalStorageWarning('')
            setBackupStatus((prev) => ({ ...prev, lastError: '' }))
          }}
        />
        <div key={activeTab} className="tab-content-anim">
          {renderTabContent()}
        </div>
      </main>

      {correctorOnboardingOpen ? (
        <CorrectorOnboarding
          onComplete={() => {
            completeCorrectorOnboarding()
            setActiveTab('writing')
          }}
          onClose={() => completeCorrectorOnboarding()}
          onGoWriting={() => setActiveTab('writing')}
        />
      ) : null}

      {pendingDelete && (
        <div className="confirm-overlay" role="dialog" aria-modal="true">
          <div className="confirm-box">
            <p className="confirm-title">Êtes-vous sûr ?</p>
            <p className="confirm-message">
              {pendingDelete.type === 'scene' && 'Supprimer cette scène ?'}
              {pendingDelete.type === 'chapter' && 'Supprimer ce chapitre et toutes ses scènes ?'}
              {pendingDelete.type === 'volume' && 'Supprimer ce tome et tout son contenu ?'}
              {pendingDelete.type === 'saga' && 'Supprimer toute la saga (réinitialisation) ?'}
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn confirm-btn-cancel"
                onClick={() => setPendingDelete(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="confirm-btn confirm-btn-danger"
                onClick={handleConfirmDelete}
              >
                Oui, supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
