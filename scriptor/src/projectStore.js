export const STORAGE_KEY = 'scriptor-project-v1'
/** Copie du dernier JSON valide (récupération si écrasement accidentel). */
export const LAST_KNOWN_GOOD_KEY = 'scriptor-project-v1.last-known-good'
const UNREADABLE_RAW_BACKUP_KEY = 'scriptor-project-v1.unreadable-raw-backup'
const ALLOW_SHRINK_SESSION_KEY = 'scriptor-allow-storage-shrink-once'
const SCENE_TEXT_PREFIX = 'scriptor-scene-text-'

export function stripHtml(html) {
  if (!html || typeof html !== 'string') return ''
  const div = typeof document !== 'undefined' && document.createElement('div')
  if (!div) return html.replace(/<[^>]*>/g, '')
  div.innerHTML = html
  return (div.textContent || div.innerText || '').trim()
}

/** Sanitise le HTML de l'éditeur pour éviter injection (on* / script / iframe / svg...). */
export function sanitizeSceneHtml(html) {
  if (!html || typeof html !== 'string') return ''
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '')
  }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const dangerous = doc.querySelectorAll(
      'script, iframe, object, embed, style, link, meta, svg',
    )
    dangerous.forEach((n) => n.remove())

    doc.querySelectorAll('*').forEach((el) => {
      ;[...el.attributes].forEach((attr) => {
        const name = String(attr.name || '').toLowerCase()
        const value = String(attr.value || '')

        if (name.startsWith('on')) {
          el.removeAttribute(attr.name)
          return
        }

        if (name === 'href' || name === 'src' || name === 'xlink:href') {
          const v = value.trim().toLowerCase()
          if (v.startsWith('javascript:') || v.startsWith('vbscript:')) {
            el.removeAttribute(attr.name)
            return
          }
          if (v.startsWith('data:') && !v.startsWith('data:image/')) {
            el.removeAttribute(attr.name)
          }
          return
        }

        if (name === 'style') {
          const v = value.toLowerCase()
          if (
            v.includes('url(') ||
            v.includes('expression') ||
            v.includes('javascript:') ||
            v.includes('@import') ||
            v.includes('behavior:')
          ) {
            el.removeAttribute(attr.name)
          }
        }
      })
    })

    return doc.body.innerHTML
  } catch {
    return ''
  }
}

