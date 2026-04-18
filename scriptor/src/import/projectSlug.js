/**
 * Aligné sur `sanitize_project_name` (Rust, storage_fs) pour que le préflight
 * cible le même dossier que `Documents/Scriptor/<slug>/`.
 */
export function sanitizeProjectSlug(raw) {
  let s = String(raw ?? '')
    .trim()
    .replace(/[\\/:*?"<>|@]/g, '-')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e')
    .replace(/ê/g, 'e')
  while (s.includes('--')) {
    s = s.replace('--', '-')
  }
  s = s.replace(/^-+|-+$/g, '')
  return s || 'Projet'
}

export function deriveProjectSlugFromProject(project) {
  try {
    const sagas = Array.isArray(project?.sagas) ? project.sagas : []
    const cur = sagas.find((s) => s?.id === project?.currentSagaId) || sagas[0]
    const title = String(cur?.title || '').trim()
    return sanitizeProjectSlug(title)
  } catch {
    return 'Projet'
  }
}
