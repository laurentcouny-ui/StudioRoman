/**
 * Sauvegarde cloud gratuite : Google Drive ou Dropbox (votre compte personnel).
 * Envoi automatique toutes les 5 min (tous les comptes connectés) : le même fichier est
 * remplacé à chaque fois (pas d’historique horodaté côté cloud).
 */

const BACKUP_FILE_NAME_LATEST = 'scriptor-backup-latest.json'
const DRIVE_TOKEN_KEY = 'scriptor-gdrive-token'
const DRIVE_EXPIRY_KEY = 'scriptor-gdrive-expiry'
const DROPBOX_TOKEN_KEY = 'scriptor-dropbox-token'
const DROPBOX_EXPIRY_KEY = 'scriptor-dropbox-expiry'
const DROPBOX_PKCE_VERIFIER_KEY = 'scriptor-dropbox-pkce-verifier'
const DROPBOX_OAUTH_STATE_KEY = 'scriptor-dropbox-oauth-state'
const GOOGLE_PKCE_VERIFIER_KEY = 'scriptor-google-pkce-verifier'
const GOOGLE_OAUTH_STATE_KEY = 'scriptor-google-oauth-state'
const OAUTH_DEBUG_SESSION_KEY = 'scriptor-oauth-debug-session-v1'
const PENDING_CLOUD_BACKUP_KEY = 'scriptor-pending-cloud-backup-v1'
const UPLOAD_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * OAuth Dropbox depuis le navigateur **système** (app Tauri) : doit correspondre exactement à une
 * Redirect URI enregistrée dans la console Dropbox (`http://127.0.0.1:17863/`).
 * Évite la webview où « Se connecter avec Google » sur dropbox.com est souvent bloqué par Google.
 */
const DROPBOX_TAURI_LOOPBACK_REDIRECT = 'http://127.0.0.1:17863/'

/** Émis après connexion / déconnexion cloud pour relancer ou arrêter la planification auto-upload. */
export const CLOUD_AUTH_CHANGED_EVENT = 'scriptor-cloud-auth-changed'

let uploadIntervalId = null
let onlineListenerAttached = false
let currentGetBackupData = null
let isAutoUploadRunning = false
let unloadFlushInstalled = false

function getBackendApiTokenHeader() {
  const token = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_API_TOKEN)
    ? String(import.meta.env.VITE_AI_API_TOKEN).trim()
    : ''
  if (!token) return {}
  return { 'X-Scriptor-Api-Token': token }
}

function isTauriWebview() {
  if (typeof window === 'undefined') return false
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__)
}

function oauthDebugEnabled() {
  if (typeof window === 'undefined') return false
  try {
    if (window.sessionStorage?.getItem(OAUTH_DEBUG_SESSION_KEY) === '1') return true
  } catch {
    // Recovery volontaire: certains contextes bloquent sessionStorage (sandbox/private mode).
  }
  const env =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_OAUTH_DEBUG
      ? String(import.meta.env.VITE_OAUTH_DEBUG).trim().toLowerCase()
      : ''
  if (env === '1' || env === 'true' || env === 'yes') return true
  try {
    const u = new URL(window.location.href)
    const q = (u.searchParams.get('oauthDebug') || '').trim().toLowerCase()
    if (q === '1' || q === 'true' || q === 'yes') return true
  } catch {
    // Recovery volontaire: URL invalide ou inaccessible, on reste simplement en mode debug désactivé.
  }
  return false
}

function oauthDebugArmFromUrl() {
  if (typeof window === 'undefined') return
  try {
    const u = new URL(window.location.href)
    const q = (u.searchParams.get('oauthDebug') || '').trim().toLowerCase()
    if (q === '1' || q === 'true' || q === 'yes') {
      window.sessionStorage.setItem(OAUTH_DEBUG_SESSION_KEY, '1')
    }
  } catch {
    // Recovery volontaire: impossible d'armer le flag debug, le flux OAuth continue.
  }
}

function oauthLog(phase, detail) {
  if (!oauthDebugEnabled()) return
  const base = {
    phase,
    at: new Date().toISOString(),
    href: typeof window !== 'undefined' ? window.location.href : '',
    tauri: isTauriWebview(),
  }
  // eslint-disable-next-line no-console
  console.info('[Scriptor:oauth]', { ...base, ...detail })
}

/** Lignes lisibles (mode debug uniquement) — ne jamais y mettre de code OAuth complet. */
function oauthTraceGoogle(message, detail = {}) {
  if (!oauthDebugEnabled()) return
  // eslint-disable-next-line no-console
  console.info('[Scriptor:google-oauth]', message, detail)
}

function maskSecret(s, keepEnd = 6) {
  if (!s || typeof s !== 'string') return ''
  if (s.length <= keepEnd) return '(short)'
  return `…${s.slice(-keepEnd)}`
}

const MAX_UPLOAD_RETRIES = 6
const BASE_RETRY_DELAY_MS = 1200
const RETRY_JITTER_MS = 350
let backupEncryptionPassphrase = ''

