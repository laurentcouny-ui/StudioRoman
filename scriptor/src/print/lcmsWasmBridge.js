/**
 * Conversion RVB → CMJN (profil ICC embarqué) puis épreuvage écran via LittleCMS WASM.
 * Vite : importer le .wasm depuis le paquet (voir README lcms-wasm) — évite un 404 sur /wasm/lcms.wasm absent de public/.
 */
import instantiate from 'lcms-wasm'
import wasmFileUri from 'lcms-wasm/dist/lcms.wasm?url'
import {
  TYPE_RGB_8,
  TYPE_CMYK_8,
  INTENT_PERCEPTUAL,
  INTENT_RELATIVE_COLORIMETRIC,
  cmsFLAGS_BLACKPOINTCOMPENSATION,
} from 'lcms-wasm'
import { resolveBundledIcc } from './iccBundledProfiles.js'

const MAX_EDGE_PX = 2048

let lcmsSingleton = null

async function getLcms() {
  if (!lcmsSingleton) {
    lcmsSingleton = await instantiate({
      locateFile: (path) => (String(path).endsWith('.wasm') ? wasmFileUri : path),
    })
  }
  return lcmsSingleton
}

function stripDataUrl(b64) {
  const s = String(b64 || '')
  const i = s.indexOf(',')
  return i >= 0 ? s.slice(i + 1) : s
}

function imageSrcFromBase64(b64) {
  const s = String(b64 || '')
  if (s.startsWith('data:')) return s
  return `data:image/png;base64,${stripDataUrl(s)}`
}

function drawImageToCanvas(img) {
  let w = img.naturalWidth || img.width
  let h = img.naturalHeight || img.height
  if (!w || !h) throw new Error('lcmsWasm: dimensions image invalides')
  const max = Math.max(w, h)
  if (max > MAX_EDGE_PX) {
    const scale = MAX_EDGE_PX / max
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('lcmsWasm: canvas 2d')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

function imageDataToRgbInterleaved(data) {
  const n = (data.length / 4) | 0
  const rgb = new Uint8Array(n * 3)
  let o = 0
  for (let i = 0; i < data.length; i += 4) {
    rgb[o++] = data[i]
    rgb[o++] = data[i + 1]
    rgb[o++] = data[i + 2]
  }
  return rgb
}

function rgbInterleavedToImageData(rgb, w, h) {
  const out = new ImageData(w, h)
  const d = out.data
  let o = 0
  for (let i = 0; i < rgb.length; i += 3) {
    d[o++] = rgb[i]
    d[o++] = rgb[i + 1]
    d[o++] = rgb[i + 2]
    d[o++] = 255
  }
  return out
}

/**
 * @param {string} imageBase64 data URL ou brut base64
 * @param {{ profileLabel?: string, intent?: string, contentKind?: string }} opts
 * @returns {Promise<{ convertedBytes: string, certified: boolean, warning?: string, profile: string, intent: string }>}
 */
export async function convertImageRgbToCmykSoftproofPngBase64(imageBase64, opts = {}) {
  const profile = opts.profile || 'GRACoL'
  const perceptual = opts.contentKind === 'photo' || opts.intent === 'perceptive'
  const intentNum = perceptual ? INTENT_PERCEPTUAL : INTENT_RELATIVE_COLORIMETRIC
  const flags = cmsFLAGS_BLACKPOINTCOMPENSATION

  const lcms = await getLcms()
  const hSrgb = lcms.cmsCreate_sRGBProfile()
  const iccBytes = resolveBundledIcc(profile).bytes
  const hOut = lcms.cmsOpenProfileFromMem(iccBytes, iccBytes.byteLength)
  if (!hOut) {
    lcms.cmsCloseProfile(hSrgb)
    throw new Error('lcmsWasm: ouverture profil CMJN embarqué impossible')
  }

  const tfToCmyk = lcms.cmsCreateTransform(
    hSrgb,
    TYPE_RGB_8,
    hOut,
    TYPE_CMYK_8,
    intentNum,
    flags,
  )
  const tfToRgb = lcms.cmsCreateTransform(
    hOut,
    TYPE_CMYK_8,
    hSrgb,
    TYPE_RGB_8,
    intentNum,
    flags,
  )

  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise((resolve, reject) => {
    img.onload = () => resolve(null)
    img.onerror = () => reject(new Error('lcmsWasm: chargement image'))
    img.src = imageSrcFromBase64(imageBase64)
  })

  const canvas = drawImageToCanvas(img)
  const ctx = canvas.getContext('2d')
  const { width: w, height: h } = canvas
  const imageData = ctx.getImageData(0, 0, w, h)
  const rgbIn = imageDataToRgbInterleaved(imageData.data)
  const n = w * h

  const cmyk = lcms.cmsDoTransform(tfToCmyk, rgbIn, n)
  const rgbProof = lcms.cmsDoTransform(tfToRgb, cmyk, n)

  lcms.cmsDeleteTransform(tfToCmyk)
  lcms.cmsDeleteTransform(tfToRgb)
  lcms.cmsCloseProfile(hSrgb)
  lcms.cmsCloseProfile(hOut)

  const outData = rgbInterleavedToImageData(rgbProof, w, h)
  ctx.putImageData(outData, 0, 0)
  const dataUrl = canvas.toDataURL('image/png')
  const convertedBytes = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl

  return {
    convertedBytes,
    certified: true,
    warning:
      'Épreuve écran RVB après séparation CMJN (LittleCMS WASM). Fichier PNG pour prévisualisation ; le profil métier est approximé par ICC compact embarqué.',
    profile,
    intent: perceptual ? 'perceptive' : 'relative-colorimetric',
  }
}
