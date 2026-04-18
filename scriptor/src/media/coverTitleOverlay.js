import opentype from 'opentype.js'
import { estimateGamutScreeningFromCanvas } from './ColorPicker.js'

/**
 * Image couverture + titre / auteur dans la zone normalisée (CDC : post-traitement typo local).
 * @param {string} imageSrc
 * @param {{
 *   zone: { x: number, y: number, w: number, h: number },
 *   title: string,
 *   author?: string,
 *   rgb: { r: number, g: number, b: number },
 *   fontBuffer?: ArrayBuffer | null,
 *   maxWidth?: number,
 * }} opts
 * @returns {Promise<{ blob: Blob, gamutScreening: { percentRisky: number, level: string, label: string, suggestion: string|null } }>}
 */
export function renderCoverWithTitleBlob(imageSrc, opts) {
  const {
    zone,
    title,
    author = '',
    rgb,
    fontBuffer,
    maxWidth = 1200,
  } = opts

  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('renderCoverWithTitleBlob: document indisponible'))
      return
    }
    const img = new Image()
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 2d'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)

        const zx = zone.x * w
        const zy = zone.y * h
        const zw = zone.w * w
        const zh = zone.h * h
        const padX = zw * 0.04
        const padY = zh * 0.08
        const titleStr = String(title || 'Titre').trim() || 'Titre'
        const authorStr = String(author || '').trim()

        const fill = `rgb(${rgb.r},${rgb.g},${rgb.b})`
        ctx.fillStyle = fill
        ctx.textBaseline = 'alphabetic'

        const setLegibilityShadow = (fontSize) => {
          ctx.shadowColor = 'rgba(0,0,0,0.42)'
          ctx.shadowBlur = Math.min(10, Math.max(2, fontSize * 0.14))
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = Math.max(1, fontSize * 0.03)
        }
        const clearShadow = () => {
          ctx.shadowColor = 'transparent'
          ctx.shadowBlur = 0
          ctx.shadowOffsetY = 0
        }

        let font = null
        if (fontBuffer && fontBuffer.byteLength > 100) {
          try {
            font = opentype.parse(fontBuffer)
          } catch {
            font = null
          }
        }

        const titleSize = Math.min(zh * 0.34, zw / Math.max(titleStr.length * 0.45, 5))
        const authorSize = Math.max(10, titleSize * 0.38)

        const titleBaseline = authorStr
          ? zy + padY + titleSize * 0.85
          : zy + zh * 0.52 + titleSize * 0.28
        const authorBaseline = authorStr ? zy + zh - padY - authorSize * 0.12 : titleBaseline

        if (font) {
          ctx.save()
          ctx.fillStyle = fill
          setLegibilityShadow(titleSize)
          font.draw(ctx, titleStr, zx + padX, titleBaseline, titleSize)
          if (authorStr) {
            clearShadow()
            setLegibilityShadow(authorSize)
            font.draw(ctx, authorStr, zx + padX, authorBaseline, authorSize)
          }
          clearShadow()
          ctx.restore()
        } else {
          ctx.save()
          setLegibilityShadow(titleSize)
          ctx.font = `600 ${titleSize}px Georgia, "Times New Roman", serif`
          ctx.fillText(titleStr, zx + padX, titleBaseline)
          if (authorStr) {
            clearShadow()
            setLegibilityShadow(authorSize)
            ctx.font = `400 ${authorSize}px Georgia, "Times New Roman", serif`
            ctx.fillText(authorStr, zx + padX, authorBaseline)
          }
          clearShadow()
          ctx.restore()
        }

        let gamutScreening
        try {
          gamutScreening = estimateGamutScreeningFromCanvas(canvas)
        } catch {
          gamutScreening = {
            percentRisky: 0,
            level: 'ok',
            label: 'Gamut : analyse indisponible.',
            suggestion: null,
          }
        }
        canvas.toBlob(
          (blob) => {
            if (blob) resolve({ blob, gamutScreening })
            else reject(new Error('toBlob'))
          },
          'image/png',
          0.92,
        )
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('Chargement image couverture'))
    img.src = imageSrc
  })
}
