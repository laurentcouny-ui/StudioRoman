import { colorBridge } from '../print/ColorBridge'

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  }
}

function rgbToHex(r, g, b) {
  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const v = Math.max(0, Math.min(255, Math.round(x)))
        return v.toString(16).padStart(2, '0')
      })
      .join('')
  )
}

function rgbToHsl(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
    else if (max === gn) h = ((bn - rn) / d + 2) / 6
    else h = ((rn - gn) / d + 4) / 6
  }
  return { h: h * 360, s, l }
}

/**
 * Fallback déterministe (tests / pas d’image).
 */
export function extractDominantPalette() {
  return [
    { h: 210, s: 0.42, l: 0.42, hex: '#3c5f8f' },
    { h: 20, s: 0.62, l: 0.48, hex: '#c55c2f' },
    { h: 45, s: 0.44, l: 0.58, hex: '#c9a760' },
    { h: 120, s: 0.2, l: 0.36, hex: '#476b47' },
    { h: 0, s: 0, l: 0.15, hex: '#262626' },
  ]
}

/**
 * Histogramme quantifié (RGB 5 bits) sur canvas — navigateur uniquement.
 * @param {HTMLCanvasElement} canvas
 * @param {number} [maxColors]
 * @returns {Array<{ h: number, s: number, l: number, hex: string }>}
 */
export function extractDominantPaletteFromCanvas(canvas, maxColors = 7) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return extractDominantPalette()
  const w = canvas.width
  const h = canvas.height
  if (w < 2 || h < 2) return extractDominantPalette()
  const { data } = ctx.getImageData(0, 0, w, h)
  const buckets = new Map()
  const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / 10000)))
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      const i = (Math.floor(py) * w + Math.floor(px)) * 4
      if (data[i + 3] < 12) continue
      const r = (data[i] >> 3) << 3
      const g = (data[i + 1] >> 3) << 3
      const b = (data[i + 2] >> 3) << 3
      const key = (r << 16) | (g << 8) | b
      buckets.set(key, (buckets.get(key) || 0) + 1)
    }
  }
  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxColors)
  if (sorted.length === 0) return extractDominantPalette()
  return sorted.map(([key]) => {
    const r = (key >> 16) & 255
    const g = (key >> 8) & 255
    const b = key & 255
    const { h, s, l } = rgbToHsl(r, g, b)
    return { h, s, l, hex: rgbToHex(r, g, b) }
  })
}

/**
 * RGB moyen (pixels opaques, échantillonnés) — pour contraste WCAG titre / fond couverture.
 * @param {HTMLCanvasElement} canvas
 */
export function getAverageRgbFromCanvas(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { r: 28, g: 33, b: 38 }
  const w = canvas.width
  const h = canvas.height
  const { data } = ctx.getImageData(0, 0, w, h)
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / 12000)))
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      const i = (Math.floor(py) * w + Math.floor(px)) * 4
      if (data[i + 3] < 12) continue
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      n += 1
    }
  }
  if (!n) return { r: 28, g: 33, b: 38 }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
}

/**
 * Décode une image base64 (JPEG/PNG/WebP) en canvas redimensionné (côté max 256px) pour analyse rapide.
 * @param {string} bytesBase64 sans préfixe data:
 * @returns {Promise<HTMLCanvasElement>}
 */
export function imageBase64ToCanvas(bytesBase64) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('imageBase64ToCanvas: document indisponible'))
      return
    }
    const img = new Image()
    img.onload = () => {
      const maxSide = 256
      let tw = img.width
      let th = img.height
      if (tw > maxSide || th > maxSide) {
        const sc = maxSide / Math.max(tw, th)
        tw = Math.round(tw * sc)
        th = Math.round(th * sc)
      }
      const c = document.createElement('canvas')
      c.width = Math.max(2, tw)
      c.height = Math.max(2, th)
      const ctx = c.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2d'))
        return
      }
      ctx.drawImage(img, 0, 0, c.width, c.height)
      resolve(c)
    }
    img.onerror = () => reject(new Error('Chargement image'))
    img.src = `data:image;base64,${bytesBase64}`
  })
}

