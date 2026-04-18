import {
  STORAGE_KEY,
  loadInitialProject,
  computeStats,
  exportFullBackup,
  importFullBackup,
  buildManuscriptText,
  createInitialProject,
} from '../src/projectStore.js'
import {
  uploadBackupToDrive,
  uploadBackupToDropbox,
} from '../src/backupService.js'

function nowMs() {
  return Number(process.hrtime.bigint() / 1000000n)
}

function formatMs(ms) {
  return `${ms.toFixed(1)} ms`
}

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
    clear() {
      store.clear()
    },
    _raw: store,
  }
}

function estimateStorageBytes(localStorage) {
  let bytes = 0
  for (const [k, v] of localStorage._raw.entries()) {
    bytes += Buffer.byteLength(k, 'utf8') + Buffer.byteLength(v, 'utf8')
  }
  return bytes
}

function repeatedWords(prefix, words) {
  return Array(words).fill(prefix).join(' ')
}

function makeBase64(sizeKb) {
  const raw = 'x'.repeat(sizeKb * 1024)
  return `data:image/png;base64,${Buffer.from(raw).toString('base64')}`
}

function buildHugeDataset() {
  const project = createInitialProject()
  const saga = project.sagas[0]
  const volume = saga.volumes[0]
  volume.title = 'Tome charge maximale'
  volume.chapters = []

  // Ecriture: 50 chapitres * 50 scenes * 2000 mots
  const chaptersCount = 50
  const scenesPerChapter = 50
  const wordsPerScene = 2000
  const sceneTexts = {}
  for (let c = 0; c < chaptersCount; c++) {
    const chapter = {
      id: `chapter-${c + 1}`,
      title: `Chapitre ${c + 1}`,
      scenes: [],
    }
    for (let s = 0; s < scenesPerChapter; s++) {
      const id = `scene-${c + 1}-${s + 1}`
      chapter.scenes.push({
        id,
        title: `Scène ${s + 1}`,
        pov: '',
        status: 'draft',
        charactersInScene: [],
        summary: repeatedWords('resume', 40),
        wordCount: wordsPerScene,
      })
      sceneTexts[id] = repeatedWords('mot', wordsPerScene)
    }
    volume.chapters.push(chapter)
  }

  // Personnages: 3000 fiches riches
  project.characters = []
  for (let i = 0; i < 3000; i++) {
    project.characters.push({
      id: `char-${i + 1}`,
      name: `Personnage ${i + 1}`,
      role: i % 3 === 0 ? 'protagoniste' : i % 3 === 1 ? 'secondaire' : 'antagoniste',
      image: null,
      appearance: repeatedWords('apparence', 80),
      biography: repeatedWords('biographie', 140),
      goals: repeatedWords('objectif', 70),
      traits: repeatedWords('trait', 60),
      relationships: repeatedWords('relation', 65),
      notes: repeatedWords('note', 90),
    })
  }

  // Bible: categories + sous-categories + 4000 entrées
  saga.bible.categories = []
  for (let c = 0; c < 40; c++) {
    const cat = {
      id: `bible-cat-${c + 1}`,
      title: `Categorie ${c + 1}`,
      subcategories: [],
    }
    for (let s = 0; s < 20; s++) {
      cat.subcategories.push({
        id: `bible-sub-${c + 1}-${s + 1}`,
        title: `Sous categorie ${c + 1}.${s + 1}`,
      })
    }
    saga.bible.categories.push(cat)
  }
  saga.bible.entries = []
  let bibleEntryIndex = 1
  for (const cat of saga.bible.categories) {
    for (const sub of cat.subcategories) {
      for (let i = 0; i < 5; i++) {
        saga.bible.entries.push({
          id: `bible-entry-${bibleEntryIndex++}`,
          title: `Entree ${bibleEntryIndex}`,
          content: repeatedWords('contenu-bible', 220),
          categoryId: cat.id,
          subcategoryId: sub.id,
        })
      }
    }
  }

  // Chronologie: 5000 événements
  saga.timeline.events = []
  for (let i = 0; i < 5000; i++) {
    saga.timeline.events.push({
      id: `timeline-${i + 1}`,
      title: `Evenement ${i + 1}`,
      date: `An ${1000 + i}`,
      description: repeatedWords('chrono', 120),
    })
  }

  // Carte du monde: image lourde + 2000 lieux
  saga.worldMap.mapImage = makeBase64(512) // ~512KB base64 source
  saga.worldMap.places = []
  for (let i = 0; i < 2000; i++) {
    saga.worldMap.places.push({
      id: `place-${i + 1}`,
      title: `Lieu ${i + 1}`,
      description: repeatedWords('lieu', 130),
      image: i % 25 === 0 ? makeBase64(64) : null,
    })
  }

  return {
    project,
    sceneTexts,
    meta: {
      chaptersCount,
      scenesPerChapter,
      wordsPerScene,
      totalScenes: chaptersCount * scenesPerChapter,
      characters: project.characters.length,
      bibleEntries: saga.bible.entries.length,
      timelineEvents: saga.timeline.events.length,
      places: saga.worldMap.places.length,
    },
  }
}

function setupWindowAndTokens(localStorage) {
  const now = Date.now()
  localStorage.setItem('scriptor-gdrive-token', 'fake-drive-token')
  localStorage.setItem('scriptor-gdrive-expiry', String(now + 3600_000))
  localStorage.setItem('scriptor-dropbox-token', 'fake-dropbox-token')
  localStorage.setItem('scriptor-dropbox-expiry', String(now + 3600_000))
  global.window = {
    localStorage,
    location: { origin: 'http://localhost:5173', pathname: '/' },
  }
}

