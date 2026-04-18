import {
  uploadBackupToDropbox,
  uploadBackupToDrive,
} from '../src/backupService.js'

function createMemoryLocalStorage() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(String(key), String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

function setupWindowWithTokens() {
  const localStorage = createMemoryLocalStorage()
  const now = Date.now()
  // Tokens factices non vides + expirations futures
  localStorage.setItem('scriptor-gdrive-token', 'fake-drive-token')
  localStorage.setItem('scriptor-gdrive-expiry', String(now + 3600_000))
  localStorage.setItem('scriptor-dropbox-token', 'fake-dropbox-token')
  localStorage.setItem('scriptor-dropbox-expiry', String(now + 3600_000))
  global.window = { localStorage, location: { origin: 'http://localhost:5173', pathname: '/' } }
}

function fakeBackupData() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    project: { sagas: [] },
    sceneTexts: {},
  }
}

function createFlakyFetch() {
  const counters = {
    driveFind: 0,
    driveCreate: 0,
    driveUpload: 0,
    dropboxUpload: 0,
  }

  return {
    counters,
    fetch: async (url, options = {}) => {
      const u = String(url)

      // Drive: recherche de fichier
      if (u.includes('/drive/v3/files?q=')) {
        counters.driveFind += 1
        if (counters.driveFind <= 2) return { ok: false, status: 500, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => ({ files: [{ id: 'file-1' }] }) }
      }

      // Drive: création fichier
      if (u.endsWith('/drive/v3/files') && options.method === 'POST') {
        counters.driveCreate += 1
        return { ok: true, status: 200, json: async () => ({ id: 'file-1' }) }
      }

      // Drive: upload media
      if (u.includes('/upload/drive/v3/files/')) {
        counters.driveUpload += 1
        if (counters.driveUpload <= 1) return { ok: false, status: 503, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => ({}) }
      }

      // Dropbox upload
      if (u.includes('content.dropboxapi.com/2/files/upload')) {
        counters.dropboxUpload += 1
        if (counters.dropboxUpload <= 2) return { ok: false, status: 500, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => ({}) }
      }

      return { ok: true, status: 200, json: async () => ({}) }
    },
  }
}

async function main() {
  setupWindowWithTokens()
  const { fetch, counters } = createFlakyFetch()
  global.fetch = fetch

  console.log('=== Stress backup retry simulation ===')
  await uploadBackupToDrive(fakeBackupData)
  await uploadBackupToDropbox(fakeBackupData)

  console.log('Drive find attempts:', counters.driveFind)
  console.log('Drive upload attempts:', counters.driveUpload)
  console.log('Dropbox upload attempts:', counters.dropboxUpload)
  console.log('OK: uploads réussis malgré erreurs transitoires (retries).')
}

main().catch((err) => {
  console.error('ECHEC backup stress:', err?.message || err)
  process.exitCode = 1
})
