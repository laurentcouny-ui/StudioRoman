import { coerce, gt, valid } from 'semver'

const CACHE_KEY = 'scriptor_update_check_v1'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

/** Ex. https://api.github.com/repos/ORG/REPO/releases/latest — si vide, pas de requête (évite un 404 console sur URL obsolète). */
function releasesLatestUrl(): string {
  const u = (import.meta.env?.VITE_RELEASES_LATEST_URL as string | undefined)?.trim()
  return u || ''
}

export type UpdateCheckResult = { available: boolean; latestVersion?: string }

function readCache(): UpdateCheckResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { t, result } = JSON.parse(raw) as {
      t: number
      result: UpdateCheckResult
    }
    if (typeof t !== 'number' || !result) return null
    if (Date.now() - t >= ONE_DAY_MS) return null
    return result
  } catch {
    return null
  }
}

function writeCache(result: UpdateCheckResult): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ t: Date.now(), result }),
    )
  } catch {
    /* quota / mode privé */
  }
}

async function fetchLatest(currentVersion: string): Promise<UpdateCheckResult> {
  const url = releasesLatestUrl()
  if (!url) return { available: false }

  const ctrl = new AbortController()
  const id = window.setTimeout(() => ctrl.abort(), 3000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return { available: false }
    const data = (await res.json()) as { tag_name?: string }
    const rawTag = data.tag_name?.replace(/^v/i, '') ?? ''
    const latest = coerce(rawTag)?.version ?? null
    const cur = coerce(currentVersion)?.version ?? null
    if (!latest || !cur || !valid(latest) || !valid(cur)) {
      return { available: false }
    }
    if (gt(latest, cur)) {
      return { available: true, latestVersion: latest }
    }
    return { available: false, latestVersion: latest }
  } catch {
    return { available: false }
  } finally {
    clearTimeout(id)
  }
}

/** Vérification des mises à jour : timeout 3 s, cache local 24 h, échec silencieux. Sans `VITE_RELEASES_LATEST_URL`, aucun appel réseau. */
export async function checkGitHubUpdate(
  currentVersion: string,
): Promise<UpdateCheckResult> {
  if (!releasesLatestUrl()) return { available: false }
  const cached = readCache()
  if (cached) return cached
  const result = await fetchLatest(currentVersion)
  writeCache(result)
  return result
}
