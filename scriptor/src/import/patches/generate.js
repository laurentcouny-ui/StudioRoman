/**
 * Génère des patches (AST non modifié) — groupes CDC simplifiés.
 * Priorité : structure (1) > contenu (2) > cosmétique (3) — ici typo seulement.
 */

import { detectFrench } from './lang.js'

/** @typedef {{ type: string, targetNodeId: string, field: string, operations: Array<{start:number,end:number,replace:string}>, priority: number, diffType: string, anchor?: {before:string,after:string}, applied: boolean }} TypoPatch */

/**
 * @param {string} text
 * @param {{ spaces?: boolean, punct?: boolean, dialogue?: boolean, signals?: boolean }} groups
 */
export function generatePatchesForText(text, groups = {}, options = {}) {
  const g = {
    spaces: !!groups.spaces,
    punct: !!groups.punct,
    dialogue: !!groups.dialogue,
    signals: !!groups.signals,
  }
  const { lang = detectFrench(text) } = options
  /** @type {TypoPatch[]} */
  const out = []
  const nodeId = options.targetNodeId || 'inline'
  const field = 'content'

  const addBatch = (ops, priority, diffType) => {
    if (!ops.length) return
    const before = text.slice(Math.max(0, ops[0].start - 12), ops[0].start).trim()
    const last = ops[ops.length - 1]
    const after = text.slice(last.end, last.end + 12).trim()
    out.push({
      type: 'TYPO_BATCH',
      targetNodeId: nodeId,
      field,
      operations: ops,
      priority,
      diffType,
      anchor: { before, after },
      applied: false,
    })
  }

  if (g.spaces) {
    const ops = []
    const re = /  +/g
    let m
    while ((m = re.exec(text)) !== null) {
      ops.push({ start: m.index, end: m.index + m[0].length, replace: ' ' })
    }
    addBatch(ops, 3, 'typo')
  }

  if (g.punct) {
    const ops = []
    const re = /\.{3}/g
    let m
    while ((m = re.exec(text)) !== null) {
      ops.push({ start: m.index, end: m.index + 3, replace: '…' })
    }
    addBatch(ops, 2, 'typo')
  }

  if (g.dialogue && lang === 'fr') {
    const ops = []
    const re = /"([^"]+)"/g
    let m
    while ((m = re.exec(text)) !== null) {
      ops.push({
        start: m.index,
        end: m.index + m[0].length,
        replace: `«\u00A0${m[1]}\u00A0»`,
      })
    }
    addBatch(ops, 2, 'typo')
  }

  if (g.signals) {
    const re = /\b([A-Z]{2,})\b/g
    let m
    while ((m = re.exec(text)) !== null) {
      if (m[1].length <= 4) {
        out.push({
          type: 'TYPO_BATCH',
          targetNodeId: nodeId,
          field,
          operations: [{ start: m.index, end: m.index + m[0].length, replace: m[0] }],
          priority: 2,
          diffType: 'structure',
          applied: false,
        })
      }
    }
  }

  return { patches: out, lang }
}

/**
 * Applique les patches (copie) sur une chaîne — ne modifie pas l’AST.
 */
export function applyTypoPatchesToString(text, patches) {
  let s = text
  const sorted = [...patches].sort((a, b) => {
    const pa = a.operations?.[0]?.start ?? 0
    const pb = b.operations?.[0]?.start ?? 0
    return pb - pa
  })
  for (const p of sorted) {
    if (p.type !== 'TYPO_BATCH' || !p.operations) continue
    for (const op of [...p.operations].sort((a, b) => b.start - a.start)) {
      s = s.slice(0, op.start) + op.replace + s.slice(op.end)
    }
  }
  return s
}
