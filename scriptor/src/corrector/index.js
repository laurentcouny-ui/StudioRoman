export {
  checkFrenchParagraph,
  checkFrenchParagraphRealtime,
  toLegacyMatches,
} from './CorrecteurFacade.js'
export { getGramalecteIntegrationStatus } from './engines/gramalecteEngine.js'
export {
  ensureLexiqueIndex,
  getLexiqueIndexStatus,
  isLexiqueForm,
  isLexiqueLemma,
} from './database/lexiqueIndex.js'
export {
  ensureMorphalouIndex,
  startMorphalouLoad,
  getMorphalouIndexStatus,
  isMorphalouForm,
  getMorphalouFormCount,
} from './database/morphalouIndex.js'
export {
  searchCorpusSnippets,
  getCorpusSnippetIndexStatus,
  resetCorpusSnippetCache,
} from './database/corpusSnippetSearch.js'
export { analyzeContextOnDemand, terminateContextWorker } from './ContextualEngine.js'
export { notifyCorrectionAccepted } from './walIntegration.js'
export { pickPrimaryRule } from './database/modernityFilter.js'
export {
  CORRECTOR_MODE,
  getCorrectorMode,
  setCorrectorMode,
  getGraceDelayMs,
  setGraceDelayMs,
  silentAutoEnabledForMode,
  showJournalChromeForMode,
  showSilentJournalUi,
  showGraceDelayHint,
  showInlineAnalysisHighlights,
  showExpertChrome,
  getAbsoluteConfidenceMode,
  setAbsoluteConfidenceMode,
} from './CorrectorModes.js'
export { SilentJournal } from './SilentJournal.js'
export { createGraceScheduler } from './graceScheduler.js'
export {
  subscribeCorrectorEco,
  getCorrectorEcoState,
  isEcoParagraphOnly,
  ECO_MODE_MESSAGE,
} from './correctorEcoThrottle.js'
export { applySilentCorrectionsToEditor } from './silentCorrections.js'
export { isUnderTemporalShield } from './temporalShield.js'
export { evaluatePhantomHomophone } from './phantomHomophone.js'
export {
  recordStyleIndignation,
  recordIndignationCorrectionKept,
  recordCestMonStyle,
  countIntentionRules,
  getLibertyStatistics,
} from './IntentionMemory.js'
export {
  collectBibleSurfaceTerms,
  findNominalCoherenceIssues,
  findBibleCanonOrthographyIssues,
  detectBibleRenameSinceLastSnapshot,
} from './BibleSync.js'
export {
  loadPersonalDictionary,
  addPersonalEntry,
  getMergedUserWordsForProject,
  matchesPersonalOrBible,
} from './PersonalDictionary.js'
export { normalizePhoneticKey } from './phoneticUtils.js'
export { analyzeSequence3, computeTextFingerprint } from './sequence3Analyzer.js'
export {
  inferMatchCategory,
  filterMatchesByFocus,
  matchKey,
  computeCertainScore,
} from './analysisUiHelpers.js'
export { applyLtHighlights, clearLtHighlights } from './editorHighlights.js'
export { limitHighlightMatches } from './densityLimiter.js'
export { replaceTextByOffset } from './editorTextOps.js'
export {
  findBlockAncestor,
  resolvePathToNode,
  getDomPathKeyFromNode,
  getPlainOffsetUpTo,
} from './editorDomUtils.js'