const backupStatus = {
  running: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: '',
  nextAttemptAt: null,
  consecutiveFailures: 0,
  pendingQueue: false,
  connected: { drive: false, dropbox: false },
}
const statusListeners = new Set()

/** @param {string} scope @param {string} [message] Explication lisible (quota navigateur ≠ disque, etc.) */
export function emitStorageWarning(scope, message = '') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('scriptor-storage-warning', {
      detail: { scope, message, at: Date.now() },
    }),
  )
}

function updateStatus(patch) {
  Object.assign(backupStatus, patch, {
    connected: {
      drive: isGoogleDriveConnected(),
      dropbox: isDropboxConnected(),
    },
  })
  statusListeners.forEach((fn) => {
    try {
      fn({ ...backupStatus, connected: { ...backupStatus.connected } })
    } catch {
      // Recovery volontaire: un listener UI ne doit pas casser la boucle de notifications.
    }
  })
}

export function subscribeBackupStatus(listener) {
  if (typeof listener !== 'function') return () => {}
  statusListeners.add(listener)
  listener({ ...backupStatus, connected: { ...backupStatus.connected } })
  return () => {
    statusListeners.delete(listener)
  }
}

export function getBackupStatusSnapshot() {
  return { ...backupStatus, connected: { ...backupStatus.connected } }
}

export function setBackupEncryptionPassphrase(passphrase) {
  backupEncryptionPassphrase = typeof passphrase === 'string' ? passphrase.trim() : ''
}

function getStoredToken(tokenKey, expiryKey) {
  if (typeof window === 'undefined') return null
  const token = window.localStorage.getItem(tokenKey)
  const expiry = window.localStorage.getItem(expiryKey)
  if (!token || !expiry) return null
  const expiryMs = parseInt(expiry, 10)
  // Marge courte seulement : l’ancienne marge de 60 s faisait passer le compte pour « déconnecté »
  // alors que l’UI montrait encore « connecté », et aucune sauvegarde n’était planifiée.
  if (Number.isFinite(expiryMs) && Date.now() < expiryMs - 10000) return token
  return null
}

function setStoredToken(tokenKey, expiryKey, token, expiresInSeconds) {
  if (typeof window === 'undefined' || !token) return
  try {
    window.localStorage.setItem(tokenKey, token)
    window.localStorage.setItem(expiryKey, String(Date.now() + (expiresInSeconds || 3600) * 1000))
  } catch {
    emitStorageWarning('oauth-token')
  }
  updateStatus({})
  window.dispatchEvent(new CustomEvent(CLOUD_AUTH_CHANGED_EVENT))
}

function clearStoredToken(tokenKey, expiryKey) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(tokenKey)
  window.localStorage.removeItem(expiryKey)
  updateStatus({})
  window.dispatchEvent(new CustomEvent(CLOUD_AUTH_CHANGED_EVENT))
}

function getDriveToken() {
  return getStoredToken(DRIVE_TOKEN_KEY, DRIVE_EXPIRY_KEY)
}

function getDropboxToken() {
  return getStoredToken(DROPBOX_TOKEN_KEY, DROPBOX_EXPIRY_KEY)
}

export function isGoogleDriveConnected() {
  return !!getDriveToken()
}

export function isDropboxConnected() {
  return !!getDropboxToken()
}

export function isAnyCloudConnected() {
  return isGoogleDriveConnected() || isDropboxConnected()
}

/**
 * Flux OAuth Google (web + desktop webview) :
 * redirect classique via window.location.href vers l’origine de l’app.
 * L’échange `code` → `access_token` : soit POST **direct vers Google** (PKCE, sans secret dans le bundle),
 * soit via le proxy Spring `POST /api/v1/oauth/google/token` si `VITE_GOOGLE_TOKEN_VIA_BACKEND=1`
 * (type « Application ordinateur », secret uniquement côté serveur).
 * Google a retiré `urn:ietf:wg:oauth:2.0:oob` : utiliser une **URI loopback** (ex. `http://localhost:14230/` en dev Tauri), pas OOB.
 *
 * URI de redirection : dérivée de `window.location` (loopback → racine `/`) ou
 * `VITE_GOOGLE_OAUTH_REDIRECT_URI` si vous devez forcer une valeur (ex. http://localhost:14230/).
 */
export function connectGoogleDrive() {
  const clientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || ''
  if (!clientId.trim()) {
    return Promise.reject(
      new Error(
        'Clé Google manquante : dans le dossier scriptor, éditez le fichier .env et mettez votre ID client après VITE_GOOGLE_CLIENT_ID= (sans espace). ' +
          'Le fichier ne doit pas être vide — copiez-le depuis l’autre PC ou suivez CONFIGURATION-CLES.md. Puis arrêtez et relancez npm run dev / dev:tauri.',
      ),
    )
  }
  if (typeof window === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) {
    return Promise.reject(new Error('Connexion Google nécessite un navigateur moderne (Web Crypto).'))
  }
  return _connectGoogleDriveWeb(clientId)
}

