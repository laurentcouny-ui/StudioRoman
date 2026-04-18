import { analyzeSaliency, computePlacementScore } from './SaliencyEngine'
import {
  proposeTitleColors,
  socialSafeZones,
  validateColorOnCmykPreview,
  imageBase64ToCanvas,
  getAverageRgbFromCanvas,
  extractDominantPaletteFromCanvas,
} from './ColorPicker'

function pickBestZone(analysis) {
  const s = analysis?.suggestion?.zone || 'bottom-third'
  if (s === 'right') return { x: 0.62, y: 0.2, w: 0.3, h: 0.18 }
  if (s === 'top') return { x: 0.2, y: 0.08, w: 0.6, h: 0.16 }
  return { x: 0.16, y: 0.68, w: 0.68, h: 0.2 }
}

function grayPx(data, i) {
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
}

/**
 * Variance locale de luminance (0–1) sur canvas analyse — alimente le score combiné CDC.
 * @param {HTMLCanvasElement} canvas
 */
export function localLuminanceVariance01(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0.75
  const w = canvas.width
  const h = canvas.height
  if (w < 2 || h < 2) return 0.75
  const { data } = ctx.getImageData(0, 0, w, h)
  const samples = []
  const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / 4096)))
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (Math.floor(y) * w + Math.floor(x)) * 4
      if (data[i + 3] < 8) continue
      samples.push(grayPx(data, i))
    }
  }
  if (samples.length < 4) return 0.75
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length
  const variance = samples.reduce((a, s) => a + (s - mean) ** 2, 0) / samples.length
  return Math.min(1, Math.sqrt(variance) / 72)
}

/**
 * Grille N×N : énergie d'arête moyenne par cellule ; retourne les zones les plus « calmes » (faible densité).
 * @param {HTMLCanvasElement} canvas
 * @param {number} [grid]
 * @param {number} [take]
 */
export function lowEdgeDensityZoneCandidates(canvas, grid = 4, take = 3) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  const w = canvas.width
  const h = canvas.height
  if (w < 8 || h < 8) return []
  const { data } = ctx.getImageData(0, 0, w, h)
  const cellW = w / grid
  const cellH = h / grid
  const cells = []
  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      const x0 = Math.max(1, Math.floor(gx * cellW))
      const y0 = Math.max(1, Math.floor(gy * cellH))
      const x1 = Math.min(w - 2, Math.floor((gx + 1) * cellW))
      const y1 = Math.min(h - 2, Math.floor((gy + 1) * cellH))
      let energy = 0
      let n = 0
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const i = (y * w + x) * 4
          const l = grayPx(data, i)
          const lx = grayPx(data, (y * w + x - 1) * 4)
          const rx = grayPx(data, (y * w + x + 1) * 4)
          const ty = grayPx(data, ((y - 1) * w + x) * 4)
          const by = grayPx(data, ((y + 1) * w + x) * 4)
          energy += Math.abs(l - lx) + Math.abs(l - rx) + Math.abs(l - ty) + Math.abs(l - by)
          n += 1
        }
      }
      const meanE = n ? energy / (4 * n) : 0
      cells.push({
        meanEdge: meanE,
        x: gx / grid,
        y: gy / grid,
        w: 1 / grid,
        h: 1 / grid,
        grid: { gx, gy },
      })
    }
  }
  cells.sort((a, b) => a.meanEdge - b.meanEdge)
  return cells.slice(0, take).map((c) => ({
    source: 'low-edge-density-grid',
    reason: `Grille ${grid}×${grid} : cellule à faible densité de contours (titre plus lisible).`,
    x: c.x,
    y: c.y,
    w: c.w,
    h: c.h,
    meanEdge: Math.round(c.meanEdge * 1000) / 1000,
  }))
}

