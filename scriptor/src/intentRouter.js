import Fuse from 'fuse.js'
import intentVocabulary from './ThesaurusData/intentVocabulary.json'
import thesaurusData from './thesaurusData.js'

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const FAMILLE_MAP = {
  emotions: thesaurusData.emotions || [],
  etatsPhysiques: thesaurusData.etatsPhysiques || [],
  traitsDeCaractere: thesaurusData.traitsDeCaractere || [],
  conflits: thesaurusData.conflits || [],
  blessuresEmotionnelles: thesaurusData.blessuresEmotionnelles || [],
  dynamiquesRelationnelles: thesaurusData.dynamiquesRelationnelles || [],
  motivations: thesaurusData.motivations || [],
  lieux: thesaurusData.lieux || [],
  atmospheres: thesaurusData.atmospheres || [],
  meteo: thesaurusData.meteo || [],
  elementsSensoriels: thesaurusData.elementsSensoriels || [],
  objetsNarratifs: thesaurusData.objetsNarratifs || [],
  professions: thesaurusData.professions || [],
}

export const FAMILLE_LABELS = {
  emotions: 'Émotions',
  etatsPhysiques: 'États physiques',
  traitsDeCaractere: 'Traits de caractère',
  conflits: 'Conflits',
  blessuresEmotionnelles: 'Blessures émotionnelles',
  dynamiquesRelationnelles: 'Dynamiques relationnelles',
  motivations: 'Motivations',
  lieux: 'Lieux',
  atmospheres: 'Atmosphères',
  meteo: 'Météo',
  elementsSensoriels: 'Éléments sensoriels',
  objetsNarratifs: 'Objets narratifs',
  professions: 'Professions',
}

const FUSE_OPTIONS = {
  keys: [
    { name: 'label', weight: 2 },
    { name: 'id', weight: 1.5 },
    { name: 'alias', weight: 1 },
    { name: 'aliases', weight: 1 },
    { name: 'definitionCourte', weight: 0.8 },
  ],
  threshold: 0.42,
  includeScore: true,
  minMatchCharLength: 3,
}

/** Mots trop vagues pour lancer une recherche Fuse seuls (évitent « personnage » → fiches hors-sujet). */
const THESAURUS_SEARCH_STOPWORDS = new Set([
  'mon',
  'ma',
  'mes',
  'ton',
  'ta',
  'tes',
  'son',
  'sa',
  'ses',
  'leur',
  'leurs',
  'un',
  'une',
  'des',
  'les',
  'la',
  'le',
  'de',
  'du',
  'en',
  'et',
  'ou',
  'que',
  'qui',
  'pour',
  'avec',
  'sans',
  'dans',
  'sur',
  'ce',
  'cet',
  'cette',
  'ces',
  'est',
  'sont',
  'il',
  'ils',
  'elle',
  'elles',
  'nous',
  'vous',
  'plus',
  'tres',
  'trop',
  'bien',
  'mal',
  'pas',
  'ne',
  'comme',
  'tout',
  'toute',
])

const THESAURUS_GENERIC_SUBJECT_TOKENS = new Set([
  'personnage',
  'personnages',
  'protagoniste',
  'histoire',
  'scene',
  'quelque',
  'chose',
])

const THESAURUS_EMOTION_FEAR_TOKENS = new Set([
  'peur',
  'crainte',
  'angoisse',
  'terreur',
  'phobie',
  'panique',
  'apprehension',
  'effroi',
  'anxiete',
  'tremble',
  'paralyse',
  'effraye',
  'apeure',
])

function sortTokensForThesaurusSearch(tokens) {
  const copy = [...tokens]
  copy.sort((a, b) => {
    const fa = THESAURUS_EMOTION_FEAR_TOKENS.has(a) ? 0 : 1
    const fb = THESAURUS_EMOTION_FEAR_TOKENS.has(b) ? 0 : 1
    if (fa !== fb) return fa - fb
    const ga = THESAURUS_GENERIC_SUBJECT_TOKENS.has(a) ? 1 : 0
    const gb = THESAURUS_GENERIC_SUBJECT_TOKENS.has(b) ? 1 : 0
    if (ga !== gb) return ga - gb
    return b.length - a.length
  })
  return copy
}

const fuseByFamille = {}
for (const [famille, items] of Object.entries(FAMILLE_MAP)) {
  if (items.length > 0) {
    fuseByFamille[famille] = new Fuse(items, FUSE_OPTIONS)
  }
}

