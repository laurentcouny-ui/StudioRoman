/**
 * Phase 2 CDC — détection de personnages à la sauvegarde explicite (pas en temps réel).
 * Appelle le backend uniquement si le texte a une taille minimale.
 */
const MIN_CHARS = 40

function stripHtml(html) {
  if (!html || typeof html !== 'string') return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseDetectedNames(raw) {
  if (!raw || typeof raw !== 'string') return []
  const cleaned = raw
    .replace(/^Absents détectés\s*:\s*/i, '')
    .replace(/\r/g, '\n')
    .replace(/\n+/g, ',')
  return cleaned
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^aucun$/i.test(s))
}

/**
 * @param {string} sceneHtmlOrText — contenu de la scène (souvent HTML éditeur)
 * @returns {Promise<string[]>} liste de noms détectés (peut être vide)
 */
export async function requestCharacterDetectionOnSave(sceneHtmlOrText) {
  const plain = stripHtml(sceneHtmlOrText)
  if (plain.length < MIN_CHARS) return []

  try {
    const res = await fetch('/api/v1/ia/characters/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
      body: JSON.stringify({ sceneText: plain }),
    })
    if (!res.ok) return []
    const out = await res.text()
    if (out && out.trim()) {
      const names = parseDetectedNames(out)
      if (names.length > 0) {
        console.info('[Scriptor IA] Personnages détectés (scène) :', names.join(', '))
      }
      return names
    }
    return []
  } catch {
    /* backend arrêté ou hors ligne : silencieux */
    return []
  }
}
