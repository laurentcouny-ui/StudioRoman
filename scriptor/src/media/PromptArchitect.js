const LEXICON_RULES = [
  { tokens: ['froid', 'acier', 'brume'], value: 'bleus desatures' },
  { tokens: ['feu', 'sang', 'ardeur'], value: 'rouges chauds' },
  { tokens: ['foret', 'racines', 'terre'], value: 'verts profonds' },
  { tokens: ['lumiere', 'aube', 'or'], value: 'dores et jaunes chauds' },
]

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function scoreByTokens(text, tokens) {
  const n = normalize(text)
  return tokens.reduce((s, t) => s + (n.includes(t) ? 1 : 0), 0)
}

function confidence(found, total) {
  if (!total) return 0.35
  return Math.min(0.98, Math.max(0.45, found / total))
}

function dominantPalette(raw) {
  let best = { value: 'palette neutre', score: 0, total: 1 }
  for (const r of LEXICON_RULES) {
    const s = scoreByTokens(raw, r.tokens)
    if (s > best.score) best = { value: r.value, score: s, total: r.tokens.length }
  }
  return { value: best.value, confidence: confidence(best.score, best.total) }
}

function compositionFromDialogueDensity(raw) {
  const txt = String(raw || '')
  const quoteCount = (txt.match(/[«"”]/g) || []).length
  const lines = Math.max(1, txt.split('\n').length)
  const density = quoteCount / lines
  if (density > 0.45) {
    return { value: 'centree personnages', confidence: 0.82 }
  }
  return { value: 'atmospherique / paysagere', confidence: 0.74 }
}

function inferGenreVisual(raw) {
  const n = normalize(raw)
  if (/dragon|royaume|sorc|ep[eé]e|magie/.test(n)) return { value: 'fantasy organique', confidence: 0.91 }
  if (/enquete|crime|tueur|ombre|secret/.test(n)) return { value: 'thriller noir', confidence: 0.87 }
  if (/amour|coeur|passion|baiser/.test(n)) return { value: 'romance lumineuse', confidence: 0.84 }
  if (/orbite|station|quantique|cyber|ia/.test(n)) return { value: 'science-fiction geometrique', confidence: 0.86 }
  return { value: 'drame litteraire', confidence: 0.62 }
}

function inferMainCharacter(saga, manuscript) {
  const entries = saga?.bible?.entries || []
  const people = entries
    .map((e) => String(e?.title || '').trim())
    .filter(Boolean)
    .slice(0, 24)
  const n = normalize(manuscript)
  let best = null
  let bestScore = 0
  for (const p of people) {
    const m = (n.match(new RegExp(normalize(p), 'g')) || []).length
    if (m > bestScore) {
      best = p
      bestScore = m
    }
  }
  return {
    value: best || 'figure centrale anonyme',
    confidence: best ? confidence(Math.min(bestScore, 6), 6) : 0.5,
  }
}

function recurringVisualElements(raw) {
  const n = normalize(raw)
  const candidates = ['lune', 'mer', 'foret', 'flamme', 'couronne', 'porte', 'ruine', 'pluie']
  const found = []
  for (const c of candidates) {
    const cnt = (n.match(new RegExp(c, 'g')) || []).length
    if (cnt >= 3) found.push(c)
  }
  return { value: found.slice(0, 5), confidence: found.length > 0 ? 0.78 : 0.46 }
}

function epochMood(raw) {
  const n = normalize(raw)
  if (/chateau|chevalier|abbaye|duc|ep[eé]e/.test(n)) return { value: 'medieval', confidence: 0.82 }
  if (/metro|smartphone|reseau|startup|paris/.test(n)) return { value: 'contemporain', confidence: 0.75 }
  if (/vaisseau|colonie|reacteur|orbite/.test(n)) return { value: 'futuriste', confidence: 0.84 }
  return { value: 'intemporel', confidence: 0.55 }
}

function tensionToComposition(raw) {
  const n = normalize(raw)
  if (/thriller|crime|traque|urgence|peur/.test(n)) {
    return { value: 'asymetrique, ombres dominantes', confidence: 0.88 }
  }
  if (/romance|amour|tendre|rencontre/.test(n)) {
    return { value: 'centrage doux, lumiere chaude', confidence: 0.85 }
  }
  return { value: 'equilibre narratif', confidence: 0.6 }
}

function inferGenreCommercial(raw) {
  return inferGenreVisual(raw)
}

function buildPrompt400Words(extract, engine, opts = {}) {
  const low = Boolean(opts.lowInference)
  const pieces = [
    `Create a commercial book cover visual for ${extract.genre_visuel.value}.`,
    `Color palette: ${extract.palette.value}.`,
    `Composition: ${extract.composition.value}.`,
    `Main character: ${extract.personnage_principal.value}.`,
    `Mood/era: ${extract.epoque_ambiance.value}.`,
    `Tension style: ${extract.tension_composition.value}.`,
    `Recurring symbols: ${(extract.elements_recurrents.value || []).join(', ') || 'none explicit'}.`,
    'Lighting should support title readability in negative space.',
    'Use cinematic framing and editorially marketable hierarchy.',
    'NO text, NO title, NO lettering, NO typography.',
    'Avoid readable words, logos, or letter-like symbols (OCR-clean artwork for later title overlay).',
  ]
  if (low) {
    pieces.push('Low inference mode: keep literal details, avoid strong stylistic extrapolation.')
  }
  if (engine === 'midjourney') {
    pieces.push('--ar 2:3 --style raw --v 6')
  }
  let prompt = pieces.join(' ')
  const fillers = [
    'Premium editorial lighting, controlled speculars, depth haze where appropriate.',
    'Negative space reserved for title block; avoid clutter in upper third unless genre demands.',
    'Cinematic color grading, natural skin or material response if figures appear.',
    'Sharp subject separation from background; atmospheric perspective on distant elements.',
    'Balanced composition with readable silhouette at thumbnail scale.',
    'Texture detail suitable for print: no excessive micro-noise.',
    'Coherent single light direction; avoid conflicting cast shadows.',
    'Mood aligned with genre without cliché overload.',
  ]
  let i = 0
  while (prompt.split(/\s+/).length < 400) {
    prompt += ` ${fillers[i % fillers.length]}`
    i += 1
  }
  return prompt
}

function questionnaire5() {
  return [
    'Voulez-vous une couverture centree personnage ou ambiance ?',
    'Niveau de contraste souhaite (doux / moyen / fort) ?',
    'Palette preferee (froide / chaude / neutre) ?',
    'Epoque visuelle a renforcer ?',
    'Composition classique ou plus audacieuse ?',
  ]
}

const PROMPT_VAULT = new Map()

export class PromptArchitect {
  buildFromManuscript({ manuscriptText, saga, lowInference = false, engine = 'pollinations' }) {
    const raw = String(manuscriptText || '')
    const extract = {
      palette: dominantPalette(raw),
      composition: compositionFromDialogueDensity(raw),
      genre_visuel: inferGenreVisual(raw),
      personnage_principal: inferMainCharacter(saga, raw),
      elements_recurrents: recurringVisualElements(raw),
      epoque_ambiance: epochMood(raw),
      tension_composition: tensionToComposition(raw),
      genre_commercial: inferGenreCommercial(raw),
    }

    const prompt = buildPrompt400Words(extract, engine, { lowInference })
    const promptId = `pa-${Date.now()}-${Math.random().toString(16).slice(2)}`
    PROMPT_VAULT.set(promptId, {
      prompt,
      createdAt: Date.now(),
      engine,
      lowInference,
    })

    return {
      promptId,
      axes: extract,
      questionnaire: questionnaire5(),
      lowInference,
      // le prompt brut n'est jamais expose a l'auteur
    }
  }

  consumePrompt(promptId) {
    const item = PROMPT_VAULT.get(promptId)
    if (!item) throw new Error('PromptArchitect: prompt introuvable ou expire')
    return item.prompt
  }
}

export const promptArchitect = new PromptArchitect()
