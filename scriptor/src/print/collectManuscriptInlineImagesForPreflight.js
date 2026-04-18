import { getCurrentSaga, loadSceneText } from '../projectStore.js'

const DATA_IMG_RE = /data:image\/[^;]+;base64,([A-Za-z0-9+/=\r\n]+)/gi

/**
 * Extrait les images inline (data URL) du HTML des scènes pour le préflight print.
 * @param {object} project
 * @returns {Array<{ id: string, bytesBase64: string, dpi: number, scaleFactor: number, iccProfile: null, colorSpace: string }>}
 */
export function collectManuscriptInlineImagesForPreflight(project) {
  const saga = getCurrentSaga(project)
  if (!saga?.volumes?.length) return []
  const out = []
  saga.volumes.forEach((vol) => {
    vol.chapters?.forEach((ch) => {
      ch.scenes?.forEach((sc) => {
        if (!sc?.id) return
        const html = loadSceneText(sc.id) || ''
        let m
        DATA_IMG_RE.lastIndex = 0
        let i = 0
        while ((m = DATA_IMG_RE.exec(html)) !== null) {
          const b64 = m[1].replace(/\s+/g, '')
          if (b64.length < 24) continue
          i += 1
          out.push({
            id: `manuscript-${sc.id}-${i}`,
            bytesBase64: b64,
            dpi: 0,
            scaleFactor: 1,
            iccProfile: null,
            colorSpace: 'RGB',
          })
        }
      })
    })
  })
  return out
}