/**
 * Heuristique chroma / tons vifs → risque hors-gamut CMJN (approx. écran, CDC Brique 4).
 */
export function estimateGamutScreeningFromCanvas(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      percentRisky: 0,
      level: 'ok',
      label: 'Gamut : analyse indisponible.',
      suggestion: null,
    }
  }
  const w = canvas.width
  const h = canvas.height
  if (w < 2 || h < 2) {
    return { percentRisky: 0, level: 'ok', label: 'Gamut : —', suggestion: null }
  }
  const { data } = ctx.getImageData(0, 0, w, h)
  let risky = 0
  let total = 0
  const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / 10000)))
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      const i = (Math.floor(py) * w + Math.floor(px)) * 4
      if (data[i + 3] < 20) continue
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255
      total += 1
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const l = (max + min) / 2
      let s = 0
      if (max !== min) {
        s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
      }
      const chroma = max - min
      const vivid = s > 0.88 && l > 0.1 && l < 0.96
      const neon = chroma > 0.9 && max > 0.5
      if (vivid || neon) risky += 1
    }
  }
  if (!total) {
    return { percentRisky: 0, level: 'ok', label: 'Gamut : aucun pixel échantillonné.', suggestion: null }
  }
  const percentRisky = Math.round((risky / total) * 1000) / 10
  let level = 'ok'
  if (percentRisky >= 15) level = 'critical'
  else if (percentRisky >= 1) level = 'soft'

  const suggestion =
    level === 'critical'
      ? 'Envisager environ −12 % de saturation sur les aplats les plus vifs, ou une épreuve colorimétrique.'
      : level === 'soft'
        ? 'Surveiller jaunes et magenta vifs à l’épreuve sur papier couché.'
        : null

  const label =
    level === 'ok'
      ? `Gamut (estim.) : ${percentRisky}% de pixels très chromatiques — RAS.`
      : level === 'soft'
        ? `Gamut (estim.) : ${percentRisky}% de pixels à chroma élevé (sous le seuil critique 15 %).`
        : `Gamut (estim.) : ${percentRisky}% — au-dessus du seuil CDC 15 % (risque hors-gamut CMJN).`

  return { percentRisky, level, label, suggestion }
}

export async function estimateGamutFromImageBase64(bytesBase64) {
  try {
    const canvas = await imageBase64ToCanvas(bytesBase64)
    return estimateGamutScreeningFromCanvas(canvas)
  } catch {
    return {
      percentRisky: 0,
      level: 'ok',
      label: 'Gamut : décodage image impossible.',
      suggestion: null,
    }
  }
}

/**
 * @param {string} dataUrl data:image/...;base64,...
 */
export async function estimateGamutFromDataUrl(dataUrl) {
  if (typeof document === 'undefined' || !dataUrl || !String(dataUrl).startsWith('data:')) {
    return { percentRisky: 0, level: 'ok', label: 'Gamut : —', suggestion: null }
  }
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const maxSide = 256
      let tw = img.width
      let th = img.height
      if (tw > maxSide || th > maxSide) {
        const sc = maxSide / Math.max(tw, th)
        tw = Math.round(tw * sc)
        th = Math.round(th * sc)
      }
      const c = document.createElement('canvas')
      c.width = Math.max(2, tw)
      c.height = Math.max(2, th)
      const ctx = c.getContext('2d')
      if (!ctx) {
        resolve({ percentRisky: 0, level: 'ok', label: 'Gamut : —', suggestion: null })
        return
      }
      ctx.drawImage(img, 0, 0, c.width, c.height)
      resolve(estimateGamutScreeningFromCanvas(c))
    }
    img.onerror = () =>
      resolve({
        percentRisky: 0,
        level: 'ok',
        label: 'Gamut : chargement couverture impossible.',
        suggestion: null,
      })
    img.src = dataUrl
  })
}

