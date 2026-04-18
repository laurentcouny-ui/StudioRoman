import { isDesktop } from './platform'
import {
  initDiagError,
  initDiagLog,
  initDiagStep,
  initDiagStepSoft,
  initDiagWarn,
} from './platform/initDiagnostics.js'

const KEY_PREFIX = 'scriptor-'
const SCENE_PREFIX = 'scriptor-scene-text-'
const STORAGE_KEY = 'scriptor-project-v1'

let initialized = false
let invokeFn = null
let isDirty = false
let lastInputTs = 0
let hardAutosaveTimer = null
let schedulerTimer = null
/** CDC Brique 2 : debounce écriture projet (500ms–2s) — clé volumineuse uniquement */
let projectDiskDebounceTimer = null
const DEBOUNCE_PROJECT_MS = 900
let bypassProjectDebounce = false
let schedulerTickCount = 0
let storageReadonly = false
let externalChanges = []
const SYNC_LOOP_WINDOW_MS = 10_000
const SYNC_LOOP_MIN_EVENTS = 10
const DEFAULT_SYNC_LOOP_THRESHOLD = 0.8
let syncLoopThreshold = DEFAULT_SYNC_LOOP_THRESHOLD
let conflictFiles = []

/**
 * Bureau : si le JSON projet ou une scène dépasse le quota localStorage (~5–10 Mo),
 * on garde une copie en mémoire et on force l’écriture disque (Tauri) tout de suite.
 * Les lectures passent par getItem patché ci-dessous.
 */
let projectLsOverflowMirror = null
const sceneLsOverflowMirrors = new Map()

function isTrackedKey(key) {
  return typeof key === 'string' && key.startsWith(KEY_PREFIX)
}

function deriveProjectDisplayName(projectRaw) {
  try {
    const p = JSON.parse(projectRaw)
    const sagas = Array.isArray(p?.sagas) ? p.sagas : []
    const current = sagas.find((s) => s?.id === p?.currentSagaId) || sagas[0]
    const title = String(current?.title || '').trim()
    return title || 'Projet'
  } catch {
    return 'Projet'
  }
}

async function ensureInvoke() {
  if (invokeFn) return invokeFn
  const { invoke } = await import('@tauri-apps/api/core')
  invokeFn = invoke
  return invoke
}

function dispatchStorageStatus(detail) {
  try {
    window.dispatchEvent(new CustomEvent('scriptor-storage-status', { detail }))
  } catch {
    // noop
  }
}

function dispatchConflictUpdate() {
  try {
    window.dispatchEvent(
      new CustomEvent('scriptor-storage-conflicts', { detail: { files: conflictFiles } }),
    )
  } catch {
    // noop
  }
}

function markDirty() {
  isDirty = true
}

/** Brique 5 : toute correction acceptée peut appeler ce hook pour le dirty bit WAL. */
export function markStorageDirty() {
  markDirty()
}

function flushDirtyProject() {
  if (!isDirty || storageReadonly) return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    bypassProjectDebounce = true
    window.localStorage.setItem(STORAGE_KEY, raw)
    bypassProjectDebounce = false
    isDirty = false
  } catch {
    bypassProjectDebounce = false
    // noop
  }
}

async function seedFromDesktop() {
  const invoke = await ensureInvoke()
  const res = await invoke('storage_bootstrap')
  const entries = Array.isArray(res?.entries)
    ? res.entries
    : Array.isArray(res)
      ? res
      : []
  for (const e of entries) {
    if (!e || typeof e.key !== 'string') continue
    const v = typeof e.value === 'string' ? e.value : ''
    try {
      window.localStorage.setItem(e.key, v)
    } catch {
      if (e.key === STORAGE_KEY) {
        projectLsOverflowMirror = v
        dispatchStorageStatus({
          level: 'warn',
          message:
            'Projet chargé depuis le disque : trop volumineux pour le cache navigateur (localStorage). Les données restent sur votre PC ; exportez aussi un JSON pour plus de sûreté.',
        })
      } else if (e.key.startsWith(SCENE_PREFIX)) {
        sceneLsOverflowMirrors.set(e.key, v)
      }
    }
  }
  if (res && typeof res === 'object' && res.reconstructed) {
    const src = res.reconstructSource ?? res.reconstruct_source
    dispatchStorageStatus({
      level: 'warn',
      message: `Reconstruction effectuée (${String(src ?? 'inconnue')}).`,
    })
  }
}

