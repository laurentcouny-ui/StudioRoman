import JSZip from 'jszip'
import { EPUB_KINDLE_SAFE_SNIPPET } from './epubKindlePreview.js'

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
    for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i)
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
  return 'cover.jpg'
}

const STYLE_BASE = `body{font-family:Georgia,"Times New Roman",serif;line-height:1.5;margin:0.8em 4%;color:#111;}
h1{font-size:1.25em;margin:0.5em 0;}
h2{font-size:1.1em;margin:0.85em 0 0.3em;color:#333;}
p{margin:0 0 0.6em;}
.tome{font-size:0.95em;color:#555;margin-top:1em;font-weight:bold;}
.scene-body{margin-bottom:1em;}
.cover{margin:0;padding:0;text-align:center;}
.cover img{max-width:100%;height:auto;}
.wm{position:fixed;left:0;right:0;top:38%;text-align:center;transform:rotate(-45deg);font-size:0.95rem;color:rgba(90,90,90,0.22);pointer-events:none;z-index:2;}`

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`

function placeholderChapterXhtml(title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head><title>${escapeXml(title)}</title><link rel="stylesheet" href="style.css"/></head>
<body><h1>${escapeXml(title)}</h1><p>—</p></body>
</html>`
}

/** Décodage minimal des entités XML dans un href pour comparaison aux chemins du paquet. */
function decodeXmlAttrHref(href) {
  return String(href)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Hrefs des balises <a> dans le document nav (fragment et URL externes exclus).
 * @param {string} navHtml
 * @returns {string[]}
 */
function extractNavAnchorHrefs(navHtml) {
  const out = []
  const re = /<a\b[^>]*\bhref\s*=\s*"([^"]*)"/gi
  let m
  while ((m = re.exec(navHtml)) !== null) {
    let h = decodeXmlAttrHref(m[1]).trim()
    if (!h) continue
    const lower = h.toLowerCase()
    if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('mailto:')) continue
    if (h.includes('..')) {
      out.push(`__unsafe:${h}`)
      continue
    }
    h = h.split('#')[0].trim()
    if (!h) continue
    out.push(h)
  }
  return out
}

/**
 * @param {string} navHtml
 * @param {Set<string>} oebpsPaths chemins relatifs sous OEBPS
 * @param {string[]} warnings
 */
function validateNavAgainstPackage(navHtml, oebpsPaths, warnings) {
  const hrefs = extractNavAnchorHrefs(navHtml)
  const seenDead = new Set()
  for (const raw of hrefs) {
    if (raw.startsWith('__unsafe:')) {
      const p = raw.slice('__unsafe:'.length)
      warnings.push(`Table des matières (nav) : lien « ${p} » contient « .. » (non pris en charge).`)
      continue
    }
    if (!oebpsPaths.has(raw)) {
      if (seenDead.has(raw)) continue
      seenDead.add(raw)
      warnings.push(
        `Table des matières (nav) : lien mort vers « ${raw} » (fichier absent du paquet OEBPS).`,
      )
    }
  }
}

