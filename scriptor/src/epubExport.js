import JSZip from 'jszip'
import {
  getCurrentSaga,
  loadSceneText,
  sanitizeSceneHtml,
  stripHtml,
} from './projectStore.js'

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function dataUrlToBytes(dataUrl) {
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl)
  if (!m) return null
  const mime = m[1].split(';')[0].trim()
  const b64 = m[2].replace(/\s/g, '')
  try {
    const binary = atob(b64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
    return { mime, bytes }
  } catch {
    return null
  }
}

function mimeToCoverFilename(mime) {
  const m = (mime || '').toLowerCase()
  if (m === 'image/jpeg' || m === 'image/jpg') return 'cover.jpg'
  if (m === 'image/png') return 'cover.png'
  if (m === 'image/gif') return 'cover.gif'
  if (m === 'image/webp') return 'cover.webp'
  if (m === 'image/svg+xml') return 'cover.svg'
  if (m === 'image/bmp') return 'cover.bmp'
  if (m === 'image/tiff' || m === 'image/x-tiff') return 'cover.tif'
  return 'cover.bin'
}

function sceneBodyToXhtml(html) {
  const h = sanitizeSceneHtml(html || '').trim()
  if (!h) return '<p></p>'
  return h
    .replace(/<br\s*\/?>/gi, '<br />')
    .replace(/<hr\s*\/?>/gi, '<hr />')
}

function fallbackBodyFromText(html) {
  const t = stripHtml(html || '').trim()
  if (!t) return '<p></p>'
  return t
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeXml(p)}</p>`)
    .join('\n')
}

function wrapChapterXhtml(title, inner, useWatermark, watermarkText) {
  const wm =
    useWatermark && String(watermarkText).trim()
      ? `<div class="wm" aria-hidden="true">${escapeXml(String(watermarkText).trim())}</div>`
      : ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" href="style.css"/>
</head>
<body>
${wm}
${inner}
</body>
</html>`
}

const EPUB_STYLE = `body{font-family:Georgia,serif;line-height:1.5;margin:0.8em 4%;color:#111;}
h1{font-size:1.35em;margin:0.6em 0 0.4em;}
h2{font-size:1.15em;margin:1em 0 0.35em;color:#333;}
h3{font-size:1.05em;margin:0.9em 0 0.3em;font-style:italic;}
p{margin:0 0 0.65em;}
.tome{font-size:0.95em;color:#555;margin-top:1.8em;font-weight:bold;}
.scene-body{margin-bottom:1em;}
.cover{margin:0;padding:0;text-align:center;}
.cover img{max-width:100%;height:auto;}
.wm{position:fixed;left:0;right:0;top:38%;text-align:center;transform:rotate(-45deg);font-size:0.95rem;color:rgba(90,90,90,0.22);pointer-events:none;z-index:2;}`

function collectManuscriptChapters(project, useWatermark, watermarkText) {
  const saga = getCurrentSaga(project)
  if (!saga?.volumes?.length) return null
  let itemCounter = 0
  const chapters = []
  saga.volumes.forEach((vol, vi) => {
    vol.chapters?.forEach((ch, ci) => {
      const chTitle = ch.title || `Chapitre ${ci + 1}`
      const idx = itemCounter
      const href = `chap-${String(idx).padStart(3, '0')}.xhtml`
      const parts = []
      parts.push(`<p class="tome">${escapeXml(vol.title || `Tome ${vi + 1}`)}</p>`)
      parts.push(`<h1>${escapeXml(chTitle)}</h1>`)
      ch.scenes?.forEach((scene) => {
        parts.push(`<h2>${escapeXml(scene.title?.trim() || 'Scène')}</h2>`)
        const raw = loadSceneText(scene.id) || ''
        let body
        try {
          body = `<div class="scene-body">${sceneBodyToXhtml(raw)}</div>`
        } catch {
          body = `<div class="scene-body">${fallbackBodyFromText(raw)}</div>`
        }
        parts.push(body)
      })
      chapters.push({
        id: `ch-${idx}`,
        href,
        navLabel: `${vol.title || `Tome ${vi + 1}`} — ${chTitle}`,
        xhtml: wrapChapterXhtml(
          chTitle,
          parts.join('\n'),
          useWatermark,
          watermarkText,
        ),
      })
      itemCounter += 1
    })
  })
  if (chapters.length === 0) return null
  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}`
  const bookId = `urn:uuid:${uuid}`
  return { saga, chapters, bookId }
}

/**
 * Données pour le pipeline print `exportEpub3` / `buildEpubZipFromSpec` (même contenu que buildManuscriptEpubBlob).
 */
export function buildEpub3ManuscriptPayload(project, options = {}) {
  const { useWatermark = false, watermarkText = '', author = '' } = options
  const collected = collectManuscriptChapters(project, useWatermark, watermarkText)
  if (!collected) return null
  const { saga, chapters, bookId } = collected
  const title = saga.title || 'Manuscrit'
  const lang = 'fr'
  const navLinks = []
  if (options.coverDataUrl) {
    const parsed = dataUrlToBytes(options.coverDataUrl)
    if (parsed?.bytes?.length) navLinks.push(`<li><a href="cover.xhtml">Couverture</a></li>`)
  }
  chapters.forEach((ch) => {
    navLinks.push(`<li><a href="${escapeXml(ch.href)}">${escapeXml(ch.navLabel)}</a></li>`)
  })
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
  <title>Navigation</title>
</head>
<body>
<nav epub:type="toc" id="toc">
  <h1>Table des matières</h1>
  <ol>
${navLinks.map((l) => `    ${l}`).join('\n')}
  </ol>
</nav>
</body>
</html>`
  const spineItems = chapters.map((ch) => ({
    id: ch.id,
    href: ch.href,
    xhtml: ch.xhtml,
  }))
  return {
    metadata: {
      title,
      author,
      language: lang,
      identifier: bookId,
    },
    navXhtml,
    spineItems,
    coverDataUrl: options.coverDataUrl || null,
  }
}

