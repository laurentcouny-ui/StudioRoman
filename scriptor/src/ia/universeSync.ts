/**
 * Synchronise la saga courante + personnages vers l’API Java (bible / persos / chronologie fichier).
 */
import { getAddonFeatureFlags } from '../featureFlags.js'
import { apiClient } from './apiClient'

export function buildUniverseSyncPayload(project: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!project || typeof project !== 'object') return null
  const sagas = project.sagas as Array<Record<string, unknown>> | undefined
  const currentSagaId = project.currentSagaId as string | undefined
  const saga = sagas?.find((s) => s.id === currentSagaId)
  if (!saga) return null

  const characters = ((project.characters as Array<Record<string, unknown>>) || []).map((c) => ({
    scriptorId: String(c.id ?? ''),
    nom: String(c.name ?? ''),
    role: String(c.role ?? ''),
    description: [c.appearance, c.biography, c.goals, c.traits, c.relationships, c.notes]
      .filter((x) => typeof x === 'string' && (x as string).trim())
      .join('\n\n'),
    statut: '',
  }))

  const bible = (saga.bible as Record<string, unknown>) || {}
  const categories = (bible.categories as Array<Record<string, unknown>>) || []
  const entries = (bible.entries as Array<Record<string, unknown>>) || []

  const bibleEntries = entries
    .map((e) => {
      const cat = categories.find((c) => c.id === e.categoryId)
      let section = String(e.title ?? 'Sans titre')
      const subs = (cat?.subcategories as Array<Record<string, unknown>>) || []
      if (e.subcategoryId) {
        const sub = subs.find((s) => s.id === e.subcategoryId)
        if (sub?.title) section = `${String(sub.title)} — ${section}`
      }
      return {
        fiche: String(cat?.title ?? 'Bible'),
        section,
        paragraphe: 1,
        contenu: String(e.content ?? ''),
      }
    })
    .filter((b) => b.contenu.trim().length > 0)

  const timeline = (saga.timeline as Record<string, unknown>) || {}
  const events = (timeline.events as Array<Record<string, unknown>>) || []
  const timelineEvents = events.map((ev) => ({
    title: String(ev.title ?? ''),
    dateLabel: String(ev.date ?? ''),
    description: String(ev.description ?? ''),
  }))

  return { characters, bibleEntries, timelineEvents }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

/** Planifie un POST /universe/sync (debounce). Retourne une fonction d’annulation. */
export function scheduleUniverseSyncToBackend(
  project: Record<string, unknown> | null | undefined,
  delayMs = 2000,
): () => void {
  if (syncTimer) {
    clearTimeout(syncTimer)
    syncTimer = null
  }
  syncTimer = setTimeout(() => {
    syncTimer = null
    void pushUniverseSync(project)
  }, delayMs)
  return () => {
    if (syncTimer) {
      clearTimeout(syncTimer)
      syncTimer = null
    }
  }
}

async function pushUniverseSync(project: Record<string, unknown> | null | undefined) {
  const { aiPanel } = getAddonFeatureFlags()
  if (!aiPanel) return
  // En production Tauri (pas de proxy Vite), ne tenter la sync que si VITE_AI_API_BASE
  // est configuré — sinon fetch('/api/...') cible tauri://localhost/api/... et retourne 404.
  const hasExplicitBackendUrl = !!(import.meta.env?.VITE_AI_API_BASE as string | undefined)?.trim()
  if (import.meta.env.PROD && !hasExplicitBackendUrl) return
  const payload = buildUniverseSyncPayload(project)
  if (!payload) return
  try {
    await apiClient.post('/universe/sync', payload)
  } catch {
    /* backend arrêté ou hors-ligne : silencieux */
  }
}