function loadAdapterAdvancedSettings() {
  try {
    const raw = window.localStorage.getItem('scriptor_storage_adapter_settings')
    if (!raw) return
    const parsed = JSON.parse(raw)
    const v = Number(parsed?.syncLoopThreshold)
    if (Number.isFinite(v) && v > 0.5 && v <= 1.0) {
      syncLoopThreshold = v
    }
  } catch {
    // noop
  }
}

function installLocalStorageBridge() {
  const ls = window.localStorage
  const origGet = ls.getItem.bind(ls)
  const origSet = ls.setItem.bind(ls)
  const origRemove = ls.removeItem.bind(ls)
  const origClear = ls.clear.bind(ls)

  ls.getItem = function patchedGetItem(key) {
    const k = String(key)
    if (k === STORAGE_KEY && projectLsOverflowMirror != null) {
      return projectLsOverflowMirror
    }
    if (k.startsWith(SCENE_PREFIX) && sceneLsOverflowMirrors.has(k)) {
      return sceneLsOverflowMirrors.get(k)
    }
    return origGet(k)
  }

  const writeDesktopKeyImmediate = async (key, value) => {
    try {
      const invoke = await ensureInvoke()
      if (key === STORAGE_KEY) {
        const displayName = deriveProjectDisplayName(value)
        await invoke('storage_set_active_project', {
          display_name: displayName,
          displayName,
        })
      }
      await invoke('storage_set_key', { key, value })
      markDirty()
    } catch (e) {
      dispatchStorageStatus({ level: 'error', message: String(e) })
    }
  }

  const writeDesktopKey = async (key, value) => {
    if (key === STORAGE_KEY && !bypassProjectDebounce) {
      if (projectDiskDebounceTimer != null) {
        clearTimeout(projectDiskDebounceTimer)
        projectDiskDebounceTimer = null
      }
      projectDiskDebounceTimer = window.setTimeout(() => {
        projectDiskDebounceTimer = null
        void writeDesktopKeyImmediate(key, value)
      }, DEBOUNCE_PROJECT_MS)
      markDirty()
      return
    }
    await writeDesktopKeyImmediate(key, value)
  }

  ls.setItem = function patchedSetItem(key, value) {
    const k = String(key)
    const v = value == null ? '' : String(value)
    const tracked = isTrackedKey(k)
    const isProject = k === STORAGE_KEY
    const isScene = k.startsWith(SCENE_PREFIX)

    if (tracked && (isProject || isScene)) {
      try {
        origSet(k, v)
        if (isProject) projectLsOverflowMirror = null
        else sceneLsOverflowMirrors.delete(k)
      } catch {
        if (isProject) projectLsOverflowMirror = v
        else sceneLsOverflowMirrors.set(k, v)
        void writeDesktopKeyImmediate(k, v).catch((err) =>
          dispatchStorageStatus({ level: 'error', message: String(err) }),
        )
        return
      }
      void writeDesktopKey(k, v)
      return
    }

    origSet(k, v)
    if (!tracked) return
    void writeDesktopKey(k, v)
  }

  ls.removeItem = function patchedRemoveItem(key) {
    const k = String(key)
    if (k === STORAGE_KEY) projectLsOverflowMirror = null
    if (k.startsWith(SCENE_PREFIX)) sceneLsOverflowMirrors.delete(k)
    origRemove(k)
    if (!isTrackedKey(k)) return
    void ensureInvoke()
      .then((invoke) => invoke('storage_remove_key', { key: k }))
      .catch(() => {})
  }

  ls.clear = function patchedClear() {
    projectLsOverflowMirror = null
    sceneLsOverflowMirrors.clear()
    const keys = []
    for (let i = 0; i < ls.length; i += 1) {
      const k = ls.key(i)
      if (k && isTrackedKey(k)) keys.push(k)
    }
    origClear()
    void Promise.all(
      keys.map((k) =>
        ensureInvoke()
          .then((invoke) => invoke('storage_remove_key', { key: k }))
          .catch(() => {}),
      ),
    )
  }
}

