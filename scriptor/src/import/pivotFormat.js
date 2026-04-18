/**
 * Format pivot Brique 3 : **gras** *italique* __souligné__ {note: "..."} [toc]
 */

function walkInline(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (node.nodeType !== Node.ELEMENT_NODE) return ''
  const tag = node.tagName.toLowerCase()
  const inner = [...node.childNodes].map(walkInline).join('')
  if (tag === 'strong' || tag === 'b') return `**${inner}**`
  if (tag === 'em' || tag === 'i') return `*${inner}*`
  if (tag === 'u') return `__${inner}__`
  if (tag === 'br') return '\n'
  if (tag === 'img') return '[image_ref]'
  return inner
}

export function elementToPivotText(el) {
  if (!el) return ''
  return walkInline(el).trim()
}

/** HTML complet (mammoth) → texte avec marqueurs de chapitre `##` pour `parseImportedText`. */
export function docxHtmlToChapterPlain(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const parts = []
  for (const el of doc.body.querySelectorAll('h1, h2, h3, p')) {
    const t = el.tagName.toLowerCase()
    if (t === 'h1' || t === 'h2' || t === 'h3') {
      const title = el.textContent.trim() || 'Sans titre'
      parts.push(`## ${title}`)
    } else {
      const block = elementToPivotText(el)
      if (block) parts.push(block)
    }
  }
  if (parts.length === 0) {
    return elementToPivotText(doc.body)
  }
  return parts.join('\n\n')
}
