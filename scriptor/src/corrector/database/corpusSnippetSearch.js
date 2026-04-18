/**
 * Recherche floue dans les extraits issus de database/processed (index corpusChunks.json).
 */
import Fuse from 'fuse.js'

/** @type {import('fuse.js').default | null} */
let fuseInstance = null
/** @type {{ id: string, source: string, text: string }[] | undefined} */
let chunkList
/** @type {Promise<void> | null} */
let loadPromise = null

async function ensureChunksLoaded() {
  if (chunkList !== undefined) return chunkList
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const mod = await import('./index/corpusChunks.json')
        const data = mod.default ?? mod
        chunkList = Array.isArray(data.chunks) ? data.chunks : []
      } catch {
        chunkList = []
      }
    })()
  }
  await loadPromise
  return chunkList
}

function buildFuse(list) {
  return new Fuse(list, {
    keys: ['text'],
    threshold: 0.42,
    ignoreLocation: true,
    minMatchCharLength: 3,
    includeScore: true,
  })
}

/**
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ id: string, source: string, text: string, score?: number }[]>}
 */
export async function searchCorpusSnippets(query, opts = {}) {
  const q = String(query || '').trim()
  if (q.length < 3) return []
  const list = await ensureChunksLoaded()
  if (!list.length) return []
  if (!fuseInstance) fuseInstance = buildFuse(list)
  const limit = opts.limit ?? 6
  return fuseInstance.search(q.slice(0, 280), { limit }).map((r) => ({
    ...r.item,
    score: r.score,
  }))
}

/**
 * @returns {Promise<{ loaded: boolean, count: number }>}
 */
export async function getCorpusSnippetIndexStatus() {
  const list = await ensureChunksLoaded()
  return { loaded: list.length > 0, count: list.length }
}

/** Invalide le cache (apres rebuild index). */
export function resetCorpusSnippetCache() {
  fuseInstance = null
  chunkList = undefined
  loadPromise = null
}
