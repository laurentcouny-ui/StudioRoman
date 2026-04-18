import { isDesktop } from '../platform'
import { failoverStrategy } from './FailoverStrategy'
import { layoutAstToPdfLibPlan } from './adapters/pdfLibAdapter'
import { embedPdfPrintOutputIntentAndXmp } from './pdfXEmbed'
import { resolveBundledIcc, userFacingIccNote } from './iccBundledProfiles'
import { buildEpubZipFromSpec } from './epubZipFromSpec.js'
import { PDFDocument, StandardFonts } from 'pdf-lib'

function bytesToBase64(bytes) {
  const chunk = 0x8000
  let bin = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    const part = bytes.subarray(i, i + chunk)
    bin += String.fromCharCode(...part)
  }
  return btoa(bin)
}

function pageDimensionsFromAst(layoutAst) {
  const ps = layoutAst?.pageSize
  const w = Number(ps?.width) || 595.28
  const h = Number(ps?.height) || 841.89
  return { widthPt: w, heightPt: h }
}

/** Alignement device PDF (points) : cohérent avec `quantize` pagination (`device-aligned` = 1/1000 pt). */
function deviceAlignPt(v) {
  return Math.round(Number(v) * 1000) / 1000
}

/**
 * Rendu depuis le Layout AST : un drawText par cluster (glyph run), coords device-aligned.
 * L'ordonnée AST est mesurée depuis le haut de la page ; pdf-lib utilise la baseline depuis le bas.
 */
async function buildPdfFromLayout(layoutAst, meta) {
  const doc = await PDFDocument.create()
  doc.setTitle(meta?.title || 'Scriptor Export')
  doc.setAuthor(meta?.author || 'Scriptor')
  doc.setSubject('PDF/X export')
  doc.setProducer('Scriptor Desktop V2')
  if (meta?.isbn) doc.setKeywords(['ISBN', String(meta.isbn)])

  const helv = await doc.embedFont(StandardFonts.Helvetica)
  const { widthPt: defaultW, heightPt: defaultH } = pageDimensionsFromAst(layoutAst)
  const pages = layoutAst?.pages || []

  for (const p of pages) {
    const w = Number(p.widthPt) || defaultW
    const h = Number(p.heightPt) || defaultH
    const page = doc.addPage([w, h])
    if (p.type === 'blank') continue

    const lines = p.lines || []
    for (const l of lines) {
      const runs = l.glyphRuns || []
      if (runs.length === 0 && l.text) {
        page.drawText(String(l.text).slice(0, 500), {
          x: deviceAlignPt(72),
          y: deviceAlignPt(h - 100),
          size: deviceAlignPt(11),
          font: helv,
        })
        continue
      }
      for (const gr of runs) {
        const cluster = String(gr.cluster ?? '')
        if (!cluster || /^\s+$/.test(cluster)) continue
        const size = Math.max(4, Number(gr.fontSize) || 11)
        const ascent = Number(gr.ascent) || size * 0.95
        const yFromTop = Number(gr.y) || 0
        const x = deviceAlignPt(gr.x)
        const baselineFromTop = yFromTop + ascent
        const yPdf = deviceAlignPt(h - baselineFromTop)
        page.drawText(cluster, {
          x,
          y: yPdf,
          size: deviceAlignPt(size),
          font: helv,
        })
      }
    }
  }

  const iccBundle = resolveBundledIcc(meta?.profile || 'GRACoL')
  embedPdfPrintOutputIntentAndXmp(doc, {
    outputIntentProfileLabel: meta?.profile || 'GRACoL',
    pdfStandard: meta?.pdfStandard || 'PDF/X-4',
    title: meta?.title,
    author: meta?.author,
    isbn: meta?.isbn,
    iccBundle,
  })

  const pdfBytes = await doc.save()
  return { pdfBytes, iccBundle }
}

