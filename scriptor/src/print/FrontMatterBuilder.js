function safe(v) {
  return String(v || '').trim()
}

export function buildFrontMatterPages({
  title,
  author,
  isbn,
  legalNotice,
  dedication,
  acknowledgements,
  tocItems = [],
}) {
  const pages = []
  pages.push({
    type: 'title',
    content: `${safe(title)}\n\n${safe(author)}`,
  })
  pages.push({
    type: 'copyright',
    content: [safe(legalNotice), isbn ? `ISBN: ${isbn}` : ''].filter(Boolean).join('\n'),
  })
  if (safe(dedication)) pages.push({ type: 'dedication', content: safe(dedication) })
  if (safe(acknowledgements))
    pages.push({ type: 'acknowledgements', content: safe(acknowledgements) })
  if (tocItems.length > 0) {
    pages.push({
      type: 'toc',
      content: tocItems.map((x, i) => `${i + 1}. ${x}`).join('\n'),
    })
  }
  return pages
}

export function applyFrenchParagraphIndents(text, indentCm = 0.5) {
  const indent = `⟶${Math.max(0, Number(indentCm || 0.5)).toFixed(2)}cm`
  return String(text || '')
    .split(/\n{2,}/)
    .map((p) => {
      const lines = p.split('\n').map((x) => x.trim()).filter(Boolean)
      if (lines.length <= 1) return lines.join('\n')
      return [lines[0], ...lines.slice(1).map((l) => `${indent} ${l}`)].join('\n')
    })
    .join('\n\n')
}

