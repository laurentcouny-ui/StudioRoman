/**
 * Word .docx → HTML (mammoth) → texte structuré pour `parseImportedText`.
 */

import { docxHtmlToChapterPlain } from './pivotFormat.js'

export async function extractDocxArrayBuffer(arrayBuffer) {
  const mammoth = await import('mammoth')
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer })
  const plain = docxHtmlToChapterPlain(html)
  return { html, plain }
}