export async function exportPdfX4({
  layoutAst,
  fontMode = 'embedded',
  profile = 'GRACoL',
  isbn,
  author,
  title,
  fallbackToX1a = false,
}) {
  const plan = layoutAstToPdfLibPlan(layoutAst)
  const warnings = []
  if (!['embedded', 'outlined', 'hybrid-safe'].includes(fontMode)) {
    throw new Error(`PDF export: unsupported fontMode "${fontMode}"`)
  }
  if (fontMode === 'outlined') warnings.push('Mode outlined: texte non selectionnable')
  if (fontMode === 'hybrid-safe') warnings.push('Mode hybrid-safe: validite PDF/X potentiellement limite')
  if (fallbackToX1a) {
    warnings.push(
      'PDF/X-1a : métadonnées XMP sans transparence ; aplatissement complet des calques et effets peut exiger Ghostscript ou l’outil imprimeur si le PDF contient de la transparence native.',
    )
  }

  const { pdfBytes, iccBundle } = await buildPdfFromLayout(layoutAst, {
    title,
    author,
    isbn,
    profile,
    pdfStandard: fallbackToX1a ? 'PDF/X-1a' : 'PDF/X-4',
  })
  warnings.push(userFacingIccNote(profile, iccBundle))
  const pdfBase64 = bytesToBase64(new Uint8Array(pdfBytes))

  const payload = {
    standard: fallbackToX1a ? 'PDF/X-1a' : 'PDF/X-4',
    outputIntent: profile,
    transparent: !fallbackToX1a,
    xmp: { isbn: isbn || '', author: author || '', title: title || '' },
    fontMode,
    plan,
    pdfBase64,
  }

  let validation = { ok: true, tool: 'none', details: 'validation pending integration' }
  if (isDesktop()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      validation = await invoke('print_validate_pdfx', { payloadJson: JSON.stringify(payload) })
      if (validation?.mode === 'structural-only') {
        const degraded = failoverStrategy.validationToolMissing(
          new Error('validation-iso-outillee-non-effectuee'),
        )
        warnings.push(degraded.userLabel)
        warnings.push('Validation ISO externe non exécutée : mode structurel seulement.')
      }
    } catch (err) {
      const degraded = failoverStrategy.validationToolMissing(err)
      warnings.push(degraded.userLabel)
      validation = { ok: false, degraded, details: degraded.techMessage }
    }
  }

  return {
    blob: new Blob([pdfBytes], { type: 'application/pdf' }),
    report: {
      standard: payload.standard,
      outputIntent: profile,
      fontMode,
      layoutContext: layoutAst?.layoutContext || null,
      warnings,
      validation,
      isoToolValidated: validation?.mode === 'structural-plus-tool-run',
      fileHashHint: `${pdfBytes.length}-${payload.standard}`,
    },
  }
}

/**
 * Export EPUB 3.0 réel (ZIP). `spine` : entrées { id?, href?, xhtml?, title?, properties? } ou chaînes (titres).
 * EPUBCheck : `npm run epubcheck -- fichier.epub` si `EPUBCHECK_JAR` est défini ; sinon validation structurelle uniquement.
 */
export async function exportEpub3({
  navXhtml,
  spine,
  metadata,
  kindleSafeCss = false,
  coverDataUrl = null,
}) {
  const spineItems = (spine || []).map((item, i) => {
    if (typeof item === 'string') {
      return {
        id: `ch-${i}`,
        href: `chap-${String(i).padStart(3, '0')}.xhtml`,
        title: item,
      }
    }
    return {
      id: item.id || `ch-${i}`,
      href: item.href || `chap-${String(i).padStart(3, '0')}.xhtml`,
      xhtml: item.xhtml,
      title: item.title || metadata?.title,
      properties: item.properties,
    }
  })

  const { blob, warnings } = await buildEpubZipFromSpec({
    metadata: metadata || {},
    navXhtml,
    spineItems,
    kindleSafeCss,
    coverDataUrl: coverDataUrl || metadata?.coverDataUrl || null,
  })

  const validation = {
    ok: true,
    tool: 'structure-jszip',
    details:
      'Conteneur EPUB 3 (mimetype STORED + OEBPS). Validez avec EPUBCheck en externe si besoin.',
    warnings: [...warnings],
  }

  return {
    blob,
    report: {
      warnings,
      validation,
      kindleSafeCss,
      metadata: metadata || {},
    },
  }
}