function contrastRatio(l1, l2) {
  const a = Math.max(l1, l2)
  const b = Math.min(l1, l2)
  return (a + 0.05) / (b + 0.05)
}

function relativeLuminance(rgb) {
  const fn = (x) => {
    const s = x / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * fn(rgb.r) + 0.7152 * fn(rgb.g) + 0.0722 * fn(rgb.b)
}

function printSafetyFilter(hsl) {
  return {
    h: hsl.h,
    s: clamp(hsl.s, 0, 0.78),
    l: clamp(hsl.l, 0.08, 0.92),
  }
}

/**
 * @param {{ r: number, g: number, b: number }} backgroundRgb couleur moyenne (fond) pour contraste WCAG
 * @param {Array<{ h: number, s: number, l: number, hex: string }>} [dominantPaletteFromImage] sinon palette de secours
 */
export function proposeTitleColors(backgroundRgb = { r: 30, g: 30, b: 30 }, dominantPaletteFromImage) {
  const palette =
    Array.isArray(dominantPaletteFromImage) && dominantPaletteFromImage.length > 0
      ? dominantPaletteFromImage
      : extractDominantPalette()
  const dom = palette[0]
  const complement = { h: (dom.h + 180) % 360, s: dom.s, l: dom.l }
  const analog = { h: (dom.h + 28) % 360, s: dom.s, l: clamp(dom.l + 0.12, 0, 1) }
  const neutral = relativeLuminance(backgroundRgb) < 0.42 ? { h: 0, s: 0, l: 0.95 } : { h: 0, s: 0, l: 0.08 }

  const options = [
    { id: 'complementary', label: 'Complementaire dominante', hsl: complement },
    { id: 'analog-warm', label: 'Analogue chaude', hsl: analog },
    { id: 'neutral', label: 'Neutre', hsl: neutral },
  ].map((o) => {
    const safe = printSafetyFilter(o.hsl)
    const rgb = hslToRgb(safe.h, safe.s, safe.l)
    const wcag = contrastRatio(relativeLuminance(rgb), relativeLuminance(backgroundRgb))
    return {
      ...o,
      hsl: safe,
      rgb,
      wcag: Math.round(wcag * 100) / 100,
      wcagAA: wcag >= 4.5,
      excluded: wcag < 4.5,
    }
  })
  return options
}

export function socialSafeZones() {
  return {
    instagramPost1080: { blocked: [{ x: 0.0, y: 0.82, w: 0.22, h: 0.18 }, { x: 0.78, y: 0.82, w: 0.22, h: 0.18 }] },
    instagramStory1080x1920: { blocked: [{ x: 0, y: 0, w: 1, h: 0.08 }, { x: 0, y: 0.9, w: 1, h: 0.1 }] },
    tiktok1080x1920: { blocked: [{ x: 0.84, y: 0.2, w: 0.16, h: 0.6 }, { x: 0, y: 0.86, w: 0.4, h: 0.14 }] },
    facebook1200x630: { blocked: [{ x: 0, y: 0.87, w: 1, h: 0.13 }] },
    twitter1200x675: { blocked: [{ x: 0, y: 0.86, w: 1, h: 0.14 }] },
    pinterest1000x1500: { blocked: [{ x: 0.02, y: 0.02, w: 0.14, h: 0.08 }, { x: 0, y: 0.9, w: 1, h: 0.1 }] },
  }
}

export async function validateColorOnCmykPreview(imageBase64, platform = 'kdp') {
  const cmyk = await colorBridge.convertImageToCmyk({
    imageBase64,
    imageHash: `preview-${platform}`,
    platform,
    contentKind: 'graphic',
  })
  return {
    certified: Boolean(cmyk?.certified),
    warning: cmyk?.warning || null,
  }
}

