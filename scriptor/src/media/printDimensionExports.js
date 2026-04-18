/**
 * Redimensionnement « cover » (remplissage) pour planche imprimeur ou fichiers stores.
 */

export function renderImageCoverFitToBlob(imageSrc, widthPx, heightPx, mimeType = 'image/png', quality = 0.95) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Canvas indisponible'))
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(2, Math.round(widthPx))
      canvas.height = Math.max(2, Math.round(heightPx))
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2d'))
        return
      }
      const w = canvas.width
      const h = canvas.height
      const scale = Math.max(w / img.width, h / img.height)
      const dw = img.width * scale
      const dh = img.height * scale
      const dx = (w - dw) / 2
      const dy = (h - dh) / 2
      ctx.drawImage(img, dx, dy, dw, dh)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('toBlob'))
        },
        mimeType,
        quality,
      )
    }
    img.onerror = () => reject(new Error('Chargement image'))
    img.src = imageSrc
  })
}

/**
 * Couverture ebook : côté court ≥ `minShortSide` px (bonnes pratiques boutiques), longueur max bornée.
 */
export function renderEbookCoverBlob(imageSrc, minShortSide = 1600, maxLongSide = 4000) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Canvas indisponible'))
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      let nw = img.width
      let nh = img.height
      const short = Math.min(nw, nh)
      if (short < minShortSide) {
        const s = minShortSide / short
        nw = Math.round(nw * s)
        nh = Math.round(nh * s)
      }
      const long = Math.max(nw, nh)
      if (long > maxLongSide) {
        const s = maxLongSide / long
        nw = Math.round(nw * s)
        nh = Math.round(nh * s)
      }
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(2, nw)
      canvas.height = Math.max(2, nh)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2d'))
        return
      }
      ctx.drawImage(img, 0, 0, nw, nh)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('toBlob'))
        },
        'image/jpeg',
        0.92,
      )
    }
    img.onerror = () => reject(new Error('Chargement image'))
    img.src = imageSrc
  })
}