function installHeartbeatHooks() {
  const flush = () => {
    // Sans toucher projectStore : on force une réécriture du projet courant.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      bypassProjectDebounce = true
      window.localStorage.setItem(STORAGE_KEY, raw)
      bypassProjectDebounce = false
    } catch {
      bypassProjectDebounce = false
      // noop
    }
  }

  window.addEventListener('blur', flush)
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') flush()
  })
  window.addEventListener('input', () => {
    lastInputTs = Date.now()
  })
  window.addEventListener('keydown', () => {
    lastInputTs = Date.now()
  })
  window.addEventListener('beforeunload', () => {
    flush()
    teardownStorageAdapter()
    void ensureInvoke()
      .then((invoke) => invoke('storage_shutdown'))
      .catch(() => {})
  })

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
      void ensureInvoke()
        .then((invoke) => invoke('storage_create_manual_snapshot'))
        .then((path) => {
          dispatchStorageStatus({
            level: 'warn',
            message: `Snapshot manuel créé: ${String(path)}`,
          })
        })
        .catch((err) => {
          dispatchStorageStatus({ level: 'error', message: String(err) })
        })
    }
  })

  window.addEventListener('storage', (ev) => {
    const key = String(ev?.key || '')
    if (!isTrackedKey(key)) return
    const now = Date.now()
    externalChanges.push(now)
    externalChanges = externalChanges.filter((t) => now - t <= SYNC_LOOP_WINDOW_MS)
    void ensureInvoke()
      .then((invoke) => invoke('storage_external_mutation', { key }))
      .catch(() => {})

    const total = externalChanges.length + (isDirty ? 1 : 0)
    if (total >= SYNC_LOOP_MIN_EVENTS) {
      const ratio = externalChanges.length / Math.max(1, total)
      if (ratio >= syncLoopThreshold) {
        storageReadonly = true
        dispatchStorageStatus({
          level: 'warn',
          message: 'Modification massive externe. Accepter ou restaurer Snapshot ?',
        })
        void reportStorageAnomaly('sync-loop-guard-triggered')
        void ensureInvoke()
          .then((invoke) =>
            invoke('storage_create_conflict_artifact', {
              key,
              externalValue: String(ev?.newValue || ''),
            }),
          )
          .then(async (path) => {
            conflictFiles.push(String(path))
            dispatchConflictUpdate()
            const invoke = await ensureInvoke()
            const list = await invoke('storage_list_conflicts')
            conflictFiles = Array.isArray(list?.files) ? list.files : conflictFiles
            dispatchConflictUpdate()
            dispatchStorageStatus({
              level: 'warn',
              message: `Conflit détecté. Fichier de conflit créé: ${String(path)}`,
            })
          })
          .catch(() => {})
      }
    }
  })

  // Hard autosave every 5 seconds if dirty.
  hardAutosaveTimer = window.setInterval(() => {
    flushDirtyProject()
  }, 5000)

  // Adaptive scheduler loop (2s): avoid heavy checks while typing.
  schedulerTimer = window.setInterval(() => {
    const userTyping = Date.now() - lastInputTs < 1000
    if (userTyping) return
    schedulerTickCount += 1
    // Scrub léger disque (1 scène / tick) — ~10s si pas de frappe (CDC : pas pendant saisie)
    if (schedulerTickCount % 5 === 0) {
      void ensureInvoke()
        .then(async (invoke) => {
          const cpu = await invoke('storage_cpu_sample').catch(() => null)
          if (cpu != null && Number(cpu) >= 60) return
          await invoke('storage_scrub_tick')
        })
        .catch(() => {})
    }
    void ensureInvoke()
      .then((invoke) => invoke('storage_health'))
      .then((health) => {
        if (!health) return
        if (health.status === 'red') {
          dispatchStorageStatus({
            level: 'error',
            readonly: !!health.readonly,
            safeMode: !!health.safeMode,
            message:
              health.freeBytes < 10 * 1024 * 1024
                ? 'Disque critique (<10 Mo). Sauvegardes bloquées.'
                : 'Erreur stockage critique.',
          })
        } else if (health.status === 'orange') {
          dispatchStorageStatus({
            level: 'warn',
            readonly: !!health.readonly,
            safeMode: !!health.safeMode,
            message:
              health.freeBytes < 100 * 1024 * 1024
                ? 'Espace disque faible (<100 Mo).'
                : 'Mode dégradé stockage.',
          })
        } else {
          dispatchStorageStatus({
            level: 'ok',
            readonly: !!health.readonly,
            safeMode: !!health.safeMode,
            message: 'Système de fichiers local opérationnel',
          })
        }
      })
      .catch(() => {})
  }, 2000)

  if (navigator?.getBattery) {
    void navigator.getBattery().then((battery) => {
      const onBattery = () => {
        if (battery.level <= 0.05) flushDirtyProject()
      }
      battery.addEventListener('levelchange', onBattery)
      battery.addEventListener('chargingchange', onBattery)
    })
  }
}

