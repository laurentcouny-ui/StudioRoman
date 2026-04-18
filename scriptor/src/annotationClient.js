function sanitizeTag(tag) {
  const t = String(tag || '').trim().toLowerCase()
  if (t === 'pas satisfait' || t === 'a developper' || t === 'à développer' || t === 'idee ici' || t === 'idée ici') {
    return t
      .replace('a developper', 'à développer')
      .replace('idee ici', 'idée ici')
  }
  return ''
}

/**
 * Enregistre une annotation utilisateur (non bloquant, échec silencieux).
 * Structure attendue backend : { debut, fin, tag, timestamp }.
 */
export async function createAnnotation(payload) {
  const tag = sanitizeTag(payload?.tag)
  const debut = Number(payload?.debut ?? -1)
  const fin = Number(payload?.fin ?? -1)
  if (!tag || !Number.isFinite(debut) || !Number.isFinite(fin) || fin <= debut) return

  try {
    const res = await fetch('/api/v1/ia/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        debut,
        fin,
        tag,
        timestamp: Number(payload?.timestamp ?? Date.now()),
      }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    // backend absent / offline : on garde l'éditeur fluide, pas d'erreur bloquante
    return null
  }
}

export async function deleteAnnotationById(annotationId) {
  const id = String(annotationId || '').trim()
  if (!id) return
  try {
    await fetch(`/api/v1/ia/annotations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
    })
  } catch {
    // silencieux
  }
}