export function countWords(text) {
  if (!text) return 0
  const raw = typeof text === 'string' ? text : String(text)
  const trimmed = raw.includes('<') ? stripHtml(raw).trim() : raw.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function generateId(prefix) {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createEmptyScene() {
  return {
    id: generateId('scene'),
    title: 'Nouvelle scène',
    pov: '',
    status: 'draft',
    charactersInScene: [],
    summary: '',
    content: '',
  }
}

export function createEmptyChapter() {
  return {
    id: generateId('chapter'),
    title: 'Nouveau chapitre',
    scenes: [createEmptyScene()],
  }
}

export function createEmptyVolume() {
  return {
    id: generateId('volume'),
    title: 'Nouveau tome',
    chapters: [createEmptyChapter()],
  }
}

export function createEmptyBibleEntry() {
  return {
    id: generateId('bible'),
    title: '',
    content: '',
    // Organisation Bible (v1)
    categoryId: null,
    subcategoryId: null,
  }
}

export function createEmptyBibleCategory() {
  return {
    id: generateId('bible-cat'),
    title: '',
    subcategories: [],
  }
}

export function createEmptyBibleSubcategory() {
  return {
    id: generateId('bible-subcat'),
    title: '',
  }
}

export function getCharacterTemplate(templateMode = 'standard') {
  const isEmpty = templateMode === 'empty'
  return {
    name: 'Nouveau personnage',
    role: '',
    image: null,
    appearance: isEmpty ? '' : 'Cheveux : ...\nTenue : ...\nSignes distinctifs : ...',
    biography: isEmpty ? '' : 'Naissance / passé : ...\nÉvénements marquants : ...',
    goals: isEmpty ? '' : 'Ce qu’il veut : ...\nCe qui l’empêche : ...',
    traits: isEmpty ? '' : 'Forces : ...\nFaiblesses : ...',
    relationships: isEmpty ? '' : 'Liens avec : ...',
    notes: '',
  }
}

export function createEmptyTimelineEvent() {
  return {
    id: generateId('timeline'),
    title: 'Sans titre',
    date: '',
    description: '',
  }
}

export function createEmptyPlace() {
  return {
    id: generateId('place'),
    title: 'Sans titre',
    description: '',
    image: null,
  }
}

export function createEmptySaga() {
  return {
    id: generateId('saga'),
    title: 'Nouvelle saga',
    volumes: [createEmptyVolume()],
    bible: {
      categories: [],
      entries: [],
    },
    timeline: { events: [createEmptyTimelineEvent()] },
    worldMap: { mapImage: null, places: [createEmptyPlace()] },
  }
}

export function createInitialProject() {
  const saga = createEmptySaga()
  saga.title = 'Nouvelle saga sans titre'
  saga.volumes[0].title = 'Tome 1'
  return {
    sagas: [saga],
    currentSagaId: saga.id,
    characters: [],
  }
}

export function safeParseProject(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return createInitialProject()
    return parsed
  } catch {
    return createInitialProject()
  }
}

function isValidBackupProjectShape(project) {
  if (!project || typeof project !== 'object') return false
  if (!Array.isArray(project.sagas) || project.sagas.length === 0) return false
  if (project.sagas.length > 50) return false
  for (const saga of project.sagas) {
    if (!saga || typeof saga !== 'object') return false
    if (!Array.isArray(saga.volumes)) return false
    if (saga.volumes.length > 50) return false
    for (const vol of saga.volumes) {
      if (!vol || typeof vol !== 'object') return false
      if (!Array.isArray(vol.chapters)) return false
      if (vol.chapters.length > 200) return false
      for (const ch of vol.chapters) {
        if (!ch || typeof ch !== 'object') return false
        if (!Array.isArray(ch.scenes)) return false
        if (ch.scenes.length > 500) return false
      }
    }
  }
  return true
}

/** Retourne la saga actuellement sélectionnée. */
export function getCurrentSaga(project) {
  if (!project.sagas?.length) return null
  const current = project.sagas.find((s) => s.id === project.currentSagaId)
  return current ?? project.sagas[0]
}

/** Migration : ancien format (sagaTitle + volumes) → nouveau (sagas + currentSagaId). */
function migrateToSagas(project) {
  if (project.sagas && Array.isArray(project.sagas)) {
    project.sagas.forEach((saga) => {
      if (!saga.bible) saga.bible = {}
      if (!Array.isArray(saga.bible.categories)) saga.bible.categories = []
      const rawEntries = Array.isArray(saga.bible.entries) ? saga.bible.entries : []
      saga.bible.entries = rawEntries.filter((e) => e && typeof e === 'object')

      // Bible vide par défaut ; si d’anciennes entrées existent sans catégorie, on crée une catégorie de repli
      if (saga.bible.categories.length === 0) {
        if (saga.bible.entries.length > 0) {
          const fallbackCat = createEmptyBibleCategory()
          saga.bible.categories = [fallbackCat]
          const firstCatId = fallbackCat.id
          saga.bible.entries = saga.bible.entries.map((e) => ({
            ...e,
            categoryId: typeof e.categoryId === 'string' ? e.categoryId : firstCatId,
            subcategoryId: typeof e.subcategoryId === 'string' ? e.subcategoryId : null,
          }))
        }
      } else {
        const firstCatId = saga.bible.categories[0]?.id ?? null
        saga.bible.entries = saga.bible.entries.map((e) => ({
          ...e,
          categoryId: typeof e.categoryId === 'string' ? e.categoryId : firstCatId,
          subcategoryId: typeof e.subcategoryId === 'string' ? e.subcategoryId : null,
        }))
      }
      if (!saga.timeline?.events) saga.timeline = { events: [createEmptyTimelineEvent()] }
      if (!saga.worldMap) saga.worldMap = { mapImage: null, places: [createEmptyPlace()] }
      else {
        if (!saga.worldMap.places) saga.worldMap.places = [createEmptyPlace()]
        if (saga.worldMap.mapImage === undefined) saga.worldMap.mapImage = null
      }
    })
    return project
  }
  const saga = {
    id: generateId('saga'),
    title: project.sagaTitle ?? 'Nouvelle saga sans titre',
    volumes: project.volumes ?? [createEmptyVolume()],
    bible: {
      categories: [],
      entries: [],
    },
    timeline: { events: [createEmptyTimelineEvent()] },
    worldMap: { mapImage: null, places: [createEmptyPlace()] },
  }
  return {
    sagas: [saga],
    currentSagaId: saga.id,
    characters: project.characters ?? [],
  }
}

function migrateSceneText(saga) {
  saga.volumes?.forEach((volume) => {
    volume.chapters?.forEach((chapter) => {
      chapter.scenes?.forEach((scene) => {
        if (scene && typeof scene.id === 'string') {
          if (typeof scene.content === 'string' && scene.content.length > 0) {
            const key = `${SCENE_TEXT_PREFIX}${scene.id}`
            if (typeof window !== 'undefined') {
              try {
                const safe = sanitizeSceneHtml(scene.content)
                window.localStorage.setItem(key, safe)
              } catch {
                window.dispatchEvent(
                  new CustomEvent('scriptor-storage-warning', {
                    detail: { scope: 'scene-migration-write', at: Date.now() },
                  }),
                )
              }
            }
            // Compte basé sur le HTML sanitisé (évite de compter du contenu "dangereux").
            scene.wordCount = countWords(sanitizeSceneHtml(scene.content))
          } else if (typeof scene.wordCount !== 'number') {
            const key = `${SCENE_TEXT_PREFIX}${scene.id}`
            let stored = ''
            if (typeof window !== 'undefined') {
              try {
                stored = window.localStorage.getItem(key) || ''
              } catch {
                stored = ''
                window.dispatchEvent(
                  new CustomEvent('scriptor-storage-warning', {
                    detail: { scope: 'scene-migration-read', at: Date.now() },
                  }),
                )
              }
            }
            scene.wordCount = countWords(sanitizeSceneHtml(stored))
          }
        }
      })
    })
  })
}

function normalizeProjectCharacters(project) {
  if (!Array.isArray(project.characters)) project.characters = []
  project.characters = project.characters
    .filter((c) => c && typeof c === 'object')
    .map((c) => {
      const t = getCharacterTemplate('standard')
      const merged = { ...t, ...c }
      merged.image = c.image ?? null
      merged.appearance = typeof c.appearance === 'string' ? c.appearance : t.appearance
      merged.biography = typeof c.biography === 'string' ? c.biography : t.biography
      merged.goals = typeof c.goals === 'string' ? c.goals : t.goals
      merged.traits = typeof c.traits === 'string' ? c.traits : t.traits
      merged.relationships = typeof c.relationships === 'string' ? c.relationships : t.relationships
      merged.notes = typeof c.notes === 'string' ? c.notes : ''
      return merged
    })
}

/**
 * Reconstruit un projet depuis une chaîne JSON sans retomber sur le projet vierge
 * (utilisé pour anti-écrasement et pour last-known-good).
 */
export function tryHydrateProjectFromRaw(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const project = migrateToSagas(parsed)
    if (!project.sagas?.length) return null
    project.sagas.forEach(migrateSceneText)
    normalizeProjectCharacters(project)
    return project
  } catch {
    return null
  }
}

