import { useEffect, useRef } from 'react'

/**
 * Simulation 2D du pli central (livre ouvert) — repère ergonomie gouttière, pas un rendu 3D moteur.
 */
export function GutterSimCanvas({ userReadingAngle = 110, coverStiffness = 'soft', gutterScore }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const w = 280
    const h = 140
    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const angle = Math.max(90, Math.min(140, Number(userReadingAngle) || 110))
    const depth = coverStiffness === 'hard' ? 0.14 : 0.1
    const curve = depth + (120 - angle) * 0.0015

    ctx.fillStyle = '#1e1e24'
    ctx.fillRect(0, 0, w, h)

    const mid = w / 2
    const pad = 16
    const pageW = mid - pad - 6
    const pageH = h - pad * 2
    const top = pad

    const drawPage = (side) => {
      const x = side === 'left' ? pad : mid + 6
      const grd = ctx.createLinearGradient(x, top, x + pageW, top + pageH)
      grd.addColorStop(0, side === 'left' ? '#4a4a58' : '#45455a')
      grd.addColorStop(1, side === 'left' ? '#353542' : '#303040')
      ctx.fillStyle = grd
      ctx.fillRect(x, top, pageW, pageH)
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.strokeRect(x + 0.5, top + 0.5, pageW - 1, pageH - 1)
    }

    drawPage('left')
    drawPage('right')

    // Gouttière (courbe + ombre)
    ctx.save()
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(mid, top + pageH * 0.15)
    ctx.quadraticCurveTo(mid + curve * 40, top + pageH * 0.5, mid, top + pageH * 0.85)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(mid, top + pageH * 0.12)
    ctx.quadraticCurveTo(mid + curve * 32, top + pageH * 0.5, mid, top + pageH * 0.88)
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = '11px system-ui, sans-serif'
    const score = gutterScore?.score != null ? `${gutterScore.score}/100` : '—'
    ctx.fillText(`GutterSim — score ${score} — pli ${coverStiffness}`, 8, h - 8)
  }, [userReadingAngle, coverStiffness, gutterScore])

  return (
    <canvas
      ref={ref}
      className="print-gutter-sim-canvas"
      aria-label="Simulation du pli central du livre ouvert"
    />
  )
}
