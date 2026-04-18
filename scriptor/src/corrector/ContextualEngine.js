/**
 * Moteur contextuel ONNX / Transformers.js — uniquement sur demande, via Web Worker.
 */

let workerRef = null

function getWorker() {
  if (typeof Worker === 'undefined') {
    return null
  }
  if (!workerRef) {
    workerRef = new Worker(new URL('./contextual.worker.js', import.meta.url), { type: 'module' })
  }
  return workerRef
}

/**
 * @param {string} text
 * @param {{ maxWords?: number, timeoutMs?: number }} [opts]
 */
export function analyzeContextOnDemand(text, opts = {}) {
  const maxWords = opts.maxWords ?? 2000
  const wc = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  if (wc > maxWords) {
    return Promise.resolve({ ok: false, reason: 'batch-too-large', words: wc })
  }

  const w = getWorker()
  if (!w) {
    return Promise.resolve({ ok: false, reason: 'no-worker', fallback: 'languagetool' })
  }

  return new Promise((resolve) => {
    const timeoutMs = opts.timeoutMs ?? 5000
    const t = globalThis.setTimeout(() => {
      resolve({ ok: false, reason: 'timeout', fallback: 'languagetool' })
    }, timeoutMs)

    const onMessage = (ev) => {
      globalThis.clearTimeout(t)
      w.removeEventListener('message', onMessage)
      resolve(ev.data)
    }
    w.addEventListener('message', onMessage)
    w.postMessage({ type: 'ANALYZE', text, maxWords })
  })
}

export function terminateContextWorker() {
  if (workerRef) {
    workerRef.terminate()
    workerRef = null
  }
}