/** Flux web : redirect classique via window.location.href. */
function _connectGoogleDriveWeb(clientId) {
  oauthDebugArmFromUrl()
  const redirectUri = getGoogleOAuthRedirectUri()
  oauthTraceGoogle('redirect_uri utilisé pour la requête authorize', { redirectUri, origin: window.location?.origin })
  oauthLog('google:start', {
    redirectUri,
    pathname: typeof window !== 'undefined' ? window.location.pathname : '',
    clientIdPrefix: maskSecret(clientId.trim(), 8),
  })
  const verifier = createPkceVerifier()
  return createPkceChallenge(verifier).then((challenge) => {
    const state = `google-${Date.now().toString(36)}`
    window.localStorage.setItem(GOOGLE_PKCE_VERIFIER_KEY, verifier)
    window.localStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state)
    oauthLog('google:redirect', {
      state: maskSecret(state, 8),
      verifierLen: verifier.length,
      authUrlHost: 'accounts.google.com',
    })
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    })
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  })
}

export function disconnectGoogleDrive() {
  clearStoredToken(DRIVE_TOKEN_KEY, DRIVE_EXPIRY_KEY)
}

function toBase64Url(bytes) {
  const b64 = toBase64(bytes)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function createPkceVerifier(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr, (n) => chars[n % chars.length]).join('')
}

async function createPkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return toBase64Url(new Uint8Array(digest))
}

function getDropboxRedirectUri() {
  let redirectUri =
    typeof window !== 'undefined'
      ? window.location.origin + (window.location.pathname || '/')
      : 'http://localhost:5173/'
  if (redirectUri.endsWith('/') === false) redirectUri += '/'
  if (
    typeof window !== 'undefined' &&
    (/^https?:\/\/localhost(:\d+)?$/i.test(window.location.origin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(window.location.origin) ||
      /^https:\/\/tauri\.localhost$/i.test(window.location.origin))
  )
    redirectUri = window.location.origin + '/'
  return redirectUri
}

/**
 * redirect_uri Google (client public + PKCE). Même normalisation loopback que Dropbox,
 * avec override optionnel si l’origine WebView ne correspond pas à la console Google.
 */
function getGoogleOAuthRedirectUri() {
  const forced =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_OAUTH_REDIRECT_URI
      ? String(import.meta.env.VITE_GOOGLE_OAUTH_REDIRECT_URI).trim()
      : ''
  if (forced) {
    const base = forced.replace(/\/+$/, '')
    return `${base}/`
  }
  return getDropboxRedirectUri()
}

/** Client Google « ordinateur » : échange code → jeton via Spring (secret hors bundle). */
function useGoogleTokenViaBackend() {
  return /^(1|true|yes)$/i.test(
    String(typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_TOKEN_VIA_BACKEND || '').trim(),
  )
}

function getBackendOriginForGoogleTokenProxy() {
  const raw = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_API_BASE || '').trim().replace(/\/$/, '')
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      return new URL(raw).origin
    } catch {
      return ''
    }
  }
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return ''
}

function getGoogleBackendTokenExchangeUrl() {
  const o = getBackendOriginForGoogleTokenProxy()
  if (!o) return '/api/v1/oauth/google/token'
  return `${o}/api/v1/oauth/google/token`
}

/**
 * Échange authorization code → jeton Dropbox (PKCE). `redirect_uri` doit être identique à la requête authorize.
 * @param {string} code
 * @param {string} state
 * @param {string} redirectUri
 */
async function exchangeDropboxPkceToken(code, state, redirectUri) {
  try {
    const expectedState = window.localStorage.getItem(DROPBOX_OAUTH_STATE_KEY)
    const verifier = window.localStorage.getItem(DROPBOX_PKCE_VERIFIER_KEY)
    if (!expectedState || state !== expectedState || !verifier) {
      throw new Error('OAuth Dropbox : session invalide ou expirée. Recommencez la connexion.')
    }
    const appKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DROPBOX_APP_KEY) || ''
    const form = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: appKey,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    })
    const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    let payload = null
    try {
      payload = await res.json()
    } catch {
      payload = null
    }
    if (!res.ok) {
      const detail =
        payload?.error_description ||
        payload?.error_summary ||
        payload?.error ||
        `HTTP ${res.status}`
      throw new Error(`OAuth Dropbox échoué: ${detail}`)
    }
    const token = payload?.access_token
    const expiresIn = parseInt(String(payload?.expires_in || 14400), 10)
    if (token) setStoredToken(DROPBOX_TOKEN_KEY, DROPBOX_EXPIRY_KEY, token, Number.isFinite(expiresIn) ? expiresIn : 14400)
  } catch (err) {
    updateStatus({ lastError: err?.message || 'OAuth Dropbox échoué' })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('scriptor-cloud-auth-error', {
          detail: { provider: 'dropbox', message: err?.message || 'OAuth Dropbox échoué' },
        }),
      )
    }
    throw err
  } finally {
    window.localStorage.removeItem(DROPBOX_PKCE_VERIFIER_KEY)
    window.localStorage.removeItem(DROPBOX_OAUTH_STATE_KEY)
  }
}

