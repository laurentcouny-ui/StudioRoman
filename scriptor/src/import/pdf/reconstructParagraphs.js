/**
 * Regroupe les glyphes pdf.js en lignes physiques, puis en paragraphes (CDC Brique 3).
 */
import { startsWithInciseVerb } from './inciseVerbs.js'

const Y_TOL_MIN = 3
const WIDTH_MERGE_RATIO = 0.8
/** Ratio sur la hauteur de police médiane pour tolérer les légers écarts de baseline. */
const Y_TOL_HEIGHT_FACTOR = 0.45
/** Notes de bas de page : bande basse de page + police plus petite que la médiane. */
const FOOTNOTE_Y_BAND = 0.14
const FOOTNOTE_H_RATIO = 0.36
/** Largeur min (unités PDF) pour tenter une lecture 2 colonnes. */
const COLUMN_SPREAD_MIN = 120

/** Fin de ligne = phrase / énoncé probablement terminé. */
const STRONG_END_RE = /[.!?…]["»'')\]]*\s*$/u

/** Dialogue ou réplique : ne jamais coller à la ligne précédente. */
const DIALOG_START_RE = /^\s*[—–-]\s*«\s*['"]?/u

/** Césure typographique en fin de ligne (tiret / trait d’union). */
const HYPHEN_BREAK_RE = /[-\u2010\u2011]\s*$/u

function normalizeLineText(parts) {
  return parts
    .join('')
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function medianPositive(nums) {
  const a = nums.filter((n) => n > 0).sort((x, y) => x - y)
  if (a.length === 0) return 0
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

function clusterItemsIntoLines(itemList, yTol) {
  if (itemList.length === 0) return []
  const sorted = [...itemList].sort((a, b) => {
    if (Math.abs(a.y - b.y) > yTol) return b.y - a.y
    return a.x - b.x
  })
  const lines = []
  let bucket = []
  let lineY = sorted[0].y
  const bucketMeanY = () => bucket.reduce((s, b) => s + b.y, 0) / bucket.length
  const flush = () => {
    if (bucket.length === 0) return
    const rtlN = bucket.filter((b) => b.rtl).length
    if (rtlN * 2 > bucket.length) {
      bucket.sort((a, b) => b.x - a.x)
    } else {
      bucket.sort((a, b) => a.x - b.x)
    }
    const text = normalizeLineText(bucket.map((b) => b.str))
    const width = bucket.reduce((s, b) => s + b.w, 0)
    const centerX = bucket.reduce((s, b) => s + b.x + b.w / 2, 0) / bucket.length
    lines.push({ text, width, centerX, lineY: bucketMeanY() })
    bucket = []
  }
  for (const it of sorted) {
    if (bucket.length === 0) {
      bucket.push(it)
      lineY = it.y
      continue
    }
    if (Math.abs(it.y - lineY) <= yTol) {
      bucket.push(it)
      lineY = bucketMeanY()
    } else {
      flush()
      bucket.push(it)
      lineY = it.y
    }
  }
  flush()
  return lines
}

/** Ordre de lecture 2 colonnes (gouttière ~ médiane X), si la page est assez large. */
function orderLinesTwoColumnReading(lines) {
  if (lines.length < 4) return lines
  const cx = lines.map((l) => l.centerX ?? 0)
  const minX = Math.min(...cx)
  const maxX = Math.max(...cx)
  const spread = maxX - minX
  const medianWid = medianPositive(lines.map((l) => l.width))
  if (spread < COLUMN_SPREAD_MIN || spread < medianWid * 1.05) return lines
  const mid = (minX + maxX) / 2
  const left = lines
    .filter((l) => (l.centerX ?? 0) < mid)
    .sort((a, b) => (b.lineY ?? 0) - (a.lineY ?? 0))
  const right = lines
    .filter((l) => (l.centerX ?? 0) >= mid)
    .sort((a, b) => (b.lineY ?? 0) - (a.lineY ?? 0))
  if (left.length === 0 || right.length === 0) return lines
  return [...left, ...right]
}

/** @param {object[]} items — items pdf.js (str, transform, width) */
export function groupPdfTextItemsIntoLines(items) {
  const enriched = (items || [])
    .filter((it) => 'str' in it && String(it.str).length > 0)
    .map((it) => {
      const t = it.transform
      const h =
        typeof it.height === 'number' && it.height > 0
          ? it.height
          : Math.hypot(t[2], t[3]) || 0
      return {
        str: it.str,
        x: t[4],
        y: t[5],
        w: typeof it.width === 'number' && it.width > 0 ? it.width : String(it.str).length * 4,
        h,
        rtl: it.dir === 'rtl',
      }
    })
  if (enriched.length === 0) return []

  const ys = enriched.map((e) => e.y)
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const yBand = yMax - yMin || 1

  const medianH = medianPositive(enriched.map((e) => e.h))
  const yTol =
    medianH > 0
      ? Math.max(Y_TOL_MIN, medianH * Y_TOL_HEIGHT_FACTOR)
      : Y_TOL_MIN

  const footnoteThresholdY = yMin + yBand * FOOTNOTE_Y_BAND
  const body = []
  const foot = []
  for (const e of enriched) {
    const small = e.h > 0 && e.h < medianH * FOOTNOTE_H_RATIO
    const low = e.y <= footnoteThresholdY
    if (small && low && medianH > 0) {
      foot.push(e)
    } else {
      body.push(e)
    }
  }

  let lines = clusterItemsIntoLines(body, yTol)
  lines = orderLinesTwoColumnReading(lines)
  if (foot.length > 0) {
    const footLines = clusterItemsIntoLines(foot, yTol)
    if (footLines.length > 0) {
      lines.push({ text: '', width: 0 })
      lines.push(...footLines)
    }
  }
  return lines.map(({ text, width }) => ({ text, width }))
}

function lineStartsWithLowercase(text) {
  const t = String(text || '').trim()
  if (!t) return false
  const c = t[0]
  return c === c.toLowerCase() && /\p{Ll}/u.test(c)
}

/**
 * @param {{ text: string, width: number }[]} lineObjs
 * @returns {string}
 */
export function reconstructPdfParagraphsFromLines(lineObjs) {
  const lines = (lineObjs || []).map((l) => ({
    text: String(l.text || '').trim(),
    width: typeof l.width === 'number' ? l.width : 0,
  }))

  const medianW = medianPositive(lines.map((l) => l.width))

  const paras = []
  let buf = ''
  let prevWidth = 0

  const pushBuf = () => {
    const t = buf.trim()
    if (t) paras.push(t)
    buf = ''
    prevWidth = 0
  }

  for (let i = 0; i < lines.length; i += 1) {
    const { text, width } = lines[i]
    if (!text) {
      pushBuf()
      continue
    }

    if (!buf) {
      buf = text
      prevWidth = width
      continue
    }

    const trimmedNext = text.trim()
    if (HYPHEN_BREAK_RE.test(buf) && trimmedNext.length > 0) {
      const c0 = trimmedNext[0]
      if (c0 === c0.toLowerCase() && /\p{Ll}/u.test(c0)) {
        buf = buf.replace(HYPHEN_BREAK_RE, '') + trimmedNext
        prevWidth = width
        continue
      }
    }

    if (DIALOG_START_RE.test(text)) {
      pushBuf()
      buf = text
      prevWidth = width
      continue
    }

    if (STRONG_END_RE.test(buf)) {
      pushBuf()
      buf = text
      prevWidth = width
      continue
    }

    const narrowPrev =
      medianW > 0 && prevWidth > 0 && prevWidth < WIDTH_MERGE_RATIO * medianW
    const mergeHere =
      narrowPrev && (lineStartsWithLowercase(text) || startsWithInciseVerb(text))

    if (mergeHere) {
      buf = `${buf} ${text}`.replace(/\s+/g, ' ')
      prevWidth = width
    } else {
      pushBuf()
      buf = text
      prevWidth = width
    }
  }
  pushBuf()
  return paras.join('\n\n').trim()
}

/** @param {{ items?: object[] }} textContent */
export function pdfTextContentToPlainParagraphs(textContent) {
  const lines = groupPdfTextItemsIntoLines(textContent?.items || [])
  return reconstructPdfParagraphsFromLines(lines)
}
