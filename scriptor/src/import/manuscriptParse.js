/**
 * Orchestration : lecture chunkée (optionnelle) + worker parse (docx / pdf).
 * Conversion pivot docx sur le thread principal (DOMParser).
 */
import { docxHtmlToChapterPlain } from './pivotFormat.js'
import { readFileAsArrayBufferChunked } from './io/readFileChunked.js'
import { pdfTextContentToPlainParagraphs } from './pdf/reconstructParagraphs.js'

function runParseWorker(arrayBuffer, kind, onProgress) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const worker = new Worker(new URL('./workers/manuscriptParse.worker.js', import.meta.url), {
      type: 'module',
    })
    const onMsg = (ev) => {
      const d = ev.data
      if (!d || d.id !== id) return
      if (d.type === 'progress') {
        const p = typeof d.value === 'number' ? d.value : 0
        onProgress?.(p)
        return
      }
      if (d.type === 'done') {
        worker.removeEventListener('message', onMsg)
        worker.terminate()
        resolve(d)
        return
      }
      if (d.type === 'error') {
        worker.removeEventListener('message', onMsg)
        worker.terminate()
        reject(new Error(d.message || 'Erreur worker'))
      }
    }
    worker.addEventListener('message', onMsg)
    worker.addEventListener('error', (err) => {
      worker.removeEventListener('message', onMsg)
      worker.terminate()
      reject(err.error || new Error(String(err.message)))
    })
    try {
      worker.postMessage({ id, kind, arrayBuffer }, [arrayBuffer])
    } catch (e) {
      worker.removeEventListener('message', onMsg)
      worker.terminate()
      reject(e)
    }
  })
}

async function extractDocxMain(arrayBuffer) {
  const mammoth = await import('mammoth')
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer })
  const plain = docxHtmlToChapterPlain(html)
  return { html, plain }
}

async function extractPdfMain(arrayBuffer) {
  const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs')
  const { default: workerSrc } = await import('pdfjs-dist/build/pdf.worker.mjs?url')
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const parts = []
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    parts.push(pdfTextContentToPlainParagraphs(textContent))
  }
  return parts.join('\n\n').trim()
}

/**
 * Parse docx/pdf depuis un ArrayBuffer déjà chargé (ex. après hash) — transfère au worker.
 * @param {'docx'|'pdf'} kind
 * @param {(percent: number) => void} [onProgress] 0–100 sur la phase parse uniquement
 */
export async function extractManuscriptFromArrayBuffer(arrayBuffer, kind, onProgress) {
  if (typeof Worker === 'undefined') {
    onProgress?.(30)
    if (kind === 'docx') {
      const r = await extractDocxMain(arrayBuffer)
      onProgress?.(100)
      return r
    }
    const plain = await extractPdfMain(arrayBuffer)
    onProgress?.(100)
    return { html: '', plain }
  }

  const result = await runParseWorker(arrayBuffer, kind, onProgress)
  if (kind === 'docx') {
    const html = result.html || ''
    const plain = docxHtmlToChapterPlain(html)
    onProgress?.(100)
    return { html, plain }
  }
  onProgress?.(100)
  return { html: '', plain: result.plain || '' }
}

/**
 * @param {File} file
 * @param {'docx'|'pdf'} kind
 * @param {(percent: number) => void} [onProgress] 0–100 (lecture + parse)
 */
export async function extractManuscriptWithWorker(file, kind, onProgress) {
  const buf = await readFileAsArrayBufferChunked(file, (p) => onProgress?.(Math.round(p * 0.35)))
  return extractManuscriptFromArrayBuffer(buf, kind, (p) =>
    onProgress?.(35 + Math.round(p * 0.65)),
  )
}