/** Fusionne les candidats grille (4×4 + 8×8), déduplique par position normalisée, trie par arête moyenne. */
export function mergeLowEdgeZoneCandidates(lists, maxTotal = 6) {
  const flat = lists.flat().filter(Boolean)
  const seen = new Set()
  const out = []
  for (const c of flat) {
    const k = `${c.x.toFixed(4)}_${c.y.toFixed(4)}_${c.w.toFixed(4)}_${c.h.toFixed(4)}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(c)
  }
  out.sort((a, b) => (a.meanEdge ?? 0) - (b.meanEdge ?? 0))
  return out.slice(0, maxTotal)
}

/** Simulation légère « vignette » type listing (redimensionnement fort → mesure variance). */
function amazonListingRoughness01(canvas) {
  if (typeof document === 'undefined') return null
  const tw = 150
  const th = 240
  const c = document.createElement('canvas')
  c.width = tw
  c.height = th
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'low'
  ctx.drawImage(canvas, 0, 0, tw, th)
  return localLuminanceVariance01(c)
}

export async function buildCoverComposition({
  imageInfo,
  title,
  author,
  platform = 'kdp',
}) {
  const saliency = await analyzeSaliency(imageInfo)
  const zone = pickBestZone(saliency)

  let backgroundRgb = { r: 28, g: 33, b: 38 }
  let dominantPalette = null
  let analysisCanvas = null
  let variance01 = 0.8
  let amazonRoughness01 = null
  let gridZones = []

  if (imageInfo?.bytesBase64) {
    try {
      const canvas = await imageBase64ToCanvas(imageInfo.bytesBase64)
      analysisCanvas = canvas
      backgroundRgb = getAverageRgbFromCanvas(canvas)
      dominantPalette = extractDominantPaletteFromCanvas(canvas)
      variance01 = localLuminanceVariance01(canvas)
      const coarse = lowEdgeDensityZoneCandidates(canvas, 4, 4)
      const dense = lowEdgeDensityZoneCandidates(canvas, 8, 6)
      gridZones = mergeLowEdgeZoneCandidates([coarse, dense], 6)
      try {
        amazonRoughness01 = amazonListingRoughness01(canvas)
      } catch {
        amazonRoughness01 = null
      }
    } catch {
      /* fallback couleurs ci-dessous */
    }
  }

  const saliencyCoherence = saliency.fallbackUsed ? 0.65 : saliency.tfjsPathUsed ? 0.92 : 0.82
  const colors = proposeTitleColors(backgroundRgb, dominantPalette)
  const bestColor = colors.find((c) => c.wcagAA && !c.excluded) || colors[0]
  const score = computePlacementScore({
    negativeSpace: 0.82,
    wcag: Math.min(1, bestColor.wcag / 7),
    saliency: saliencyCoherence,
    variance: variance01,
  })
  const cmykCheck = await validateColorOnCmykPreview(imageInfo?.bytesBase64 || '', platform)

  const zoneCandidates = [
    {
      rank: 1,
      source: 'saliency-narrative',
      reason: 'Placement depuis saillance + suggestion narrative (règle des tiers / regard).',
      x: zone.x,
      y: zone.y,
      w: zone.w,
      h: zone.h,
    },
    ...gridZones.slice(0, 4).map((g, i) => ({ ...g, rank: i + 2 })),
  ]

  const pipelineSteps = [
    'downscale-max-256',
    'rgb-average-dominant-palette',
    'local-luminance-variance',
    gridZones.length ? 'grid-low-edge-density-4x4+8x8-merged' : null,
    amazonRoughness01 != null ? 'amazon-listing-thumb-sim-150x240' : null,
    saliency.tfjsPathUsed ? 'saliency-tfjs-sobel' : saliency.fallbackUsed ? 'saliency-heuristic-fallback' : 'saliency-canvas-sobel',
    'wcag-title-colors',
    'cmyk-preview-validate',
  ].filter(Boolean)

  return {
    title,
    author,
    zone,
    zoneCandidates,
    selectedColor: bestColor,
    placementScore: score,
    saliency,
    cmykCheck,
    averageRgb: backgroundRgb,
    dominantPalette,
    pipelineReport: {
      steps: pipelineSteps,
      localVariance01: Math.round(variance01 * 1000) / 1000,
      amazonListingRoughness01:
        amazonRoughness01 != null ? Math.round(amazonRoughness01 * 1000) / 1000 : null,
      analysisCanvasSize: analysisCanvas ? { w: analysisCanvas.width, h: analysisCanvas.height } : null,
    },
  }
}

const SAFE_EPS = 0.014

function rectOverlap(a, b) {
  if (!a || !b) return false
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function clampTitleRect(z) {
  const w = Math.min(Math.max(z.w, 0.04), 0.98)
  const h = Math.min(Math.max(z.h, 0.04), 0.98)
  return {
    x: Math.max(0, Math.min(1 - w, z.x)),
    y: Math.max(0, Math.min(1 - h, z.y)),
    w,
    h,
  }
}

function overlapCount(moved, blocked) {
  return blocked.reduce((n, b) => n + (rectOverlap(moved, b) ? 1 : 0), 0)
}

/**
 * Évite les masques UI (plusieurs passes, 4 directions) ; signale si le bloc ne tient pas entièrement hors masque.
 * @returns {{ zone: { x: number, y: number, w: number, h: number }, overlapRemaining: boolean, iterations: number }}
 */
export function analyzeSafeZoneReposition(zone, formatId) {
  const blocked = socialSafeZones()[formatId]?.blocked || []
  if (!zone || typeof zone.x !== 'number') {
    return {
      zone: zone || { x: 0.1, y: 0.65, w: 0.68, h: 0.18 },
      overlapRemaining: false,
      iterations: 0,
    }
  }
  let moved = clampTitleRect({ ...zone })
  if (blocked.length === 0) {
    return { zone: moved, overlapRemaining: false, iterations: 0 }
  }

  const maxIter = 28
  let iterations = 0
  for (let iter = 0; iter < maxIter; iter += 1) {
    const before = overlapCount(moved, blocked)
    if (before === 0) {
      iterations = iter
      return { zone: moved, overlapRemaining: false, iterations }
    }
    iterations = iter + 1
    let best = moved
    let bestScore = before
    for (const b of blocked) {
      if (!rectOverlap(moved, b)) continue
      const { x, y, w, h } = moved
      const tries = [
        clampTitleRect({ x, y: b.y - h - SAFE_EPS, w, h }),
        clampTitleRect({ x, y: b.y + b.h + SAFE_EPS, w, h }),
        clampTitleRect({ x: b.x - w - SAFE_EPS, y, w, h }),
        clampTitleRect({ x: b.x + b.w + SAFE_EPS, y, w, h }),
      ]
      for (const t of tries) {
        const sc = overlapCount(t, blocked)
        if (sc < bestScore) {
          bestScore = sc
          best = t
        }
      }
    }
    if (bestScore < before) {
      moved = best
      continue
    }
    // Aucune amélioration cardinal : repli bande haute / basse (titres souvent lisibles en haut ou tiers inférieur).
    const fallbacks = [
      clampTitleRect({ ...moved, y: 0.06 }),
      clampTitleRect({ ...moved, y: 0.72 }),
      clampTitleRect({ ...moved, x: 0.05 }),
      clampTitleRect({ ...moved, x: 0.5 - moved.w / 2 }),
    ]
    let improved = false
    for (const t of fallbacks) {
      const sc = overlapCount(t, blocked)
      if (sc < before) {
        moved = t
        improved = true
        break
      }
    }
    if (!improved) break
  }

  const overlapRemaining = overlapCount(moved, blocked) > 0
  return { zone: moved, overlapRemaining, iterations }
}

export function repositionAgainstSafeZones(zone, formatId) {
  return analyzeSafeZoneReposition(zone, formatId).zone
}

export function buildMockup2p5DPlan({ coverWidth = 1200, coverHeight = 1800, spinePx = 120 }) {
  return {
    type: 'canvas-2.5d',
    surfaces: {
      front: { x: spinePx, y: 20, w: coverWidth / 2, h: coverHeight / 2 },
      spine: { x: spinePx - 24, y: 20, w: 24, h: coverHeight / 2 },
      shadow: { blur: 24, opacity: 0.24 },
    },
  }
}

export function buildMediaKitManifest(input) {
  return {
    generatedAt: Math.floor(Date.now() / 1000),
    assets: {
      printCover: input.printCover || null,
      ebookCover: input.ebookCover || null,
      exclusiveFontTtf: input.exclusiveFontTtf || null,
      socialVariants: input.socialVariants || [],
      mockup3d: input.mockup3d || null,
      layoutAstJson: input.layoutAstJson || null,
    },
    report: input.report || {},
    pricing: { minimumEuro: 1, selectedEuro: Math.max(1, Number(input.priceEuro || 1)) },
  }
}

