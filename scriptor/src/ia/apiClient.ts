/**
 * Client API → backend Scriptor IA (Spring Boot).
 * - Dev : par défaut URL relative `/api/v1/ia` → même origine (ex. localhost:1420) + proxy Vite → 127.0.0.1:8080
 * - Build sans proxy : VITE_AI_API_BASE (ex. http://127.0.0.1:8080/api/v1/ia)
 * - Contournement proxy (dev uniquement) : VITE_IA_DEV_USE_DIRECT_127=1 → appels directs vers 127.0.0.1:8080 (CORS déjà ouvert côté Java)
 */
function getBaseUrl(): string {
  const raw = (import.meta.env?.VITE_AI_API_BASE || '').trim().replace(/\/$/, '')
  if (raw) return raw
  const useDirect127 =
    import.meta.env.DEV &&
    /^(1|true|yes)$/i.test(String(import.meta.env?.VITE_IA_DEV_USE_DIRECT_127 || '').trim())
  if (useDirect127) return 'http://127.0.0.1:8080/api/v1/ia'
  return '/api/v1/ia'
}

const BASE_URL = getBaseUrl()

function iaFetchDebugEnabled(): boolean {
  return /^(1|true|yes)$/i.test(String(import.meta.env?.VITE_IA_FETCH_DEBUG || '').trim())
}

/** URL absolue utilisée par le navigateur / WebView (pour logs et diagnostic 502 / proxy). */
export function resolveIaRequestUrl(endpoint: string): string {
  const suffix = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const combined = `${BASE_URL}${suffix}`
  if (combined.startsWith('http://') || combined.startsWith('https://')) return combined
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(combined, window.location.origin).href
  }
  return combined
}

function iaFetchDebugLog(method: string, url: string): void {
  if (!iaFetchDebugEnabled()) return
  // eslint-disable-next-line no-console
  console.info('[Scriptor:ia-fetch]', method, url)
}
const IA_SETTINGS_CACHE_KEY = 'scriptor_ia_settings'

function isSilentModeEnabled(): boolean {
  try {
    const raw = localStorage.getItem(IA_SETTINGS_CACHE_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { silentMode?: boolean }
    return parsed?.silentMode === true
  } catch {
    return false
  }
}

function isSettingsEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/settings')
}

/** Santé / Ollama : autorisés même en mode silencieux (diagnostics uniquement). */
function isDiagnosticsEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/ollama/') || endpoint === '/health'
}

function isUniverseSyncEndpoint(endpoint: string): boolean {
  return endpoint.startsWith('/universe/')
}

/** Enregistrement d’une proposition bible (pas d’appel LLM). */
function isBibleProposeEndpoint(endpoint: string): boolean {
  return endpoint === '/bible/propose-entry'
}

function assertNotSilenced(endpoint: string): void {
  if (!isSilentModeEnabled()) return
  if (isSettingsEndpoint(endpoint)) return
  if (isDiagnosticsEndpoint(endpoint)) return
  if (isUniverseSyncEndpoint(endpoint)) return
  if (isBibleProposeEndpoint(endpoint)) return
  throw new Error(
    "L'IA est en mode silencieux. Désactivez ce mode dans Paramètres IA pour relancer les appels réseau.",
  )
}

/** Une ligne — évite les pavés d’aide répétés dans chaque erreur. */
function backendHintOneLine(): string {
  return BASE_URL.startsWith('http')
    ? ' Lancez le backend Java (dossier backend, mvn spring-boot:run) ou corrigez VITE_AI_API_BASE.'
    : ' Lancez le backend Java : ouvrez un terminal, cd backend, puis mvn spring-boot:run (port 8080).'
}

/** Ping minimal côté serveur (évite certains soucis de routage sur /api/v1/ia/health). */
function getHealthCheckUrls(): string[] {
  if (BASE_URL.startsWith('http')) {
    try {
      const origin = new URL(BASE_URL).origin
      return [`${origin}/api/health`, `${BASE_URL}/health`]
    } catch {
      return [`${BASE_URL}/health`]
    }
  }
  return ['/api/health', `${BASE_URL}/health`]
}

