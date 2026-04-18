/** AST immuable logique : un nœud par chapitre / scène avec hash de contenu. */

function simpleHash(str) {
  let h = 0
  const s = String(str ?? '')
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return `h${(h >>> 0).toString(16)}`
}

function fingerprintContext(text, context = '') {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  const slice = t.slice(0, 80)
  return simpleHash(`${context}|${slice}`)
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `n-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** @param {object} parsed - résultat parseImportedText */
export function buildAstFromParsed(parsed) {
  const rootChildren = []
  for (const ch of parsed.chapters || []) {
    const chId = newId()
    const chNode = {
      id: chId,
      hash: simpleHash(ch.title),
      fingerprint: fingerprintContext(ch.title, 'chapter'),
      type: 'chapter',
      content: ch.title || '',
      detectionScore: 85,
      detectionMethod: 'import-heading',
      formatting: [],
      children: [],
    }
    for (const sc of ch.scenes || []) {
      const scId = newId()
      const text = sc.text || ''
      const scNode = {
        id: scId,
        hash: simpleHash(text),
        fingerprint: fingerprintContext(text, 'scene'),
        type: 'scene',
        content: text,
        detectionScore: 90,
        detectionMethod: 'import-scene',
        formatting: [],
        children: [],
      }
      chNode.children.push(scNode)
    }
    rootChildren.push(chNode)
  }
  const rootHash = simpleHash(JSON.stringify(rootChildren.map((n) => n.hash)))
  return {
    rootHash,
    nodes: rootChildren,
    volumeTitle: parsed.volumeTitle || 'Import',
  }
}
