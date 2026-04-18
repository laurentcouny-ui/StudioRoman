import kdpProfile from './profiles/kdp.json'
import ingramProfile from './profiles/ingram.json'
import { computeSpineFromFinalPdfPages, computeFullCoverDimensions, inchesToPixels } from './GeometryEngine.js'

/** Aligné sur `PublisherTab` (estimation ~1500 caractères / page). */
export function estimatePagesFromManuscriptChars(text) {
  return Math.max(1, Math.ceil(String(text || '').length / 1500))
}

/**
 * Dimensions pleine planche couverture (dos + rabats + fond perdu) pour export kit média.
 * @param {{ manuscriptText: string, platform?: 'kdp'|'ingramspark', dpi?: number }} opts
 */
export function getPrintCoverPlancheSpec({ manuscriptText, platform = 'kdp', dpi = 300 }) {
  const profile = platform === 'ingramspark' ? ingramProfile : kdpProfile
  const formats = profile.formatsIn || []
  const fmt =
    formats.find((f) => f.label === '6x9' || (f.width === 6 && f.height === 9)) || formats[0] || { width: 6, height: 9 }
  const pages = estimatePagesFromManuscriptChars(manuscriptText)
  const spine = computeSpineFromFinalPdfPages({
    pages,
    platform: platform === 'ingramspark' ? 'ingramspark' : 'kdp',
    paper: '60# white',
  })
  const bleedIn = Number(profile.bleedIn) || 0.125
  const cover = computeFullCoverDimensions({
    trimWidthIn: fmt.width,
    trimHeightIn: fmt.height,
    spineWidthIn: spine.widthIn,
    bleedIn,
  })
  return {
    profileId: profile.id,
    platform,
    estimatedPages: pages,
    widthIn: cover.widthIn,
    heightIn: cover.heightIn,
    widthPx: inchesToPixels(cover.widthIn, dpi),
    heightPx: inchesToPixels(cover.heightIn, dpi),
    dpi,
    bleedIn,
    spineWidthIn: spine.widthIn,
    trimIn: { w: fmt.width, h: fmt.height },
  }
}
