/**
 * Limiteur de densité CDC séquence 2 : max 1 micro-point (90–97 %) par phrase,
 * max 3 par paragraphe, fusion des incertitudes proches.
 */
import { CORRECTOR_MODE } from './CorrectorModes.js'

function sortByOffset(arr) {
  return [...arr].sort((a, b) => (a.offset || 0) - (b.offset || 0))
}

function sentenceIndexForOffset(text, paraStart, paraEnd, offset) {
  const slice = text.slice(paraStart, paraEnd)
  const rel = Math.max(0, offset - paraStart)
  const re = /[.!?]+(?:\s+|$)/g
  const ends = []
  let m
  while ((m = re.exec(slice)) !== null) {
    ends.push(m.index + m[0].length)
  }
  for (let i = 0; i < ends.length; i += 1) {
    if (rel < ends[i]) return i
  }
  return ends.length
}

function paragraphRanges(text) {
  const ranges = []
  let start = 0
  const re = /\n+/g
  let m
  while ((m = re.exec(text)) !== null) {
    ranges.push({ start, end: m.index, index: ranges.length })
    start = m.index + m[0].length
  }
  ranges.push({ start, end: text.length, index: ranges.length })
  return ranges.length ? ranges : [{ start: 0, end: text.length, index: 0 }]
}

function matchPriority(m) {
  const msg = String(m.message || '').toLowerCase()
  if (/grammaire|accord|conjugaison|verbe|syntaxe|pluriel|singulier/.test(msg)) return 4
  if (/orthographe|faute|typo|mot/.test(msg)) return 3
  if (/ponctuation|virgule|point|deux\s*points/.test(msg)) return 2
  return 1
}

function mergeCloseUncertain(matches, maxGap = 14) {
  const sorted = sortByOffset(matches.filter((m) => (m.confidence ?? 0) < 0.98))
  const out = []
  let buf = []
  const flushBuf = () => {
    if (buf.length === 0) return
    buf.sort((a, b) => matchPriority(b) - matchPriority(a) || (b.confidence ?? 0) - (a.confidence ?? 0))
    out.push(buf[0])
    buf = []
  }
  for (const m of sorted) {
    const last = buf[buf.length - 1]
    if (
      last &&
      m.offset - (last.offset + last.length) <= maxGap &&
      (m.confidence ?? 0) < 0.98 &&
      (last.confidence ?? 0) < 0.98
    ) {
      buf.push(m)
    } else {
      flushBuf()
      buf = [m]
    }
  }
  flushBuf()
  return out
}

/**
 * @param {string} plain
 * @param {Array<{ offset: number, length: number, confidence?: number, message?: string }>} uncertain
 */
function limitUncertainDensity(plain, uncertain) {
  const merged = mergeCloseUncertain(uncertain)
  const paras = paragraphRanges(plain)
  /** @type {typeof uncertain} */
  const kept = []
  const perParaCount = new Map()
  const usedSentence = new Set()

  const ordered = merged.sort(
    (a, b) => matchPriority(b) - matchPriority(a) || (b.confidence ?? 0) - (a.confidence ?? 0),
  )

  for (const m of ordered) {
    const para = paras.find((r) => m.offset >= r.start && m.offset < r.end) || paras[0]
    const pidx = para?.index ?? 0
    const count = perParaCount.get(pidx) || 0
    if (count >= 3) continue

    const si = sentenceIndexForOffset(plain, para.start, para.end, m.offset)
    const skey = `${pidx}:${si}`
    if (usedSentence.has(skey)) continue

    usedSentence.add(skey)
    kept.push(m)
    perParaCount.set(pidx, count + 1)
  }
  return kept
}

/**
 * @param {string} plain
 * @param {Array<{ offset: number, length: number, confidence?: number, message?: string }>} matches
 * @param {string} correctorMode CORRECTOR_MODE.*
 */
export function limitHighlightMatches(plain, matches, correctorMode) {
  if (correctorMode === CORRECTOR_MODE.SIMPLE_STRICT) return []

  const list = [...(matches || [])].filter(
    (m) => m && Number.isFinite(m.offset) && Number.isFinite(m.length) && m.length > 0,
  )

  const bibleMarks = list.filter((m) => m.bibleNominal)

  if (correctorMode === CORRECTOR_MODE.EXPERT) {
    const strong = list.filter(
      (m) => (m.confidence ?? 1) >= 0.98 && !m.bibleNominal,
    )
    const shadow = list.filter((m) => (m.confidence ?? 1) < 0.9 && !m.bibleNominal)
    const uncertain = list.filter((m) => {
      const c = m.confidence ?? 0
      return c >= 0.9 && c < 0.98 && !m.bibleNominal
    })
    const limitedU = limitUncertainDensity(plain, uncertain)
    return sortByOffset([...bibleMarks, ...strong, ...limitedU, ...shadow])
  }

  const strong = list.filter((m) => (m.confidence ?? 1) >= 0.98 && !m.bibleNominal)
  const uncertain = list.filter((m) => {
    const c = m.confidence ?? 0
    return c >= 0.9 && c < 0.98 && !m.bibleNominal
  })
  const limitedU = limitUncertainDensity(plain, uncertain)
  return sortByOffset([...bibleMarks, ...strong, ...limitedU])
}
