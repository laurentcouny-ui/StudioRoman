/**
 * Diff simple caractère à caractère pour surlignage (bleu typo / vert structure / rouge suppression).
 */

export function buildDiffSpans(original, modified, { typo = true } = {}) {
  const a = String(original ?? '')
  const b = String(modified ?? '')
  const out = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      out.push({ ch: a[i], kind: 'same' })
      i += 1
      j += 1
    } else if (j < b.length && (i >= a.length || a[i] !== b[j])) {
      const kind = typo ? 'typo' : 'structure'
      out.push({ ch: b[j], kind })
      j += 1
    } else if (i < a.length) {
      out.push({ ch: a[i], kind: 'delete' })
      i += 1
    } else {
      break
    }
  }
  return out
}

export function spansToHtml(spans) {
  return spans
    .map((s) => {
      const cls =
        s.kind === 'typo'
          ? 'import-diff-typo'
          : s.kind === 'structure'
            ? 'import-diff-structure'
            : s.kind === 'delete'
              ? 'import-diff-delete'
              : ''
      const esc = String(s.ch)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      return cls ? `<span class="${cls}">${esc}</span>` : esc
    })
    .join('')
}