function defaultNav() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head><title>Navigation</title></head>
<body>
<nav epub:type="toc" id="toc"><h1>Table des matières</h1><ol><li><a href="part-000.xhtml">Début</a></li></ol></nav>
</body>
</html>`
}

/**
 * Construit un conteneur EPUB 3.0 (ZIP) conforme : mimetype en STORED, OEBPS + OPF + nav.
 *
 * @param {object} opts
 * @param {object} [opts.metadata] title, author|creator, language, identifier
 * @param {string} [opts.navXhtml] document nav complet
 * @param {Array<{ id: string, href: string, xhtml?: string, title?: string, properties?: string }>} [opts.spineItems]
 * @param {boolean} [opts.kindleSafeCss]
 * @param {string|null} [opts.coverDataUrl] data URL image couverture (optionnel)
 */
export async function buildEpubZipFromSpec({
  metadata = {},
  navXhtml,
  spineItems = [],
  kindleSafeCss = false,
  coverDataUrl = null,
}) {
  const warnings = []
  const title = String(metadata.title || 'Sans titre').trim() || 'Sans titre'
  const author = String(metadata.author || metadata.creator || '').trim()
  const lang = String(metadata.language || 'fr').trim() || 'fr'
  const uuid =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `id-${Date.now()}`
  const bookId = String(metadata.identifier || `urn:uuid:${uuid}`).trim()

  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.folder('META-INF').file('container.xml', CONTAINER_XML)

  const oebps = zip.folder('OEBPS')
  const css = kindleSafeCss ? `${STYLE_BASE}\n${EPUB_KINDLE_SAFE_SNIPPET}` : STYLE_BASE
  oebps.file('style.css', css)
  if (kindleSafeCss) warnings.push('CSS mode Kindle-safe appliqué (sous-ensemble)')

  const oebpsPaths = new Set(['style.css'])

  const manifestLines = []
  const spineLines = []
  let metaCoverLine = ''

  if (coverDataUrl) {
    const parsed = dataUrlToBytes(coverDataUrl)
    if (parsed?.bytes?.length) {
      const mediaType = parsed.mime || 'image/jpeg'
      const fname = mimeToCoverFilename(mediaType)
      const imgHref = `images/${fname}`
      oebps.folder('images').file(fname, parsed.bytes)
      manifestLines.push(
        `    <item id="cover-image" href="${escapeXml(imgHref)}" media-type="${escapeXml(mediaType)}" properties="cover-image"/>`,
      )
      const coverXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">
<head><title>Couverture</title><link rel="stylesheet" href="style.css"/></head>
<body epub:type="cover">
<div class="cover"><img src="${escapeXml(imgHref)}" alt="Couverture"/></div>
</body>
</html>`
      oebps.file('cover.xhtml', coverXhtml)
      oebpsPaths.add('cover.xhtml')
      oebpsPaths.add(imgHref)
      manifestLines.push(
        '    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>',
      )
      spineLines.push('    <itemref idref="cover"/>')
      metaCoverLine = '    <meta name="cover" content="cover-image"/>\n'
    } else {
      warnings.push(
        'Couverture : data URL illisible ou base64 invalide — image ignorée (vérifiez le fichier source).',
      )
    }
  }

  let items = Array.isArray(spineItems) ? [...spineItems] : []
  if (items.length === 0) {
    warnings.push('Spine vide : chapitre placeholder ajouté')
    items = [{ id: 'part-000', href: 'part-000.xhtml', title }]
  }

  const usedManifestIds = new Set()
  const usedManifestHrefs = new Set()
  manifestLines.forEach((line) => {
    const idM = /id="([^"]+)"/.exec(line)
    const hrefM = /href="([^"]+)"/.exec(line)
    if (idM) usedManifestIds.add(idM[1])
    if (hrefM) usedManifestHrefs.add(hrefM[1])
  })
  usedManifestIds.add('nav')
  usedManifestHrefs.add('nav.xhtml')

  items.forEach((raw, i) => {
    const id = raw.id || `part-${String(i).padStart(3, '0')}`
    const href = raw.href || `part-${String(i).padStart(3, '0')}.xhtml`
    if (usedManifestIds.has(id)) warnings.push(`ID manifest dupliqué « ${id} » — risque d’échec EPUBCheck.`)
    if (usedManifestHrefs.has(href)) warnings.push(`Fichier spine dupliqué « ${href} » — contenu potentiellement écrasé.`)
    usedManifestIds.add(id)
    usedManifestHrefs.add(href)
    const xhtml = raw.xhtml || placeholderChapterXhtml(raw.title || title)
    oebps.file(href, xhtml)
    oebpsPaths.add(href)
    const props = raw.properties ? ` properties="${escapeXml(raw.properties)}"` : ''
    manifestLines.push(
      `    <item id="${escapeXml(id)}" href="${escapeXml(href)}" media-type="application/xhtml+xml"${props}/>`,
    )
    spineLines.push(`    <itemref idref="${escapeXml(id)}"/>`)
  })

  const nav = navXhtml && String(navXhtml).trim() ? String(navXhtml) : defaultNav()
  if (!navXhtml?.trim()) warnings.push('nav.xhtml absent ou vide : navigation minimale générée')

  oebpsPaths.add('nav.xhtml')
  validateNavAgainstPackage(nav, oebpsPaths, warnings)

  oebps.file('nav.xhtml', nav)
  manifestLines.push(
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
  )
  spineLines.push('    <itemref idref="nav" linear="no"/>')

  if (!author) {
    warnings.push(
      'Métadonnée auteur absente (dc:creator) — renseignez l’auteur pour une meilleure diffusion.',
    )
  }

  const dcCreator = author ? `    <dc:creator>${escapeXml(author)}</dc:creator>\n` : ''

  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0" xml:lang="${escapeXml(lang)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${escapeXml(lang)}</dc:language>
${dcCreator}${metaCoverLine}  </metadata>
  <manifest>
${manifestLines.join('\n')}
  </manifest>
  <spine>
${spineLines.join('\n')}
  </spine>
</package>`

  oebps.file('content.opf', opf)

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return { blob, warnings }
}
