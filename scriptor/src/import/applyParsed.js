import { generatePatchesForText, applyTypoPatchesToString } from './patches/generate.js'

/** Applique les corrections typographiques (copie) sur une structure parseImportedText. */
export function applyTypoGroupsToParsed(parsed, groups) {
  const next = JSON.parse(JSON.stringify(parsed))
  for (const ch of next.chapters || []) {
    for (const sc of ch.scenes || []) {
      const t = sc.text || ''
      const { patches } = generatePatchesForText(t, groups, { targetNodeId: sc.id || 'scene' })
      sc.text = applyTypoPatchesToString(t, patches)
    }
  }
  return next
}
