import { useEffect, useRef } from 'react'
import { buildMockup2p5DPlan } from './MediaPostPipeline.js'

/**
 * Mockup livre 2.5D (couverture + tranche) — CDC Brique 4 kit média.
 */
export function MediaMockupCanvas({ imageSrc, bookTitle }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || !imageSrc) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const plan = buildMockup2p5DPlan({
      coverWidth: 720,
      coverHeight: 1080,
      spinePx: 48,
    })
    const front = plan.surfaces.front
    const spine = plan.surfaces.spine
    const { blur, opacity } = plan.surfaces.shadow

    const img = new Image()
    img.onload = () => {
      const cssW = 440
      const cssH = 260
      const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const totalW = front.x + front.w + 24
      const totalH = Math.max(spine.y + spine.h, front.y + front.h) + 28
      const scale = Math.min(cssW / totalW, cssH / totalH) * 0.92
      const ox = (cssW - totalW * scale) / 2
      const oy = (cssH - totalH * scale) / 2

      ctx.fillStyle = '#14141a'
      ctx.fillRect(0, 0, cssW, cssH)

      const sx = ox + spine.x * scale
      const sy = oy + spine.y * scale
      const sw = spine.w * scale
      const sh = spine.h * scale
      const fx = ox + front.x * scale
      const fy = oy + front.y * scale
      const fw = front.w * scale
      const fh = front.h * scale

      ctx.save()
      ctx.shadowColor = `rgba(0,0,0,${opacity + 0.35})`
      ctx.shadowBlur = blur * 0.35
      ctx.shadowOffsetY = 6
      ctx.fillStyle = '#3a3a48'
      ctx.fillRect(sx, sy, sw, sh)
      ctx.fillStyle = '#2e2e38'
      ctx.fillRect(sx - 1, sy, 2, sh)

      ctx.beginPath()
      ctx.rect(fx, fy, fw, fh)
      ctx.clip()
      ctx.drawImage(img, fx, fy, fw, fh)
      ctx.restore()

      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1)

      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.font = '600 11px system-ui, Segoe UI, sans-serif'
      const label = String(bookTitle || 'Couverture').slice(0, 48)
      ctx.fillText(label, fx + 8, fy + 18)

      ctx.fillStyle = 'rgba(200,200,210,0.55)'
      ctx.font = '10px system-ui, sans-serif'
      ctx.save()
      ctx.translate(sx + sw / 2, sy + sh / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText('dos', -12, -4)
      ctx.restore()
    }
    img.onerror = () => {
      ctx.fillStyle = '#222'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    img.src = imageSrc
  }, [imageSrc, bookTitle])

  if (!imageSrc) return null

  return (
    <div className="media-mockup-wrap">
      <canvas ref={ref} aria-label="Mockup livre 2,5 D" />
      <p className="publisher-hint" style={{ marginTop: 6, maxWidth: 440 }}>
        Aperçu non contractuel : projection plate + ombre. Dimensions dérivées du plan{' '}
        <code>buildMockup2p5DPlan</code> (CDC).
      </p>
    </div>
  )
}