export async function initializeStorageAdapter() {
  if (initialized) {
    initDiagLog('storage: initializeStorageAdapter — déjà fait, abandon')
    return
  }
  initialized = true
  initDiagLog('storage: initializeStorageAdapter — début')
  if (!isDesktop()) {
    initDiagLog('storage: pas desktop — pont fichier ignoré')
    return
  }
  try {
    const invoke = await initDiagStep('storage: ensureInvoke (@tauri-apps/api/core)', () =>
      ensureInvoke(),
    )
    initDiagLog('storage: loadAdapterAdvancedSettings')
    try {
      loadAdapterAdvancedSettings()
    } catch (e) {
      initDiagWarn('storage: loadAdapterAdvancedSettings', e)
    }

    const init = await initDiagStep('storage: invoke(storage_init)', () => invoke('storage_init'))
    void invoke('storage_set_sync_loop_threshold', { threshold: syncLoopThreshold }).catch((e) =>
      initDiagWarn('storage: storage_set_sync_loop_threshold', e),
    )
    storageReadonly = !!init?.readonly
    dispatchStorageStatus({
      level: init?.status === 'red' ? 'error' : init?.status === 'green' ? 'ok' : 'warn',
      readonly: !!init?.readonly,
      safeMode: !!init?.safeMode,
      doubleInstance: !!init?.doubleInstance,
      projectSlug: init?.projectSlug,
      freeBytes: Number(init?.freeBytes || 0),
    })
    initDiagLog('storage: statut disque dispatché', {
      status: init?.status,
      readonly: !!init?.readonly,
      doubleInstance: !!init?.doubleInstance,
    })

    await initDiagStep('storage: seedFromDesktop (storage_bootstrap)', () => seedFromDesktop())

    if (!window.localStorage.getItem(STORAGE_KEY)) {
      await initDiagStepSoft('storage: storage_reconstruct (cache projet vide)', async () => {
        const rec = await invoke('storage_reconstruct')
        if (rec?.rebuilt) {
          await seedFromDesktop()
          dispatchStorageStatus({
            level: 'warn',
            message: `Reconstruction effectuée (${rec.source}).`,
          })
        }
      })
    }

    initDiagLog('storage: installLocalStorageBridge')
    try {
      installLocalStorageBridge()
    } catch (e) {
      initDiagError('storage: installLocalStorageBridge', e)
      throw e
    }
    initDiagLog('storage: installHeartbeatHooks')
    try {
      installHeartbeatHooks()
    } catch (e) {
      initDiagError('storage: installHeartbeatHooks', e)
      throw e
    }

    await initDiagStepSoft('storage: storage_list_conflicts', async () => {
      const list = await invoke('storage_list_conflicts')
      conflictFiles = Array.isArray(list?.files) ? list.files : []
      dispatchConflictUpdate()
    })
    initDiagLog('storage: initializeStorageAdapter — terminé')
  } catch (e) {
    initDiagError('storage: initializeStorageAdapter — échec global', e)
    throw e
  }
}

export async function notifyCloudSyncSuccess(version = Date.now()) {
  if (!isDesktop()) return
  try {
    const invoke = await ensureInvoke()
    await invoke('storage_sync_success', { version: Number(version) || 0 })
  } catch {
    // noop
  }
}

export async function reportStorageAnomaly(message) {
  if (!isDesktop()) return
  try {
    const invoke = await ensureInvoke()
    await invoke('storage_report_anomaly', { message: String(message || 'anomaly') })
  } catch {
    // noop
  }
}

export async function createManualSnapshot() {
  if (!isDesktop()) return null
  try {
    const invoke = await ensureInvoke()
    return await invoke('storage_create_manual_snapshot')
  } catch {
    return null
  }
}

export async function restoreLatestSnapshot() {
  if (!isDesktop()) return null
  try {
    const invoke = await ensureInvoke()
    const path = await invoke('storage_restore_latest_snapshot')
    await invoke('storage_set_readonly', { enabled: false }).catch(() => null)
    storageReadonly = false
    externalChanges = []
    await seedFromDesktop()
    dispatchStorageStatus({
      level: 'warn',
      message: `Snapshot restauré: ${String(path)}`,
    })
    return path
  } catch (e) {
    dispatchStorageStatus({ level: 'error', message: String(e) })
    return null
  }
}