export function completeDropboxAuth() {
  if (typeof window === 'undefined') return false
  const url = new URL(window.location.href)

  // Nouveau flux OAuth 2.0 Authorization Code + PKCE (sans token dans l'URL).
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (code && state && state.startsWith('google-')) return false
  if (code && state) {
    const expectedState = window.localStorage.getItem(DROPBOX_OAUTH_STATE_KEY)
    const verifier = window.localStorage.getItem(DROPBOX_PKCE_VERIFIER_KEY)
    if (!expectedState || state !== expectedState || !verifier) return false
    const redirectUri = getDropboxRedirectUri()
    void exchangeDropboxPkceToken(code, state, redirectUri).catch(() => {})
    url.searchParams.delete('code')
    url.searchParams.delete('state')
    window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash)
    return true
  }

  // Compat legacy (implicit flow) pour ne pas bloquer les sessions existantes.
  const hash = window.location.hash
  if (!hash) return false
  const params = new URLSearchParams(hash.slice(1))
  const token = params.get('access_token')
  const legacyState = params.get('state')
  if (legacyState !== 'dropbox' || !token) return false
  // Dropbox implicit flow may not return expires_in; use 4h default
  const expiresIn = params.get('expires_in')
  setStoredToken(DROPBOX_TOKEN_KEY, DROPBOX_EXPIRY_KEY, token, expiresIn ? parseInt(expiresIn, 10) : 14400)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return true
}

export function completeGoogleAuth() {
  if (typeof window === 'undefined') return false
  oauthDebugArmFromUrl()
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthErr = url.searchParams.get('error')
  const oauthErrDesc = url.searchParams.get('error_description')
  const looksGoogle = Boolean(state && state.startsWith('google-'))
  if (oauthDebugEnabled() && (code || looksGoogle || oauthErr)) {
    oauthLog('google:callback', {
      hasCode: Boolean(code),
      codeLen: code ? code.length : 0,
      codeTail: code ? maskSecret(code, 6) : '',
      state: state ? maskSecret(state, 8) : '',
      oauthErr,
      oauthErrDesc,
      expectedStatePresent: Boolean(window.localStorage.getItem(GOOGLE_OAUTH_STATE_KEY)),
      verifierPresent: Boolean(window.localStorage.getItem(GOOGLE_PKCE_VERIFIER_KEY)),
    })
  }
  if (oauthErr && (looksGoogle || window.localStorage.getItem(GOOGLE_PKCE_VERIFIER_KEY))) {
    oauthLog('google:oauth_error_param', { oauthErr, oauthErrDesc })
    return false
  }
  if (!code || !state || !state.startsWith('google-')) return false
  oauthTraceGoogle('Code reçu par le frontend (valeur masquée, ne pas partager)', {
    codeAperçu: maskSecret(code, 8),
    codeLongueur: code.length,
  })
  const expectedState = window.localStorage.getItem(GOOGLE_OAUTH_STATE_KEY)
  const verifier = window.localStorage.getItem(GOOGLE_PKCE_VERIFIER_KEY)
  if (!expectedState || state !== expectedState || !verifier) {
    oauthLog('google:state_mismatch', {
      expectedState: expectedState ? maskSecret(expectedState, 8) : '',
      state: state ? maskSecret(state, 8) : '',
      verifierLen: verifier ? verifier.length : 0,
    })
    return false
  }
  const clientId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) || ''
  if (!clientId.trim()) {
    oauthLog('google:no_client_id', {})
    return false
  }
  const redirectUri = getGoogleOAuthRedirectUri()
  const tokenViaBackend = useGoogleTokenViaBackend()
  const tokenEndpoint = tokenViaBackend ? getGoogleBackendTokenExchangeUrl() : 'https://oauth2.googleapis.com/token'
  oauthLog('google:token_exchange_start', {
    redirectUri,
    tokenEndpoint,
    clientIdPrefix: maskSecret(clientId.trim(), 8),
    viaBackendProxy: tokenViaBackend,
  })
  oauthTraceGoogle(
    tokenViaBackend
      ? 'Échange du code : POST JSON vers le proxy Spring /api/v1/oauth/google/token (client_secret côté serveur)'
      : 'Échange du code : POST form direct vers https://oauth2.googleapis.com/token (PKCE, sans client_secret)',
    { redirect_uri: redirectUri },
  )
  const form = new URLSearchParams({
    code,
    client_id: clientId,
    code_verifier: verifier,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const directTokenInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  }

  /** Si le proxy Spring / le backend est arrêté (502 Vite, 503/504), retenter l’échange PKCE direct vers Google. */
  const fetchGoogleAccessToken = async () => {
    if (!tokenViaBackend) {
      return fetch('https://oauth2.googleapis.com/token', directTokenInit)
    }
    let res = await fetch(getGoogleBackendTokenExchangeUrl(), {
      method: 'POST',
      headers: {
        ...getBackendApiTokenHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        code,
        redirectUri,
        codeVerifier: verifier,
      }),
    })
    const status = res.status
    const proxyOrBackendDown = status === 502 || status === 503 || status === 504
    let backendNotConfigured = false
    if (status === 503) {
      try {
        const j = await res.clone().json()
        backendNotConfigured = j?.error === 'oauth_backend_not_configured'
      } catch {
        backendNotConfigured = false
      }
    }
    if (proxyOrBackendDown || backendNotConfigured) {
      oauthTraceGoogle(
        'Spring indisponible ou OAuth non configuré côté serveur — nouvel essai direct PKCE vers Google (sans client_secret)',
        { httpStatus: status },
      )
      res = await fetch('https://oauth2.googleapis.com/token', directTokenInit)
    }
    return res
  }

  void fetchGoogleAccessToken()
    .then(async (res) => {
      let payload = null
      try {
        payload = await res.json()
      } catch {
        payload = null
      }
      oauthLog('google:token_http', {
        ok: res.ok,
        status: res.status,
        payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : null,
        payload:
          oauthDebugEnabled() && payload && typeof payload === 'object'
            ? JSON.stringify(payload).slice(0, 2000)
            : null,
      })
      oauthTraceGoogle('Réponse HTTP échange jeton Google (proxy ou direct)', {
        status: res.status,
        ok: res.ok,
      })
      if (!res.ok) {
        const detail = payload?.error_description || payload?.error || `HTTP ${res.status}`
        throw new Error(`OAuth Google échoué: ${detail}`)
      }
      return payload
    })
    .then((tokenResponse) => {
      const token = tokenResponse?.access_token
      const expiresIn = parseInt(String(tokenResponse?.expires_in || 3600), 10)
      if (token) {
        setStoredToken(DRIVE_TOKEN_KEY, DRIVE_EXPIRY_KEY, token, Number.isFinite(expiresIn) ? expiresIn : 3600)
        oauthLog('google:token_stored', {
          tokenLen: token.length,
          expiresIn: Number.isFinite(expiresIn) ? expiresIn : 3600,
          driveConnected: isGoogleDriveConnected(),
        })
      } else {
        oauthLog('google:no_access_token_in_payload', {
          keys: tokenResponse && typeof tokenResponse === 'object' ? Object.keys(tokenResponse) : null,
        })
      }
    })
    .catch((err) => {
      oauthLog('google:token_exchange_failed', { message: err?.message || String(err) })
      updateStatus({ lastError: err?.message || 'OAuth Google échoué' })
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('scriptor-cloud-auth-error', {
            detail: { provider: 'google', message: err?.message || 'OAuth Google échoué' },
          }),
        )
      }
    })
    .finally(() => {
      window.localStorage.removeItem(GOOGLE_PKCE_VERIFIER_KEY)
      window.localStorage.removeItem(GOOGLE_OAUTH_STATE_KEY)
    })
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash)
  return true
}

