export function layoutAstToPdfMakeDoc(layoutAst) {
  const pages = (layoutAst?.pages || []).map((p) => {
    if (p.type === 'blank') return { text: '', pageBreak: 'after' }
    const text = (p.lines || []).map((l) => l.text || '').join('\n')
    return { text, pageBreak: 'after' }
  })
  return {
    content: pages,
    info: {
      title: 'Apercu approximatif',
      subject: 'Aperçu approximatif',
    },
    metadata: {
      scriptorPreviewLabel: 'Aperçu approximatif',
      layoutContext: layoutAst?.layoutContext || null,
    },
  }
}
