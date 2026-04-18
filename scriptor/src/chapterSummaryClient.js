import { loadSceneText } from './projectStore.js'

function stripHtml(html) {
  if (!html || typeof html !== 'string') return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildChapterPlainText(chapter) {
  if (!chapter?.scenes || !Array.isArray(chapter.scenes)) return ''
  const parts = []
  for (const sc of chapter.scenes) {
    const title = String(sc?.title || '').trim()
    const raw = loadSceneText(sc?.id) || sc?.text || ''
    const plain = stripHtml(raw)
    if (!plain) continue
    parts.push(title ? `${title}\n${plain}` : plain)
  }
  return parts.join('\n\n')
}

/**
 * Résumé de chapitre à la sauvegarde explicite (CDC) ; renvoie null si pas exploitable.
 */
export async function requestChapterSummaryOnSave(chapter) {
  const chapterText = buildChapterPlainText(chapter)
  if (!chapterText || chapterText.length < 80) return null

  try {
    const res = await fetch('/api/v1/ia/summary/chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ chapterText }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const summary = String(data?.summary || '').trim()
    return summary || null
  } catch {
    return null
  }
}
