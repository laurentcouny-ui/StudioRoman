import { failoverStrategy } from '../print/FailoverStrategy'

export const DEFAULT_SALIENCY_CONTEXT = {
  modelVersion: 'gradient-sobel-1.0.0',
  precision: 'float32',
  seed: 42,
}

const TFJS_MODEL_VERSION = 'tfjs-sobel-luma-1.0.0'

function seeded(seed) {
  let x = seed || 42
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296
    return x / 4294967296
  }
}

function heuristicMap(width, height, seed = 42) {
  const rnd = seeded(seed)
  const focal = { x: Math.round(width * (0.35 + rnd() * 0.3)), y: Math.round(height * (0.28 + rnd() * 0.36)) }
  const gaze = rnd() > 0.5 ? 'right' : 'left'
  const vanishing = rnd() > 0.5 ? 'up' : 'center'
  return { focal, gaze, vanishing, method: 'heuristic-edge-variance' }
}

function suggestPlacementFromNarrative(map) {
  if (map.gaze === 'right') return { zone: 'right', reason: 'follows-gaze-flow' }
  if (map.vanishing === 'up') return { zone: 'top', reason: 'vanishing-lines-up' }
  return { zone: 'bottom-third', reason: 'rule-of-thirds' }
}

function gray(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * @param {Float32Array | number[]} mag
 */
function mapFromMagnitudeField(mag, w, h) {
  let max = 0
  let mx = Math.floor(w / 2)
  let my = Math.floor(h / 2)
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const v = mag[y * w + x]
      if (v > max) {
        max = v
        mx = x
        my = y
      }
    }
  }
  let left = 0
  let right = 0
  const mid = Math.floor(w / 2)
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < mid; x += 1) left += mag[y * w + x]
    for (let x = mid; x < w; x += 1) right += mag[y * w + x]
  }
  const gaze = right > left * 1.08 ? 'right' : 'left'
  let top = 0
  let bottom = 0
  const midy = Math.floor(h / 2)
  for (let y = 0; y < midy; y += 1) {
    for (let x = 0; x < w; x += 1) top += mag[y * w + x]
  }
  for (let y = midy; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) bottom += mag[y * w + x]
  }
  const vanishing = top > bottom * 1.05 ? 'up' : bottom > top * 1.05 ? 'center' : 'center'
  return {
    focal: { x: mx, y: my },
    gaze,
    vanishing,
    method: 'gradient-sobel-luma',
    maxEnergy: max,
  }
}

/**
 * Carte de saillance par magnitude Sobel sur luminance (canvas).
 * @param {ImageData} data
 * @param {number} w
 * @param {number} h
 */
function saliencyFromGradient(data, w, h) {
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i += 1) {
    const o = i * 4
    g[i] = gray(data.data[o], data.data[o + 1], data.data[o + 2])
  }
  const mag = new Float32Array(w * h)
  const gxk = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const gyk = [-1, -2, -1, 0, 0, 0, 1, 2, 1]
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      let sx = 0
      let sy = 0
      let ki = 0
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const idx = (y + ky) * w + (x + kx)
          sx += g[idx] * gxk[ki]
          sy += g[idx] * gyk[ki]
          ki += 1
        }
      }
      mag[y * w + x] = Math.sqrt(sx * sx + sy * sy)
    }
  }
  return mapFromMagnitudeField(mag, w, h)
}

/**
 * Même géométrie Sobel que le chemin canvas, via TensorFlow.js (CDC : priorité TF.js, repli si échec).
 * @param {ImageData} data
 */
async function saliencyFromGradientTfjs(data, w, h) {
  const tf = await import('@tensorflow/tfjs')
  await tf.ready()
  const grayData = new Float32Array(w * h)
  const d = data.data
  for (let i = 0; i < w * h; i += 1) {
    const o = i * 4
    grayData[i] = gray(d[o], d[o + 1], d[o + 2]) / 255
  }
  const out = tf.tidy(() => {
    const input = tf.tensor4d(grayData, [1, h, w, 1])
    const kx = tf.tensor4d(new Float32Array([-1, 0, 1, -2, 0, 2, -1, 0, 1]), [3, 3, 1, 1])
    const ky = tf.tensor4d(new Float32Array([-1, -2, -1, 0, 0, 0, 1, 2, 1]), [3, 3, 1, 1])
    const gx = tf.conv2d(input, kx, [1, 1], 'same')
    const gy = tf.conv2d(input, ky, [1, 1], 'same')
    return tf.sqrt(tf.add(tf.square(gx), tf.square(gy)))
  })
  const magData = out.dataSync()
  out.dispose()
  const mag = Float32Array.from(magData)
  const base = mapFromMagnitudeField(mag, w, h)
  return { ...base, method: 'tfjs-sobel-luma' }
}

function tryLoadDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('decode'))
    img.src = dataUrl
  })
}

async function loadImageElement(bytesBase64) {
  const raw = String(bytesBase64 || '')
  if (raw.startsWith('data:')) {
    return tryLoadDataUrl(raw)
  }
  const types = ['image/png', 'image/jpeg', 'image/webp']
  let lastErr = null
  for (const t of types) {
    try {
      return await tryLoadDataUrl(`data:${t};base64,${raw}`)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr || new Error('saliency: image decode failed')
}

/**
 * @param {{ bytesBase64?: string, width?: number, height?: number }} image
 */
export async function analyzeSaliency(image, ctx = DEFAULT_SALIENCY_CONTEXT) {
  const width = image?.width || 1024
  const height = image?.height || 1536

  if (!image?.bytesBase64 || typeof document === 'undefined') {
    const map = heuristicMap(width, height, ctx.seed)
    return {
      saliencyContext: { ...DEFAULT_SALIENCY_CONTEXT, ...ctx },
      map,
      suggestion: suggestPlacementFromNarrative(map),
      fallbackUsed: true,
    }
  }

  try {
    const img = await loadImageElement(image.bytesBase64)
    const cw = 256
    const ch = 256
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const c2 = canvas.getContext('2d')
    if (!c2) throw new Error('canvas 2d')
    c2.drawImage(img, 0, 0, cw, ch)
    const data = c2.getImageData(0, 0, cw, ch)

    let map
    let usedTfjs = false
    try {
      map = await saliencyFromGradientTfjs(data, cw, ch)
      usedTfjs = true
    } catch {
      map = saliencyFromGradient(data, cw, ch)
    }

    const suggestion = suggestPlacementFromNarrative(map)
    const modelVersion = usedTfjs ? TFJS_MODEL_VERSION : DEFAULT_SALIENCY_CONTEXT.modelVersion
    return {
      saliencyContext: { ...DEFAULT_SALIENCY_CONTEXT, ...ctx, modelVersion },
      map: {
        ...map,
        focal: {
          x: Math.round((map.focal.x / cw) * (image.width || img.width || width)),
          y: Math.round((map.focal.y / ch) * (image.height || img.height || height)),
        },
      },
      suggestion,
      fallbackUsed: false,
      tfjsPathUsed: usedTfjs,
    }
  } catch (err) {
    const degraded = failoverStrategy.saliencyDivergence(err)
    const map = heuristicMap(width, height, ctx.seed)
    return {
      saliencyContext: { ...DEFAULT_SALIENCY_CONTEXT, ...ctx },
      map,
      suggestion: suggestPlacementFromNarrative(map),
      fallbackUsed: true,
      degraded,
    }
  }
}

export function computePlacementScore({ negativeSpace = 0.8, wcag = 0.8, saliency = 0.8, variance = 0.8 }) {
  const score = negativeSpace * wcag * saliency * variance
  return Math.round(score * 1000) / 1000
}