/**
 * Projet tout neuf au premier lancement (createInitialProject) — pas une saga ajoutée via « Nouvelle saga ».
 * Sert à détecter un état « vide » qui ne doit pas écraser un gros JSON encore présent dans localStorage.
 */
export function isLikelyPristineDefaultProject(project) {
  if (!project || !Array.isArray(project.sagas) || project.sagas.length !== 1) return false
  if ((project.characters?.length ?? 0) !== 0) return false
  const s = project.sagas[0]
  if (!s.volumes || s.volumes.length !== 1) return false
  const v = s.volumes[0]
  if (!v.chapters || v.chapters.length !== 1) return false
  const ch = v.chapters[0]
  if (!ch.scenes || ch.scenes.length !== 1) return false
  const sc = ch.scenes[0]
  if ((s.title || '').trim() !== 'Nouvelle saga sans titre') return false
  if ((v.title || '').trim() !== 'Tome 1') return false
  if ((ch.title || '').trim() !== 'Nouveau chapitre') return false
  if ((sc.title || '').trim() !== 'Nouvelle scène') return false
  return true
}

/** Après import fichier ou action explicite : autoriser un enregistrement plus petit que l’ancien. */
export function markAllowShrinkPersist() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(ALLOW_SHRINK_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function consumeAllowShrinkPersist() {
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(ALLOW_SHRINK_SESSION_KEY) === '1') {
      sessionStorage.removeItem(ALLOW_SHRINK_SESSION_KEY)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

export function loadInitialProject() {
  try {
    if (typeof window === 'undefined') return createInitialProject()
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const fromLkg = tryHydrateProjectFromRaw(window.localStorage.getItem(LAST_KNOWN_GOOD_KEY) || '')
      if (fromLkg) return fromLkg
      return createInitialProject()
    }

    let project = tryHydrateProjectFromRaw(raw)
    if (project) {
      try {
        window.localStorage.setItem(LAST_KNOWN_GOOD_KEY, JSON.stringify(project))
      } catch {
        /* ignore */
      }
      return project
    }

    const fromLkg = tryHydrateProjectFromRaw(window.localStorage.getItem(LAST_KNOWN_GOOD_KEY) || '')
    if (fromLkg) return fromLkg

    try {
      window.localStorage.setItem(UNREADABLE_RAW_BACKUP_KEY, raw.slice(0, 4_000_000))
    } catch {
      /* ignore */
    }
    return createInitialProject()
  } catch (_) {
    return createInitialProject()
  }
}

export function computeStats(project) {
  const saga = getCurrentSaga(project)
  if (!saga?.volumes) return { totalWords: 0, currentSceneWords: 0 }
  let total = 0
  saga.volumes.forEach((volume) => {
    volume.chapters?.forEach((chapter) => {
      chapter.scenes?.forEach((scene) => {
        const c = typeof scene.wordCount === 'number' ? scene.wordCount : 0
        total += c
      })
    })
  })
  return { totalWords: total, currentSceneWords: 0 }
}

/** Statistiques pour le tableau de bord : totaux et détail par tome. */
export function getDashboardStats(project) {
  const saga = getCurrentSaga(project)
  const volumesList = saga?.volumes ?? []
  const volumes = volumesList.map((vol) => {
    let words = 0
    let scenes = 0
    vol.chapters?.forEach((ch) => {
      ch.scenes?.forEach((sc) => {
        scenes += 1
        words += typeof sc.wordCount === 'number' ? sc.wordCount : 0
      })
    })
    return {
      id: vol.id,
      title: vol.title || 'Sans titre',
      chaptersCount: vol.chapters?.length ?? 0,
      scenesCount: scenes,
      wordsCount: words,
    }
  })

  const totalWords = volumes.reduce((s, v) => s + v.wordsCount, 0)
  const totalChapters = volumes.reduce((s, v) => s + v.chaptersCount, 0)
  const totalScenes = volumes.reduce((s, v) => s + v.scenesCount, 0)
  const totalCharacters = (project.characters || []).length

  return {
    totalWords,
    totalChapters,
    totalScenes,
    totalVolumes: volumes.length,
    totalCharacters,
    volumes,
  }
}

export function findSceneById(project, sceneId) {
  const saga = getCurrentSaga(project)
  if (!saga?.volumes) return null
  for (const volume of saga.volumes) {
    for (const chapter of volume.chapters || []) {
      for (const scene of chapter.scenes || []) {
        if (scene.id === sceneId) {
          return { volume, chapter, scene }
        }
      }
    }
  }
  return null
}

export function loadSceneText(sceneId) {
  if (typeof window === 'undefined' || !sceneId) return ''
  const key = `${SCENE_TEXT_PREFIX}${sceneId}`
  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    window.dispatchEvent?.(
      new CustomEvent('scriptor-storage-warning', {
        detail: { scope: 'scene-live-read', at: Date.now() },
      }),
    )
    return ''
  }
}

