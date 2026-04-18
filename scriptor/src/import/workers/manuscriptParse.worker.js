/**
 * Worker : mammoth (docx) + pdf.js (pdf) — ne bloque pas le thread UI.
 */
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { pdfTextContentToPlainParagraphs } from '../pdf/reconstructParagraphs.js'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

self.onmessage = async (ev) => {
  const { id, kind, arrayBuffer } = ev.data || {}
  if (!id || !kind || !arrayBuffer) {
    self.postMessage({ id: id || 'x', type: 'error', message: 'message worker invalide' })
    return
  }
  try {
    if (kind === 'docx') {
      self.postMessage({ id, type: 'progress', value: 10 })
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer })
      self.postMessage({ id, type: 'progress', value: 95 })
      self.postMessage({ id, type: 'done', html: html || '' })
      return
    }
    if (kind === 'pdf') {
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const n = pdf.numPages || 0
      if (n === 0) {
        self.postMessage({ id, type: 'done', plain: '' })
        return
      }
      const parts = []
      for (let i = 1; i <= n; i += 1) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        parts.push(pdfTextContentToPlainParagraphs(textContent))
        const pct = 5 + Math.round((i / Math.max(n, 1)) * 90)
        self.postMessage({ id, type: 'progress', value: pct })
      }
      self.postMessage({ id, type: 'done', plain: parts.join('\n\n').trim() })
      return
    }
    self.postMessage({ id, type: 'error', message: `kind inconnu: ${kind}` })
  } catch (e) {
    self.postMessage({
      id,
      type: 'error',
      message: String(e?.message || e),
    })
  }
}
