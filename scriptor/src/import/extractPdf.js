/**
 * PDF → texte brut (pdf.js). Regroupement par lignes puis fusion de paragraphes (CDC Brique 3).
 */
import { pdfTextContentToPlainParagraphs } from './pdf/reconstructParagraphs.js'

export async function extractPdfArrayBuffer(arrayBuffer) {
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
