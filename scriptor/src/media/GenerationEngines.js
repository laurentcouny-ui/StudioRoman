import { isDesktop } from '../platform'
import { taskQueueManager } from '../print/TaskQueueManager'
import { failoverStrategy } from '../print/FailoverStrategy'
import engineConfig from './engineConfig.json'
import { promptArchitect } from './PromptArchitect'
import { decryptSecretString, encryptSecretString } from './mediaSecrets.js'

function openUrl(url) {
  if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
}

async function storeSecret(key, value) {
  if (isDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('media_store_secret', { key, value })
      return
    } catch {
      // fallback local
    }
  }
  try {
    const enc = await encryptSecretString(String(value || ''))
    window.localStorage.setItem(`scriptor-media-secret-${key}`, enc)
  } catch {
    const enc = btoa(unescape(encodeURIComponent(String(value || ''))))
    window.localStorage.setItem(`scriptor-media-secret-${key}`, enc)
  }
}

async function readSecret(key) {
  if (isDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const v = await invoke('media_read_secret', { key })
      return v || ''
    } catch {
      // fallback local
    }
  }
  const raw = window.localStorage.getItem(`scriptor-media-secret-${key}`)
  if (!raw) return ''
  try {
    return await decryptSecretString(raw)
  } catch {
    try {
      return decodeURIComponent(escape(atob(raw)))
    } catch {
      return ''
    }
  }
}

async function pollinationsGenerate(prompt, opts = {}) {
  const base = engineConfig.engines.pollinations.baseUrl
  const url = `${base}${encodeURIComponent(prompt)}?width=${opts.width || 1024}&height=${opts.height || 1536}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Pollinations HTTP ${res.status}`)
  const blob = await res.blob()
  return { blob, engine: 'pollinations' }
}

async function leonardoGenerate(prompt, opts = {}) {
  const key = opts.apiKey || (await readSecret('leonardo-api-key'))
  if (!key) throw new Error('Leonardo API key manquante')
  const res = await fetch(engineConfig.engines.leonardo.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      prompt,
      width: opts.width || 1024,
      height: opts.height || 1536,
      num_images: 1,
    }),
  })
  if (!res.ok) throw new Error(`Leonardo HTTP ${res.status}`)
  const data = await res.json()
  return { data, engine: 'leonardo' }
}

function midjourneyPrepare(prompt) {
  return {
    engine: 'midjourney',
    prompt,
    copyPrompt: prompt,
    open: () => openUrl(engineConfig.engines.midjourney.webUrl),
  }
}

export function getLeonardoTutorialSteps() {
  return [
    '1) Créez un compte gratuit Leonardo.ai puis ouvrez API Access.',
    '2) Générez une API key personnelle (lecture/génération).',
    '3) Collez la clé dans Scriptor (paramètres Kit Média) puis testez une génération.',
  ]
}

export class GenerationEngines {
  constructor(config = engineConfig) {
    this.config = config
  }

  listAvailableEngines() {
    return Object.entries(this.config.engines)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k)
  }

  async setLeonardoApiKey(apiKey) {
    await storeSecret('leonardo-api-key', apiKey)
  }

  async generateFromPromptId({ promptId, engine = this.config.defaultEngine, width, height }) {
    const prompt = promptArchitect.consumePrompt(promptId)
    return this.generate({ prompt, engine, width, height })
  }

  async generate({ prompt, engine = this.config.defaultEngine, width, height, apiKey }) {
    if (engine === 'midjourney') {
      return midjourneyPrepare(prompt)
    }

    if (engine === 'pollinations') {
      try {
        return await taskQueueManager.enqueue({
          id: `pollinations-${Date.now()}`,
          label: 'Generation Pollinations',
          priority: 'saliency',
          debounceKey: 'pollinations-generate',
          prompt,
          run: async ({ updateProgress }) => {
            updateProgress(15, 'Connexion Pollinations')
            const out = await pollinationsGenerate(prompt, { width, height })
            updateProgress(100, 'Image recue')
            return out
          },
        })
      } catch (err) {
        const degraded = failoverStrategy.pollinationsOffline(err)
        if (degraded.pauseQueue) taskQueueManager.pause('network-offline')
        throw new Error(degraded.userMessage)
      }
    }

    if (engine === 'leonardo') {
      return taskQueueManager.enqueue({
        id: `leonardo-${Date.now()}`,
        label: 'Generation Leonardo',
        priority: 'saliency',
        debounceKey: 'leonardo-generate',
        prompt,
        run: async ({ updateProgress }) => {
          updateProgress(15, 'Connexion Leonardo')
          const out = await leonardoGenerate(prompt, { width, height, apiKey })
          updateProgress(100, 'Generation terminee')
          return out
        },
      })
    }

    throw new Error(`GenerationEngines: moteur inconnu "${engine}"`)
  }
}

export const generationEngines = new GenerationEngines()