function makeFlakyFetch() {
  const counters = { driveFind: 0, driveUpload: 0, dropboxUpload: 0 }
  return {
    counters,
    fetch: async (url, options = {}) => {
      const u = String(url)
      // Drive search
      if (u.includes('/drive/v3/files?q=')) {
        counters.driveFind += 1
        if (counters.driveFind % 7 === 0) return { ok: false, status: 500, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => ({ files: [{ id: 'drive-file' }] }) }
      }
      // Drive upload
      if (u.includes('/upload/drive/v3/files/')) {
        counters.driveUpload += 1
        if (counters.driveUpload % 5 === 0) return { ok: false, status: 503, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => ({}) }
      }
      // Dropbox upload
      if (u.includes('content.dropboxapi.com/2/files/upload')) {
        counters.dropboxUpload += 1
        if (counters.dropboxUpload % 4 === 0) return { ok: false, status: 500, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => ({}) }
      }
      // Drive create file fallback
      if (u.endsWith('/drive/v3/files') && options.method === 'POST') {
        return { ok: true, status: 200, json: async () => ({ id: 'drive-file' }) }
      }
      return { ok: true, status: 200, json: async () => ({}) }
    },
  }
}

async function runCloudStress(getBackupData, loops) {
  const failures = []
  const t0 = nowMs()
  for (let i = 0; i < loops; i++) {
    try {
      await uploadBackupToDrive(getBackupData)
    } catch (e) {
      failures.push(`Drive#${i + 1}: ${e?.message || e}`)
    }
    try {
      await uploadBackupToDropbox(getBackupData)
    } catch (e) {
      failures.push(`Dropbox#${i + 1}: ${e?.message || e}`)
    }
  }
  const t1 = nowMs()
  return { elapsedMs: t1 - t0, failures }
}

function resolveCloudLoops() {
  const raw = Number(process.env.STRESS_CLOUD_LOOPS || 10)
  if (!Number.isFinite(raw) || raw <= 0) return 10
  return Math.min(50, Math.floor(raw))
}

async function main() {
  const localStorage = createMemoryLocalStorage()
  setupWindowAndTokens(localStorage)

  const t0 = nowMs()
  const { project, sceneTexts, meta } = buildHugeDataset()
  const t1 = nowMs()

  localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  for (const [sceneId, text] of Object.entries(sceneTexts)) {
    localStorage.setItem(`scriptor-scene-text-${sceneId}`, text)
  }
  const t2 = nowMs()

  const loaded = loadInitialProject()
  const t3 = nowMs()
  const stats = computeStats(loaded)
  const t4 = nowMs()
  const backup = exportFullBackup()
  const t5 = nowMs()
  const restored = importFullBackup(backup)
  const t6 = nowMs()
  const manuscript = buildManuscriptText(restored)
  const t7 = nowMs()

  const storageBytes = estimateStorageBytes(localStorage)
  const backupBytes = Buffer.byteLength(JSON.stringify(backup), 'utf8')
  const manuscriptBytes = Buffer.byteLength(manuscript, 'utf8')

  const { fetch, counters } = makeFlakyFetch()
  global.fetch = fetch
  const cloudLoops = resolveCloudLoops()
  const cloud = await runCloudStress(() => backup, cloudLoops)

  console.log('=== Stress test global Scriptor ===')
  console.log(`Scenes: ${meta.totalScenes} (${meta.chaptersCount}x${meta.scenesPerChapter}, ${meta.wordsPerScene} mots/scène)`)
  console.log(`Personnages: ${meta.characters}`)
  console.log(`Entrées Bible: ${meta.bibleEntries}`)
  console.log(`Événements Chronologie: ${meta.timelineEvents}`)
  console.log(`Lieux Carte: ${meta.places}`)
  console.log('')
  console.log(`Génération dataset: ${formatMs(t1 - t0)}`)
  console.log(`Injection stockage: ${formatMs(t2 - t1)}`)
  console.log(`loadInitialProject: ${formatMs(t3 - t2)}`)
  console.log(`computeStats: ${formatMs(t4 - t3)}`)
  console.log(`exportFullBackup: ${formatMs(t5 - t4)}`)
  console.log(`importFullBackup: ${formatMs(t6 - t5)}`)
  console.log(`buildManuscriptText: ${formatMs(t7 - t6)}`)
  console.log('')
  console.log(`Taille stockage simulé: ${(storageBytes / (1024 * 1024)).toFixed(2)} MB`)
  console.log(`Taille backup JSON: ${(backupBytes / (1024 * 1024)).toFixed(2)} MB`)
  console.log(`Taille manuscrit texte: ${(manuscriptBytes / (1024 * 1024)).toFixed(2)} MB`)
  console.log('')
  console.log(`Cloud stress (${cloudLoops} boucles Drive+Dropbox): ${formatMs(cloud.elapsedMs)}`)
  console.log(`Drive find calls: ${counters.driveFind}`)
  console.log(`Drive upload calls: ${counters.driveUpload}`)
  console.log(`Dropbox upload calls: ${counters.dropboxUpload}`)

  if (cloud.failures.length) {
    console.log(`ÉCHECS cloud: ${cloud.failures.length}`)
    console.log(cloud.failures.slice(0, 10).join('\n'))
    process.exitCode = 1
    return
  }

  const expectedWords = meta.totalScenes * meta.wordsPerScene
  if (stats.totalWords !== expectedWords) {
    console.error(`ÉCHEC stats mots: attendu=${expectedWords} obtenu=${stats.totalWords}`)
    process.exitCode = 1
    return
  }

  console.log('')
  console.log('OK: stress global passé (données massives + sauvegardes cloud résilientes).')
}

main().catch((err) => {
  console.error('ÉCHEC global:', err?.message || err)
  process.exitCode = 1
})
