import { TypographicEngine, TYPOGRAPHIC_ENGINE_VERSION } from './TypographicEngine'
import { LAYOUT_AST_SCHEMA_VERSION } from './layoutAstSchema.js'

/** Points de mise en page : en `device-aligned` (profil print), arrondi **1/1000 pt** avant export PDF. */
function quantize(value, mode) {
  if (mode === 'device-aligned') return Math.round(value * 1000) / 1000
  return value
}

function sceneParagraphs(sceneText) {
  return String(sceneText || '')
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function ensureOddChapterStart(pages) {
  if (pages.length % 2 === 1) pages.push({ type: 'blank', lines: [], chapterId: null })
}

export class PaginationOrchestrator {
  constructor(opts = {}) {
    this.pageHeight = opts.pageHeight ?? 700
    this.pageWidth = opts.pageWidth ?? 500
    this.marginTop = opts.marginTop ?? 72
    this.marginLeft = opts.marginLeft ?? 72
    this.marginRight = opts.marginRight ?? 72
    this.marginBottom = opts.marginBottom ?? 72
    this.lineHeight = opts.lineHeight ?? 16
    this.fontId = opts.fontId ?? 'EBGaramond-Regular'
    this.fontSize = opts.fontSize ?? 11
    this.ruleset = opts.ruleset ?? 'fr-classic-v1'
  }

  buildLayoutAst(parsed, profile) {
    const quantization = profile.mode === 'print' ? 'device-aligned' : 'subpixel'
    const engine = new TypographicEngine({
      lineWidth: this.pageWidth - this.marginLeft - this.marginRight,
      fontSize: this.fontSize,
      lineHeight: this.lineHeight / this.fontSize,
      lang: 'fr',
    })

    const pages = []
    let currentPage = { type: 'content', lines: [], chapterId: null }
    let cursorY = this.marginTop
    let glyphId = 1

    const pushPage = () => {
      pages.push(currentPage)
      currentPage = { type: 'content', lines: [], chapterId: null }
      cursorY = this.marginTop
    }

    const availableBottom = this.pageHeight - this.marginBottom
    const minWidowOrphan = 2

    for (const ch of parsed?.chapters || []) {
      ensureOddChapterStart(pages)
      currentPage.chapterId = ch.id || ch.title || null
      for (const sc of ch.scenes || []) {
        for (const para of sceneParagraphs(sc.text)) {
          const laid = engine.layoutParagraph(para)
          let idx = 0
          while (idx < laid.length) {
            const remaining = laid.length - idx
            const room = Math.floor((availableBottom - cursorY) / this.lineHeight)
            if (room <= 0) {
              pushPage()
              continue
            }
            // Regle veuves/orphelines min 2 lignes.
            if (remaining > room && (room < minWidowOrphan || remaining - room < minWidowOrphan)) {
              pushPage()
              continue
            }

            const take = Math.min(room, remaining)
            for (let i = 0; i < take; i += 1) {
              const line = laid[idx + i]
              let x = this.marginLeft
              const glyphRuns = []
              for (const w of line.words) {
                const advBase = w.width + (/^\s+$/.test(w.text) ? line.expansionPerSpace : 0)
                for (const cluster of w.clusters || [w.text]) {
                  const advance = advBase / Math.max(1, (w.clusters || []).length)
                  glyphRuns.push({
                    glyphId: glyphId++,
                    cluster,
                    x: quantize(x, quantization),
                    y: quantize(cursorY, quantization),
                    advance: quantize(advance, quantization),
                    fontId: this.fontId,
                    fontSize: this.fontSize,
                    ascent: quantize(this.fontSize * 0.95, quantization),
                    descent: quantize(this.fontSize * 0.23, quantization),
                  })
                  x += advance
                }
              }
              currentPage.lines.push({ glyphRuns, text: line.words.map((w) => w.text).join('') })
              cursorY += this.lineHeight
            }
            idx += take
            if (idx < laid.length) pushPage()
          }
          cursorY += this.lineHeight * 0.4
          if (cursorY >= availableBottom) pushPage()
        }
      }
      pushPage()
    }
    if (currentPage.lines.length > 0 || pages.length === 0) pages.push(currentPage)

    return {
      layoutContext: {
        typographicEngineVersion: TYPOGRAPHIC_ENGINE_VERSION,
        hyphenationDict: engine.dictId,
        ruleset: this.ruleset,
        layoutQuantization: quantization,
        layoutAstSchemaVersion: LAYOUT_AST_SCHEMA_VERSION,
        timestamp: Math.floor(Date.now() / 1000),
      },
      pageSize: { width: this.pageWidth, height: this.pageHeight },
      pages,
    }
  }
}

