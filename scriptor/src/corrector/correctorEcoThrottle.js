/**
 * CDC séquence 1 — Smart throttling : CPU élevée ou batterie faible →
 * corrections silencieuses uniquement en fin de paragraphe (pas de délai « temps réel »).
 * Retour au mode normal après 30 s de conditions stables.
 */
import { isDesktop } from '../platform'

const CPU_THRESHOLD = 70
const CPU_HIGH_MS = 3000
const STABLE_MS = 30_000
const BATTERY_LOW = 0.2

/** @type {Set<(s: { eco: boolean, reason: 'cpu' | 'battery' | null }) => void>} */
const listeners = new Set()

let eco = false
/** @type {'cpu' | 'battery' | null} */
let reason = null
let cpuHighSince = null
let stableSince = null
let intervalId = null
let refCount = 0

export const ECO_MODE_MESSAGE =
  "Mode économie d'énergie : analyse à la fin de chaque paragraphe."

function notify() {
  const state = { eco, reason }
  for (const cb of listeners) {
    try {
      cb(state)
    } catch {
      // noop
    }
  }
  try {
    window.dispatchEvent(new CustomEvent('scriptor-corrector-eco', { detail: state }))
  } catch {
    // noop
  }
}

export function getCorrectorEcoState() {
  return { eco, reason }
}

/** @returns {boolean} true si seul le changement de paragraphe doit déclencher les silencieuses. */
export function isEcoParagraphOnly() {
  return eco
}

async function sampleCpuPercent() {
  if (!isDesktop()) return null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const v = await invoke('storage_cpu_sample')
    if (v == null) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

async function tick() {
  let batteryLow = false
  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery()
      batteryLow = !b.charging && b.level <= BATTERY_LOW
    }
  } catch {
    // noop
  }

  const cpu = await sampleCpuPercent()
  const now = Date.now()
  const cpuHigh = cpu != null && cpu >= CPU_THRESHOLD

  if (eco) {
    if (batteryLow) {
      reason = 'battery'
      stableSince = null
    } else if (cpuHigh) {
      reason = 'cpu'
      stableSince = null
    } else {
      if (stableSince == null) stableSince = now
      if (now - stableSince >= STABLE_MS) {
        eco = false
        reason = null
        cpuHighSince = null
        stableSince = null
      }
    }
  } else {
    stableSince = null
    if (batteryLow) {
      eco = true
      reason = 'battery'
      cpuHighSince = null
    } else if (cpuHigh) {
      if (cpuHighSince == null) cpuHighSince = now
      if (now - cpuHighSince >= CPU_HIGH_MS) {
        eco = true
        reason = 'cpu'
      }
    } else {
      cpuHighSince = null
    }
  }

  notify()
}

function ensureTimer() {
  if (intervalId != null) return
  intervalId = window.setInterval(() => {
    void tick()
  }, 1000)
  void tick()
}

function stopTimerIfIdle() {
  if (refCount > 0) return
  if (intervalId != null) {
    window.clearInterval(intervalId)
    intervalId = null
  }
}

/**
 * Abonne les mises à jour d’état éco. Démarre le moniteur au premier abonné.
 * @param {(s: { eco: boolean, reason: 'cpu' | 'battery' | null }) => void} cb
 * @returns {() => void} désabonner
 */
export function subscribeCorrectorEco(cb) {
  listeners.add(cb)
  cb({ eco, reason })
  refCount += 1
  ensureTimer()
  return () => {
    listeners.delete(cb)
    refCount = Math.max(0, refCount - 1)
    stopTimerIfIdle()
  }
}
