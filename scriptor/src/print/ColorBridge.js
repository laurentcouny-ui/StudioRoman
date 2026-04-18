import { taskQueueManager } from './TaskQueueManager'
import { failoverStrategy } from './FailoverStrategy'
import { convertImageRgbToCmykSoftproofPngBase64 } from './lcmsWasmBridge.js'
// NOTE : LittleCMS natif Rust (print_littlecms_convert) non implémenté côté backend.
// Toutes les conversions passent par LittleCMS WASM via TaskQueueManager — même résultat, certified: true.

const ICC_PROFILES = {
  ingramspark: 'FOGRA39',
  kdp: 'GRACoL',
}

const COLOR_CACHE = new Map()

function cacheKey(opts) {
  return JSON.stringify({
    hash: opts.imageHash,
    profile: opts.profile,
    intent: opts.intent,
    kind: opts.contentKind,
  })
}

function fakeCanvasSimulateConversion(imageBytes) {
  return {
    convertedBytes: imageBytes,
    warning: 'Simulation couleur — non conforme impression',
    certified: false,
  }
}

export class ColorBridge {
  resolveIccProfile(platformName) {
    return ICC_PROFILES[String(platformName || '').toLowerCase()] || 'FOGRA39'
  }

  async convertImageToCmyk(opts) {
    const profile = opts.profile || this.resolveIccProfile(opts.platform)
    const intent = opts.intent || (opts.contentKind === 'photo' ? 'perceptive' : 'relative-colorimetric')
    const key = cacheKey({ ...opts, profile, intent })
    if (COLOR_CACHE.has(key)) return COLOR_CACHE.get(key)

    try {
      const result = await taskQueueManager.enqueue({
        id: `icc-wasm-${Date.now()}`,
        label: 'ICC conversion LittleCMS WASM',
        priority: 'print',
        debounceKey: `icc-${key}`,
        run: async ({ updateProgress }) => {
          updateProgress(5, 'Initialisation LittleCMS WASM')
          const out = await convertImageRgbToCmykSoftproofPngBase64(opts.imageBase64, {
            profile,
            intent,
            contentKind: opts.contentKind || 'graphic',
          })
          updateProgress(100, 'Conversion terminée')
          return {
            convertedBytes: out.convertedBytes,
            profile: out.profile,
            intent: out.intent,
            certified: true,
            warning: out.warning,
          }
        },
      })
      COLOR_CACHE.set(key, result)
      return result
    } catch (err) {
      const degraded = failoverStrategy.littleCmsWasmCrash(err)
      return { ...fakeCanvasSimulateConversion(opts.imageBase64), degraded, profile, intent }
    }
  }

  /**
   * Référence CDC : noir riche (CMJN) vs noir pur (100 % K seul) — utile pour contrôle manuel / UI.
   * @param {{ k?: number }} sample échantillon CMJN normalisé 0–100 si disponible
   */
  verifyBlackPolicy(sample) {
    const richBlack = { c: 60, m: 40, y: 40, k: 100 }
    const pureBlack = { c: 0, m: 0, y: 0, k: 100 }
    return {
      richBlack,
      pureBlack,
      textBlackLooksGray: (sample?.k ?? 100) < 94,
    }
  }

  gamutWarning({ outOfGamutRatio }) {
    const ratio = Number(outOfGamutRatio || 0)
    if (ratio > 0.15) {
      return { level: 'critical', label: 'Critical Warning', suggestDesaturationPct: Math.round(ratio * 80) }
    }
    if (ratio > 0) return { level: 'soft', label: 'Soft Warning', suggestDesaturationPct: Math.round(ratio * 50) }
    return { level: 'none', label: 'OK', suggestDesaturationPct: 0 }
  }
}

export const colorBridge = new ColorBridge()

