import { socialSafeZones } from './ColorPicker.js'

/**
 * Dessine couverture + masques + guides titre sur un contexte 2D (coords CSS px).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cssW
 * @param {number} cssH
 * @param {CanvasImageSource} img
 * @param {{
 *   formatId: string,
 *   zone?: { x: number, y: number, w: number, h: number },
 *   zoneAdjusted?: { x: number, y: number, w: number, h: number },
 *   alternateZones?: Array<{ x: number, y: number, w: number, h: number }>,
 *   showBlockedOverlay?: boolean,
 *   showTitleGuides?: boolean,
 * }} opts
 */
export function drawSocialMaskOnContext(ctx, cssW, cssH, img, opts) {
  const {
    formatId,
    zone,
    zoneAdjusted,
    alternateZones = [],
    showBlockedOverlay = true,
    showTitleGuides = true,
  } = opts

  ctx.clearRect(0, 0, cssW, cssH)
  ctx.drawImage(img, 0, 0, cssW, cssH)

  const blocked = socialSafeZones()[formatId]?.blocked || []
  if (showBlockedOverlay) {
    ctx.fillStyle = 'rgba(255, 60, 60, 0.26)'
    for (const b of blocked) {
      ctx.fillRect(b.x * cssW, b.y * cssH, b.w * cssW, b.h * cssH)
    }
  }

  if (!showTitleGuides) return

  for (let i = 0; i < alternateZones.length; i += 1) {
    const az = alternateZones[i]
    if (!az || typeof az.x !== 'number') continue
    ctx.strokeStyle = i === 0 ? 'rgba(255, 200, 80, 0.92)' : 'rgba(255, 160, 40, 0.85)'
    ctx.lineWidth = Math.max(1, cssW / 360)
    ctx.setLineDash([6, 4])
    ctx.strokeRect(az.x * cssW, az.y * cssH, az.w * cssW, az.h * cssH)
    ctx.setLineDash([])
  }

  if (zone && typeof zone.x === 'number') {
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.92)'
    ctx.lineWidth = Math.max(2, (2 * cssW) / 360)
    ctx.setLineDash([7, 5])
    ctx.strokeRect(zone.x * cssW, zone.y * cssH, zone.w * cssW, zone.h * cssH)
    ctx.setLineDash([])
  }
  if (
    zoneAdjusted &&
    typeof zoneAdjusted.x === 'number' &&
    (zoneAdjusted.x !== zone?.x ||
      zoneAdjusted.y !== zone?.y ||
      zoneAdjusted.w !== zone?.w ||
      zoneAdjusted.h !== zone?.h)
  ) {
    ctx.strokeStyle = 'rgba(90, 160, 255, 0.95)'
    ctx.lineWidth = Math.max(2, (2 * cssW) / 360)
    ctx.setLineDash([4, 4])
    ctx.strokeRect(
      zoneAdjusted.x * cssW,
      zoneAdjusted.y * cssH,
      zoneAdjusted.w * cssW,
      zoneAdjusted.h * cssH,
    )
    ctx.setLineDash([])
  }
}

/**
 * Export PNG (aperçu social) — mêmes calques que l’UI.
 * @returns {Promise<Blob>}
 */
export function renderSocialMaskPreviewBlob(imageSrc, opts, exportWidthPx = 1080) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('renderSocialMaskPreviewBlob: document indisponible'))
      return
    }
    const img = new Image()
    img.onload = () => {
      const cssW = exportWidthPx
      const cssH = Math.max(120, Math.round(cssW * (img.height / img.width)))
      const canvas = document.createElement('canvas')
      canvas.width = cssW
      canvas.height = cssH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2d'))
        return
      }
      drawSocialMaskOnContext(ctx, cssW, cssH, img, opts)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('toBlob'))
        },
        'image/png',
        0.92,
      )
    }
    img.onerror = () => reject(new Error('Chargement image'))
    img.src = imageSrc
  })
}
