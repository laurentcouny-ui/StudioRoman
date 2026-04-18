import { colorBridge } from './ColorBridge'

function imageStatus(blocking, warnings) {
  if (blocking.length > 0) return 'Bloquant'
  if (warnings.length > 0) return 'Warning'
  return 'OK'
}

export class ImagePreflightEngine {
  async run(images, opts = {}) {
    const rows = []
    for (const img of images || []) {
      const warnings = []
      const blocking = []
      const dpi = Number(img.dpi || 0)
      if (dpi > 0 && dpi < 300) blocking.push(`DPI trop faible (${dpi})`)
      if (dpi <= 0) warnings.push('DPI non calculable — fournir dimensions image + format couverture')

      const scaleFactor = Number(img.scaleFactor || 1)
      if (scaleFactor > 1) warnings.push(`Agrandissement > 100% (${Math.round(scaleFactor * 100)}%)`)

      let converted = null
      if (img.colorSpace && img.colorSpace.toUpperCase() !== 'CMYK') {
        converted = await colorBridge.convertImageToCmyk({
          imageBase64: img.bytesBase64,
          imageHash: img.hash || img.id,
          contentKind: img.contentKind || 'photo',
          platform: opts.platform || 'kdp',
        })
        warnings.push('Colorspace normalise RGB -> CMYK')
      }
      if (!img.iccProfile) warnings.push('Profil ICC absent : conversion profil plateforme par defaut')

      rows.push({
        id: img.id,
        status: imageStatus(blocking, warnings),
        blocking,
        warnings,
        dpi,
        converted,
      })
    }
    return {
      status: rows.some((r) => r.status === 'Bloquant')
        ? 'Bloquant'
        : rows.some((r) => r.status === 'Warning')
          ? 'Warning'
          : 'OK',
      images: rows,
    }
  }
}

export const imagePreflightEngine = new ImagePreflightEngine()