/**
 * App bureau (Tauri) : ouvre l’OAuth Dropbox dans le navigateur par défaut pour que la connexion
 * Google sur dropbox.com fonctionne ; le retour se fait sur 127.0.0.1:17863 (serveur Rust local).
 */
async function connectDropboxViaSystemBrowser() {
  const appKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DROPBOX_APP_KEY) || ''
  const { invoke } = await import('@tauri-apps/api/core')
  const { listen } = await import('@tauri-apps/api/event')
  const { open } = await import('@tauri-apps/plugin-shell')
  const redirectUri = DROPBOX_TAURI_LOOPBACK_REDIRECT

  try {
    await invoke('start_dropbox_oauth_server')
  } catch (e) {
    window.localStorage.removeItem(DROPBOX_PKCE_VERIFIER_KEY)
    window.localStorage.removeItem(DROPBOX_OAUTH_STATE_KEY)
    throw e
  }

  const verifier = createPkceVerifier()
  const challenge = await createPkceChallenge(verifier)
  const state = `dropbox-${Date.now().toString(36)}`
  window.localStorage.setItem(DROPBOX_PKCE_VERIFIER_KEY, verifier)
  window.localStorage.setItem(DROPBOX_OAUTH_STATE_KEY, state)
  const url = `https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(appKey)}&response_type=code&token_access_type=offline&code_challenge_method=S256&code_challenge=${encodeURIComponent(challenge)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`

  oauthLog('dropbox:tauri_system_browser', { redirectUri })

  return new Promise((resolve, reject) => {
    let unlisten = () => {}
    let timeoutId = null
    const armTimeout = () => {
      timeoutId = setTimeout(() => {
        unlisten()
        window.localStorage.removeItem(DROPBOX_PKCE_VERIFIER_KEY)
        window.localStorage.removeItem(DROPBOX_OAUTH_STATE_KEY)
        reject(new Error('Délai dépassé : connexion Dropbox annulée ou non terminée.'))
      }, 720 * 1000)
    }

    listen('dropbox-oauth-callback', async (event) => {
      if (timeoutId) clearTimeout(timeoutId)
      unlisten()
      const p = event.payload
      if (p?.error) {
        window.localStorage.removeItem(DROPBOX_PKCE_VERIFIER_KEY)
        window.localStorage.removeItem(DROPBOX_OAUTH_STATE_KEY)
        reject(new Error(typeof p.error === 'string' ? p.error : 'Connexion Dropbox refusée ou annulée.'))
        return
      }
      if (!p?.code || p?.state == null || p?.state === '') {
        window.localStorage.removeItem(DROPBOX_PKCE_VERIFIER_KEY)
        window.localStorage.removeItem(DROPBOX_OAUTH_STATE_KEY)
        reject(new Error('Réponse OAuth Dropbox incomplète.'))
        return
      }
      try {
        await exchangeDropboxPkceToken(p.code, p.state, redirectUri)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
      .then((fn) => {
        unlisten = fn
        armTimeout()
        return open(url)
      })
      .catch((e) => {
        if (timeoutId) clearTimeout(timeoutId)
        unlisten()
        window.localStorage.removeItem(DROPBOX_PKCE_VERIFIER_KEY)
        window.localStorage.removeItem(DROPBOX_OAUTH_STATE_KEY)
        reject(e)
      })
  })
}

export function connectDropbox() {
  const appKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DROPBOX_APP_KEY) || ''
  if (!appKey.trim()) {
    return Promise.reject(
      new Error(
        'Clé Dropbox manquante : dans scriptor/.env, renseignez VITE_DROPBOX_APP_KEY= (App key Dropbox, sans espace après =). ' +
          'Copiez le .env de l’autre PC ou la console Dropbox. Puis redémarrez npm run dev / dev:tauri.',
      ),
    )
  }
  if (typeof window === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) {
    return Promise.reject(new Error('OAuth Dropbox nécessite un navigateur moderne (Web Crypto).'))
  }
  if (isTauriWebview()) {
    return connectDropboxViaSystemBrowser()
  }
  const redirectUri = getDropboxRedirectUri()
  const verifier = createPkceVerifier()
  return createPkceChallenge(verifier).then((challenge) => {
    const state = `dropbox-${Date.now().toString(36)}`
    window.localStorage.setItem(DROPBOX_PKCE_VERIFIER_KEY, verifier)
    window.localStorage.setItem(DROPBOX_OAUTH_STATE_KEY, state)
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(appKey)}&response_type=code&token_access_type=offline&code_challenge_method=S256&code_challenge=${encodeURIComponent(challenge)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`
    window.location.href = authUrl
  })
}

async function sha256Hex(text) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(text)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // Fallback non-crypto pour vieux environnements
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return `fallback-${hash.toString(16)}-${text.length}`
}

function toBase64(bytes) {
  // Evite le spread géant qui peut faire exploser la stack sur gros payloads.
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, chunk)
  }
  return btoa(binary)
}

function fromUtf8(text) {
  return new TextEncoder().encode(text)
}

async function deriveAesKey(passphrase, saltBytes) {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    fromUtf8(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 120000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
}

async function buildEncryptedEnvelope(data) {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Chiffrement non supporté par ce navigateur')
  }
  if (!backupEncryptionPassphrase) return null
  const plainJson = JSON.stringify(data)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveAesKey(backupEncryptionPassphrase, salt)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fromUtf8(plainJson),
  )
  return {
    version: 3,
    createdAt: new Date().toISOString(),
    encrypted: true,
    kdf: 'PBKDF2-SHA256',
    iterations: 120000,
    cipher: 'AES-GCM-256',
    saltB64: toBase64(salt),
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(new Uint8Array(encrypted)),
    checksum: await sha256Hex(plainJson),
  }
}

async function prepareBackupPayload(getBackupData) {
  const data = getBackupData?.()
  if (!data) throw new Error('Aucune donnée à envoyer')

  const encryptedEnvelope = await buildEncryptedEnvelope(data)
  if (encryptedEnvelope) {
    const payload = JSON.stringify(encryptedEnvelope)
    // Vérification minimale que le payload est bien serialisable/rechargeable
    JSON.parse(payload)
    return payload
  }

  const backupJson = JSON.stringify(data)
  const checksum = await sha256Hex(backupJson)
  const envelope = {
    version: 2,
    createdAt: new Date().toISOString(),
    checksum,
    backup: data,
  }
  const payload = JSON.stringify(envelope)
  // Vérification d'intégrité locale avant envoi
  const parsed = JSON.parse(payload)
  const rehash = await sha256Hex(JSON.stringify(parsed.backup))
  if (rehash !== parsed.checksum) {
    throw new Error('Intégrité sauvegarde invalide avant envoi')
  }
  return payload
}

function getPendingPayload() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(PENDING_CLOUD_BACKUP_KEY) || null
  } catch {
    emitStorageWarning('pending-queue-read')
    return null
  }
}

function setPendingPayload(payload) {
  if (typeof window === 'undefined') return
  try {
    if (!payload) window.localStorage.removeItem(PENDING_CLOUD_BACKUP_KEY)
    else window.localStorage.setItem(PENDING_CLOUD_BACKUP_KEY, payload)
  } catch {
    emitStorageWarning('pending-queue-write')
  }
}

async function findDriveFileId(token) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D%27${encodeURIComponent(BACKUP_FILE_NAME_LATEST)}%27%20and%20trashed%3Dfalse&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error('Recherche Drive échouée')
  const data = await res.json()
  return data.files?.[0]?.id || null
}

async function createDriveFile(token, fileName) {
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: fileName,
      mimeType: 'application/json',
    }),
  })
  if (!res.ok) throw new Error('Création fichier Drive échouée')
  const data = await res.json()
  return data.id
}

async function uploadToDriveApi(fileId, jsonString, token) {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: jsonString,
  })
  if (!res.ok) throw new Error('Envoi Drive échoué')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry(task, label = 'opération') {
  let lastError = null
  for (let attempt = 1; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    try {
      return await task()
    } catch (err) {
      lastError = err
      if (attempt >= MAX_UPLOAD_RETRIES) break
      const jitter = Math.floor(Math.random() * RETRY_JITTER_MS)
      await sleep(BASE_RETRY_DELAY_MS * attempt + jitter)
    }
  }
  const msg = lastError?.message || String(lastError || 'Erreur inconnue')
  throw new Error(`${label} échoué après ${MAX_UPLOAD_RETRIES} tentative(s): ${msg}`)
}

export async function uploadBackupToDrive(getBackupData, prebuiltPayload) {
  updateStatus({ running: true, lastAttemptAt: Date.now(), lastError: '' })
  return withRetry(async () => {
    const token = getDriveToken()
    if (!token) throw new Error('Non connecté à Google Drive')
    const jsonString = prebuiltPayload || (await prepareBackupPayload(getBackupData))
    let fileId = await findDriveFileId(token)
    if (!fileId) fileId = await createDriveFile(token, BACKUP_FILE_NAME_LATEST)
    await uploadToDriveApi(fileId, jsonString, token)
  }, 'Envoi Google Drive')
    .then(() => {
      updateStatus({
        running: false,
        lastSuccessAt: Date.now(),
        consecutiveFailures: 0,
        pendingQueue: !!getPendingPayload(),
      })
    })
    .catch((err) => {
      updateStatus({
        running: false,
        lastError: err?.message || 'Envoi Google Drive échoué',
        consecutiveFailures: backupStatus.consecutiveFailures + 1,
        pendingQueue: !!getPendingPayload(),
      })
      throw err
    })
}

export async function uploadBackupToDropbox(getBackupData, prebuiltPayload) {
  updateStatus({ running: true, lastAttemptAt: Date.now(), lastError: '' })
  return withRetry(async () => {
    const token = getDropboxToken()
    if (!token) throw new Error('Non connecté à Dropbox')
    const jsonString = prebuiltPayload || (await prepareBackupPayload(getBackupData))
    const path = '/' + BACKUP_FILE_NAME_LATEST
    const dropboxArg = JSON.stringify({ path, mode: 'overwrite', autorename: false })
    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': dropboxArg,
      },
      body: jsonString,
    })
    if (!res.ok) throw new Error('Envoi Dropbox échoué')
  }, 'Envoi Dropbox')
    .then(() => {
      updateStatus({
        running: false,
        lastSuccessAt: Date.now(),
        consecutiveFailures: 0,
        pendingQueue: !!getPendingPayload(),
      })
    })
    .catch((err) => {
      updateStatus({
        running: false,
        lastError: err?.message || 'Envoi Dropbox échoué',
        consecutiveFailures: backupStatus.consecutiveFailures + 1,
        pendingQueue: !!getPendingPayload(),
      })
      throw err
    })
}

export function disconnectDropbox() {
  clearStoredToken(DROPBOX_TOKEN_KEY, DROPBOX_EXPIRY_KEY)
}

async function runAutoUploadCycle(getBackupData) {
  if (isAutoUploadRunning) return
  if (!isAnyCloudConnected() || !getBackupData) return
  const failuresBefore = backupStatus.consecutiveFailures || 0
  let failedServicesCount = 0
  isAutoUploadRunning = true
  updateStatus({
    running: true,
    lastAttemptAt: Date.now(),
    lastError: '',
  })
  try {
    const pending = getPendingPayload()
    const payload = pending || (await prepareBackupPayload(getBackupData))
    if (pending) updateStatus({ pendingQueue: true })
    const tasks = []
    if (isGoogleDriveConnected())
      tasks.push(
        uploadBackupToDrive(getBackupData, payload).then(
          () => ({ service: 'drive', ok: true }),
          (error) => ({ service: 'drive', ok: false, error }),
        ),
      )
    if (isDropboxConnected())
      tasks.push(
        uploadBackupToDropbox(getBackupData, payload).then(
          () => ({ service: 'dropbox', ok: true }),
          (error) => ({ service: 'dropbox', ok: false, error }),
        ),
      )
    if (tasks.length) {
      const settled = await Promise.all(tasks)
      const failed = settled.filter((r) => !r.ok)
      failedServicesCount = failed.length
      if (failed.length) {
        const firstError = failed[0]?.error
        throw new Error(firstError?.message || 'Auto-upload échoué sur un ou plusieurs services')
      }
      setPendingPayload(null)
      updateStatus({
        pendingQueue: false,
        lastSuccessAt: Date.now(),
        consecutiveFailures: 0,
      })
    }
  } catch (err) {
    try {
      const payload = await prepareBackupPayload(getBackupData)
      setPendingPayload(payload)
    } catch {
      // Recovery volontaire: si la mise en file locale échoue, l'état d'échec global reste exposé ci-dessous.
    }
    updateStatus({
      lastError: err?.message || 'Auto-upload échoué',
      consecutiveFailures: Math.max(
        backupStatus.consecutiveFailures + 1,
        failuresBefore + Math.max(1, failedServicesCount),
      ),
      pendingQueue: true,
    })
  } finally {
    isAutoUploadRunning = false
    const next = Date.now() + UPLOAD_INTERVAL_MS
    updateStatus({ running: false, nextAttemptAt: next })
  }
}

function attachOnlineListener() {
  if (typeof window === 'undefined' || onlineListenerAttached) return
  window.addEventListener('online', () => {
    if (currentGetBackupData) void runAutoUploadCycle(currentGetBackupData)
  })
  onlineListenerAttached = true
}

export function startAutoUpload(getBackupData, options = {}) {
  const { forceRestart = false } = options
  if (forceRestart) stopAutoUpload()
  currentGetBackupData = getBackupData || currentGetBackupData

  if (!isAnyCloudConnected() || !currentGetBackupData) {
    if (uploadIntervalId) {
      clearInterval(uploadIntervalId)
      uploadIntervalId = null
    }
    updateStatus({
      nextAttemptAt: null,
      running: false,
      pendingQueue: !!getPendingPayload(),
    })
    return
  }

  if (uploadIntervalId) {
    updateStatus({
      nextAttemptAt: Date.now() + UPLOAD_INTERVAL_MS,
      pendingQueue: !!getPendingPayload(),
    })
    return
  }

  attachOnlineListener()
  updateStatus({ nextAttemptAt: Date.now() + UPLOAD_INTERVAL_MS, pendingQueue: !!getPendingPayload() })
  void runAutoUploadCycle(currentGetBackupData)
  uploadIntervalId = setInterval(() => {
    void runAutoUploadCycle(currentGetBackupData)
  }, UPLOAD_INTERVAL_MS)
}

/**
 * Arrête seulement le minuteur (ex. remontage React Strict Mode) sans perdre le callback
 * ni remettre nextAttemptAt à zéro de façon durable — la prochaine exécution de startAutoUpload rétablit le cycle.
 */
export function pauseAutoUploadTimers() {
  if (uploadIntervalId) {
    clearInterval(uploadIntervalId)
    uploadIntervalId = null
  }
  isAutoUploadRunning = false
}

export function stopAutoUpload() {
  pauseAutoUploadTimers()
  currentGetBackupData = null
  updateStatus({ running: false, nextAttemptAt: null })
}

export function getUploadIntervalMinutes() {
  return UPLOAD_INTERVAL_MS / 60000
}

/**
 * Dernière tentative d’envoi cloud quand l’onglet se ferme ou passe en arrière-plan
 * (réduit le risque de retard vs. la fenêtre des 5 min). Les fetch peuvent encore être
 * interrompus par le navigateur ; la file locale (pending) reste la reprise.
 */
export function installCloudBackupUnloadFlush() {
  if (typeof window === 'undefined' || unloadFlushInstalled) return
  unloadFlushInstalled = true
  let lastFlushAt = 0
  const debounceMs = 450
  const flush = () => {
    if (!isAnyCloudConnected() || !currentGetBackupData) return
    const now = Date.now()
    if (now - lastFlushAt < debounceMs) return
    lastFlushAt = now
    void runAutoUploadCycle(currentGetBackupData)
  }
  window.addEventListener('pagehide', flush, { capture: true })
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') flush()
    },
    { capture: true },
  )
}

oauthDebugArmFromUrl()
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener(
    'securitypolicyviolation',
    (e) => {
      if (!oauthDebugEnabled()) return
      oauthLog('csp:violation', {
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective,
        effectiveDirective: e.effectiveDirective,
        disposition: e.disposition,
        sample: e.sample,
      })
    },
    { capture: true },
  )
}
