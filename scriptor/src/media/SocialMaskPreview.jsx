import { useEffect, useRef } from 'react'
import { drawSocialMaskOnContext } from './socialMaskDrawing.js'

/**
 * Aperçu couverture avec zones masquées (réseaux sociaux) + blocs titre normalisés (0–1).
 * @param {{
 *   imageSrc: string,
 *   formatId: string,
 *   zone?: { x: number, y: number, w: number, h: number },
 *   zoneAdjusted?: { x: number, y: number, w: number, h: number },
 *   alternateZones?: Array<{ x: number, y: number, w: number, h: number, rank?: number, source?: string }>,
 *   showBlockedOverlay?: boolean,
 *   showTitleGuides?: boolean,
 *   formatLabel?: string,
 * }} props
 */
export function SocialMaskPreview({
  imageSrc,
  formatId,
  zone,
  zoneAdjusted,
  alternateZones = [],
  showBlockedOverlay = true,
  showTitleGuides = true,
  formatLabel,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !imageSrc) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      const cssW = 360
      const cssH = Math.max(80, Math.round(cssW * (img.height / img.width)))
      const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawSocialMaskOnContext(ctx, cssW, cssH, img, {
        formatId,
        zone,
        zoneAdjusted,
        alternateZones,
        showBlockedOverlay,
        showTitleGuides,
      })
    }
    img.onerror = () => {
      const ctx2 = canvas.getContext('2d')
      if (ctx2) {
        ctx2.fillStyle = '#333'
        ctx2.fillRect(0, 0, canvas.width, canvas.height)
      }
    }
    img.src = imageSrc
  }, [
    imageSrc,
    formatId,
    zone,
    zoneAdjusted,
    alternateZones,
    showBlockedOverlay,
    showTitleGuides,
  ])

  if (!imageSrc) return null

  const cap = formatLabel ? ` — ${formatLabel}` : ''
  const hasAlt = Array.isArray(alternateZones) && alternateZones.length > 0

  return (
    <div className="social-mask-preview">
      <canvas ref={ref} className="social-mask-preview-canvas" aria-label={`Aperçu zones réseaux sociaux${cap}`} />
      <p className="publisher-hint" style={{ marginTop: 6, maxWidth: 440 }}>
        {!showBlockedOverlay && !showTitleGuides && 'Aucun calque actif — cochez au moins une option ci-dessus.'}
        {showBlockedOverlay && <>Rouge : zones souvent masquées par l’interface du réseau.</>}
        {showBlockedOverlay && showTitleGuides && <br />}
        {showTitleGuides && (
          <>
            {hasAlt && <>Orange : autres emplacements titre (grille faible densité). </>}
            Vert : bloc titre suggéré (saliency). Bleu : position après évitement des masques.
          </>
        )}
      </p>
    </div>
  )
}
