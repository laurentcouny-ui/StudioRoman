/**
 * Extrait le texte brut des sources Brique 5 (PDF, EPUB, ZIP contenant EPUB/XHTML)
 * vers src/corrector/database/processed/*.txt
 *
 * Usage (depuis le dossier scriptor/) : node scripts/extract-corrector-sources.mjs
 */
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { join, dirname, basename, extname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import { pdfTextContentToPlainParagraphs } from '../src/import/pdf/reconstructParagraphs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SOURCES = join(ROOT, 'src', 'corrector', 'database', 'sources')
const OUT = join(ROOT, 'src', 'corrector', 'database', 'processed')

const require = createRequire(import.meta.url)
const PDFJS_PKG = dirname(require.resolve('pdfjs-dist/package.json'))
const STANDARD_FONTS_URL = pathToFileURL(join(PDFJS_PKG, 'standard_fonts') + '/').href
const CMAP_URL = pathToFileURL(join(PDFJS_PKG, 'cmaps') + '/').href

function safeName(s) {
  return String(s || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
}

async function walk(dir, acc = []) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walk(p, acc)
    else acc.push(p)
  }
  return acc
}

function extLower(p) {
  const b = basename(p).toLowerCase()
  if (b.endsWith('.epub.epub')) return '.epub'
  return extname(p).toLowerCase()
}

async function setupPdfJs() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
  return pdfjs
}

function pdfDocumentOptions(data) {
  return {
    data,
    useSystemFonts: true,
    standardFontDataUrl: STANDARD_FONTS_URL,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
  }
}

async function extractPdfBuffer(buf, pdfjs) {
  const data = new Uint8Array(buf)
  const pdf = await pdfjs.getDocument(pdfDocumentOptions(data)).promise
  const parts = []
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    parts.push(pdfTextContentToPlainParagraphs(textContent))
  }
  return parts.join('\n\n').trim()
}

async function extractPdfFile(pdfPath, pdfjs) {
  const buf = await readFile(pdfPath)
  return extractPdfBuffer(buf, pdfjs)
}

function htmlToText(html) {
  return String(html)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractEpubFromZipBuffer(buf) {
  const zip = await JSZip.loadAsync(buf)
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir)
  const htmlPaths = names
    .filter((n) => /\.(xhtml|html|htm)$/i.test(n))
    .filter((n) => !/\/(toc|nav|copyright)\b/i.test(n))
    .sort((a, b) => a.localeCompare(b))
  const chunks = []
  for (const n of htmlPaths) {
    const raw = await zip.file(n).async('string')
    const t = htmlToText(raw)
    if (t.length > 80) chunks.push(t)
  }
  return chunks.join('\n\n').trim()
}

async function extractZipFile(zipPath, pdfjs) {
  const buf = await readFile(zipPath)
  const zip = await JSZip.loadAsync(buf)
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir)
  const epubInner = names.find((n) => n.toLowerCase().endsWith('.epub'))
  if (epubInner) {
    const inner = await zip.file(epubInner).async('uint8array')
    return extractEpubFromZipBuffer(inner)
  }
  const pdfInner = names.filter((n) => n.toLowerCase().endsWith('.pdf'))
  if (pdfInner.length === 1) {
    const inner = await zip.file(pdfInner[0]).async('uint8array')
    return extractPdfBuffer(inner, pdfjs)
  }
  if (pdfInner.length > 1) {
    const chunks = []
    for (const n of pdfInner.sort((a, b) => a.localeCompare(b))) {
      const inner = await zip.file(n).async('uint8array')
      chunks.push(await extractPdfBuffer(inner, pdfjs))
    }
    return chunks.join('\n\n\n').trim()
  }
  const fb2Inner = names.find((n) => n.toLowerCase().endsWith('.fb2'))
  if (fb2Inner) {
    const raw = await zip.file(fb2Inner).async('string')
    return htmlToText(raw)
  }
  const htmlPaths = names
    .filter((n) => /\.(xhtml|html|htm)$/i.test(n))
    .sort((a, b) => a.localeCompare(b))
  if (htmlPaths.length > 0) {
    const chunks = []
    for (const n of htmlPaths) {
      const raw = await zip.file(n).async('string')
      chunks.push(htmlToText(raw))
    }
    return chunks.join('\n\n').trim()
  }
  const txtPaths = names.filter((n) => /\.(txt|text|md|markdown)$/i.test(n))
  if (txtPaths.length > 0) {
    const chunks = []
    for (const n of txtPaths.sort((a, b) => a.localeCompare(b))) {
      chunks.push((await zip.file(n).async('string')).trim())
    }
    return chunks.join('\n\n\n').trim()
  }
  const xmlPaths = names.filter(
    (n) =>
      /\.xml$/i.test(n) &&
      !/\/(META-INF|mimetype|encryption|rights)\b/i.test(n) &&
      !/\.(rels|opf)$/i.test(n),
  )
  if (xmlPaths.length > 0) {
    const chunks = []
    for (const n of xmlPaths.sort((a, b) => a.localeCompare(b))) {
      const raw = await zip.file(n).async('string')
      const t = htmlToText(raw)
      if (t.length > 200) chunks.push(t)
    }
    if (chunks.length) return chunks.join('\n\n').trim()
  }
  const sorted = [...names].sort()
  return `--- contenu ZIP (aucun PDF/EPUB/HTML/FB2/TXT exploitable automatiquement) ---\n${sorted.join('\n')}`
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const pdfjs = await setupPdfJs()
  const all = await walk(SOURCES)
  const targets = all.filter((p) => {
    const ext = extLower(p)
    return ext === '.pdf' || ext === '.epub' || ext === '.zip'
  })

  const manifest = {
    generatedAt: new Date().toISOString(),
    outputs: [],
    errors: [],
  }

  let idx = 0
  for (const filePath of targets) {
    const rel = relative(SOURCES, filePath)
    const ext = extLower(filePath)
    const outName = `${String(idx).padStart(2, '0')}_${safeName(rel.replace(/[/\\]/g, '__'))}.txt`
    const outPath = join(OUT, outName)
    idx += 1
    try {
      let text = ''
      if (ext === '.pdf') {
        text = await extractPdfFile(filePath, pdfjs)
      } else if (ext === '.epub') {
        const buf = await readFile(filePath)
        text = await extractEpubFromZipBuffer(buf)
      } else if (ext === '.zip') {
        text = await extractZipFile(filePath, pdfjs)
      }
      const header = `--- source: ${rel}\n--- bytes: ${(await stat(filePath)).size}\n\n`
      await writeFile(outPath, header + (text || '(vide)'), 'utf8')
      manifest.outputs.push({
        source: rel,
        out: relative(ROOT, outPath).replace(/\\/g, '/'),
        chars: text.length,
      })
      console.log('OK', rel, '->', outName, `(${text.length} chars)`)
    } catch (e) {
      manifest.errors.push({ source: rel, error: String(e.message || e) })
      console.error('ERR', rel, e)
    }
  }

  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  console.log('Manifest:', join(OUT, 'manifest.json'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