/**
 * EPUB 3 avec couverture optionnelle, navigation, filigrane texte optionnel sur les chapitres (pas sur la couverture).
 */
export async function buildManuscriptEpubBlob(project, options = {}) {
  const {
    coverDataUrl = null,
    useWatermark = false,
    watermarkText = '',
    author = '',
  } = options

  const collected = collectManuscriptChapters(project, useWatermark, watermarkText)
  if (!collected) return null

  const { saga, chapters, bookId } = collected
  const title = saga.title || 'Manuscrit'
  const lang = 'fr'

  const zip = new JSZip()

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })

  zip.folder('META-INF').file(
    'container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  )

  const oebps = zip.folder('OEBPS')
  oebps.file('style.css', EPUB_STYLE)

  const manifestItems = []
  const spineIds = []
  const addManifest = (id, href, mediaType, properties) => {
    manifestItems.push({ id, href, mediaType, properties })
  }

  let coverImageHref = null
  let coverImageId = null
  let coverImageMedia = null

  if (coverDataUrl) {
    const parsed = dataUrlToBytes(coverDataUrl)
    if (parsed?.bytes?.length) {
      coverImageMedia = parsed.mime || 'image/jpeg'
      const fname = mimeToCoverFilename(coverImageMedia)
      coverImageHref = `images/${fname}`
      coverImageId = 'cover-image'
      oebps.folder('images').file(fname, parsed.bytes)
      addManifest(coverImageId, coverImageHref, coverImageMedia, 'cover-image')

      const coverXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head><title>Couverture</title><link rel="stylesheet" href="style.css"/></head>
<body epub:type="cover">
<div class="cover"><img src="${escapeXml(coverImageHref)}" alt="Couverture"/></div>
</body>
</html>`
      oebps.file('cover.xhtml', coverXhtml)
      addManifest('cover', 'cover.xhtml', 'application/xhtml+xml')
      spineIds.push('cover')
    }
  }

  chapters.forEach((ch) => {
    oebps.file(ch.href, ch.xhtml)
    addManifest(ch.id, ch.href, 'application/xhtml+xml')
    spineIds.push(ch.id)
  })

  const navLinks = []
  if (coverDataUrl && coverImageHref) {
    navLinks.push(`<li><a href="cover.xhtml">Couverture</a></li>`)
  }
  chapters.forEach((ch) => {
    navLinks.push(`<li><a href="${escapeXml(ch.href)}">${escapeXml(ch.navLabel)}</a></li>`)
  })

  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head>
  <title>Navigation</title>
</head>
<body>
<nav epub:type="toc" id="toc">
  <h1>Table des matières</h1>
  <ol>
${navLinks.map((l) => `    ${l}`).join('\n')}
  </ol>
</nav>
</body>
</html>`

  oebps.file('nav.xhtml', navXhtml)
  addManifest('nav', 'nav.xhtml', 'application/xhtml+xml', 'nav')
  spineIds.push('nav')

  const manifestXml = manifestItems
    .map((it) => {
      const props = it.properties ? ` properties="${it.properties}"` : ''
      return `    <item id="${escapeXml(it.id)}" href="${escapeXml(it.href)}" media-type="${escapeXml(it.mediaType)}"${props}/>`
    })
    .join('\n')

  const spineXml = spineIds.map((id) => `    <itemref idref="${escapeXml(id)}"/>`).join('\n')

  const metaCoverLine =
    coverImageId && coverImageHref
      ? `    <meta name="cover" content="${escapeXml(coverImageId)}"/>\n`
      : ''

  const dcCreator = author.trim() ? `    <dc:creator>${escapeXml(author.trim())}</dc:creator>\n` : ''

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${lang}</dc:language>
${dcCreator}${metaCoverLine}  </metadata>
  <manifest>
${manifestXml}
  </manifest>
  <spine>
${spineXml}
  </spine>
</package>`

  oebps.file('content.opf', opf)

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}