export async function getConflictPayload(path) {
  if (!isDesktop() || !path) return null
  try {
    const invoke = await ensureInvoke()
    return await invoke('storage_get_conflict_payload', { path: String(path) })
  } catch {
    return null
  }
}

export async function resolveConflictMerge(path, mergedText) {
  if (!isDesktop() || !path) return false
  try {
    const invoke = await ensureInvoke()
    await invoke('storage_resolve_conflict_merge', {
      path: String(path),
      merged_text: String(mergedText ?? ''),
    })
    await invoke('storage_set_readonly', { enabled: false }).catch(() => null)
    storageReadonly = false
    externalChanges = []
    const list = await invoke('storage_list_conflicts')
    conflictFiles = Array.isArray(list?.files) ? list.files : []
    dispatchConflictUpdate()
    await seedFromDesktop()
    dispatchStorageStatus({
      level: 'ok',
      readonly: false,
      message: 'Conflit résolu (fusion). Écriture locale réactivée.',
    })
    return true
  } catch (e) {
    dispatchStorageStatus({ level: 'error', message: String(e) })
    return false
  }
}

export async function resolveConflict(path, strategy = 'local') {
  if (!isDesktop() || !path) return false
  try {
    const invoke = await ensureInvoke()
    await invoke('storage_resolve_conflict', { path: String(path), strategy: String(strategy) })
    await invoke('storage_set_readonly', { enabled: false }).catch(() => null)
    storageReadonly = false
    externalChanges = []
    const list = await invoke('storage_list_conflicts')
    conflictFiles = Array.isArray(list?.files) ? list.files : []
    dispatchConflictUpdate()
    await seedFromDesktop()
    dispatchStorageStatus({
      level: 'ok',
      readonly: false,
      message: 'Conflit résolu. Écriture locale réactivée.',
    })
    return true
  } catch (e) {
    dispatchStorageStatus({ level: 'error', message: String(e) })
    return false
  }
}

export function setSyncLoopThreshold(value) {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0.5 || v > 1.0) return false
  syncLoopThreshold = v
  try {
    window.localStorage.setItem(
      'scriptor_storage_adapter_settings',
      JSON.stringify({ syncLoopThreshold: v }),
    )
  } catch {
    // noop
  }
  if (isDesktop()) {
    void ensureInvoke()
      .then((invoke) => invoke('storage_set_sync_loop_threshold', { threshold: v }))
      .catch(() => {})
  }
  return true
}

export async function setSafeMode(enabled) {
  if (!isDesktop()) return null
  try {
    const invoke = await ensureInvoke()
    const res = await invoke('storage_set_safe_mode', { enabled: !!enabled })
    dispatchStorageStatus({
      level: res?.safeMode ? 'warn' : 'ok',
      safeMode: !!res?.safeMode,
      readonly: !!res?.readonly,
      message: res?.safeMode ? 'Safe Mode actif' : 'Safe Mode désactivé',
    })
    return res
  } catch (e) {
    dispatchStorageStatus({ level: 'error', message: String(e) })
    return null
  }
}

export async function setStorageReadonly(enabled) {
  if (!isDesktop()) return null
  try {
    const invoke = await ensureInvoke()
    const res = await invoke('storage_set_readonly', { enabled: !!enabled })
    storageReadonly = !!res?.readonly
    dispatchStorageStatus({
      level: storageReadonly ? 'warn' : 'ok',
      safeMode: !!res?.safeMode,
      readonly: storageReadonly,
      message: storageReadonly ? 'Mode lecture seule actif' : 'Mode lecture seule désactivé',
    })
    return res
  } catch (e) {
    dispatchStorageStatus({ level: 'error', message: String(e) })
    return null
  }
}

export function getStorageReadonlyState() {
  return storageReadonly
}

export function teardownStorageAdapter() {
  if (projectDiskDebounceTimer != null) {
    clearTimeout(projectDiskDebounceTimer)
    projectDiskDebounceTimer = null
  }
  if (hardAutosaveTimer != null) {
    clearInterval(hardAutosaveTimer)
    hardAutosaveTimer = null
  }
  if (schedulerTimer != null) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}

export function isDesktopStorageEnabled() {
  return isDesktop()
}

export function isSceneStorageKey(key) {
  return typeof key === 'string' && key.startsWith(SCENE_PREFIX)
}

