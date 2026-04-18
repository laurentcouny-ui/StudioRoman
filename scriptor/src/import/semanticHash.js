/** Empreinte SHA-256 des 50 premiers mots (normalisés) — CDC Brique 3. */

export function joinedPlainFromParsed(parsed) {
  if (!parsed?.chapters?.length) return ''
  const parts = []
  for (const ch of parsed.chapters) {
    for (const sc of ch.scenes || []) {
      parts.push(String(sc.text ?? ''))
    }
  }
  return parts.join('\n\n')
}

export async function semanticFingerprint50(text) {
  const raw = String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  const words = raw.split(' ').filter(Boolean).slice(0, 50)
  const canon = words.join(' ')
  const enc = new TextEncoder().encode(canon)
  const hash = await crypto.subtle.digest('SHA-256', enc)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
