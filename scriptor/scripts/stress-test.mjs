import {
  STORAGE_KEY,
  loadInitialProject,
  computeStats,
  exportFullBackup,
  importFullBackup,
  buildManuscriptText,
  createInitialProject,
} from '../src/projectStore.js'

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
    key(index) {
      return [...store.keys()][index] ?? null
    },
    get length() {
      return store.size
    },
    _raw: store,
  }
}

function generateText(wordsPerScene) {
  // Texte pseudo-réaliste, simple à générer
  return Array(wordsPerScene).fill('mot').join(' ')
}

function buildLargeProject({ chaptersCount, scenesPerChapter, wordsPerScene }) {
  const project = createInitialProject()
  const saga = project.sagas[0]
  const volume = saga.volumes[0]
  volume.title = 'Tome Stress Test'
  volume.chapters = []
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
        summary: '',
        wordCount: wordsPerScene,
      })
      sceneTexts[id] = generateText(wordsPerScene)
    }
    volume.chapters.push(chapter)
  }

  return { project, sceneTexts }
}

function setTestWindow(localStorage) {
  global.window = { localStorage }
}

function estimateStorageBytes(localStorage) {
  let bytes = 0
  for (const [k, v] of localStorage._raw.entries()) {
    bytes += Buffer.byteLength(k, 'utf8') + Buffer.byteLength(v, 'utf8')
  }
  return bytes
}

function main() {
  const chaptersCount = 50
  const scenesPerChapter = 50
  const wordsPerScene = 2000
  const totalScenes = chaptersCount * scenesPerChapter

  const localStorage = createMemoryLocalStorage()
  setTestWindow(localStorage)

  const t0 = nowMs()
  const { project, sceneTexts } = buildLargeProject({
    chaptersCount,
    scenesPerChapter,
    wordsPerScene,
  })
  const t1 = nowMs()

  localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  for (const [sceneId, text] of Object.entries(sceneTexts)) {
    localStorage.setItem(`scriptor-scene-text-${sceneId}`, text)
  }
  const t2 = nowMs()

  const loadedProject = loadInitialProject()
  const t3 = nowMs()

  const stats = computeStats(loadedProject)
  const t4 = nowMs()

  const backup = exportFullBackup()
  const t5 = nowMs()

  const imported = importFullBackup(backup)
  const t6 = nowMs()

  const manuscript = buildManuscriptText(imported)
  const t7 = nowMs()

  const storageBytes = estimateStorageBytes(localStorage)
  const backupJsonBytes = Buffer.byteLength(JSON.stringify(backup), 'utf8')
  const manuscriptBytes = Buffer.byteLength(manuscript, 'utf8')

  console.log('=== Stress test Scriptor ===')
  console.log(`Chapitres: ${chaptersCount}`)
  console.log(`Scènes/chapitre: ${scenesPerChapter}`)
  console.log(`Mots/scène: ${wordsPerScene}`)
  console.log(`Total scènes: ${totalScenes}`)
  console.log('')
  console.log(`Génération dataset: ${formatMs(t1 - t0)}`)
  console.log(`Injection localStorage: ${formatMs(t2 - t1)}`)
  console.log(`loadInitialProject(): ${formatMs(t3 - t2)}`)
  console.log(`computeStats(): ${formatMs(t4 - t3)}`)
  console.log(`exportFullBackup(): ${formatMs(t5 - t4)}`)
  console.log(`importFullBackup(): ${formatMs(t6 - t5)}`)
  console.log(`buildManuscriptText(): ${formatMs(t7 - t6)}`)
  console.log('')
  console.log(`Taille localStorage simulée: ${(storageBytes / (1024 * 1024)).toFixed(2)} MB`)
  console.log(`Taille backup JSON: ${(backupJsonBytes / (1024 * 1024)).toFixed(2)} MB`)
  console.log(`Taille manuscrit texte: ${(manuscriptBytes / (1024 * 1024)).toFixed(2)} MB`)

  if (stats.totalWords !== totalScenes * wordsPerScene) {
    console.error(
      `ECHEC: totalWords attendu=${totalScenes * wordsPerScene}, obtenu=${stats.totalWords}`,
    )
    process.exitCode = 1
    return
  }

  console.log('')
  console.log('OK: dataset massif chargé, exporté, importé, compilé en manuscrit sans crash.')
}

main()
