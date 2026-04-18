import JSZip from 'jszip'
import { analyzeSafeZoneReposition } from './MediaPostPipeline.js'
import { renderSocialMaskPreviewBlob } from './socialMaskDrawing.js'

/** Aligné sur `socialSafeZones()` dans ColorPicker.js */
export const SOCIAL_PACK_FORMAT_IDS = [
  'instagramPost1080',
  'instagramStory1080x1920',
  'tiktok1080x1920',
  'facebook1200x630',
  'twitter1200x675',
  'pinterest1000x1500',
]

/**
 * Un PNG par format réseau (masques + guides), dans un ZIP.
 * @param {string} imageSrc data URL ou URL objet
 * @param {{
 *   zone: { x: number, y: number, w: number, h: number },
 *   alternateZones?: Array<{ x: number, y: number, w: number, h: number }>,
 *   showBlockedOverlay?: boolean,
 *   showTitleGuides?: boolean,
 *   exportWidthPx?: number,
 * }} opts
 * @returns {Promise<Blob>}
 */
export async function buildSocialNetworkPackZip(imageSrc, opts) {
  const {
    zone,
    alternateZones = [],
    showBlockedOverlay = true,
    showTitleGuides = true,
    exportWidthPx = 1080,
  } = opts

  const zip = new JSZip()
  const folder = zip.folder('scriptor-social-pack')

  for (const formatId of SOCIAL_PACK_FORMAT_IDS) {
    const { zone: adjusted } = analyzeSafeZoneReposition(zone, formatId)
    const blob = await renderSocialMaskPreviewBlob(
      imageSrc,
      {
        formatId,
        zone,
        zoneAdjusted: adjusted,
        alternateZones,
        showBlockedOverlay,
        showTitleGuides,
      },
      exportWidthPx,
    )
    folder.file(`${formatId}.png`, blob)
  }

  const readme =
    'Scriptor — pack aperçus réseaux (Brique 4)\n' +
    'Un fichier par format ; zones rouges = masques UI approximatifs ; vert = zone titre suggérée ; bleu = repositionnement.\n'
  folder.file('LISEZ-MOI.txt', readme)

  return zip.generateAsync({ type: 'blob' })
}
