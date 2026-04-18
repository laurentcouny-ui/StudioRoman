import Hypher from 'hypher'
import frPatterns from 'hyphenation.fr'
import enPatterns from 'hyphenation.en-us'
import frDict from './dictionaries/fr-v1.json'
import enDict from './dictionaries/en-v1.json'

export const TYPOGRAPHIC_ENGINE_VERSION = '1.0.1'
const LIGATURES = ['ffi', 'ff', 'fi', 'fl']

/** Paires latines courantes : ajustement en em (négatif = resserré). Complète l’approximation globale ; pas de tables GSUB/GPOS. */
const KERN_PAIR_EM = {
  AV: -0.042,
  AW: -0.036,
  AT: -0.028,
  LT: -0.022,
  To: -0.02,
  Te: -0.02,
  Ta: -0.02,
  Tu: -0.02,
  Ty: -0.02,
  Ve: -0.02,
  We: -0.02,
  Wa: -0.02,
  Yo: -0.02,
  Ly: -0.02,
  '\u00ABA': -0.02,
  '\u00ABE': -0.02,
}

function firstClusterChar(cluster) {
  const c = String(cluster || '')
  return c.length ? c[0] : ''
}

function pairKerningSumEm(clusters) {
  if (!clusters || clusters.length < 2) return 0
  let sum = 0
  for (let i = 0; i < clusters.length - 1; i += 1) {
    const a = firstClusterChar(clusters[i])
    const b = firstClusterChar(clusters[i + 1])
    const key = `${a}${b}`
    sum += KERN_PAIR_EM[key] ?? 0
  }
  return sum
}

/** Espace fine insécable (Unicode) avant ; : ! ? » et après « — typographie française (CDC Brique 4). */
function normalizeSpaceAroundFrenchPunctuation(text) {
  return String(text || '')
    .replace(/\s*([;:!?»])/g, '\u202F$1')
    .replace(/«\s*/g, '«\u202F')
}

function conservativeSplit(word) {
  if (word.length < 7) return null
  const i = Math.max(2, Math.floor(word.length / 2))
  if (i >= word.length - 2) return null
  return [word.slice(0, i), word.slice(i)]
}

function findPatternSplit(word, dict) {
  const lower = word.toLowerCase()
  for (const p of dict.patterns || []) {
    if (!lower.endsWith(p.suffix)) continue
    for (const spl of p.splits || []) {
      const joined = spl.replace(/-/g, '')
      if (!lower.endsWith(joined)) continue
      const stem = word.slice(0, word.length - joined.length)
      const [a, b] = spl.split('-')
      const left = `${stem}${a}`
      const right = b
      if (left.length >= 2 && right.length >= 2) return [left, right]
    }
  }
  return null
}

let _hypherFr = null
let _hypherEn = null

function getHypherForLang(lang) {
  if (String(lang || '').toLowerCase().startsWith('en')) {
    if (!_hypherEn) _hypherEn = new Hypher(enPatterns)
    return _hypherEn
  }
  if (!_hypherFr) _hypherFr = new Hypher(frPatterns)
  return _hypherFr
}

export class TypographicEngine {
  constructor(opts = {}) {
    this.lineWidth = opts.lineWidth ?? 420
    this.fontSize = opts.fontSize ?? 11
    this.lineHeight = opts.lineHeight ?? 1.45
    this.lang = opts.lang || 'fr'
    this.dict = this.lang.startsWith('en') ? enDict : frDict
    this.dictId = this.dict.id
  }

  tokenize(raw) {
    const cleaned = normalizeSpaceAroundFrenchPunctuation(raw)
    return cleaned.split(/(\s+)/).filter((x) => x.length > 0)
  }

  wordToGlyphClusters(word) {
    const clusters = []
    let i = 0
    while (i < word.length) {
      const lig = LIGATURES.find((x) => word.slice(i, i + x.length) === x)
      if (lig) {
        clusters.push(lig)
        i += lig.length
      } else {
        clusters.push(word[i])
        i += 1
      }
    }
    return clusters
  }

  measureWord(word) {
    const w = String(word || '')
    if (w === '\u202F' || w === '\u2009') return { width: this.fontSize * 0.2, clusters: [w] }
    if (w === '\u00A0') return { width: this.fontSize * 0.3, clusters: [w] }
    // Approx: largeur proportionnelle + kerning minimal.
    const clusters = this.wordToGlyphClusters(word)
    const base = clusters.reduce((s, c) => s + (c === ' ' ? 3 : c.length * this.fontSize * 0.48), 0)
    const kerning = Math.max(0, clusters.length - 1) * this.fontSize * 0.01
    const pairEm = pairKerningSumEm(clusters)
    const width = base - kerning + pairEm * this.fontSize
    return { width, clusters }
  }

  /**
   * Césure par patterns TeX (Hypher / Knuth–Liang) selon la langue ; repli sur dictionnaire local puis coupe conservative.
   * @param {number} roomLeft largeur disponible sur la ligne pour le premier fragment + tiret
   */
  hyphenateWord(word, roomLeft = Infinity) {
    const w = String(word || '')
    if (w.length < 4) return findPatternSplit(word, this.dict) || conservativeSplit(word)
    try {
      const h = getHypherForLang(this.lang)
      const parts = h.hyphenate(w)
      if (parts.length >= 2) {
        for (let i = parts.length - 1; i >= 1; i -= 1) {
          const leftHyp = `${parts.slice(0, i).join('')}-`
          const mLeft = this.measureWord(leftHyp)
          if (mLeft.width <= roomLeft) {
            return [parts.slice(0, i).join(''), parts.slice(i).join('')]
          }
        }
      }
    } catch {
      /* repli ci-dessous */
    }
    return findPatternSplit(word, this.dict) || conservativeSplit(word)
  }

  layoutParagraph(text) {
    const tokens = this.tokenize(text)
    const lines = []
    let current = { words: [], width: 0 }

    const flush = () => {
      if (current.words.length > 0) lines.push(current)
      current = { words: [], width: 0 }
    }

    for (const tk of tokens) {
      const isSpace = /^\s+$/.test(tk)
      const measure = this.measureWord(tk)
      const future = current.width + measure.width
      if (!isSpace && future > this.lineWidth && current.words.length > 0) {
        const roomLeft = this.lineWidth - current.width
        const split = this.hyphenateWord(tk, roomLeft)
        if (split) {
          const left = `${split[0]}-`
          const right = split[1]
          const mLeft = this.measureWord(left)
          if (current.width + mLeft.width <= this.lineWidth) {
            current.words.push({ text: left, ...mLeft })
            current.width += mLeft.width
            flush()
            const mRight = this.measureWord(right)
            current.words.push({ text: right, ...mRight })
            current.width += mRight.width
            continue
          }
        }
        flush()
      }
      if (!isSpace || current.words.length > 0) {
        current.words.push({ text: tk, ...measure })
        current.width += measure.width
      }
    }
    flush()
    return this.justify(lines)
  }

  justify(lines) {
    return lines.map((line, i) => {
      const isLast = i === lines.length - 1
      const spaces = line.words.filter((w) => /^\s+$/.test(w.text)).length
      const gap = Math.max(0, this.lineWidth - line.width)
      const expansionPerSpace = !isLast && spaces > 0 ? gap / spaces : 0
      const glyphExpansion = !isLast && spaces === 0 ? gap / Math.max(1, line.words.length) : 0
      return {
        ...line,
        expansionPerSpace,
        glyphExpansion,
        lineHeightPt: this.fontSize * this.lineHeight,
      }
    })
  }
}

