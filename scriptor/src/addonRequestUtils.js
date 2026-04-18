/**
 * Utilitaires pour futurs appels réseau (IA / APIs externes).
 * Non utilisés tant que les modules ne sont pas branchés — prêts à l'emploi.
 */

export function debounce(fn, ms) {
  let t = null
  return (...args) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => {
      t = null
      fn(...args)
    }, ms)
  }
}

/**
 * Combine plusieurs signaux : si l’un est déjà annulé ou l’annule, le signal retourné suit.
 */
export function mergeAbortSignals(...signals) {
  const list = signals.filter((s) => s && typeof s.aborted === 'boolean')
  if (list.length === 0) return new AbortController().signal
  if (list.length === 1) return list[0]
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(list)
  }
  const master = new AbortController()
  const forward = () => master.abort()
  for (const s of list) {
    if (s.aborted) {
      forward()
      return master.signal
    }
    s.addEventListener('abort', forward, { once: true })
  }
  return master.signal
}

/**
 * Annule l’appel précédent avant d’en lancer un nouveau (saisie continue / debounce manuel).
 */
export function withAbortPrevious() {
  let current = null
  return (run) => {
    if (current) current.abort()
    current = new AbortController()
    return run(current.signal)
  }
}

/**
 * fetch avec timeout via AbortController (annulation propre).
 * Si `init.signal` est fourni, une annulation côté appelant annule aussi le fetch.
 */
export async function fetchWithTimeout(url, init = {}, timeoutMs = 20000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  const parentSignal = init.signal
  const onParentAbort = () => controller.abort()
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort()
    else parentSignal.addEventListener('abort', onParentAbort, { once: true })
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(id)
    if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort)
  }
}

/**
 * Coupe temporairement les appels après trop d'échecs consécutifs.
 */
export function createCircuitBreaker(options = {}) {
  const threshold = options.threshold ?? 5
  const coolDownMs = options.coolDownMs ?? 60_000
  let failures = 0
  let openUntil = 0

  return {
    isOpen() {
      return Date.now() < openUntil
    },
    reset() {
      failures = 0
      openUntil = 0
    },
    async run(fn) {
      if (Date.now() < openUntil) {
        throw new Error('Service temporairement indisponible (trop d’échecs récents). Réessayez plus tard.')
      }
      try {
        const result = await fn()
        failures = 0
        openUntil = 0
        return result
      } catch (err) {
        failures += 1
        if (failures >= threshold) {
          openUntil = Date.now() + coolDownMs
          failures = 0
        }
        throw err
      }
    },
  }
}
