const INCH_TO_POINTS = 72

export function inchToPoints(inches) {
  return Math.round(Number(inches || 0) * INCH_TO_POINTS * 1000) / 1000
}

export function pointsToPixels(points, dpi = 300) {
  return Math.round((Number(points || 0) / 72) * dpi)
}

export function inchesToPixels(inches, dpi = 300) {
  return pointsToPixels(inchToPoints(inches), dpi)
}

export function computeSafeZoneAndBleed({ trimWidthIn, trimHeightIn, bleedIn = 0.125, safeIn = 0.25, dpi = 300 }) {
  const fullW = trimWidthIn + bleedIn * 2
  const fullH = trimHeightIn + bleedIn * 2
  return {
    trim: { widthPt: inchToPoints(trimWidthIn), heightPt: inchToPoints(trimHeightIn) },
    bleed: { widthPt: inchToPoints(fullW), heightPt: inchToPoints(fullH), bleedPt: inchToPoints(bleedIn) },
    safeZonePx: {
      x: inchesToPixels(bleedIn + safeIn, dpi),
      y: inchesToPixels(bleedIn + safeIn, dpi),
      width: inchesToPixels(trimWidthIn - safeIn * 2, dpi),
      height: inchesToPixels(trimHeightIn - safeIn * 2, dpi),
    },
  }
}

function platformFactor(platform, paper) {
  const k = `${platform}|${paper}`.toLowerCase()
  if (k.includes('kdp') && k.includes('60')) return 0.0025
  if (k.includes('ingramspark') && k.includes('60')) return 0.002252
  if (k.includes('ingramspark') && k.includes('50')) return 0.002143
  return 0.0025
}

export function computeSpineFromFinalPdfPages({ pages, platform, paper }) {
  const factor = platformFactor(platform, paper)
  const raw = pages * factor
  const snapped = Math.round(raw / 0.002) * 0.002
  return { widthIn: snapped, toleranceIn: 0.002, factorIn: factor }
}

export function computeFullCoverDimensions({ trimWidthIn, trimHeightIn, spineWidthIn, bleedIn = 0.125 }) {
  const width = trimWidthIn * 2 + spineWidthIn + bleedIn * 2
  const height = trimHeightIn + bleedIn * 2
  return { widthIn: width, heightIn: height, widthPt: inchToPoints(width), heightPt: inchToPoints(height) }
}

export function computeCreepCompensation({ pageCount, bindingType = 'perfect', paperThickness = 0.0025, signatureSize = 16, enabled = true }) {
  const suggested = pageCount > 200
  if (!enabled) return { enabled: false, offsetBySignatureIn: [], suggested }
  const signatures = Math.ceil(pageCount / signatureSize)
  const mul = bindingType === 'sewn' ? 0.42 : 0.65
  const out = []
  for (let i = 0; i < signatures; i += 1) {
    const offset = (signatures - i - 1) * paperThickness * mul
    out.push({ signatureIndex: i, offsetIn: Math.round(offset * 10000) / 10000 })
  }
  return { enabled: true, offsetBySignatureIn: out, suggested }
}

export function gutterSafetyScore({ pageCount, userReadingAngle = 110, coverStiffness = 'soft' }) {
  if (pageCount <= 400) return { score: 100, warning: false, reason: 'not-applicable' }
  const stiffnessPenalty = coverStiffness === 'hard' ? 18 : 8
  const anglePenalty = Math.max(0, (120 - userReadingAngle) * 0.7)
  const thicknessPenalty = Math.min(35, (pageCount - 400) * 0.06)
  const score = Math.max(0, Math.round(100 - stiffnessPenalty - anglePenalty - thicknessPenalty))
  return { score, warning: score < 70, reason: score < 70 ? 'ergonomic-fold-risk' : 'ok' }
}

export function spineOverflowAlert({ titleLengthApproxPx, spineWidthIn, dpi = 300 }) {
  const spinePx = inchesToPixels(spineWidthIn, dpi)
  const ratio = spinePx > 0 ? titleLengthApproxPx / spinePx : 9
  return { ratio, warning: ratio > 0.9, threshold: 0.9 }
}

/** Ligne `marginsByPagesIn` du profil KDP/Ingram la plus adaptée au nombre de pages. */
export function pickMarginsRowForPages(profile, pageCount) {
  const rows = profile?.marginsByPagesIn
  if (!Array.isArray(rows) || rows.length === 0) {
    return { maxPages: 9999, inside: 0.5, outside: 0.25, top: 0.25, bottom: 0.25 }
  }
  const sorted = [...rows].sort((a, b) => a.maxPages - b.maxPages)
  const n = Math.max(1, Number(pageCount) || 1)
  for (const r of sorted) {
    if (n <= r.maxPages) return r
  }
  return sorted[sorted.length - 1]
}