// ─── IndexedDB — filet de sécurité si localStorage est plein ─────────────────
const _IDB_NAME = 'scriptor-scene-idb'
const _IDB_STORE = 'texts'
let _idbPromise = null

function _getSceneIdb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (!_idbPromise) {
    _idbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(_IDB_NAME, 1)
        req.onupgradeneeded = () => {
          try { req.result.createObjectStore(_IDB_STORE) } catch { /* ignore */ }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
  }
  return _idbPromise
}

function _idbWrite(key, value) {
  _getSceneIdb().then((db) => {
    if (!db) return
    try {
      const tx = db.transaction(_IDB_STORE, 'readwrite')
      tx.objectStore(_IDB_STORE).put(value, key)
    } catch { /* ignore */ }
  }).catch(() => {})
}

export function recoverSceneTextFromIdb(sceneId) {
  if (!sceneId) return Promise.resolve('')
  const key = `${SCENE_TEXT_PREFIX}${sceneId}`
  return _getSceneIdb().then((db) => {
    if (!db) return ''
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(_IDB_STORE, 'readonly')
        const req = tx.objectStore(_IDB_STORE).get(key)
        req.onsuccess = () => resolve(req.result || '')
        req.onerror = () => resolve('')
      } catch {
        resolve('')
      }
    })
  }).catch(() => '')
}
// ─────────────────────────────────────────────────────────────────────────────

