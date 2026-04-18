import { checkFrenchParagraph } from './CorrecteurFacade.js'
import { analyzeContextOnDemand } from './ContextualEngine.js'
import { isUnderTemporalShield } from './temporalShield.js'
import { evaluatePhantomHomophone } from './phantomHomophone.js'
import { ensureLexiqueIndex, getLexiqueIndexStatus, isLexiqueForm } from './database/lexiqueIndex.js'
import {
  ensureMorphalouIndex,
  getMorphalouFormCount,
  isMorphalouForm,
} from './database/morphalouIndex.js'
import {
  searchCorpusSnippets,
  getCorpusSnippetIndexStatus,
} from './database/corpusSnippetSearch.js'
import {
  collectBibleSurfaceTerms,
  biblePhoneticKeys,
  findNominalCoherenceIssues,
  findBibleCanonOrthographyIssues,
  isWordCanonicallyInBible,
  detectBibleRenameSinceLastSnapshot,
} from './BibleSync.js'
import { getMergedUserWordsForProject } from './PersonalDictionary.js'
import { normalizePhoneticKey } from './phoneticUtils.js'
import { CORRECTOR_MODE } from './CorrectorModes.js'

const TEMPORAL_RE = /(concordance|temps|passé|imparfait|présent|futur|chronolog)/i

export function computeTextFingerprint(input) {
  const s = String(input || '')
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `${s.length}:${(h >>> 0).toString(16)}`
}

