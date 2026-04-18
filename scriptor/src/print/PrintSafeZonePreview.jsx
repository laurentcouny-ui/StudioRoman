import { useEffect, useRef } from 'react'
import { pickMarginsRowForPages } from './GeometryEngine.js'

/**
 * Réticule sécurité temps réel : fond perdu, fond perdu / trait de coupe, zone sûre, zone texte (marges profil).
 */
export function PrintSafeZonePreview({
  profile,
  selectedFormat,
  estimatedPages,
  geometry,
  massicotShiftIn = 0,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !profile || !selectedFormat || !geometry?.safe) return

    const bleedIn = Number(profile.bleedIn) || 0.125
    const safeIn = Number(profile.safeZoneIn) || 0.25
    const tw = Number(selectedFormat.width) || 6
    const th = Number(selectedFormat.height) || 9
    const margins = pickMarginsRowForPages(profile, estimatedPages)

    const fullW = tw + bleedIn * 2
    const fullH = th + bleedIn * 2

    const cssW = 320
    const cssH = Math.round(cssW * (fullH / fullW))
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    const sx = cssW / fullW
    const sy = cssH / fullH

    const rect = (x, y, w, h, fill, stroke, lineWidth = 1) => {
      if (fill) {
        ctx.fillStyle = fill
        ctx.fillRect(x, y, w, h)
      }
      if (stroke) {
        ctx.strokeStyle = stroke
        ctx.lineWidth = lineWidth
        ctx.strokeRect(x, y, w, h)
      }
    }

    // Fond : tout le gabarit (fond perdu inclus)
    rect(0, 0, cssW, cssH, '#2a2a32', null)

    // Zone fond perdu (hors fond de coupe = zone entre bord fichier et trait de coupe)
    const trimX = bleedIn * sx
    const trimY = bleedIn * sy
    const trimW = tw * sx
    const trimH = th * sy

    rect(trimX, trimY, trimW, trimH, '#3d3d48', '#888', 1)

    // Zone « danger » (entre fond de coupe et zone sûre) — texte / détails critiques à risque de coupe
    const safeX = trimX + safeIn * sx
    const safeY = trimY + safeIn * sy
    const safeW = trimW - 2 * safeIn * sx
    const safeH = trimH - 2 * safeIn * sy
    ctx.save()
    ctx.fillStyle = 'rgba(255, 72, 24, 0.12)'
    ctx.beginPath()
    ctx.rect(trimX, trimY, trimW, trimH)
    ctx.rect(safeX, safeY, Math.max(0, safeW), Math.max(0, safeH))
    ctx.fill('evenodd')
    ctx.restore()

    ctx.setLineDash([4, 3])
    rect(safeX, safeY, safeW, safeH, null, 'rgba(255, 0, 200, 0.95)', 1.5)
    ctx.setLineDash([])

    // Trait de coupe (blanc)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'
    ctx.lineWidth = 1
    ctx.strokeRect(trimX + 0.5, trimY + 0.5, trimW - 1, trimH - 1)

    const mIn = Math.max(0, Number(massicotShiftIn) || 0)
    if (mIn > 0) {
      const mx = mIn * sx
      const my = mIn * sy
      const ix = trimX + mx
      const iy = trimY + my
      const iw = trimW - 2 * mx
      const ih = trimH - 2 * my
      if (iw > 4 && ih > 4) {
        ctx.save()
        ctx.setLineDash([3, 4])
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.92)'
        ctx.lineWidth = 1.25
        ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1)
        ctx.restore()
        ctx.fillStyle = 'rgba(255,140,0,0.85)'
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillText('Massicot ±', trimX + 4, trimY + trimH - 6)
      }
    }

    // Zone texte recommandée (cyan) — marges intérieures profil
    const mi = Number(margins.inside) || 0.375
    const mo = Number(margins.outside) || 0.25
    const mt = Number(margins.top) || 0.25
    const mb = Number(margins.bottom) || 0.25
    const tx = trimX + mi * sx
    const ty = trimY + mt * sy
    const tww = trimW - (mi + mo) * sx
    const thh = trimH - (mt + mb) * sy
    ctx.strokeStyle = 'rgba(0, 220, 255, 0.95)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(tx, ty, Math.max(0, tww), Math.max(0, thh))

    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = '10px system-ui, sans-serif'
    ctx.fillText('Fond perdu', 6, 14)
    ctx.fillStyle = 'rgba(255,72,24,0.95)'
    ctx.fillText('Zone risque coupe', 6, 28)
    ctx.fillStyle = 'rgba(255,0,200,0.9)'
    ctx.fillText('Zone sûre', 6, 42)
    ctx.fillStyle = 'rgba(0,220,255,0.95)'
    ctx.fillText('Zone texte (marges)', 6, 56)
  }, [profile, selectedFormat, estimatedPages, geometry, massicotShiftIn])

  return (
    <div className="print-safe-zone-wrap">
      <canvas ref={ref} className="print-safe-zone-canvas" aria-label="Réticule marges et fond perdu" />
      <p className="publisher-hint" style={{ marginTop: 8, maxWidth: 360 }}>
        Échelle indicative : une page intérieure (fond de coupe + fond perdu). Orange translucide = zone risque de coupe
        (entre fond de coupe et zone sûre). Magenta = zone sûre ({profile?.safeZoneIn ?? '—'}
        &quot; depuis le fond de coupe). Cyan = zone texte selon le barème de pages du profil. Orange en pointillés =
        fenêtre intérieure si la coupe décale d’environ le « massicot » choisi (tolérance machine).
      </p>
    </div>
  )
}
