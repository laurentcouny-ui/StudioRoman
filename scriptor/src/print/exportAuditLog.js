/**
 * Journal d'export print — synthèse pour traçabilité (CDC Brique 4 : warnings, ICC, validation, hash).
 * Objet sérialisable JSON, sans blobs binaires.
 */

/**
 * @param {object} opts
 * @returns {object}
 */
export function buildPrintExportAuditLog(opts = {}) {
  const {
    generatedAtSec = Math.floor(Date.now() / 1000),
    stamp = null,
    sagaTitle = null,
    profile = null,
    printerPlatform = '',
    printerMarket = '',
    printerDistribution = '',
    coverType = '',
    trimFormat = '',
    selectedFormat = null,
    estimatedPages = 0,
    geometry = null,
    fontMode = 'embedded',
    pdfExportX1a = false,
    massicotShiftIn = 0,
    printAlerts = null,
    coverGamutScreening = null,
    coverPrintPreflight = null,
    manuscriptImagesPreflight = null,
    printValidationReport = null,
    printCost = null,
    creep = null,
    spineOverflow = null,
    gutterScore = null,
  } = opts

  const viteEnv =
    typeof import.meta !== 'undefined' && import.meta.env
      ? { mode: import.meta.env.MODE, prod: Boolean(import.meta.env.PROD) }
      : null

  return {
    schema: 'scriptor.print-export-audit.v1',
    generatedAt: generatedAtSec,
    exportStamp: stamp,
    toolchain: viteEnv,
    saga: { title: sagaTitle },
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          version: profile.version,
          validFrom: profile.validFrom,
          iccProfile: profile.iccProfile,
        }
      : null,
    job: {
      printerPlatform,
      printerMarket,
      printerDistribution,
      coverType,
      trimFormat,
      trimSizeIn: selectedFormat ? { widthIn: selectedFormat.width, heightIn: selectedFormat.height } : null,
      estimatedPages,
      fontMode,
      pdfStandardIntent: pdfExportX1a ? 'PDF/X-1a' : 'PDF/X-4',
      massicotShiftIn,
    },
    geometry: geometry
      ? {
          spine: geometry.spine
            ? {
                widthIn: geometry.spine.widthIn,
                toleranceIn: geometry.spine.toleranceIn,
              }
            : null,
          cover: geometry.cover
            ? { widthIn: geometry.cover.widthIn, heightIn: geometry.cover.heightIn }
            : null,
        }
      : null,
    creep: creep
      ? { suggested: Boolean(creep.suggested), enabled: Boolean(creep.enabled) }
      : null,
    spineOverflow: spineOverflow ? { warning: Boolean(spineOverflow.warning) } : null,
    gutter: gutterScore
      ? { score: gutterScore.score, warning: Boolean(gutterScore.warning) }
      : null,
    costEstimate: printCost
      ? {
          price: printCost.price,
          currency: printCost.currency,
          mode: printCost.mode,
          validFrom: printCost.validFrom,
          outdated: Boolean(printCost.outdated),
        }
      : null,
    alerts: Array.isArray(printAlerts?.list) ? printAlerts.list : [],
    gamutScreening: coverGamutScreening
      ? {
          level: coverGamutScreening.level,
          percentRisky: coverGamutScreening.percentRisky,
          label: coverGamutScreening.label,
        }
      : null,
    coverPreflight: coverPrintPreflight
      ? {
          status: coverPrintPreflight.status,
          note: coverPrintPreflight.note,
          images: coverPrintPreflight.images,
        }
      : null,
    manuscriptImagesPreflight: manuscriptImagesPreflight
      ? {
          status: manuscriptImagesPreflight.status,
          note: manuscriptImagesPreflight.note,
          images: manuscriptImagesPreflight.images,
        }
      : null,
    lastPdfValidation: printValidationReport
      ? {
          standard: printValidationReport.standard,
          outputIntent: printValidationReport.outputIntent,
          fontMode: printValidationReport.fontMode,
          fileHashHint: printValidationReport.fileHashHint,
          layoutContext: printValidationReport.layoutContext || null,
          warnings: printValidationReport.warnings || [],
          validation: printValidationReport.validation
            ? {
                ok: printValidationReport.validation.ok,
                tool: printValidationReport.validation.tool,
                mode: printValidationReport.validation.mode,
                details: printValidationReport.validation.details,
                isoCompliant: printValidationReport.validation.isoCompliant,
              }
            : null,
          isoToolValidated: printValidationReport.isoToolValidated,
        }
      : null,
  }
}
