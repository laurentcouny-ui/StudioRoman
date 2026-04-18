import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
} from 'docx'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfVfs from 'pdfmake/build/vfs_fonts'
import {
  getCurrentSaga,
  loadSceneText,
  sanitizeSceneHtml,
  stripHtml,
} from './projectStore.js'

let pdfFontsRegistered = false

function ensurePdfFonts() {
  if (pdfFontsRegistered) return
  if (pdfMake && typeof pdfMake.addVirtualFileSystem === 'function') {
    const vfs = pdfVfs?.default ?? pdfVfs
    pdfMake.addVirtualFileSystem(vfs)
    pdfFontsRegistered = true
  }
}

/**
 * Paragraphes Word à partir du HTML d’une scène (blocs <p>, sinon sauts <br> / lignes).
 */
function sceneHtmlToDocxParagraphs(html) {
  const clean = sanitizeSceneHtml(html || '').trim()
  const paras = []
  if (!clean) {
    return [new Paragraph({ text: '' })]
  }
  if (typeof DOMParser === 'undefined') {
    stripHtml(clean)
      .split(/\n\s*\n+/)
      .forEach((block) => {
        const t = block.trim()
        if (t) paras.push(new Paragraph(t))
      })
    return paras.length ? paras : [new Paragraph('')]
  }
  const hdoc = new DOMParser().parseFromString(
    `<div id="scriptor-scene-wrap">${clean}</div>`,
    'text/html',
  )
  const wrap = hdoc.getElementById('scriptor-scene-wrap')
  if (!wrap) {
    return [new Paragraph(stripHtml(clean))]
  }
  const pList = wrap.querySelectorAll('p')
  if (pList.length > 0) {
    pList.forEach((p) => {
      const t = p.textContent?.trim()
      if (t) paras.push(new Paragraph(t))
    })
  } else {
    const chunks = clean.split(/<br\s*\/?>/gi)
    chunks.forEach((chunk) => {
      const t = stripHtml(chunk).trim()
      if (t) paras.push(new Paragraph(t))
    })
  }
  if (paras.length === 0) {
    stripHtml(clean)
      .split(/\n+/)
      .forEach((t) => {
        if (t.trim()) paras.push(new Paragraph(t.trim()))
      })
  }
  return paras.length ? paras : [new Paragraph('')]
}

/**
 * Manuscrit .docx structuré (titre saga, tome, chapitre, scène, corps).
 */
export async function buildManuscriptDocxBlob(project) {
  const saga = getCurrentSaga(project)
  if (!saga?.volumes?.length) return null

  const children = []

  children.push(
    new Paragraph({
      text: saga.title || 'Manuscrit',
      heading: HeadingLevel.TITLE,
    }),
  )

  saga.volumes.forEach((vol, vi) => {
    children.push(
      new Paragraph({
        text: vol.title || 'Tome',
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: vi > 0,
      }),
    )
    vol.chapters?.forEach((ch) => {
      children.push(
        new Paragraph({
          text: ch.title || 'Chapitre',
          heading: HeadingLevel.HEADING_2,
        }),
      )
      ch.scenes?.forEach((scene) => {
        children.push(
          new Paragraph({
            text: scene.title?.trim() || 'Scène',
            heading: HeadingLevel.HEADING_3,
          }),
        )
        const raw = loadSceneText(scene.id) || ''
        sceneHtmlToDocxParagraphs(raw).forEach((p) => children.push(p))
      })
    })
  })

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}

/**
 * PDF A4 avec hiérarchie ; couverture image en première page ; filigrane optionnel.
 * @param {{ watermarkText?: string, useWatermark?: boolean, coverDataUrl?: string | null }} options
 */
export function buildManuscriptPdfBlob(project, options = {}) {
  ensurePdfFonts()
  const { watermarkText = '', useWatermark = false, coverDataUrl = null } = options
  const saga = getCurrentSaga(project)
  if (!saga?.volumes?.length) {
    return Promise.resolve(null)
  }

  const content = []
  /** Zone utile A4 avec marges [50,72,50,72] pt → largeur ~495 */
  const innerW = 495
  const innerH = 700

  if (coverDataUrl && String(coverDataUrl).startsWith('data:')) {
    content.push({
      image: coverDataUrl,
      fit: [innerW, innerH],
      alignment: 'center',
      margin: [0, 0, 0, 12],
      pageBreak: 'after',
    })
  }

  const styles = {
    title: { fontSize: 22, bold: true, margin: [0, 0, 0, 14] },
    vol: { fontSize: 17, bold: true, margin: [0, 18, 0, 10] },
    ch: { fontSize: 14, bold: true, margin: [0, 12, 0, 8] },
    sc: { fontSize: 12, bold: true, italics: true, margin: [0, 8, 0, 5] },
    body: {
      fontSize: 11,
      alignment: 'justify',
      lineHeight: 1.35,
      margin: [0, 0, 0, 7],
    },
  }

  content.push({ text: saga.title || 'Manuscrit', style: 'title' })

  saga.volumes.forEach((vol, vi) => {
    if (vi > 0) {
      content.push({ text: '', pageBreak: 'before' })
    }
    content.push({ text: vol.title || 'Tome', style: 'vol' })
    vol.chapters?.forEach((ch) => {
      content.push({ text: ch.title || 'Chapitre', style: 'ch' })
      ch.scenes?.forEach((scene) => {
        content.push({
          text: scene.title?.trim() || 'Scène',
          style: 'sc',
        })
        const raw = loadSceneText(scene.id) || ''
        const text = stripHtml(sanitizeSceneHtml(raw) || raw)
          .replace(/[ \t]+\n/g, '\n')
          .trim()
        const blocks = text
          .split(/\n{2,}/)
          .map((t) => t.trim())
          .filter(Boolean)
        if (blocks.length === 0) {
          content.push({ text: '\u00a0', style: 'body' })
        } else {
          blocks.forEach((block) => {
            content.push({ text: block, style: 'body' })
          })
        }
      })
    })
  })

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [50, 72, 50, 72],
    content,
    styles,
    defaultStyle: { font: 'Roboto', fontSize: 11 },
  }

  if (useWatermark && String(watermarkText).trim()) {
    docDefinition.watermark = {
      text: String(watermarkText).trim(),
      color: '#888888',
      opacity: 0.12,
      bold: true,
      italics: false,
      fontSize: 11,
      angle: -40,
    }
  }

  return new Promise((resolve, reject) => {
    try {
      if (!pdfMake || typeof pdfMake.createPdf !== 'function') {
        reject(new Error('pdfMake indisponible'))
        return
      }
      pdfMake.createPdf(docDefinition).getBlob((blob) => resolve(blob))
    } catch (e) {
      reject(e)
    }
  })
}

export function manuscriptSafeBasename(project) {
  const saga = getCurrentSaga(project)
  const raw = (saga?.title || 'manuscrit').trim()
  const slug = raw
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return slug || 'manuscrit'
}