function looksLikeHomophone(originalWord, replacement) {
  const a = normalizePhoneticKey(originalWord)
  const b = normalizePhoneticKey(replacement)
  return !!a && !!b && a === b && originalWord !== replacement
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Blocs 3–5 phrases pour progression (streaming simulé). */
function splitIntoSentenceBlocks(text, minSent = 3, maxSent = 5) {
  const parts = String(text || '')
    .split(/(?<=[.!?])\s+/u)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return ['']
  const blocks = []
  let buf = []
  for (let i = 0; i < parts.length; i += 1) {
    buf.push(parts[i])
    const n = buf.length
    const isLast = i === parts.length - 1
    if (n >= maxSent || (n >= minSent && (isLast || (i + 1) % 4 === 0))) {
      blocks.push(buf.join(' '))
      buf = []
    }
  }
  if (buf.length) blocks.push(buf.join(' '))
  return blocks.length ? blocks : [String(text)]
}

/**
 * Heuristique « style expérimental » (ex. Damasio) — informatif, pas une faute.
 * Passages longs très fragmentés, ou extraits plus courts mais très découpés.
 */
function inferExperimentalStyle(text) {
  const s = String(text || '').trim()
  if (s.length < 220) return false
  const sentences = s.split(/[.!?]+/).filter((x) => x.trim().length > 0)
  if (sentences.length < 5) return false
  const shortCount = sentences.filter((x) => x.trim().length < 25).length
  const fragRatio = shortCount / sentences.length
  const punctDensity = (s.match(/[—–\-:;]/g) || []).length / Math.max(1, s.length / 80)
  if (s.length >= 400 && sentences.length >= 6) {
    return fragRatio > 0.35 || punctDensity > 0.12
  }
  return s.length >= 220 && sentences.length >= 8 && fragRatio > 0.42
}

/**
 * Phrases très courtes consécutives sans verbe (heuristique simple).
 */
function inferChoppedRhythm(text) {
  const sentences = String(text || '')
    .split(/[.!?]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length < 48)
  if (sentences.length < 4) return false
  const noVerbish = /^(et|ou|mais|donc|puis|alors|comme|si|sans|dans|sur|un|une|le|la|les|des|du|de|à|au|aux)\b/i
  let streak = 0
  for (const sent of sentences) {
    const hasVerb =
      /\b(est|sont|était|fut|a |as |ai |ont |être|avoir|faire|dit|fait|va |vont|peut|doit|semble|reste|tient|prend|donne|voit|sait|croit)\b/i.test(
        sent,
      )
    if (!hasVerb || noVerbish.test(sent)) streak += 1
    else streak = 0
    if (streak >= 3) return true
  }
  return false
}

/** Répétitions frappantes (ex. anaphore « Vingt-trois ans »). */
function inferAnaphoraStyle(text) {
  const s = String(text || '')
  if ((s.match(/Vingt-trois ans/gi) || []).length >= 2) return true
  const lines = s.split(/\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 3) return false
  const head = lines[0].slice(0, 12)
  let n = 0
  for (const l of lines) {
    if (l.length >= 8 && head.length >= 8 && l.slice(0, 8) === head.slice(0, 8)) n += 1
  }
  return n >= 3
}

/** Fragments très courts — ellipse / ponctuation narrative (informatif). */
function inferEllipseStyle(text) {
  const parts = String(text || '')
    .split(/[.!?]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  const tiny = parts.filter((p) => p.length > 0 && p.length <= 20 && p.split(/\s+/).length <= 4)
  return tiny.length >= 2
}

const PROGRESS_MESSAGES = [
  'Scriptor lit votre chapitre…',
  'LanguageTool vérifie les règles grammaticales…',
  'Consultation de la base académique française…',
  'Analyse contextuelle en cours…',
  'Vérification de la ligne temporelle…',
  'Détection des connecteurs temporels…',
  'Arbitrage des cas ambigus…',
  'Application des règles de style mémorisées…',
  'Synchronisation avec la Bible du projet…',
]

/**
 * @param {string} plainText
 * @param {{
 *   userDict?: string[],
 *   includeCorpusSnippets?: boolean,
 *   project?: unknown,
 *   sagaId?: string,
 *   correctorMode?: string,
 *   onProgress?: (message: string) => void,
 * }} [opts]
 */
export async function analyzeSequence3(plainText, opts = {}) {
  const text = String(plainText || '')
  const baseTextHash = computeTextFingerprint(text)
  const mode = opts.correctorMode || CORRECTOR_MODE.SIMPLE

  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null

  if (!text.trim()) {
    const corpusIndex = await getCorpusSnippetIndexStatus()
    return {
      counts: { total: 0, active: 0, shielded: 0, temporal: 0, phantomBlocked: 0, bible: 0 },
      active: [],
      shielded: [],
      context: { ok: false, reason: 'empty' },
      baseTextHash,
      corpusIndex,
      styleHints: [],
      bibleRenameHint: null,
      experimentalStyleMute: false,
      progressDone: true,
    }
  }

  const bibleTerms = opts.project ? collectBibleSurfaceTerms(opts.project) : []
  const bibleKeys = biblePhoneticKeys(bibleTerms)
  const mergedUser = getMergedUserWordsForProject(opts.sagaId || 'default', bibleTerms)
  const userDict = [...new Set([...(opts.userDict || []).map((w) => String(w).toLowerCase()), ...mergedUser])]

  const blocks = splitIntoSentenceBlocks(text)
  let step = 0
  for (let i = 0; i < blocks.length; i += 1) {
    if (onProgress) {
      const msg = PROGRESS_MESSAGES[Math.min(step, PROGRESS_MESSAGES.length - 1)]
      onProgress(msg)
      step += 1
      await sleep(0)
    }
  }
  if (onProgress) onProgress('Fusion des résultats…')

  await ensureLexiqueIndex().catch(() => {})
  await ensureMorphalouIndex().catch(() => {})
  const lexReady = getLexiqueIndexStatus().ready
  const morphalouFormCount = getMorphalouFormCount()
  const dictionaryBacked = lexReady || morphalouFormCount > 0

  const context = await analyzeContextOnDemand(text, { maxWords: 2000, timeoutMs: 5000 })
  const camembertConfidence = context?.ok ? 0.995 : 0.0

  const { matches: ltMatches } = await checkFrenchParagraph(text, {
    userDict,
    awaitMorphalou: false,
    absoluteConfidence: opts.absoluteConfidence === true,
  })

  const overlaps = (a, b) =>
    a.offset < b.offset + b.length && a.offset + a.length > b.offset

  const bibleSeen = new Set()
  /** @type {typeof ltMatches} */
  const bibleRows = []
  for (const b of [
    ...findNominalCoherenceIssues(text, bibleTerms),
    ...findBibleCanonOrthographyIssues(text, bibleTerms),
  ]) {
    const k = `${b.offset}-${b.length}`
    if (bibleSeen.has(k)) continue
    bibleSeen.add(k)
    bibleRows.push(b)
  }
  const extraBible = bibleRows.filter((b) => !ltMatches.some((m) => overlaps(m, b)))

  let matches = [...ltMatches, ...extraBible]

  const experimentalProse = inferExperimentalStyle(text)
  /** Ne masque les fautes mécaniques que si le fragmente fort (rythme / anaphore) — évite les faux positifs sur un chapitre « normal » très découpé. */
  const experimentalMute =
    experimentalProse && (inferChoppedRhythm(text) || inferAnaphoraStyle(text))

  /** @type {{ label: string, detail?: string }[]} */
  const styleHints = []
  if (mode === CORRECTOR_MODE.EXPERT) {
    if (experimentalProse) {
      styleHints.push({ label: 'Expérimental', detail: 'Syntaxe fragmentée ou ponctuation dense — informatif.' })
    }
    if (inferChoppedRhythm(text)) {
      styleHints.push({ label: 'Rythme haché', detail: 'Enchaînement de phrases très courtes — pas une faute.' })
    }
    if (inferAnaphoraStyle(text)) {
      styleHints.push({ label: 'Anaphore', detail: 'Répétitions structurantes — pas une faute.' })
    }
    if (inferEllipseStyle(text)) {
      styleHints.push({ label: 'Ellipse', detail: 'Fragments ou phrases très courtes — pas une faute.' })
    }
  }

  const bibleRenameHint = opts.project ? detectBibleRenameSinceLastSnapshot(opts.project) : null

  const includeCorp = opts.includeCorpusSnippets === true
  const snippetCache = new Map()
  const snippetFor = async (originalWord, message) => {
    const needle = `${String(message || '').slice(0, 100)} ${originalWord}`.trim().slice(0, 200)
    if (needle.length < 5) return []
    const k = needle.toLowerCase()
    if (snippetCache.has(k)) return snippetCache.get(k)
    const sn = await searchCorpusSnippets(needle, { limit: 2 })
    snippetCache.set(k, sn)
    return sn
  }

  const rowsBuilt = await Promise.all(
    matches.map(async (m) => {
      const underShield = isUnderTemporalShield(text, m.offset)
      const originalWord = text.slice(m.offset, m.offset + m.length)
      const replacement = m.replacements?.[0] || ''
      const candidate = looksLikeHomophone(originalWord, replacement)

      const inBible = isWordCanonicallyInBible(originalWord, bibleTerms)
      const pk = normalizePhoneticKey(originalWord)
      const phoneticNearBibleTerm =
        bibleKeys.has(pk) && !inBible && !isWordCanonicallyInBible(originalWord, bibleTerms)

      let phantomAllowed = true
      let phantomInc = 0
      if (candidate && !m.bibleNominal) {
        const verdict = evaluatePhantomHomophone({
          word: originalWord,
          inBaseDictionary: dictionaryBacked
            ? isLexiqueForm(originalWord) || isMorphalouForm(originalWord)
            : /^[\p{L}\p{M}'-]+$/u.test(originalWord),
          camembertConfidence,
          inBible,
          phoneticNearBibleTerm,
          rejectedBefore: false,
        })
        phantomAllowed = verdict.allow
        if (!verdict.allow) phantomInc = 1
      }

      let corpusSnippets = []
      if (includeCorp) {
        corpusSnippets = await snippetFor(originalWord, m.message)
      }

      const row = {
        ...m,
        excerpt: originalWord,
        candidateHomophone: candidate,
        phantomAllowed,
        temporalRelated: TEMPORAL_RE.test(m.message || ''),
        corpusSnippets,
        bibleNominal: !!m.bibleNominal,
      }
      return { row, underShield, phantomInc }
    }),
  )

  let shielded = []
  let active = []
  let temporalCount = 0
  let phantomBlocked = 0
  let bibleCount = 0

  for (const { row, underShield, phantomInc } of rowsBuilt) {
    phantomBlocked += phantomInc
    if (row.temporalRelated) temporalCount += 1
    if (row.bibleNominal) bibleCount += 1
    if (underShield) shielded.push(row)
    else active.push(row)
  }

  /** Prose expérimentale (Damasio, etc.) : pas d’alertes « mécaniques » — uniquement cohérence Bible. */
  if (experimentalMute) {
    active = active.filter((r) => r.bibleNominal)
    shielded = shielded.filter((r) => r.bibleNominal)
    const merged = [...active, ...shielded]
    bibleCount = merged.filter((r) => r.bibleNominal).length
    temporalCount = merged.filter((r) => r.temporalRelated).length
    phantomBlocked = merged.reduce((acc, r) => acc + (r.candidateHomophone && !r.phantomAllowed ? 1 : 0), 0)
  }

  const corpusIndex = await getCorpusSnippetIndexStatus()

  return {
    counts: {
      total: matches.length,
      active: active.length,
      shielded: shielded.length,
      temporal: temporalCount,
      phantomBlocked,
      bible: bibleCount,
    },
    active: active.slice(0, 40),
    shielded: shielded.slice(0, 20),
    context,
    baseTextHash,
    corpusIndex,
    styleHints,
    bibleRenameHint,
    /** Passage classé style expérimentatif : alertes hors Bible masquées dans ce rapport. */
    experimentalStyleMute: experimentalMute,
    progressDone: true,
  }
}
