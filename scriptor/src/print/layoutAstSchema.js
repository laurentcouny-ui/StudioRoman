/**
 * Contrat minimal des glyph runs produits par `PaginationOrchestrator` (export JSON / PDF).
 * Le CDC externe peut étendre la liste ; les champs ci-dessous sont toujours présents pour le texte courant.
 */
export const LAYOUT_AST_SCHEMA_VERSION = '1.0.0'

/** Champs émis sur chaque entrée de `line.glyphRuns[]` (profil print). */
export const GLYPH_RUN_FIELDS = [
  'glyphId',
  'cluster',
  'x',
  'y',
  'advance',
  'fontId',
  'fontSize',
  'ascent',
  'descent',
]