export function saveSceneText(sceneId, text) {
  if (typeof window === 'undefined' || !sceneId) return
  const key = `${SCENE_TEXT_PREFIX}${sceneId}`
  const safe = sanitizeSceneHtml(text || '')
  // Écriture IDB en parallèle — survit si localStorage est plein
  _idbWrite(key, safe)
  try {
    window.localStorage.setItem(key, safe)
  } catch {
    window.dispatchEvent(
      new CustomEvent('scriptor-storage-warning', {
        detail: { scope: 'scene-live-write', at: Date.now() },
      }),
    )
  }
}

function _idbDelete(key) {
  _getSceneIdb()
    .then((db) => {
      if (!db) return
      try {
        const tx = db.transaction(_IDB_STORE, 'readwrite')
        tx.objectStore(_IDB_STORE).delete(key)
      } catch {
        /* ignore */
      }
    })
    .catch(() => {})
}

/** Supprime le texte de scène du stockage (rollback import ciblé). */
export function clearSceneTexts(sceneIds) {
  if (typeof window === 'undefined') return
  for (const id of sceneIds || []) {
    if (!id) continue
    const key = `${SCENE_TEXT_PREFIX}${id}`
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    _idbDelete(key)
  }
}

/** Retire un tome d’une saga (copie immuable du projet). */
export function removeVolumeFromSaga(project, sagaId, volumeId) {
  const next = structuredClone
    ? structuredClone(project)
    : JSON.parse(JSON.stringify(project))
  const saga = next.sagas?.find((s) => s.id === sagaId)
  if (!saga?.volumes) return next
  saga.volumes = (saga.volumes || []).filter((v) => v.id !== volumeId)
  return next
}

/** Liste de tous les IDs de scènes du projet (toutes sagas). */
function getAllSceneIds(project) {
  const ids = []
  project.sagas?.forEach((saga) => {
    saga.volumes?.forEach((vol) => {
      vol.chapters?.forEach((ch) => {
        ch.scenes?.forEach((sc) => {
          if (sc?.id) ids.push(sc.id)
        })
      })
    })
  })
  return ids
}

/** Export complet pour sauvegarde fichier : projet + tous les textes de scènes. */
export function exportFullBackup() {
  if (typeof window === 'undefined') return null
  let raw = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    window.dispatchEvent?.(
      new CustomEvent('scriptor-storage-warning', {
        detail: { scope: 'export-full-read', at: Date.now() },
      }),
    )
  }
  const project = raw ? safeParseProject(raw) : createInitialProject()
  const migrated = migrateToSagas(project)
  migrated.sagas?.forEach(migrateSceneText)
  const sceneTexts = {}
  getAllSceneIds(migrated).forEach((id) => {
    sceneTexts[id] = loadSceneText(id)
  })
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    project: migrated,
    sceneTexts,
  }
}

const LAST_LOCAL_BACKUP_KEY = 'scriptor-last-local-backup'

export function getLastLocalBackupTimestamp() {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(LAST_LOCAL_BACKUP_KEY)
  if (!v) return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

export function setLastLocalBackupTimestamp() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LAST_LOCAL_BACKUP_KEY, String(Date.now()))
  } catch {
    window.dispatchEvent(
      new CustomEvent('scriptor-storage-warning', {
        detail: { scope: 'last-local-backup-write', at: Date.now() },
      }),
    )
  }
}