const fullBase = Object.values(FAMILLE_MAP).flat()
const fuseFull = new Fuse(fullBase, FUSE_OPTIONS)

function scoreVocabEntry(entry, normalizedInput, tokens) {
  let score = 0
  for (const pattern of entry.patterns || []) {
    if (normalizedInput.includes(normalizeText(pattern))) {
      score += entry.poids * 2.5
    }
  }
  for (const mot of entry.mots || []) {
    const norm = normalizeText(mot)
    if (tokens.includes(norm)) {
      score += entry.poids * 1.0
    } else if (tokens.some((t) => t.length >= 4 && (t.includes(norm) || norm.includes(t)))) {
      score += entry.poids * 0.4
    }
  }
  return score
}

function entryDedupeKey(item) {
  if (!item || typeof item !== 'object') return String(item)
  return String(item.id ?? item.label ?? '')
}

/**
 * Recherche Fuse dans une famille. La phrase complète donne souvent 0 résultat (seuil strict) ;
 * on retombe alors sur les mots du libellé (ex. « mon personnage a peur » → « peur », « personnage »).
 */
function getFuseResults(famille, rawQuery, limit = 5) {
  const fuse = fuseByFamille[famille]
  if (!fuse) return []
  const trimmed = (rawQuery || '').trim()
  if (!trimmed) return []

  const direct = fuse.search(trimmed, { limit }).map((r) => r.item)
  if (direct.length > 0) return direct

  const normalized = normalizeText(trimmed)
  const tokens = sortTokensForThesaurusSearch(
    normalized
      .split(/[\s,;.!?]+/)
      .filter((t) => t.length >= 3 && !THESAURUS_SEARCH_STOPWORDS.has(t)),
  )

  const seen = new Set()
  const merged = []
  for (const tok of tokens) {
    for (const r of fuse.search(tok, { limit: Math.max(limit, 8) })) {
      const k = entryDedupeKey(r.item)
      if (!k || seen.has(k)) continue
      seen.add(k)
      merged.push(r.item)
      if (merged.length >= limit) return merged
    }
  }
  return merged
}

export function routeIntent(rawQuery) {
  const trimmed = (rawQuery || '').trim()
  if (!trimmed) return { type: 'empty', reformulation: '', pistes: [], rawQuery: '' }

  const normalized = normalizeText(trimmed)
  const tokens = normalized.split(/[\s,;.!?]+/).filter((t) => t.length >= 3)

  const scored = intentVocabulary
    .map((entry) => ({ entry, score: scoreVocabEntry(entry, normalized, tokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    return {
      type: 'fallback',
      reformulation: 'Pas de piste précise — voici les entrées les plus proches :',
      pistes: [
        {
          famille: 'tous',
          label: 'Résultats proches',
          score: 0,
          entries: fuseFull.search(trimmed, { limit: 6 }).map((r) => r.item),
        },
      ],
      rawQuery: trimmed,
    }
  }

  const familleScores = {}
  const familleReformulations = {}

  for (const { entry, score } of scored) {
    const fam = entry.famille
    if (!familleScores[fam] || score > familleScores[fam]) {
      familleScores[fam] = score
      familleReformulations[fam] = entry.reformulation
    }
    for (const secFam of entry.famillesSecondaires || []) {
      const secScore = score * 0.55
      if (!familleScores[secFam] || secScore > familleScores[secFam]) {
        familleScores[secFam] = secScore
        familleReformulations[secFam] = entry.reformulation
      }
    }
  }

  const topFamilles = Object.entries(familleScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)

  const pistes = topFamilles.map(([famille, score]) => ({
    famille,
    label: FAMILLE_LABELS[famille] || famille,
    score,
    entries: getFuseResults(famille, trimmed),
  }))

  return {
    type: 'intent',
    reformulation: familleReformulations[topFamilles[0][0]] || '',
    pistes,
    rawQuery: trimmed,
  }
}

export function searchInFamille(famille, rawQuery, limit = 8) {
  const trimmed = (rawQuery || '').trim()
  if (!trimmed || !fuseByFamille[famille]) return []
  return getFuseResults(famille, trimmed, limit)
}

export const FAMILLES_DISPONIBLES = Object.entries(FAMILLE_LABELS).map(([id, label]) => ({
  id,
  label,
}))
