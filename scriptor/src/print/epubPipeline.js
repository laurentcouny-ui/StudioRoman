import { buildEpub3ManuscriptPayload } from '../epubExport.js'
import { buildEpubZipFromSpec } from './epubZipFromSpec.js'

/**
 * Même contenu que `buildManuscriptEpubBlob`, mais en passant par `buildEpubZipFromSpec`
 * (pipeline Brique 4 / exportEpub3).
 */
export async function exportManuscriptViaPrintEpub3Pipeline(project, options = {}) {
  const payload = buildEpub3ManuscriptPayload(project, options)
  if (!payload) return null

  const { blob, warnings } = await buildEpubZipFromSpec({
    metadata: payload.metadata,
    navXhtml: payload.navXhtml,
    spineItems: payload.spineItems,
    coverDataUrl: payload.coverDataUrl,
    kindleSafeCss: Boolean(options.kindleSafeCss),
  })

  return {
    blob,
    report: {
      pipeline: 'print-epub3',
      warnings,
      kindleSafeCss: Boolean(options.kindleSafeCss),
      metadata: payload.metadata,
    },
  }
}
