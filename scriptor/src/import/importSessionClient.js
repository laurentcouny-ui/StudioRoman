import { isDesktop } from '../platform'

async function invoke(cmd, args) {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}

/**
 * @param {File} file
 * @returns {Promise<string>} hex sha-256
 */
export async function sha256HexFile(file) {
  const buf = await file.arrayBuffer()
  return sha256HexArrayBuffer(buf)
}

export async function sha256HexArrayBuffer(arrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', arrayBuffer)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Étape 0 : écriture test dans `.tmp_import/` (desktop uniquement).
 */
export async function runPreflight(projectSlug) {
  if (!isDesktop()) return
  await invoke('import_preflight_write', { projectSlug })
}

/**
 * @param {{ projectSlug: string, projectId: string, diskHashAtStart: string }} opts
 * @returns {{ importId: string, stopHeartbeat: () => void, stop: () => Promise<void> }}
 */
export async function startImportSession(opts) {
  const importId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `imp-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const now = Math.floor(Date.now() / 1000)
  const session = {
    importId,
    projectId: opts.projectId,
    projectSlug: opts.projectSlug,
    status: 'parsing',
    createdAt: now,
    lastHeartbeat: now,
    diskHashAtStart: opts.diskHashAtStart,
  }
  if (isDesktop()) {
    await invoke('import_session_save', { session })
    const tick = () => {
      invoke('import_session_touch_heartbeat', { importId }).catch(() => {})
    }
    const interval = window.setInterval(tick, 2000)
    const stopHeartbeat = () => window.clearInterval(interval)
    const stop = async () => {
      stopHeartbeat()
      session.status = 'aborted'
      session.lastHeartbeat = Math.floor(Date.now() / 1000)
      try {
        await invoke('import_session_save', { session })
      } catch {
        // noop
      }
    }
    return { importId, stopHeartbeat, stop }
  }
  return {
    importId,
    stopHeartbeat: () => {},
    stop: async () => {},
  }
}

export async function commitImportSession(importId) {
  if (!isDesktop() || !importId) return
  const session = await invoke('import_session_load', { importId })
  if (!session) return
  session.status = 'committed'
  session.lastHeartbeat = Math.floor(Date.now() / 1000)
  await invoke('import_session_save', { session })
}

export async function attachBackupToSession(importId, backupPath) {
  if (!isDesktop() || !importId || !backupPath) return
  const session = await invoke('import_session_load', { importId })
  if (!session) return
  session.backupPath = backupPath
  await invoke('import_session_save', { session })
}

export async function saveImportLog(entry) {
  if (!isDesktop()) return
  await invoke('import_save_log', { entry })
}

export async function listRecentImportLogs(limit = 8) {
  if (!isDesktop()) return []
  return invoke('import_list_recent_logs', { limit })
}

export async function importStageSceneText({ projectSlug, importId, sceneId, text }) {
  if (!isDesktop()) return
  await invoke('import_stage_scene_text', {
    projectSlug,
    importId,
    sceneId,
    text: text ?? '',
  })
}

/** @returns {Promise<number>} nombre de scènes commitées */
export async function importCommitStagedScenes({ projectSlug, importId }) {
  if (!isDesktop()) return 0
  return invoke('import_commit_staged_scenes', { projectSlug, importId })
}

export async function importRestoreFromPreImportBackup({ projectSlug, backupPath }) {
  if (!isDesktop()) return
  await invoke('import_restore_from_pre_import_backup', {
    projectSlug,
    backupPath,
  })
}