/** Restaure une sauvegarde complète (projet + textes de scènes). */
export function importFullBackup(data) {
  if (typeof window === 'undefined' || !data) return null
  const normalized = data.backup && typeof data.backup === 'object' ? data.backup : data
  const project = normalized.project && typeof normalized.project === 'object' ? normalized.project : null
  const sceneTexts =
    normalized.sceneTexts && typeof normalized.sceneTexts === 'object'
      ? normalized.sceneTexts
      : {}
  if (!project || !project.sagas) return null
  if (!isValidBackupProjectShape(project)) return null
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
  } catch {
    window.dispatchEvent(
      new CustomEvent('scriptor-storage-warning', {
        detail: { scope: 'import-backup-write', at: Date.now() },
      }),
    )
    return null
  }
  Object.entries(sceneTexts).forEach(([sceneId, text]) => {
    if (sceneId && typeof text === 'string') saveSceneText(sceneId, text)
  })
  return project
}

/** Construit le manuscrit de la saga courante (texte brut, scènes concaténées). */
export function buildManuscriptText(project) {
  const saga = getCurrentSaga(project)
  if (!saga?.volumes?.length) return ''
  const parts = []
  parts.push(saga.title || 'Sans titre')
  parts.push('')
  saga.volumes.forEach((vol) => {
    parts.push(vol.title || 'Sans titre')
    parts.push('')
    vol.chapters?.forEach((ch) => {
      parts.push(ch.title || 'Sans titre')
      parts.push('')
      ch.scenes?.forEach((scene) => {
        const text = loadSceneText(scene.id)
        parts.push(stripHtml(text || '').trim())
        if (stripHtml(text || '').trim()) parts.push('')
      })
    })
  })
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const DOSSIER_STORAGE_PREFIX = 'scriptor-dossier-'

/** Charge les champs du dossier éditeur pour une saga (lettre, synopsis, note d'intention, bio). */
export function loadDossierEditeur(sagaId) {
  if (typeof window === 'undefined' || !sagaId) return { lettre: '', synopsis: '', noteIntention: '', bio: '' }
  try {
    const raw = window.localStorage.getItem(`${DOSSIER_STORAGE_PREFIX}${sagaId}`)
    if (!raw) return { lettre: '', synopsis: '', noteIntention: '', bio: '' }
    const data = JSON.parse(raw)
    return {
      lettre: typeof data.lettre === 'string' ? data.lettre : '',
      synopsis: typeof data.synopsis === 'string' ? data.synopsis : '',
      noteIntention: typeof data.noteIntention === 'string' ? data.noteIntention : '',
      bio: typeof data.bio === 'string' ? data.bio : '',
    }
  } catch {
    return { lettre: '', synopsis: '', noteIntention: '', bio: '' }
  }
}

/** Enregistre les champs du dossier éditeur pour une saga. */
export function saveDossierEditeur(sagaId, data) {
  if (typeof window === 'undefined' || !sagaId || !data) return
  try {
    window.localStorage.setItem(
      `${DOSSIER_STORAGE_PREFIX}${sagaId}`,
      JSON.stringify({
        lettre: String(data.lettre ?? ''),
        synopsis: String(data.synopsis ?? ''),
        noteIntention: String(data.noteIntention ?? ''),
        bio: String(data.bio ?? ''),
      })
    )
  } catch {
    window.dispatchEvent(
      new CustomEvent('scriptor-storage-warning', {
        detail: { scope: 'dossier-write', at: Date.now() },
      }),
    )
  }
}

const COVER_STORAGE_PREFIX = 'scriptor-saga-cover-'

/** Données couverture pour PDF / EPUB (data URL, hors projet JSON pour limiter la taille). */
export function loadSagaCover(sagaId) {
  if (typeof window === 'undefined' || !sagaId) return null
  try {
    const raw = window.localStorage.getItem(`${COVER_STORAGE_PREFIX}${sagaId}`)
    if (!raw) return null
    const data = JSON.parse(raw)
    const dataUrl = typeof data.dataUrl === 'string' ? data.dataUrl : ''
    if (!dataUrl.startsWith('data:')) return null
    const mime = typeof data.mime === 'string' ? data.mime : ''
    return { dataUrl, mime }
  } catch {
    return null
  }
}

export function saveSagaCover(sagaId, dataUrl, mime = '') {
  if (typeof window === 'undefined' || !sagaId || typeof dataUrl !== 'string') return false
  if (!dataUrl.startsWith('data:')) return false
  try {
    window.localStorage.setItem(
      `${COVER_STORAGE_PREFIX}${sagaId}`,
      JSON.stringify({
        dataUrl,
        mime: mime || '',
        updatedAt: Date.now(),
      }),
    )
    return true
  } catch {
    window.dispatchEvent(
      new CustomEvent('scriptor-storage-warning', {
        detail: { scope: 'saga-cover-write', at: Date.now() },
      }),
    )
    return false
  }
}

export function clearSagaCover(sagaId) {
  if (typeof window === 'undefined' || !sagaId) return
  try {
    window.localStorage.removeItem(`${COVER_STORAGE_PREFIX}${sagaId}`)
  } catch {
    /* ignore */
  }
}

/** Construit le manuscrit en HTML (pour ouverture dans Word / export). */
export function buildManuscriptHtml(project) {
  const saga = getCurrentSaga(project)
  if (!saga?.volumes?.length) return ''
  const title = (saga.title || 'Sans titre').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const styles = `
    body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.5; max-width: 40rem; margin: 2cm auto; color: #111; }
    h1 { font-size: 1.75rem; margin: 0 0 1.2em; page-break-after: avoid; }
    h2 { font-size: 1.35rem; margin: 1.5em 0 0.6em; page-break-after: avoid; border-bottom: 1px solid #ccc; padding-bottom: 0.2em; }
    h3 { font-size: 1.15rem; margin: 1.2em 0 0.5em; page-break-after: avoid; }
    h4 { font-size: 1.05rem; margin: 1em 0 0.4em; font-weight: 600; page-break-after: avoid; }
    .scene-body { margin-bottom: 1.25em; }
    .scene-body p { margin: 0 0 0.65em; }
  `
  let body = `<h1>${title}</h1>\n`
  saga.volumes.forEach((vol) => {
    const volTitle = (vol.title || 'Sans titre').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    body += `<h2>${volTitle}</h2>\n`
    vol.chapters?.forEach((ch) => {
      const chTitle = (ch.title || 'Sans titre').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      body += `<h3>${chTitle}</h3>\n`
      ch.scenes?.forEach((scene) => {
        const sceneTitle = (scene.title || 'Scène').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        body += `<h4>${sceneTitle}</h4>\n`
        const raw = loadSceneText(scene.id) || ''
        const safe = sanitizeSceneHtml(raw)
        body += `<div class="scene-body">${safe || '<p></p>'}</div>\n`
      })
    })
  })
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>${styles}</style></head><body>${body}</body></html>`
}

/**
 * Parse un texte importé pour en extraire une structure tome / chapitres / scènes.
 * Détecte : "Chapitre 1", "Chapitre : Titre", "## Titre".
 * Sinon : un seul chapitre avec une scène (tout le texte).
 */
export function parseImportedText(text) {
  const raw = (text || '').trim()
  if (!raw) {
    return { volumeTitle: 'Import', chapters: [{ title: 'Chapitre 1', scenes: [{ title: 'Scène 1', text: '' }] }] }
  }

  const chapterRegex = /^\s*(?:Chapitre\s*[:\d]+\s*[-–—]?\s*|Chapitre\s+.+?\s*[-–—]?\s*|#{1,6}\s+)(.*)$/gim
  const matches = [...raw.matchAll(chapterRegex)]

  const chapters = []
  if (matches.length === 0) {
    chapters.push({ title: 'Chapitre 1', scenes: [{ title: 'Scène 1', text: raw }] })
  } else {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i][0].length
      const end = matches[i + 1] ? matches[i + 1].index : raw.length
      const content = raw.slice(start, end).trim()
      const title = (matches[i][1] || '').trim() || `Chapitre ${i + 1}`
      chapters.push({
        title,
        scenes: [{ title: 'Scène 1', text: content }],
      })
    }
  }

  return { volumeTitle: 'Import', chapters }
}

