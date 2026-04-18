/** Détection FR : > 40 % mots outils OU > 30 % caractères accentués (CDC). */
const STOP = new Set(
  'le la les un une des et ou mais donc car dans sur pour par avec sans sous comme'.split(' '),
)

export function detectFrench(text) {
  const raw = String(text || '')
  if (!raw.trim()) return 'und'
  const words = raw.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return 'und'
  let stop = 0
  for (const w of words) {
    const t = w.replace(/[^\p{L}]/gu, '')
    if (STOP.has(t)) stop += 1
  }
  const ratioStop = stop / words.length
  const acc = (raw.match(/[àâäéèêëïîôùûç]/gi) || []).length
  const ratioAcc = acc / Math.max(raw.length, 1)
  if (ratioStop > 0.4 || ratioAcc > 0.3) return 'fr'
  return 'und'
}
