/**
 * Gramalecte FR pour Scriptor — worker dédié + fichiers statiques sous /grammalecte-fr/ (public/).
 * Moteur et données : extension Mozilla « Grammalecte [fr] » v2.3.0, GPL-3.0-only.
 *
 * Regénérer les fichiers publics : npm run vendor:gramalecte-fr
 */
export const GRAMALECTE_BUNDLE_ACTIVE = true
export const GRAMALECTE_VENDOR_VERSION = '2.3.0'

let worker = null
let initPromise = null
let reqSeq = 0

function viteBasePrefix() {
  const b = import.meta.env.BASE_URL || '/'
  return b.endsWith('/') ? b : `${b}/`
}

function extensionRootHref() {
  if (typeof window === 'undefined') return ''
  return new URL('grammalecte-fr/', window.location.origin + viteBasePrefix()).href
}

function workerScriptHref() {
  if (typeof window === 'undefined') return ''
  return new URL('grammalecte-fr/gce_worker_scriptor.js', window.location.origin + viteBasePrefix()).href
}

function getWorker() {
  if (typeof window === 'undefined') return null
  if (worker) return worker
  worker = new Worker(workerScriptHref())
  return worker
}

function postInit(w) {
  return new Promise((resolve, reject) => {
    const id = ++reqSeq
    function onMsg(e) {
      const d = e.data
      if (!d || d.oInfo?.id !== id) return
      w.removeEventListener('message', onMsg)
      if (d.bError) reject(new Error(String(d.result?.sMessage || d.result?.sDescription || 'Grammalecte init')))
      else resolve(d.result)
    }
    w.addEventListener('message', onMsg)
    const root = extensionRootHref()
    const sExtensionPath = root.endsWith('/') ? root : `${root}/`
    w.postMessage({
      sCommand: 'init',
      oParam: {
        sExtensionPath,
        dOptions: null,
        sContext: 'JavaScript',
      },
      oInfo: { id },
    })
  })
}

/** Même découpage que grammalecte/text.js getParagraph (offsets de début de paragraphe). */
function paragraphBaseOffsets(sText) {
  const s = String(sText).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const bases = []
  let iStart = 0
  let iEnd = 0
  while ((iEnd = s.indexOf('\n', iStart)) !== -1) {
    bases.push(iStart)
    iStart = iEnd + 1
  }
  bases.push(iStart)
  return bases
}

function postParse(w, text) {
  return new Promise((resolve, reject) => {
    const id = ++reqSeq
    const batches = []
    let iPara = 0
    const bases = paragraphBaseOffsets(text)

    function onMsg(e) {
      const d = e.data
      if (!d || d.oInfo?.id !== id) return
      if (d.bError) {
        w.removeEventListener('message', onMsg)
        reject(new Error(String(d.result?.sMessage || 'Grammalecte parse')))
        return
      }
      if (d.sActionDone !== 'parse') return
      if (d.bEnd && d.result === null) {
        w.removeEventListener('message', onMsg)
        resolve(flattenGramalecteErrors(batches, bases))
        return
      }
      if (Array.isArray(d.result)) {
        batches.push({ iPara, errs: d.result })
        iPara += 1
      }
    }
    w.addEventListener('message', onMsg)
    w.postMessage({
      sCommand: 'parse',
      oParam: {
        sText: text,
        sCountry: 'FR',
        bDebug: false,
        bContext: true,
      },
      oInfo: { id },
    })
  })
}

function flattenGramalecteErrors(batches, bases) {
  const out = []
  for (const { iPara, errs } of batches) {
    const base = bases[iPara] ?? 0
    for (const err of errs) {
      const nStart = err.nStart
      const nEnd = err.nEnd
      if (typeof nStart !== 'number' || typeof nEnd !== 'number') continue
      const length = nEnd - nStart
      if (length <= 0) continue
      const suggestions = Array.isArray(err.aSuggestions)
        ? err.aSuggestions.filter((x) => typeof x === 'string')
        : []
      out.push({
        offset: base + nStart,
        length,
        message: String(err.sMessage || 'Grammalecte'),
        replacements: suggestions,
        confidence: 0.93,
        source: 'gramalecte',
        ruleId: String(err.sRuleId || 'grammalecte'),
      })
    }
  }
  out.sort((a, b) => a.offset - b.offset || b.length - a.length)
  return out
}

async function ensureWorkerReady() {
  if (typeof window === 'undefined') return
  const w = getWorker()
  if (!w) return
  if (!initPromise) {
    initPromise = postInit(w).catch((e) => {
      initPromise = null
      throw e
    })
  }
  await initPromise
}

/**
 * @param {string} text
 * @returns {Promise<Array<{ offset: number, length: number, message: string, replacements: string[], ruleId?: string }>>}
 */
export async function checkFrenchText(text) {
  if (typeof window === 'undefined') return []
  const raw = String(text || '').trim()
  if (!raw) return []
  try {
    const w = getWorker()
    if (!w) return []
    await ensureWorkerReady()
    return await postParse(w, raw)
  } catch (e) {
    console.warn('[Gramalecte]', e)
    return []
  }
}