function looksHealthy(res: Response, body: string): boolean {
  if (!res.ok) return false
  const t = body.trim()
  if (t === 'ok') return true
  try {
    const j = JSON.parse(t) as { ok?: boolean }
    return j.ok === true
  } catch {
    return false
  }
}

function parseErrorJson(text: string): string {
  if (!text) return ''
  try {
    const j = JSON.parse(text) as { message?: string; error?: string }
    const m = (j.message || j.error || '').trim()
    return m.length > 180 ? `${m.slice(0, 180)}…` : m
  } catch {
    return text.slice(0, 180)
  }
}

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text()
    return parseErrorJson(text)
  } catch {
    return ''
  }
}

function statusExtra(status: number): string {
  if (status === 502 || status === 503) {
    return ' (backend Java arrêté ou port 8080 inaccessible — lancez-le depuis le dossier backend)'
  }
  if (status === 404) return ' (route absente — mvn package dans backend/ puis redémarrer)'
  if (status === 500) {
    return ' (erreur dans l’API Java — voir la console du backend ou backend/logs/scriptor-ia.log)'
  }
  if (status === 413) {
    return ' (texte trop long pour l’analyse IA — réduisez la taille du texte/extraits)'
  }
  return ''
}

function backendHintForStatus(status: number): string {
  // Suggest starting backend only for gateway/unreachable style failures.
  if (status === 502 || status === 503 || status === 404) return backendHintOneLine()
  return ''
}

export async function checkIaBackendHealth(): Promise<{ ok: boolean; message?: string }> {
  const urls = getHealthCheckUrls()
  let lastStatus = 0
  let lastDetail = ''
  let networkErr: string | null = null

  for (const url of urls) {
    try {
      iaFetchDebugLog('GET', url)
      const res = await fetch(url, { method: 'GET', cache: 'no-store' })
      const text = await res.text()
      if (looksHealthy(res, text)) return { ok: true }
      lastStatus = res.status
      const d = parseErrorJson(text)
      if (d) lastDetail = d
    } catch (e) {
      networkErr = e instanceof Error ? e.message : String(e)
    }
  }

  if (networkErr && lastStatus === 0) {
    return {
      ok: false,
      message: `Impossible de joindre l’API (${networkErr}).${backendHintOneLine()}`,
    }
  }

  const parts = [
    `API IA indisponible (HTTP ${lastStatus || '—'})${statusExtra(lastStatus)}`,
    lastDetail ? ` — ${lastDetail}` : '',
    backendHintOneLine(),
  ]
  return { ok: false, message: parts.join('') }
}

export const apiClient = {
  async get(endpoint: string) {
    assertNotSilenced(endpoint)
    const url = resolveIaRequestUrl(endpoint)
    iaFetchDebugLog('GET', url)
    const response = await fetch(url)
    if (!response.ok) {
      const detail = await parseErrorBody(response)
      const hint = backendHintForStatus(response.status)
      throw new Error(
        `HTTP ${response.status}${statusExtra(response.status)}${detail ? ` — ${detail}` : ''}.${hint}`,
      )
    }
    return response.json()
  },

  async post(endpoint: string, data: unknown) {
    assertNotSilenced(endpoint)
    const url = resolveIaRequestUrl(endpoint)
    iaFetchDebugLog('POST', url)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const detail = await parseErrorBody(response)
      const hint = backendHintForStatus(response.status)
      throw new Error(
        `HTTP ${response.status}${statusExtra(response.status)}${detail ? ` — ${detail}` : ''}.${hint}`,
      )
    }
    return response.json()
  },

  async delete(endpoint: string) {
    assertNotSilenced(endpoint)
    const url = resolveIaRequestUrl(endpoint)
    iaFetchDebugLog('DELETE', url)
    const response = await fetch(url, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const detail = await parseErrorBody(response)
      const hint = backendHintForStatus(response.status)
      throw new Error(
        `HTTP ${response.status}${statusExtra(response.status)}${detail ? ` — ${detail}` : ''}.${hint}`,
      )
    }
    const text = await response.text()
    return text ? JSON.parse(text) : null
  },
}
