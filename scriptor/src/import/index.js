export { sanitizeProjectSlug, deriveProjectSlugFromProject } from './projectSlug.js'
export { docxHtmlToChapterPlain, elementToPivotText } from './pivotFormat.js'
export {
  runPreflight,
  startImportSession,
  sha256HexFile,
  sha256HexArrayBuffer,
  commitImportSession,
  attachBackupToSession,
  saveImportLog,
  listRecentImportLogs,
  importStageSceneText,
  importCommitStagedScenes,
  importRestoreFromPreImportBackup,
} from './importSessionClient.js'
export { extractDocxArrayBuffer } from './extractDocx.js'
export { extractPdfArrayBuffer } from './extractPdf.js'
export { extractManuscriptWithWorker, extractManuscriptFromArrayBuffer } from './manuscriptParse.js'
export { readFileAsArrayBufferChunked } from './io/readFileChunked.js'
export { buildAstFromParsed } from './ast/buildAst.js'
export { generatePatchesForText, applyTypoPatchesToString } from './patches/generate.js'
export { collapseTypoPatches } from './patches/collapse.js'
export { detectFrench } from './patches/lang.js'
export { buildParserContextSnapshot, PARSER_VERSION } from './parserContext.js'
export { applyTypoGroupsToParsed } from './applyParsed.js'
export { buildDiffSpans, spansToHtml } from './diff/granular.js'
export {
  groupPdfTextItemsIntoLines,
  reconstructPdfParagraphsFromLines,
  pdfTextContentToPlainParagraphs,
} from './pdf/reconstructParagraphs.js'
export { startsWithInciseVerb, firstWordLower, INCISE_WORDS } from './pdf/inciseVerbs.js'
export { joinedPlainFromParsed, semanticFingerprint50 } from './semanticHash.js'
export { scoreImportAgainstSaga, levenshtein } from './importScoring.js'
