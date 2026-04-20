import {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from 'react'
import { countWords } from './projectStore.js'
import {
  checkText,
  addToUserDictionary,
  loadUserDictionary,
  isInUserDictionary,
} from './correctorService.js'
import { notifyCorrectionAccepted } from './corrector/walIntegration.js'
import {
  CORRECTOR_MODE,
  getCorrectorMode,
  setCorrectorMode,
  getGraceDelayMs,
  silentAutoEnabledForMode,
  showSilentJournalUi,
  showGraceDelayHint,
  showInlineAnalysisHighlights,
  showExpertChrome,
  SilentJournal,
  createGraceScheduler,
  applySilentCorrectionsToEditor,
  findBlockAncestor,
  resolvePathToNode,
  getDomPathKeyFromNode,
  getPlainOffsetUpTo,
  isUnderTemporalShield,
  recordStyleIndignation,
  recordIndignationCorrectionKept,
  analyzeSequence3,
  computeTextFingerprint,
  getAbsoluteConfidenceMode,
  setAbsoluteConfidenceMode,
  filterMatchesByFocus,
  computeCertainScore,
  matchKey,
  recordCestMonStyle,
  getLibertyStatistics,
  applyLtHighlights,
  clearLtHighlights,
  limitHighlightMatches,
  replaceTextByOffset,
  startMorphalouLoad,
  subscribeCorrectorEco,
  ECO_MODE_MESSAGE,
} from './corrector/index.js'
import { createAnnotation, deleteAnnotationById } from './annotationClient.js'

const SCENE_STATUSES = [
  { id: 'draft', label: 'Brouillon' },
  { id: 'to-revise', label: 'À réviser' },
  { id: 'done', label: 'Terminé' },
]

const ANNOTATION_TAGS = [
  { id: 'pas satisfait', label: 'Pas satisfait', cls: 'is-unsatisfied' },
  { id: 'à développer', label: 'À développer', cls: 'is-develop' },
  { id: 'idée ici', label: 'Idée ici', cls: 'is-idea' },
]

/** Panneau latéral : chunk séparé, monté seulement quand le panneau est ouvert. */
const LazyWritingRightPanelContent = lazy(() => import('./WritingRightPanelContent.jsx'))

function WritingTab({
  project,
  currentSaga,
  selectedIds,
  sceneText,
  characters,
  isFocusMode,
  onToggleFocus,
  onSelectScene,
  onSelectCharacter,
  onAddScene,
  onAddSceneToChapter,
  onRequestDeleteScene,
  onAddChapter,
  onRequestDeleteChapter,
  onReorderScenes,
  onReorderChapters,
  onUpdateSceneField,
  onUpdateChapterField,
  onUpdateVolumeTitle,
  onChangeSceneText,
}) {
  const ANALYSIS_HISTORY_KEY = 'scriptor-analysis-history-v1'
  const ANALYSIS_HIDE_STALE_KEY = 'scriptor-analysis-hide-stale-v1'
  const { volumeId, chapterId, sceneId } = selectedIds
  const volumes = currentSaga?.volumes ?? []

  const currentVolume = volumes.find((v) => v.id === volumeId)
  const currentChapter =
    currentVolume?.chapters.find((c) => c.id === chapterId) || null
  const currentScene =
    currentChapter?.scenes.find((s) => s.id === sceneId) || null

  const currentChapterIndex =
    currentVolume && currentChapter
      ? currentVolume.chapters.findIndex((c) => c.id === chapterId)
      : -1
  const currentSceneIndex =
    currentChapter && currentScene
      ? currentChapter.scenes.findIndex((s) => s.id === sceneId)
      : -1

  const sceneWordCount =
    (currentScene && typeof currentScene.wordCount === 'number'
      ? currentScene.wordCount
      : countWords(sceneText || ''))

  const [fontSize, setFontSize] = useState(16)
  const [lineHeight, setLineHeight] = useState(1.6)
  const [fontFamily, setFontFamily] = useState('lora')
  /** Marges latérales de la zone de texte (usage type éditeur / manuscrit). */
  const [editorMarginPreset, setEditorMarginPreset] = useState('standard')
  const [fontColor, setFontColor] = useState('#111827')
  const [rightPanelOpen, setRightPanelOpen] = useState(false)
  /** Panneau IA élargi sur toute la colonne éditeur (masque momentanément la zone de texte sous le panneau). */
  const [rightPanelWide, setRightPanelWide] = useState(false)
  /** Incrémenté à chaque ouverture du panneau → remontage propre du chunk lazy / iframe. */
  const [rightPanelMountKey, setRightPanelMountKey] = useState(0)
  const editorRef = useRef(null)
  const sceneTextRef = useRef(sceneText)
  sceneTextRef.current = sceneText
  const correctionRangeRef = useRef(null)
  const annotationRangeRef = useRef(null)
  const lastMinusAtRef = useRef(0)
  const MINUS_TO_EMDASH_MS = 260

  const onChangeSceneTextRef = useRef(onChangeSceneText)
  onChangeSceneTextRef.current = onChangeSceneText
  const silentJournalRef = useRef(new SilentJournal())
  const graceSchedulerRef = useRef(null)
  const lastCaretPlainOffsetRef = useRef(0)
  const lastSilentBlockPathRef = useRef('_')
  const preSilentSnapshotRef = useRef({ path: '', html: /** @type {string | null} */ (null) })
  const [hasParagraphUndo, setHasParagraphUndo] = useState(false)
  const [indignationToast, setIndignationToast] = useState(/** @type {string | null} */ (null))
  const [indignationPromptOpen, setIndignationPromptOpen] = useState(false)
  const [correctorMode, setCorrectorModeState] = useState(() =>
    typeof window !== 'undefined' ? getCorrectorMode() : CORRECTOR_MODE.SIMPLE,
  )
  /** CDC séquence 1 : smart throttling → silencieuses seulement en fin de paragraphe. */
  const [ecoParagraphOnly, setEcoParagraphOnly] = useState(false)
  const [silentJournalOpen, setSilentJournalOpen] = useState(false)
  const [silentJournalFilter, setSilentJournalFilter] = useState('all')
  const [silentUiTick, setSilentUiTick] = useState(0)
  const [analysisRunning, setAnalysisRunning] = useState(false)
  const [analysisProgressLine, setAnalysisProgressLine] = useState(/** @type {string | null} */ (null))
  const [analysisReport, setAnalysisReport] = useState(null)
  const [analysisError, setAnalysisError] = useState('')
  const [selectedAnalysisKey, setSelectedAnalysisKey] = useState('')
  const [hideStaleAnalysisItems, setHideStaleAnalysisItems] = useState(() => {
    if (typeof window === 'undefined') return true
    try {
      let v = window.localStorage.getItem(ANALYSIS_HIDE_STALE_KEY)
      if (v == null) v = window.sessionStorage.getItem(ANALYSIS_HIDE_STALE_KEY)
      if (v === '0') return false
      return true
    } catch {
      return true
    }
  })
  const analysisUndoStackRef = useRef([])
  const analysisRedoStackRef = useRef([])
  const analysisHistoryBySceneRef = useRef({})
  const [analysisHistoryTick, setAnalysisHistoryTick] = useState(0)

  /** Confiance absolue : LT + base ≥ ~99,5 %, sans arbitre ambigu (CDC séquence 4). */
  const [absoluteConfidence, setAbsoluteConfidenceState] = useState(() =>
    typeof window !== 'undefined' ? getAbsoluteConfidenceMode() : false,
  )
  /** Mode Focus pour la liste d’analyse. */
  const [analysisFocus, setAnalysisFocus] = useState(
    /** @type {'all' | 'grammar' | 'spelling' | 'punctuation' | 'repetition'} */ ('all'),
  )
  /** Clés `offset-length` ignorées pour cette session d’analyse. */
  const [ignoredAnalysisKeys, setIgnoredAnalysisKeys] = useState(/** @type {string[]} */ ([]))
  const [analysisNavIndex, setAnalysisNavIndex] = useState(0)
  const [whyExpandedKey, setWhyExpandedKey] = useState('')
  const [certModalOpen, setCertModalOpen] = useState(false)
  const [certAckText, setCertAckText] = useState('')
  const [certResultShown, setCertResultShown] = useState(false)

  const toggleAbsoluteConfidence = useCallback(() => {
    const next = !getAbsoluteConfidenceMode()
    setAbsoluteConfidenceMode(next)
    setAbsoluteConfidenceState(next)
  }, [])

  const saveSceneHistory = useCallback((sid) => {
    if (!sid) return
    analysisHistoryBySceneRef.current[sid] = {
      undo: [...analysisUndoStackRef.current],
      redo: [...analysisRedoStackRef.current],
    }
    try {
      window.sessionStorage.setItem(
        ANALYSIS_HISTORY_KEY,
        JSON.stringify(analysisHistoryBySceneRef.current),
      )
    } catch {
      // ignore quota/sessionStorage errors
    }
  }, [])

  const pushAnalysisUndoSnapshot = useCallback(
    (sid, html) => {
      if (!sid || typeof html !== 'string') return
      analysisUndoStackRef.current.push(html)
      if (analysisUndoStackRef.current.length > 30) analysisUndoStackRef.current.shift()
      analysisRedoStackRef.current = []
      saveSceneHistory(sid)
      setAnalysisHistoryTick((t) => t + 1)
    },
    [saveSceneHistory],
  )

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(ANALYSIS_HISTORY_KEY) || '{}'
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        analysisHistoryBySceneRef.current = parsed
      }
    } catch {
      analysisHistoryBySceneRef.current = {}
    }
  }, [])

  useEffect(() => {
    if (!sceneId) {
      analysisUndoStackRef.current = []
      analysisRedoStackRef.current = []
      setAnalysisHistoryTick((t) => t + 1)
      return
    }
    const bucket = analysisHistoryBySceneRef.current[sceneId]
    analysisUndoStackRef.current = Array.isArray(bucket?.undo)
      ? bucket.undo.filter((x) => typeof x === 'string').slice(-30)
      : []
    analysisRedoStackRef.current = Array.isArray(bucket?.redo)
      ? bucket.redo.filter((x) => typeof x === 'string').slice(-30)
      : []
    setAnalysisHistoryTick((t) => t + 1)
  }, [sceneId])

  useEffect(() => {
    const unsubEco = subscribeCorrectorEco(({ eco }) => {
      setEcoParagraphOnly(!!eco)
    })
    return () => unsubEco()
  }, [])

  useEffect(() => {
    if (!sceneId) {
      graceSchedulerRef.current = null
      return undefined
    }
    silentJournalRef.current = new SilentJournal()
    preSilentSnapshotRef.current = { path: '', html: null }
    setHasParagraphUndo(false)
    setSilentUiTick((t) => t + 1)
    const delayMs = getGraceDelayMs()
    const sched = createGraceScheduler({
      delayMs,
      ecoParagraphOnly,
      onFire: () => {
        const el = editorRef.current
        if (!el) return
        const mode = getCorrectorMode()
        if (!silentAutoEnabledForMode(mode)) return

        const plain = el.innerText || ''
        const off = lastCaretPlainOffsetRef.current
        if (isUnderTemporalShield(plain, off)) return

        const path = lastSilentBlockPathRef.current
        let block = null
        if (path && path !== '_') {
          const raw = resolvePathToNode(el, path)
          block =
            raw?.nodeType === Node.ELEMENT_NODE
              ? raw
              : raw?.parentElement ?? null
        }
        const hadSnapshot = !!(path && path !== '_' && block && el.contains(block))
        if (hadSnapshot && block) {
          preSilentSnapshotRef.current = { path, html: block.innerHTML }
        } else {
          preSilentSnapshotRef.current = { path: '', html: null }
        }

        const { changed, journalEntries } = applySilentCorrectionsToEditor(el)
        if (!changed) {
          preSilentSnapshotRef.current = { path: '', html: null }
          setHasParagraphUndo(false)
          return
        }
        for (const e of journalEntries) {
          silentJournalRef.current.push(e)
        }
        onChangeSceneTextRef.current(el.innerHTML)
        setHasParagraphUndo(hadSnapshot)
        setSilentUiTick((x) => x + 1)
      },
    })
    graceSchedulerRef.current = sched
    return () => {
      sched.dispose()
      graceSchedulerRef.current = null
    }
  }, [sceneId, ecoParagraphOnly])

  /** Précharge la base Morphalou en arrière-plan (complément LT — CDC Brique 5 / onglet Écriture). */
  useEffect(() => {
    if (!sceneId) return undefined
    startMorphalouLoad()
    return undefined
  }, [sceneId])

  useEffect(() => {
    setAnalysisReport(null)
    setAnalysisError('')
    setSelectedAnalysisKey('')
    clearLtHighlights(editorRef.current)
  }, [sceneId])

  const syncEditorCaretRefs = useCallback(() => {
    const el = editorRef.current
    const sel = window.getSelection?.()
    if (!el || !sel?.anchorNode || !el.contains(sel.anchorNode)) return
    lastCaretPlainOffsetRef.current = getPlainOffsetUpTo(
      el,
      sel.anchorNode,
      sel.anchorOffset,
    )
    const block = findBlockAncestor(sel.anchorNode, el)
    lastSilentBlockPathRef.current = block
      ? getDomPathKeyFromNode(block, el)
      : '_'
  }, [])

  const scheduleSilentAfterEditorMutation = useCallback(() => {
    const el = editorRef.current
    const sched = graceSchedulerRef.current
    if (!el || !sched) return
    syncEditorCaretRefs()
    sched.onInput(
      () => el.innerText || '',
      () => {
        const sel = window.getSelection?.()
        if (!sel?.anchorNode || !el.contains(sel.anchorNode)) return '_'
        const block = findBlockAncestor(sel.anchorNode, el)
        return block ? getDomPathKeyFromNode(block, el) : '_'
      },
    )
  }, [syncEditorCaretRefs])

  useEffect(() => {
    if (!indignationToast) return undefined
    const t = window.setTimeout(() => setIndignationToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [indignationToast])

  const applyParagraphHtmlRestore = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const { path, html } = preSilentSnapshotRef.current
    if (!path || html == null) return
    const raw = resolvePathToNode(el, path)
    const block =
      raw?.nodeType === Node.ELEMENT_NODE ? raw : raw?.parentElement ?? null
    if (!block || !el.contains(block)) return
    block.innerHTML = html
    onChangeSceneText(el.innerHTML)
    preSilentSnapshotRef.current = { path: '', html: null }
    setHasParagraphUndo(false)
    setSilentUiTick((t) => t + 1)
  }, [onChangeSceneText])

  const confirmIndignationStyle = useCallback(() => {
    const el = editorRef.current
    const path = preSilentSnapshotRef.current.path
    applyParagraphHtmlRestore()
    if (path && el) {
      const raw = resolvePathToNode(el, path)
      const block =
        raw?.nodeType === Node.ELEMENT_NODE ? raw : raw?.parentElement ?? null
      if (block) recordStyleIndignation(project?.id, (block.innerText || '').slice(0, 280))
    }
    setIndignationToast('Préférence enregistrée pour le futur profil Style.')
    setIndignationPromptOpen(false)
  }, [applyParagraphHtmlRestore, project?.id])

  const confirmIndignationError = useCallback(() => {
    const el = editorRef.current
    const { path } = preSilentSnapshotRef.current
    const raw = path && el ? resolvePathToNode(el, path) : null
    const block =
      raw?.nodeType === Node.ELEMENT_NODE ? raw : raw?.parentElement ?? null
    recordIndignationCorrectionKept(project?.id, (block?.innerText || '').slice(0, 280))
    preSilentSnapshotRef.current = { path: '', html: null }
    setHasParagraphUndo(false)
    setIndignationPromptOpen(false)
    setIndignationToast('Merci — nous utiliserons ce retour pour améliorer le moteur.')
    setSilentUiTick((t) => t + 1)
  }, [project?.id])

  const runSequence3Analysis = useCallback(async () => {
    const el = editorRef.current
    if (!el || analysisRunning) return
    const plain = el.innerText || ''
    if (!plain.trim()) {
      setAnalysisError('Aucun texte à analyser.')
      setAnalysisReport(null)
      return
    }
    setAnalysisRunning(true)
    setAnalysisError('')
    setAnalysisProgressLine('Démarrage…')
    try {
      const report = await analyzeSequence3(plain, {
        userDict: loadUserDictionary(),
        includeCorpusSnippets: getCorrectorMode() === CORRECTOR_MODE.EXPERT,
        project,
        sagaId: currentSaga?.id,
        correctorMode,
        absoluteConfidence: getAbsoluteConfidenceMode(),
        onProgress: (msg) => setAnalysisProgressLine(msg),
      })
      setAnalysisReport(report)
      setIgnoredAnalysisKeys([])
      setAnalysisNavIndex(0)
      setWhyExpandedKey('')
      setSelectedAnalysisKey('')
      const limited = limitHighlightMatches(plain, report.active || [], correctorMode)
      if (showInlineAnalysisHighlights(correctorMode)) {
        applyLtHighlights(el, limited, { mode: correctorMode })
      } else {
        clearLtHighlights(el)
      }
    } catch (e) {
      setAnalysisError(String(e?.message || e || 'Analyse indisponible.'))
      setAnalysisReport(null)
      clearLtHighlights(el)
    } finally {
      setAnalysisRunning(false)
      setAnalysisProgressLine(null)
    }
  }, [analysisRunning, correctorMode, project, currentSaga?.id])

  const applyAnalysisSuggestion = useCallback(
    (m) => {
      const el = editorRef.current
      if (!el) return
      if (
        analysisReport?.baseTextHash &&
        computeTextFingerprint(el.innerText || '') !== analysisReport.baseTextHash
      ) {
        setAnalysisError('Le texte a changé depuis l’analyse. Relancez “Analyser”.')
        return
      }
      const plain = el.innerText || ''
      if (plain.slice(m.offset, m.offset + m.length) !== String(m?.excerpt || '')) {
        setAnalysisError('Cette suggestion a déjà été modifiée. Relancez “Analyser”.')
        return
      }
      if (m?.bibleNominal) return
      const repl = m?.replacements?.[0]
      if (!repl) return
      pushAnalysisUndoSnapshot(sceneId, el.innerHTML)
      const ok = replaceTextByOffset(el, m.offset, m.length, repl)
      if (!ok) return
      onChangeSceneText(el.innerHTML)
      scheduleSilentAfterEditorMutation()
      setAnalysisReport(null)
      setAnalysisError('')
      clearLtHighlights(el)
      saveSceneHistory(sceneId)
      notifyCorrectionAccepted()
    },
    [
      analysisReport?.baseTextHash,
      onChangeSceneText,
      scheduleSilentAfterEditorMutation,
      pushAnalysisUndoSnapshot,
      sceneId,
      saveSceneHistory,
    ],
  )

  const applyAllSafeFromAnalysis = useCallback(() => {
    const el = editorRef.current
    const report = analysisReport
    if (!el || !report?.active?.length) return
    if (
      report.baseTextHash &&
      computeTextFingerprint(el.innerText || '') !== report.baseTextHash
    ) {
      setAnalysisError('Le texte a changé depuis l’analyse. Relancez “Analyser”.')
      return
    }
    const safe = report.active
      .filter(
        (m) => (el.innerText || '').slice(m.offset, m.offset + m.length) === String(m.excerpt || ''),
      )
      .filter((m) => !m.bibleNominal)
      .filter((m) => m.replacements?.[0])
      .filter((m) => !m.candidateHomophone || m.phantomAllowed)
      .sort((a, b) => b.offset - a.offset)
    if (!safe.length) return
    pushAnalysisUndoSnapshot(sceneId, el.innerHTML)
    let changed = 0
    for (const m of safe) {
      const ok = replaceTextByOffset(el, m.offset, m.length, m.replacements[0])
      if (ok) changed += 1
    }
    if (!changed) return
    onChangeSceneText(el.innerHTML)
    scheduleSilentAfterEditorMutation()
    setAnalysisReport(null)
    setAnalysisError('')
    clearLtHighlights(el)
    saveSceneHistory(sceneId)
    notifyCorrectionAccepted()
  }, [analysisReport, onChangeSceneText, scheduleSilentAfterEditorMutation, pushAnalysisUndoSnapshot, sceneId, saveSceneHistory])

  const undoAnalysisApply = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const prev = analysisUndoStackRef.current.pop()
    if (typeof prev !== 'string') return
    analysisRedoStackRef.current.push(el.innerHTML)
    el.innerHTML = prev
    onChangeSceneText(el.innerHTML)
    scheduleSilentAfterEditorMutation()
    setAnalysisReport(null)
    setAnalysisError('')
    clearLtHighlights(el)
    setSelectedAnalysisKey('')
    saveSceneHistory(sceneId)
    setAnalysisHistoryTick((t) => t + 1)
    notifyCorrectionAccepted()
  }, [onChangeSceneText, scheduleSilentAfterEditorMutation, sceneId, saveSceneHistory])

  const redoAnalysisApply = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const next = analysisRedoStackRef.current.pop()
    if (typeof next !== 'string') return
    analysisUndoStackRef.current.push(el.innerHTML)
    if (analysisUndoStackRef.current.length > 30) analysisUndoStackRef.current.shift()
    el.innerHTML = next
    onChangeSceneText(el.innerHTML)
    scheduleSilentAfterEditorMutation()
    setAnalysisReport(null)
    setAnalysisError('')
    clearLtHighlights(el)
    setSelectedAnalysisKey('')
    saveSceneHistory(sceneId)
    setAnalysisHistoryTick((t) => t + 1)
    notifyCorrectionAccepted()
  }, [onChangeSceneText, scheduleSilentAfterEditorMutation, sceneId, saveSceneHistory])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return
      const k = String(e.key || '').toLowerCase()
      if (k === 'z') {
        e.preventDefault()
        undoAnalysisApply()
      } else if (k === 'y') {
        e.preventDefault()
        redoAnalysisApply()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [undoAnalysisApply, redoAnalysisApply])

  const focusAnalysisMatch = useCallback((m) => {
    const el = editorRef.current
    if (!el) return
    const key = `${m.offset}-${m.length}`
    setSelectedAnalysisKey(key)
    const selector = `.corrector-lt-mark[data-lt-offset="${m.offset}"][data-lt-length="${m.length}"]`
    const mark = el.querySelector(selector)
    if (!(mark instanceof HTMLElement)) return
    mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    mark.classList.remove('is-focused')
    void mark.offsetWidth
    mark.classList.add('is-focused')
    window.setTimeout(() => mark.classList.remove('is-focused'), 1200)
    el.focus()
  }, [])

  const toggleHideStaleAnalysisItems = useCallback(() => {
    setHideStaleAnalysisItems((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(ANALYSIS_HIDE_STALE_KEY, next ? '1' : '0')
        window.sessionStorage.removeItem(ANALYSIS_HIDE_STALE_KEY)
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const [correctionMenu, setCorrectionMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    word: '',
    replacements: [],
    message: '',
    loading: false,
    temporalShield: false,
  })
  const [annotationMenu, setAnnotationMenu] = useState({
    open: false,
    x: 0,
    y: 0,
  })

  /** Étend la sélection au mot sous le curseur (pour le correcteur). */
  const getWordRangeAndText = useCallback(() => {
    const sel = document.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0).cloneRange()
    const startNode = range.startContainer
    if (startNode.nodeType !== Node.TEXT_NODE) return null
    const text = startNode.textContent || ''
    const startOffset = range.startOffset
    const before = text.slice(0, startOffset)
    const after = text.slice(startOffset)
    const startMatch = before.match(/([\p{L}\p{M}'-]+)$/u)
    const endMatch = after.match(/^([\p{L}\p{M}'-]*)/u)
    const wordStart = startMatch ? startMatch[1].length : 0
    const wordEnd = endMatch ? endMatch[1].length : 0
    const word = (startMatch ? startMatch[1] : '') + (endMatch ? endMatch[1] : '')
    if (!word) return null
    range.setStart(startNode, startOffset - wordStart)
    range.setEnd(startNode, startOffset + wordEnd)
    return { range, word }
  }, [])

  const closeCorrectionMenu = useCallback(() => {
    setCorrectionMenu((m) => ({ ...m, open: false }))
    correctionRangeRef.current = null
  }, [])

  const handleEditorContextMenu = useCallback(
    async (e) => {
      if (!editorRef.current) return
      e.preventDefault()
      const sel = document.getSelection()
      if (!sel || sel.rangeCount === 0) return
      let range
      let word
      if (sel.isCollapsed) {
        const info = getWordRangeAndText()
        if (!info) return
        range = info.range
        word = info.word
      } else {
        range = sel.getRangeAt(0).cloneRange()
        word = (sel.toString() || '').trim()
      }
      if (!word) return
      correctionRangeRef.current = { range, word }
      setCorrectionMenu({
        open: true,
        x: e.clientX,
        y: e.clientY,
        word,
        replacements: [],
        message: '',
        loading: true,
        temporalShield: false,
      })
      const editorRoot = editorRef.current
      const documentPlain = editorRoot.innerText || ''
      const cursorOffset = getPlainOffsetUpTo(
        editorRoot,
        range.startContainer,
        range.startOffset,
      )
      const res = await checkText(word, { documentPlain, cursorOffset })
      const first = res.matches[0]
      const replacements = first ? first.replacements : []
      const message =
        res.temporalShield && res.hint
          ? res.hint
          : first
            ? first.message
            : res.linguisticHint || ''
      setCorrectionMenu((m) =>
        m.open
          ? {
              ...m,
              replacements,
              message,
              loading: false,
              temporalShield: !!res.temporalShield,
            }
          : m,
      )
    },
    [getWordRangeAndText],
  )

  const applyCorrection = useCallback(
    (replacement) => {
      const ref = correctionRangeRef.current
      if (!ref?.range || !editorRef.current) {
        closeCorrectionMenu()
        return
      }
      try {
        ref.range.deleteContents()
        const node = document.createTextNode(replacement)
        ref.range.insertNode(node)
        ref.range.setStartAfter(node)
        ref.range.setEndAfter(node)
        onChangeSceneText(editorRef.current.innerHTML)
        scheduleSilentAfterEditorMutation()
        notifyCorrectionAccepted()
      } catch {
        // plage de remplacement invalide: on ferme simplement le menu
      }
      closeCorrectionMenu()
    },
    [onChangeSceneText, closeCorrectionMenu, scheduleSilentAfterEditorMutation],
  )

  const addWordToDictionary = useCallback(() => {
    const ref = correctionRangeRef.current
    const word = ref?.word || correctionMenu.word
    if (word) addToUserDictionary(word)
    closeCorrectionMenu()
  }, [correctionMenu.word, closeCorrectionMenu])

  const correctionMenuRef = useRef(null)
  const annotationMenuRef = useRef(null)
  useEffect(() => {
    if (!correctionMenu.open) return
    const onPointerDown = (e) => {
      if (correctionMenuRef.current?.contains(e.target)) return
      closeCorrectionMenu()
    }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onPointerDown)
      document.addEventListener('pointerdown', onPointerDown)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [correctionMenu.open, closeCorrectionMenu])

  const closeAnnotationMenu = useCallback(() => {
    setAnnotationMenu((m) => ({ ...m, open: false }))
    annotationRangeRef.current = null
  }, [])

  useEffect(() => {
    if (!annotationMenu.open) return
    const onPointerDown = (e) => {
      if (annotationMenuRef.current?.contains(e.target)) return
      closeAnnotationMenu()
    }
    const onEsc = (e) => {
      if (e.key === 'Escape') closeAnnotationMenu()
    }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onPointerDown)
      document.addEventListener('pointerdown', onPointerDown)
      window.addEventListener('keydown', onEsc, true)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onEsc, true)
    }
  }, [annotationMenu.open, closeAnnotationMenu])

  useEffect(() => {
    if (!isFocusMode) return
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (correctionMenu.open) {
        e.preventDefault()
        closeCorrectionMenu()
        return
      }
      e.preventDefault()
      onToggleFocus()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isFocusMode, correctionMenu.open, closeCorrectionMenu, onToggleFocus])

  const getTextOffsetInEditor = useCallback((container, offset) => {
    if (!editorRef.current) return 0
    const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT)
    let total = 0
    let current = walker.nextNode()
    while (current) {
      if (current === container) {
        return total + Math.max(0, Math.min(offset, current.textContent?.length || 0))
      }
      total += current.textContent?.length || 0
      current = walker.nextNode()
    }
    return total
  }, [])

  const openAnnotationMenuFromSelection = useCallback(() => {
    if (!editorRef.current) return
    const sel = window.getSelection?.()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      closeAnnotationMenu()
      return
    }
    const range = sel.getRangeAt(0)
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      closeAnnotationMenu()
      return
    }
    const selectedText = (sel.toString() || '').trim()
    if (!selectedText) {
      closeAnnotationMenu()
      return
    }

    const start = getTextOffsetInEditor(range.startContainer, range.startOffset)
    const end = getTextOffsetInEditor(range.endContainer, range.endOffset)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      closeAnnotationMenu()
      return
    }

    const rect = range.getBoundingClientRect()
    annotationRangeRef.current = {
      range: range.cloneRange(),
      debut: start,
      fin: end,
    }
    setAnnotationMenu({
      open: true,
      x: rect.left + rect.width / 2,
      y: Math.max(8, rect.top - 8),
    })
  }, [closeAnnotationMenu, getTextOffsetInEditor])

  const applyAnnotationTag = useCallback(
    (tagId, tagClass) => {
      const ref = annotationRangeRef.current
      if (!ref?.range || !editorRef.current) {
        closeAnnotationMenu()
        return
      }

      try {
        const span = document.createElement('span')
        span.className = `writing-annotation ${tagClass}`
        span.dataset.annotationTag = tagId
        const content = ref.range.extractContents()
        span.appendChild(content)
        ref.range.insertNode(span)
        onChangeSceneText(editorRef.current.innerHTML)
        scheduleSilentAfterEditorMutation()
        void createAnnotation({
          debut: ref.debut,
          fin: ref.fin,
          tag: tagId,
          timestamp: Date.now(),
        }).then((saved) => {
          if (saved?.id) span.dataset.annotationId = String(saved.id)
        })
      } catch {
        // Sélection multi-noeuds trop complexe pour surroundContents -> on sauvegarde quand même l'annotation JSON.
        void createAnnotation({
          debut: ref.debut,
          fin: ref.fin,
          tag: tagId,
          timestamp: Date.now(),
        })
      }
      closeAnnotationMenu()
    },
    [closeAnnotationMenu, onChangeSceneText, scheduleSilentAfterEditorMutation],
  )

  const handleEditorDoubleClick = useCallback(
    (e) => {
      if (!editorRef.current) return
      const target = e.target
      if (!(target instanceof Element)) return
      const ann = target.closest('.writing-annotation')
      if (!ann || !editorRef.current.contains(ann)) return

      const id = ann.getAttribute('data-annotation-id') || ''
      const parent = ann.parentNode
      if (!parent) return
      while (ann.firstChild) parent.insertBefore(ann.firstChild, ann)
      parent.removeChild(ann)
      onChangeSceneText(editorRef.current.innerHTML)
      scheduleSilentAfterEditorMutation()
      if (id) void deleteAnnotationById(id)
    },
    [onChangeSceneText, scheduleSilentAfterEditorMutation],
  )

  useLayoutEffect(() => {
    if (!editorRef.current || !sceneId) return
    // Ne resynchroniser le DOM de l'éditeur qu'au changement de scène.
    // Sinon, chaque update React pendant la frappe peut remettre le curseur/scroll en haut.
    editorRef.current.innerHTML = sceneTextRef.current || ''
  }, [sceneId])

  const applyFormat = (command, value = null) => {
    if (!editorRef.current) return
    editorRef.current.focus()

    const sel = window.getSelection?.()
    const canUseSelection = !!(sel && sel.rangeCount > 0)
    const currentRange = canUseSelection ? sel.getRangeAt(0) : null
    const insideEditor = !!(
      currentRange && editorRef.current.contains(currentRange.commonAncestorContainer)
    )

    const applyInlineStyle = (property, styleValue) => {
      if (!insideEditor || !currentRange || !sel) return false
      if (currentRange.collapsed) return false
      try {
        const span = document.createElement('span')
        span.style[property] = styleValue
        const content = currentRange.extractContents()
        span.appendChild(content)
        currentRange.insertNode(span)
        const next = document.createRange()
        next.selectNodeContents(span)
        sel.removeAllRanges()
        sel.addRange(next)
        return true
      } catch {
        return false
      }
    }

    const applyBlockAlignment = (alignValue) => {
      if (!insideEditor || !currentRange) return false
      let node =
        currentRange.commonAncestorContainer.nodeType === Node.TEXT_NODE
          ? currentRange.commonAncestorContainer.parentElement
          : currentRange.commonAncestorContainer
      while (node && node !== editorRef.current) {
        if (
          node.nodeType === Node.ELEMENT_NODE &&
          ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE'].includes(
            node.tagName,
          )
        ) {
          node.style.textAlign = alignValue
          return true
        }
        node = node.parentElement
      }
      editorRef.current.style.textAlign = alignValue
      return true
    }

    let done = false
    if (command === 'bold') done = applyInlineStyle('fontWeight', '700')
    else if (command === 'italic') done = applyInlineStyle('fontStyle', 'italic')
    else if (command === 'underline') done = applyInlineStyle('textDecoration', 'underline')
    else if (command === 'foreColor') done = applyInlineStyle('color', value || '#ffffff')
    else if (command === 'justifyLeft') done = applyBlockAlignment('left')
    else if (command === 'justifyCenter') done = applyBlockAlignment('center')
    else if (command === 'justifyRight') done = applyBlockAlignment('right')
    else if (command === 'justifyFull') done = applyBlockAlignment('justify')

    if (!done) {
      try {
        document.execCommand?.(command, false, value)
      } catch {
        /* no-op */
      }
    }
    onChangeSceneText(editorRef.current.innerHTML)
    scheduleSilentAfterEditorMutation()
  }

  const handleEditorInput = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    clearLtHighlights(el)
    onChangeSceneText(el.innerHTML)
    scheduleSilentAfterEditorMutation()
    setAnalysisReport(null)
    setAnalysisError('')
  }, [onChangeSceneText, scheduleSilentAfterEditorMutation])

  const handleEditorKeyDown = useCallback(
    (e) => {
      // "Double appui sur -" => remplacer "--" par un tiret cadratin "—"
      if (e.key !== '-' || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return
      const now = Date.now()
      const dt = now - (lastMinusAtRef.current || 0)
      if (dt > MINUS_TO_EMDASH_MS) {
        lastMinusAtRef.current = now
        return
      }

      // Second '-' rapide : on remplace le '-' juste avant le caret.
      e.preventDefault()

      const sel = window.getSelection?.()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      if (!editorRef.current?.contains(range.commonAncestorContainer)) return

      try {
        const sc = range.startContainer
        const so = range.startOffset
        // Cas le plus simple : caret dans un noeud texte.
        if (sc?.nodeType === Node.TEXT_NODE && typeof so === 'number' && so > 0) {
          const txt = sc.textContent || ''
          const prevChar = txt.slice(so - 1, so)
          // On ne remplace que si on est bien "juste après" un '-'.
          if (prevChar === '-') {
            range.setStart(sc, so - 1)
            range.setEnd(sc, so)
            range.deleteContents()
            const node = document.createTextNode('—')
            range.insertNode(node)
            range.setStartAfter(node)
            range.setEndAfter(node)
            sel.removeAllRanges()
            sel.addRange(range)
            if (editorRef.current) {
              onChangeSceneText(editorRef.current.innerHTML)
              scheduleSilentAfterEditorMutation()
            }
          } else {
            // Fallback : insérer le tiret cadratin à la position caret.
            const node = document.createTextNode('—')
            range.insertNode(node)
            range.setStartAfter(node)
            range.setEndAfter(node)
            sel.removeAllRanges()
            sel.addRange(range)
            if (editorRef.current) {
              onChangeSceneText(editorRef.current.innerHTML)
              scheduleSilentAfterEditorMutation()
            }
          }
        } else {
          // Fallback robuste : essayer execCommand (si disponible).
          try {
            document.execCommand?.('insertText', false, '—')
          } catch {
            const node = document.createTextNode('—')
            range.insertNode(node)
          }
          if (editorRef.current) {
            onChangeSceneText(editorRef.current.innerHTML)
            scheduleSilentAfterEditorMutation()
          }
        }
      } finally {
        lastMinusAtRef.current = 0
      }
    },
    [onChangeSceneText, scheduleSilentAfterEditorMutation],
  )

  const editorClassName = [
    'scene-editor',
    `ff-${fontFamily}`,
    isFocusMode ? 'in-focus-mode' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const editorMarginX =
    {
      narrow: '0.5rem',
      standard: '0.9rem',
      comfortable: '2.25rem',
      generous: '3.75rem',
    }[editorMarginPreset] ?? '0.9rem'

  const editorStyle = {
    fontSize: `${fontSize}px`,
    lineHeight,
    '--editor-pad-x': editorMarginX,
  }

  /** Contenu éditeur vide (ou seulement espaces/br) → afficher le placeholder. */
  const isEditorEffectivelyEmpty = !sceneText || !String(sceneText).replace(/<[^>]*>/g, '').trim()

  const charactersInSceneIds = Array.isArray(currentScene?.charactersInScene)
    ? currentScene.charactersInScene
    : []

  const handleAddCharacterToScene = (characterId) => {
    if (!currentScene) return
    if (!characterId) return
    if (charactersInSceneIds.includes(characterId)) return
    const nextList = [...charactersInSceneIds, characterId]

    onUpdateSceneField('charactersInScene', nextList)
  }

  const handleRemoveCharacterFromScene = (characterId) => {
    if (!currentScene) return
    const nextList = charactersInSceneIds.filter((id) => id !== characterId)
    onUpdateSceneField('charactersInScene', nextList)
  }

  const journalChrome = showSilentJournalUi(correctorMode)
  const expertChrome = showExpertChrome(correctorMode)
  const silentJournalTick = silentUiTick
  const analysisHistoryTickValue = analysisHistoryTick
  const canUndoAnalysis = analysisUndoStackRef.current.length > 0
  const canRedoAnalysis = analysisRedoStackRef.current.length > 0
  const editorPlainNow = editorRef.current?.innerText || ''
  const filteredAnalysisItems = useMemo(() => {
    if (!analysisReport?.active) return []
    let list = filterMatchesByFocus(analysisReport.active, analysisFocus)
    if (hideStaleAnalysisItems) {
      list = list.filter(
        (m) => editorPlainNow.slice(m.offset, m.offset + m.length) === String(m.excerpt || ''),
      )
    }
    return list.filter((m) => !ignoredAnalysisKeys.includes(matchKey(m)))
  }, [
    analysisReport,
    analysisFocus,
    hideStaleAnalysisItems,
    ignoredAnalysisKeys,
    editorPlainNow,
  ])

  const certainScore = useMemo(
    () =>
      analysisReport?.active?.length
        ? computeCertainScore(analysisReport.active, editorPlainNow)
        : null,
    [analysisReport, editorPlainNow],
  )

  useEffect(() => {
    setAnalysisNavIndex((i) => {
      const max = Math.max(0, filteredAnalysisItems.length - 1)
      return Math.min(i, max)
    })
  }, [filteredAnalysisItems.length])

  const currentAnalysisMatch =
    filteredAnalysisItems.length > 0
      ? filteredAnalysisItems[Math.min(analysisNavIndex, filteredAnalysisItems.length - 1)]
      : null

  const ignoreAnalysisMatch = useCallback((m) => {
    const k = matchKey(m)
    setIgnoredAnalysisKeys((prev) => (prev.includes(k) ? prev : [...prev, k]))
  }, [])

  const activeApplicableCount = analysisReport
    ? analysisReport.active.filter(
        (m) => editorPlainNow.slice(m.offset, m.offset + m.length) === String(m.excerpt || ''),
      ).length
    : 0
  const silentJournalEntries = silentJournalRef.current.listFiltered(
    silentJournalFilter === 'critical' ? 'critical' : 'all',
  )
  const silentGraceMs = getGraceDelayMs()
  void silentJournalTick
  void analysisHistoryTickValue

  return (
    <div
      className={`writing-layout${rightPanelOpen ? ' right-panel-open' : ''}${
        rightPanelOpen && rightPanelWide ? ' right-panel-wide' : ''
      }`}
    >
      {isFocusMode && (
        <button
          type="button"
          className="focus-mode-exit"
          onClick={onToggleFocus}
          title="Quitter le mode focus et le plein écran (Échap)"
        >
          Quitter le mode focus
        </button>
      )}
      <section className="structure-panel">
        <div className="panel-header">
          <h2>Structure</h2>
        </div>

        <div className="structure-list">
          {volumes.map((volume) => (
            <div key={volume.id} className="volume-block">
              <div className="structure-volume-title">
                <span className="structure-label">Tome</span>
                <input
                  type="text"
                  className="structure-volume-input"
                  value={volume.title ?? ''}
                  onChange={(e) => onUpdateVolumeTitle?.(volume.id, e.target.value)}
                  placeholder="Titre du tome"
                />
              </div>

              {volume.chapters.map((chapter, chapterIndex) => (
                <div key={chapter.id} className="chapter-block">
                  <div className="chapter-block-header">
                    <div className="chapter-heading-bar">
                      <div
                        className="structure-order-arrows"
                        role="group"
                        aria-label="Ordre du chapitre dans le tome"
                      >
                        <button
                          type="button"
                          className="structure-order-btn"
                          disabled={chapterIndex === 0}
                          onClick={() =>
                            onReorderChapters(volume.id, chapterIndex, chapterIndex - 1)
                          }
                          title="Monter le chapitre (et toutes ses scènes)"
                          aria-label="Monter le chapitre"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          className="structure-order-btn"
                          disabled={chapterIndex >= volume.chapters.length - 1}
                          onClick={() =>
                            onReorderChapters(volume.id, chapterIndex, chapterIndex + 1)
                          }
                          title="Descendre le chapitre (et toutes ses scènes)"
                          aria-label="Descendre le chapitre"
                        >
                          ▼
                        </button>
                      </div>
                      <span className="chapter-index-badge">
                        Chapitre {chapterIndex + 1}
                      </span>
                      <button
                        type="button"
                        className="chapter-delete"
                        onClick={() =>
                          onRequestDeleteChapter(volume.id, chapter.id)
                        }
                        title="Supprimer le chapitre"
                      >
                        Suppr.
                      </button>
                    </div>
                    <label className="chapter-title-field">
                      <span className="chapter-title-field-label">Nom du chapitre</span>
                      <input
                        type="text"
                        className="chapter-title-input"
                        value={chapter.title || ''}
                        onChange={(e) =>
                          onUpdateChapterField(volume.id, chapter.id, 'title', e.target.value)
                        }
                        placeholder="Ex. Chapitre 1 — L’arrivée à la citadelle"
                        aria-label={`Nom du chapitre ${chapterIndex + 1}`}
                      />
                    </label>
                  </div>

                  <ul className="scene-list" aria-label="Scènes du chapitre">
                    {chapter.scenes.map((scene, sceneIndex) => (
                      <li key={scene.id} className="scene-row">
                        <div
                          className="structure-order-arrows structure-order-arrows--scene"
                          role="group"
                          aria-label="Ordre de la scène"
                        >
                          <button
                            type="button"
                            className="structure-order-btn"
                            disabled={sceneIndex === 0}
                            onClick={() =>
                              onReorderScenes(
                                volume.id,
                                chapter.id,
                                sceneIndex,
                                sceneIndex - 1,
                              )
                            }
                            title="Monter la scène"
                            aria-label="Monter la scène"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="structure-order-btn"
                            disabled={sceneIndex >= chapter.scenes.length - 1}
                            onClick={() =>
                              onReorderScenes(
                                volume.id,
                                chapter.id,
                                sceneIndex,
                                sceneIndex + 1,
                              )
                            }
                            title="Descendre la scène"
                            aria-label="Descendre la scène"
                          >
                            ▼
                          </button>
                        </div>
                        <button
                          type="button"
                          className={
                            scene.id === sceneId
                              ? 'scene-button is-active'
                              : 'scene-button'
                          }
                          onClick={() =>
                            onSelectScene(volume.id, chapter.id, scene.id)
                          }
                        >
                          <span className="scene-index-label">Scène {sceneIndex + 1}</span>
                          {scene.title?.trim() ? (
                            <span className="scene-title">{scene.title.trim()}</span>
                          ) : (
                            <span className="scene-title scene-title--muted">
                              À nommer (champ titre à droite)
                            </span>
                          )}
                        </button>
                        {scene.id === sceneId && (
                          <button
                            type="button"
                            className="scene-delete"
                            onClick={() => onRequestDeleteScene(scene.id)}
                            title="Supprimer la scène"
                          >
                            Suppr.
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="chapter-actions">
                    <button
                      type="button"
                      className="structure-add-scene"
                      onClick={() => onAddSceneToChapter(volume.id, chapter.id)}
                    >
                      + Scène
                    </button>
                  </div>
                </div>
              ))}
              <div className="volume-add-chapter-row">
                <button
                  type="button"
                  className="structure-add-chapter-btn"
                  onClick={() => onAddChapter(volume.id)}
                  title="Ajouter un chapitre à ce tome"
                >
                  + Chapitre dans ce tome
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="panel-footer">
          <button type="button" className="primary" onClick={() => onAddChapter()}>
            + Nouveau chapitre (tome en cours)
          </button>
          <button type="button" className="primary structure-add-scene-global" onClick={onAddScene}>
            + Nouvelle scène (chapitre actuel)
          </button>
        </div>
      </section>

      <section className="editor-panel">
        {currentScene ? (
          <>
            <header className="editor-header">
              {currentChapterIndex >= 0 && currentSceneIndex >= 0 ? (
                <p className="editor-context-strip" aria-live="polite">
                  <span className="editor-context-part">
                    <span className="editor-context-k">Tome</span>{' '}
                    <span className="editor-context-v">
                      {currentVolume?.title?.trim() || '—'}
                    </span>
                  </span>
                  <span className="editor-context-sep" aria-hidden>
                    ·
                  </span>
                  <span className="editor-context-part">
                    <span className="editor-context-k">Chapitre {currentChapterIndex + 1}</span>
                    {currentChapter?.title?.trim() ? (
                      <span className="editor-context-v">
                        {' '}
                        — {currentChapter.title.trim()}
                      </span>
                    ) : null}
                  </span>
                  <span className="editor-context-sep" aria-hidden>
                    ·
                  </span>
                  <span className="editor-context-part">
                    <span className="editor-context-k">Scène {currentSceneIndex + 1}</span>
                  </span>
                </p>
              ) : null}
              <div className="editor-header-top">
                <input
                  className="scene-title-input"
                  value={currentScene.title}
                  onChange={(e) =>
                    onUpdateSceneField('title', e.target.value)
                  }
                  placeholder="Titre de la scène"
                />

                <button
                  type="button"
                  className={
                    isFocusMode ? 'focus-toggle is-active' : 'focus-toggle'
                  }
                  onClick={onToggleFocus}
                  title={
                    isFocusMode
                      ? 'Quitter le mode focus et le plein écran du navigateur (Échap)'
                      : 'Plein écran navigateur (masque barre d’adresse et onglets) + mode focus'
                  }
                >
                  {isFocusMode ? 'Quitter le mode focus' : 'Mode focus'}
                </button>
                {!isFocusMode && (
                  <button
                    type="button"
                    className={rightPanelOpen ? 'focus-toggle is-active' : 'focus-toggle'}
                    onClick={() =>
                      setRightPanelOpen((v) => {
                        const next = !v
                        if (next) setRightPanelMountKey((k) => k + 1)
                        else setRightPanelWide(false)
                        return next
                      })
                    }
                    title={rightPanelOpen ? 'Fermer Studio Roman IA' : 'Ouvrir Studio Roman IA'}
                  >
                    {rightPanelOpen ? '✕ Studio Roman IA' : '✦ Studio Roman IA'}
                  </button>
                )}
              </div>

              <div className="editor-meta">
                <label className="field">
                  <span className="field-label">Point de vue</span>
                  <input
                    value={currentScene.pov}
                    onChange={(e) =>
                      onUpdateSceneField('pov', e.target.value)
                    }
                    placeholder="Nom du personnage narrateur"
                  />
                </label>

                <label className="field">
                  <span className="field-label">Statut</span>
                  <select
                    value={currentScene.status}
                    onChange={(e) =>
                      onUpdateSceneField('status', e.target.value)
                    }
                  >
                    {SCENE_STATUSES.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="field word-counter">
                  <span className="field-label">Mots dans la scène</span>
                  <span className="word-count">{sceneWordCount}</span>
                </div>
              </div>

              {characters.length > 0 && (
                <div className="field characters-field">
                  <span className="field-label">
                    Personnages présents dans la scène
                  </span>
                  <select
                    className="characters-select"
                    value=""
                    onChange={(e) => {
                      handleAddCharacterToScene(e.target.value)
                    }}
                  >
                    <option value="">
                      Ajouter un personnage à cette scène...
                    </option>
                    {characters
                      .filter(
                        (character) =>
                          !charactersInSceneIds.includes(character.id),
                      )
                      .map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.name || 'Sans nom'}
                        </option>
                      ))}
                  </select>

                  {charactersInSceneIds.length > 0 && (
                    <div className="characters-list">
                      {charactersInSceneIds.map((id) => {
                        const character = characters.find(
                          (c) => c.id === id,
                        )
                        if (!character) return null
                        return (
                          <button
                            key={character.id}
                            type="button"
                            className="character-pill is-active"
                        onClick={() => onSelectCharacter?.(character.id)}
                          >
                            {character.name || 'Sans nom'}
                        <span
                          className="character-pill-remove"
                          role="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveCharacterFromScene(character.id)
                          }}
                        >
                          ×
                        </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </header>

            <div className="editor-body">
              <div className="summary-block">
                <label className="field">
                  <span className="field-label">
                    Résumé interne (non exporté)
                  </span>
                  <textarea
                    className="summary-input"
                    rows={2}
                    value={currentScene.summary}
                    onChange={(e) =>
                      onUpdateSceneField('summary', e.target.value)
                    }
                    placeholder="Quelques lignes pour résumer l'intention de la scène."
                  />
                </label>
                {currentChapter?.aiSummary ? (
                  <div className="chapter-ai-summary">
                    <span className="chapter-ai-summary-title">Résumé IA du chapitre (sauvegarde explicite)</span>
                    <p className="chapter-ai-summary-body">{currentChapter.aiSummary}</p>
                  </div>
                ) : null}
              </div>

              <div className="text-editor-block">
                <div className="editor-toolbar editor-toolbar-format">
                  <span className="toolbar-label">Format</span>
                  <div className="toolbar-controls">
                    <button
                      type="button"
                      className="toolbar-format-btn toolbar-format-word"
                      onClick={() => applyFormat('bold')}
                      title="Gras"
                    >
                      Gras
                    </button>
                    <button
                      type="button"
                      className="toolbar-format-btn toolbar-format-word"
                      onClick={() => applyFormat('italic')}
                      title="Italique"
                    >
                      Italique
                    </button>
                    <button
                      type="button"
                      className="toolbar-format-btn toolbar-format-word"
                      onClick={() => applyFormat('underline')}
                      title="Souligné"
                    >
                      Souligné
                    </button>
                    <span className="toolbar-sep" />
                    <button
                      type="button"
                      className="toolbar-format-btn toolbar-format-word"
                      onClick={() => applyFormat('justifyLeft')}
                    >
                      Gauche
                    </button>
                    <button
                      type="button"
                      className="toolbar-format-btn toolbar-format-word"
                      onClick={() => applyFormat('justifyCenter')}
                    >
                      Centre
                    </button>
                    <button
                      type="button"
                      className="toolbar-format-btn toolbar-format-word"
                      onClick={() => applyFormat('justifyRight')}
                    >
                      Droite
                    </button>
                    <button
                      type="button"
                      className="toolbar-format-btn toolbar-format-word"
                      onClick={() => applyFormat('justifyFull')}
                      title="Justifié"
                    >
                      Justifié
                    </button>
                    <span className="toolbar-sep" />
                    <label className="toolbar-color-label">
                      <input
                        type="color"
                        value={fontColor}
                        onChange={(e) => {
                          setFontColor(e.target.value)
                          applyFormat('foreColor', e.target.value)
                        }}
                        className="toolbar-color-input"
                      />
                      <span className="toolbar-format-btn toolbar-format-word toolbar-color-btn">Couleur</span>
                    </label>
                  </div>
                </div>
                <div className="editor-toolbar">
                  <span className="toolbar-label">Texte de la scène</span>
                  <div className="toolbar-controls">
                    <div className="toolbar-group">
                      <span className="toolbar-group-label">
                        Taille (px)
                      </span>
                      <select
                        className="toolbar-select"
                        value={fontSize}
                        onChange={(e) =>
                          setFontSize(parseInt(e.target.value, 10) || 16)
                        }
                      >
                        <option value={12}>12</option>
                        <option value={13}>13</option>
                        <option value={14}>14</option>
                        <option value={15}>15</option>
                        <option value={16}>16</option>
                        <option value={18}>18</option>
                      </select>
                    </div>

                    <div className="toolbar-group">
                      <span className="toolbar-group-label">Interligne</span>
                      <select
                        className="toolbar-select"
                        value={lineHeight}
                        onChange={(e) =>
                          setLineHeight(parseFloat(e.target.value) || 1.6)
                        }
                      >
                        <option value={1.3}>1.3</option>
                        <option value={1.5}>1.5</option>
                        <option value={1.6}>1.6</option>
                        <option value={1.8}>1.8</option>
                        <option value={2}>2.0</option>
                      </select>
                    </div>

                    <div className="toolbar-group">
                      <span className="toolbar-group-label">Police</span>
                      <button
                        type="button"
                        className={
                          fontFamily === 'lora'
                            ? 'toolbar-chip is-active'
                            : 'toolbar-chip'
                        }
                        onClick={() => setFontFamily('lora')}
                      >
                        Lora
                      </button>
                      <button
                        type="button"
                        className={
                          fontFamily === 'garamond'
                            ? 'toolbar-chip is-active'
                            : 'toolbar-chip'
                        }
                        onClick={() => setFontFamily('garamond')}
                      >
                        EB Garamond
                      </button>
                      <button
                        type="button"
                        className={
                          fontFamily === 'crimson'
                            ? 'toolbar-chip is-active'
                            : 'toolbar-chip'
                        }
                        onClick={() => setFontFamily('crimson')}
                      >
                        Crimson Pro
                      </button>
                      <button
                        type="button"
                        className={
                          fontFamily === 'times'
                            ? 'toolbar-chip is-active'
                            : 'toolbar-chip'
                        }
                        onClick={() => setFontFamily('times')}
                        title="Times New Roman (police système)"
                      >
                        Times New Roman
                      </button>
                      <button
                        type="button"
                        className={
                          fontFamily === 'courier'
                            ? 'toolbar-chip is-active'
                            : 'toolbar-chip'
                        }
                        onClick={() => setFontFamily('courier')}
                        title="Courier New (chasse fixe, police système)"
                      >
                        Courier New
                      </button>
                    </div>

                    <div className="toolbar-group">
                      <span className="toolbar-group-label">Marges</span>
                      <select
                        className="toolbar-select toolbar-select-wide"
                        value={editorMarginPreset}
                        onChange={(e) => setEditorMarginPreset(e.target.value)}
                        title="Marges gauche et droite de la zone d’écriture"
                      >
                        <option value="narrow">Étroit</option>
                        <option value="standard">Standard</option>
                        <option value="comfortable">Confort (souvent recommandé)</option>
                        <option value="generous">Large</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="editor-toolbar silent-corrector-toolbar">
                  <span className="toolbar-label">Correcteur silencieux</span>
                  <div className="toolbar-controls silent-corrector-controls">
                    <div className="toolbar-group">
                      <span className="toolbar-group-label">Mode</span>
                      <select
                        className="toolbar-select toolbar-select-wide"
                        value={correctorMode}
                        onChange={(e) => {
                          const v = e.target.value
                          setCorrectorMode(v)
                          setCorrectorModeState(v)
                        }}
                        title="Mode d’affichage et d’application des corrections silencieuses (CDC Brique 5)"
                      >
                        <option value={CORRECTOR_MODE.SIMPLE}>Simple</option>
                        <option value={CORRECTOR_MODE.SIMPLE_STRICT}>
                          Simple strict (pas de journal auto)
                        </option>
                        <option value={CORRECTOR_MODE.EXPERT}>Expert</option>
                      </select>
                    </div>
                    {showGraceDelayHint(correctorMode) ? (
                      <span
                        className="silent-grace-hint"
                        title="Délai après la frappe avant application des silencieuses (modifiable en localStorage scriptor-corrector-grace-ms)"
                      >
                        Grâce ~{silentGraceMs} ms
                      </span>
                    ) : null}
                    {ecoParagraphOnly && silentAutoEnabledForMode(correctorMode) ? (
                      <span className="silent-eco-banner" role="status">
                        {ECO_MODE_MESSAGE}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="toolbar-format-btn toolbar-format-word silent-analyze-btn"
                      disabled={analysisRunning}
                      onClick={runSequence3Analysis}
                      title="Lancer l’analyse (LanguageTool, bases, contexte)"
                    >
                      {analysisRunning ? 'Analyse…' : 'Analyser'}
                    </button>
                    {journalChrome ? (
                      <>
                        <button
                          type="button"
                          className="silent-journal-plume"
                          onClick={() => setSilentJournalOpen((o) => !o)}
                          title="Journal des Silencieuses"
                          aria-expanded={silentJournalOpen}
                        >
                          Plume
                        </button>
                        <span
                          className="silent-journal-badge"
                          title="Corrections silencieuses sur cette scène (session)"
                        >
                          {silentJournalRef.current.sessionSilentCount}
                        </span>
                      </>
                    ) : null}
                    {expertChrome ? (
                      <span className="silent-expert-chip" title="Mode expert">
                        Expert actif
                      </span>
                    ) : null}
                    <label className="silent-absolute-confidence" title="Uniquement alertes très sûres (≥ ~99,5 %) — pas d’arbitre sur les zones ambiguës">
                      <input
                        type="checkbox"
                        checked={absoluteConfidence}
                        onChange={toggleAbsoluteConfidence}
                      />{' '}
                      Confiance absolue
                    </label>
                  </div>
                </div>
                {journalChrome && silentJournalOpen ? (
                  <div className="silent-journal-panel" role="region" aria-label="Journal des corrections silencieuses">
                    <p className="silent-journal-session-badge" role="status">
                      Pendant cette session, le correcteur a protégé ton texte de{' '}
                      <strong>{silentJournalRef.current.sessionSilentCount}</strong> micro-coquille
                      {silentJournalRef.current.sessionSilentCount === 1 ? '' : 's'} sans te déranger.
                    </p>
                    <div className="silent-journal-panel-header">
                      <select
                        className="toolbar-select"
                        value={silentJournalFilter}
                        onChange={(e) => setSilentJournalFilter(e.target.value)}
                        aria-label="Filtrer le journal"
                      >
                        <option value="all">Voir tout</option>
                        <option value="critical">Critiques seulement</option>
                      </select>
                    </div>
                    {silentJournalEntries.length === 0 ? (
                      <p className="silent-journal-empty">Aucune entrée pour ce filtre.</p>
                    ) : (
                      <ul className="silent-journal-list">
                        {silentJournalEntries.map((e) => (
                          <li key={e.id} className="silent-journal-item">
                            <span className="silent-journal-label">{e.label}</span>
                            <span className="silent-journal-cat">{e.category}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="silent-journal-actions">
                      <div className="silent-journal-validate-sauf" role="group" aria-label="Tout valider sauf">
                        <span className="silent-journal-validate-sauf-label">Tout valider sauf…</span>
                      </div>
                      {hasParagraphUndo ? (
                        <button
                          type="button"
                          className="silent-journal-action-btn silent-journal-restore-btn"
                          onClick={() => setIndignationPromptOpen(true)}
                          title="Annule la dernière salve de corrections silencieuses sur le paragraphe courant et mémorise votre intention pour le Style"
                        >
                          Rétablir ce paragraphe
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="silent-journal-action-btn"
                        onClick={() => {
                          silentJournalRef.current.clear()
                          setSilentUiTick((t) => t + 1)
                        }}
                      >
                        Vider le journal
                      </button>
                      <button
                        type="button"
                        className="silent-journal-action-btn"
                        onClick={() => {
                          silentJournalRef.current.removeByCategories(
                            new Set(['typography']),
                          )
                          setSilentUiTick((t) => t + 1)
                        }}
                        title="Retirer du journal les entrées de catégorie « typography »"
                      >
                        Tout valider sauf typo.
                      </button>
                      <button
                        type="button"
                        className="silent-journal-action-btn"
                        onClick={() => {
                          silentJournalRef.current.removeByCategories(
                            new Set(['spaces', 'punctuation']),
                          )
                          setSilentUiTick((t) => t + 1)
                        }}
                        title="Retirer espaces et ponctuation du journal"
                      >
                        Valider sauf espaces / ponctuation
                      </button>
                    </div>
                  </div>
                ) : null}
                {analysisRunning && analysisProgressLine ? (
                  <div className="silent-analysis-progress" role="status">
                    {analysisProgressLine}
                  </div>
                ) : null}
                {analysisError ? (
                  <div className="silent-analysis-report is-error" role="status">
                    {analysisError}
                  </div>
                ) : null}
                {analysisReport ? (
                  <div className="silent-analysis-report" role="region" aria-label="Analyse séquence 3">
                    <div className="silent-analysis-topline">
                      <span>
                        Actives: {activeApplicableCount}/{analysisReport.counts.active}
                      </span>
                      <span>Masquées bouclier: {analysisReport.counts.shielded}</span>
                      <span>Indices temporels: {analysisReport.counts.temporal}</span>
                      <span>Fantôme bloquées: {analysisReport.counts.phantomBlocked}</span>
                      <span>Bible (cohérence): {analysisReport.counts.bible ?? 0}</span>
                    </div>
                    {currentChapter ? (
                      <p className="silent-analysis-chapter-scope" role="note">
                        Analyse de la <strong>scène courante</strong> (chapitre :{' '}
                        {currentChapter.title || 'sans titre'}).
                      </p>
                    ) : null}
                    <div className="silent-analysis-focus-row">
                      <label className="silent-analysis-focus-label">
                        Mode focus
                        <select
                          className="toolbar-select"
                          value={analysisFocus}
                          onChange={(e) =>
                            setAnalysisFocus(
                              /** @type {'all' | 'grammar' | 'spelling' | 'punctuation' | 'repetition'} */ (
                                e.target.value
                              ),
                            )
                          }
                          aria-label="Filtrer le type d’alertes"
                        >
                          <option value="all">Tout</option>
                          <option value="grammar">Grammaire</option>
                          <option value="spelling">Orthographe</option>
                          <option value="punctuation">Ponctuation</option>
                          <option value="repetition">Répétitions</option>
                        </select>
                      </label>
                      {certainScore ? (
                        <span className="silent-analysis-score" title="Progression sur les alertes très sûres (≥ 98 %)">
                          Score (fautes certaines) : <strong>{certainScore.label}</strong>
                          {certainScore.totalCertain > 0
                            ? ` — ${certainScore.resolvedCertain}/${certainScore.totalCertain} traitées`
                            : null}
                        </span>
                      ) : null}
                    </div>
                    {analysisReport.bibleRenameHint ? (
                      <p className="silent-analysis-bible-hint" role="note">
                        {analysisReport.bibleRenameHint}
                      </p>
                    ) : null}
                    {correctorMode === CORRECTOR_MODE.EXPERT &&
                    Array.isArray(analysisReport.styleHints) &&
                    analysisReport.styleHints.length > 0 ? (
                      <div className="silent-analysis-style-hints">
                        {analysisReport.styleHints.map((h) => (
                          <span key={h.label} className="silent-analysis-style-chip">
                            Style : {h.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="silent-analysis-actions">
                      <button
                        type="button"
                        className="silent-journal-action-btn"
                        onClick={applyAllSafeFromAnalysis}
                        title="Appliquer toutes les suggestions actives qui passent les garde-fous (hors fantôme bloqué)"
                      >
                        Appliquer les suggestions sûres
                      </button>
                      <button
                        type="button"
                        className="silent-journal-action-btn"
                        onClick={runSequence3Analysis}
                        disabled={analysisRunning}
                        title="Relancer immédiatement l’analyse sur le texte courant"
                      >
                        {analysisRunning ? 'Analyse…' : 'Réanalyser'}
                      </button>
                      <button
                        type="button"
                        className="silent-journal-action-btn"
                        onClick={undoAnalysisApply}
                        disabled={!canUndoAnalysis}
                        title="Annuler la dernière application issue du rapport d’analyse"
                      >
                        Annuler corr.
                      </button>
                      <button
                        type="button"
                        className="silent-journal-action-btn"
                        onClick={redoAnalysisApply}
                        disabled={!canRedoAnalysis}
                        title="Rétablir la dernière correction annulée"
                      >
                        Rétablir corr.
                      </button>
                      <button
                        type="button"
                        className="silent-journal-action-btn"
                        onClick={toggleHideStaleAnalysisItems}
                        title="Afficher ou masquer les suggestions déjà obsolètes"
                      >
                        {hideStaleAnalysisItems ? 'Afficher obsolètes' : 'Masquer obsolètes'}
                      </button>
                      <button
                        type="button"
                        className="silent-journal-action-btn"
                        onClick={() => {
                          setCertModalOpen(true)
                          setCertAckText('')
                          setCertResultShown(false)
                        }}
                        title="Certificat de propreté mécanique (message de limitation obligatoire)"
                      >
                        Certificat
                      </button>
                    </div>
                    <div className="silent-analysis-context">
                      Contexte:{' '}
                      {analysisReport.context?.ok
                        ? `${analysisReport.context.model || 'worker ok'}`
                        : `fallback (${analysisReport.context?.reason || 'n/a'})`}
                      {analysisReport.baseTextHash ? (
                        <span className="silent-analysis-hash"> · empreinte {analysisReport.baseTextHash}</span>
                      ) : null}
                      {analysisReport.corpusIndex?.count ? (
                        <span className="silent-analysis-hash">
                          {' '}
                          · corpus index {analysisReport.corpusIndex.count} extraits
                        </span>
                      ) : null}
                    </div>
                    {analysisReport.experimentalStyleMute ? (
                      <p className="silent-analysis-experimental-note" role="note">
                        Passage détecté comme <strong>style expérimental</strong> : seules les alertes de
                        cohérence Bible sont listées ici ; le moteur ne propose pas de corrections
                        mécaniques sur ce bloc.
                      </p>
                    ) : null}
                    {filteredAnalysisItems.length ? (
                      <div className="silent-analysis-nav">
                        <button
                          type="button"
                          className="silent-analysis-nav-btn"
                          disabled={analysisNavIndex <= 0}
                          onClick={() => setAnalysisNavIndex((i) => Math.max(0, i - 1))}
                          aria-label="Alerte précédente"
                        >
                          ◀
                        </button>
                        <span className="silent-analysis-nav-pos">
                          {analysisNavIndex + 1} / {filteredAnalysisItems.length}
                        </span>
                        <button
                          type="button"
                          className="silent-analysis-nav-btn"
                          disabled={analysisNavIndex >= filteredAnalysisItems.length - 1}
                          onClick={() =>
                            setAnalysisNavIndex((i) =>
                              Math.min(filteredAnalysisItems.length - 1, i + 1),
                            )
                          }
                          aria-label="Alerte suivante"
                        >
                          ▶
                        </button>
                      </div>
                    ) : null}
                    {currentAnalysisMatch ? (
                      <div className="silent-analysis-current">
                        {(() => {
                          const m = currentAnalysisMatch
                          const stillApplicable =
                            editorPlainNow.slice(m.offset, m.offset + m.length) ===
                            String(m.excerpt || '')
                          const k = matchKey(m)
                          const showPiste =
                            (m.seeHintAvailable || m.arbiterZone === '90-97') &&
                            (m.confidence ?? 0) < 0.97
                          const whyOpen = whyExpandedKey === k
                          return (
                            <>
                              <div className="silent-analysis-item-main">
                                <button
                                  type="button"
                                  className={`silent-analysis-item-btn${
                                    selectedAnalysisKey === k ? ' is-active' : ''
                                  }${stillApplicable ? '' : ' is-stale'}`}
                                  onClick={() => focusAnalysisMatch(m)}
                                  title="Cibler cette alerte dans l’éditeur"
                                >
                                  <span className="silent-analysis-word">« {m.excerpt || '…'} »</span>{' '}
                                  {m.message}
                                  {typeof m.confidence === 'number' ? (
                                    <span className="silent-analysis-chip">
                                      conf. {Math.round(m.confidence * 100)} %
                                    </span>
                                  ) : null}
                                  {m.bibleNominal ? (
                                    <span className="silent-analysis-chip is-bible">Bible</span>
                                  ) : null}
                                  {m.temporalRelated ? (
                                    <span className="silent-analysis-chip">ligne temporelle</span>
                                  ) : null}
                                  {m.candidateHomophone && !m.phantomAllowed ? (
                                    <span className="silent-analysis-chip is-phantom">mode fantôme</span>
                                  ) : null}
                                  {m.replacements?.[0] ? (
                                    <span className="silent-analysis-repl">→ {m.replacements[0]}</span>
                                  ) : null}
                                  {!stillApplicable ? (
                                    <span className="silent-analysis-chip is-stale">déjà modifié</span>
                                  ) : null}
                                </button>
                              </div>
                              <div className="silent-analysis-suggestion-actions" role="group" aria-label="Actions sur cette suggestion">
                                {m.replacements?.[0] && stillApplicable && !m.bibleNominal ? (
                                  <button
                                    type="button"
                                    className="silent-analysis-apply-btn"
                                    onClick={() => applyAnalysisSuggestion(m)}
                                    title="Appliquer cette correction"
                                  >
                                    Corriger
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="silent-journal-action-btn"
                                  onClick={() => ignoreAnalysisMatch(m)}
                                  title="Masquer cette alerte pour cette session"
                                >
                                  Ignorer
                                </button>
                                <div className="silent-analysis-style-scope" role="group" aria-label="C’est mon style — portée">
                                  <span className="silent-analysis-style-label">C’est mon style</span>
                                  <button
                                    type="button"
                                    className="silent-journal-action-btn"
                                    onClick={() =>
                                      recordCestMonStyle(project?.id, {
                                        pattern: m.excerpt || '',
                                        message: m.message || '',
                                        scope: 'book',
                                      })
                                    }
                                  >
                                    Livre
                                  </button>
                                  <button
                                    type="button"
                                    className="silent-journal-action-btn"
                                    onClick={() =>
                                      recordCestMonStyle(project?.id, {
                                        pattern: m.excerpt || '',
                                        message: m.message || '',
                                        scope: 'dialogues',
                                      })
                                    }
                                  >
                                    Dialogues
                                  </button>
                                </div>
                                {showPiste ? (
                                  <button
                                    type="button"
                                    className="silent-journal-action-btn"
                                    onClick={() =>
                                      setIndignationToast(
                                        m.arbiterHint
                                          ? String(m.arbiterHint)
                                          : 'Aucune piste distante pour l’instant (clés API premium — voir le Guide).',
                                      )
                                    }
                                    title="Zone 90–97 % : piste sur demande uniquement"
                                  >
                                    Voir une piste
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="silent-journal-action-btn"
                                  onClick={() =>
                                    setWhyExpandedKey((prev) => (prev === k ? '' : k))
                                  }
                                >
                                  Pourquoi ? {whyOpen ? '▼' : '▶'}
                                </button>
                                <button
                                  type="button"
                                  className="silent-journal-action-btn"
                                  onClick={() => {
                                    const t = window.prompt(
                                      'Décrivez l’erreur non détectée (facultatif) :',
                                    )
                                    if (t === null) return
                                    recordIndignationCorrectionKept(
                                      project?.id,
                                      `signalement-non-détecté: ${t}`,
                                    )
                                    setIndignationToast('Signalement enregistré.')
                                  }}
                                >
                                  Signaler une erreur
                                </button>
                              </div>
                              {whyOpen ? (
                                <div className="silent-analysis-why" role="region">
                                  <p>
                                    <strong>Mentor :</strong> {m.message || '—'}
                                    {m.ruleRef ? (
                                      <>
                                        {' '}
                                        <span className="silent-analysis-rule">({m.ruleRef})</span>
                                      </>
                                    ) : null}
                                  </p>
                                  {correctorMode === CORRECTOR_MODE.EXPERT ? (
                                    <p>
                                      <strong>Expert :</strong> source {m.source || '—'}
                                      {typeof m.confidence === 'number'
                                        ? ` · confiance ${Math.round(m.confidence * 1000) / 10} %`
                                        : null}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                              {m.corpusSnippets?.length ? (
                                <details className="silent-analysis-corpus">
                                  <summary>Références corpus</summary>
                                  <ul className="silent-analysis-corpus-list">
                                    {m.corpusSnippets.map((s) => (
                                      <li key={s.id}>
                                        <span className="silent-analysis-corpus-src">{s.source}</span>
                                        <p className="silent-analysis-corpus-snippet">{s.text}</p>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              ) : null}
                            </>
                          )
                        })()}
                      </div>
                    ) : analysisReport.active?.length ? (
                      <p className="silent-analysis-empty">
                        Aucune alerte dans ce focus (ou ignorées en session). Ajustez le filtre ou réinitialisez en réanalysant.
                      </p>
                    ) : (
                      <p className="silent-analysis-empty">
                        Aucune alerte active hors bouclier temporel.
                      </p>
                    )}
                  </div>
                ) : null}

                <div
                  key={sceneId ?? 'none'}
                  ref={editorRef}
                  className={`${editorClassName} scene-editor-content${
                    correctorMode === CORRECTOR_MODE.EXPERT
                      ? ' scene-editor-corrector-expert'
                      : ''
                  }`}
                  style={editorStyle}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  onKeyDown={handleEditorKeyDown}
                  onDoubleClick={handleEditorDoubleClick}
                  onContextMenu={handleEditorContextMenu}
                  onMouseUp={openAnnotationMenuFromSelection}
                  onKeyUp={openAnnotationMenuFromSelection}
                  data-placeholder="Commencez à écrire votre scène ici..."
                  data-empty={isEditorEffectivelyEmpty ? 'true' : undefined}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>Aucune scène sélectionnée</h2>
            <p>
              Créez une première scène à l&apos;aide du bouton &quot;Nouvelle
              scène&quot; dans le panneau de gauche.
            </p>
          </div>
        )}
      </section>

      <aside className="writing-right-panel" aria-hidden={!rightPanelOpen} inert={!rightPanelOpen ? '' : undefined}>
        <div className="writing-right-panel-header">
          <span className="writing-right-panel-title">✦ Studio Roman IA</span>
          <div className="writing-right-panel-header-actions">
            <button
              type="button"
              className="writing-right-panel-wide-toggle"
              onClick={() => setRightPanelWide((w) => !w)}
              title={
                rightPanelWide
                  ? 'Revenir au panneau étroit (la zone d’écriture redevient visible à droite)'
                  : 'Élargir sur toute la zone d’écriture'
              }
            >
              {rightPanelWide ? 'Étroit' : 'Large'}
            </button>
            <button
              type="button"
              className="writing-right-panel-close"
              onClick={() => {
                setRightPanelWide(false)
                setRightPanelOpen(false)
              }}
            >
              ✕
            </button>
          </div>
        </div>
        <div className="writing-right-panel-content">
          {rightPanelOpen ? (
            <Suspense
              fallback={
                <p className="writing-addon-muted">Chargement du panneau…</p>
              }
            >
              <LazyWritingRightPanelContent
                key={`addon-${rightPanelMountKey}-${sceneId ?? 'none'}`}
                sceneId={sceneId}
                sceneTitle={currentScene?.title}
                sceneText={sceneText ?? ''}
                sessionScopeId={project?.currentSagaId ?? null}
              />
            </Suspense>
          ) : null}
        </div>
      </aside>

      {correctionMenu.open && (
        <div
          ref={correctionMenuRef}
          className="correction-context-menu"
          style={{
            left: Math.min(correctionMenu.x, window.innerWidth - 260),
            top: correctionMenu.y,
          }}
          role="menu"
        >
          {correctionMenu.loading ? (
            <div className="correction-menu-item correction-menu-loading">
              Vérification…
            </div>
          ) : (
            <>
              {correctionMenu.message && (
                <div className="correction-menu-message">
                  {correctionMenu.message}
                </div>
              )}
              {correctionMenu.replacements.slice(0, 8).map((repl, i) => (
                <button
                  key={`${repl}-${i}`}
                  type="button"
                  className="correction-menu-item correction-menu-replace"
                  onClick={() => applyCorrection(repl)}
                  role="menuitem"
                >
                  Remplacer par « {repl} »
                </button>
              ))}
              {correctorMode === CORRECTOR_MODE.EXPERT &&
              !correctionMenu.loading &&
              !correctionMenu.temporalShield ? (
                <div className="correction-menu-phantom-hint">
                  Mode Fantôme homophones : pas de correction automatique sans Bible + score
                  CamemBERT ≥ 0,99. Les remplacements que vous choisissez ici restent toujours
                  appliqués.
                </div>
              ) : null}
              <button
                type="button"
                className="correction-menu-item correction-menu-add-dict"
                onClick={addWordToDictionary}
                role="menuitem"
              >
                {isInUserDictionary(correctionMenu.word)
                  ? '✓ Dans le dictionnaire'
                  : `Ajouter « ${correctionMenu.word} » au dictionnaire`}
              </button>
              <div className="correction-menu-credit" title="LanguageTool local + Lexique + Morphalou (base linguistique Scriptor)">
                <a
                  href="https://languagetool.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="correction-menu-credit-link"
                >
                  LT + base linguistique Scriptor
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {annotationMenu.open && (
        <div
          ref={annotationMenuRef}
          className="annotation-context-menu"
          style={{
            left: Math.min(Math.max(12, annotationMenu.x - 160), window.innerWidth - 332),
            top: annotationMenu.y,
          }}
          role="menu"
          aria-label="Tags d'annotation"
        >
          <span className="annotation-context-title">Annotation rapide</span>
          <div className="annotation-context-actions">
            {ANNOTATION_TAGS.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={`annotation-chip ${tag.cls}`}
                onClick={() => applyAnnotationTag(tag.id, tag.cls)}
                role="menuitem"
              >
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {indignationPromptOpen ? (
        <div
          className="indignation-choice-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="indignation-choice-title"
        >
          <div className="indignation-choice-panel">
            <p id="indignation-choice-title">
              Était-ce une erreur de ma part ou un choix de style ?
            </p>
            <div className="indignation-choice-actions">
              <button
                type="button"
                className="indignation-choice-btn is-style"
                onClick={confirmIndignationStyle}
              >
                Choix de style
              </button>
              <button
                type="button"
                className="indignation-choice-btn is-error"
                onClick={confirmIndignationError}
              >
                Erreur du correcteur
              </button>
              <button
                type="button"
                className="indignation-choice-btn is-cancel"
                onClick={() => setIndignationPromptOpen(false)}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {indignationToast ? (
        <div className="indignation-toast" role="status">
          {indignationToast}
        </div>
      ) : null}

      {certModalOpen ? (
        <div
          className="corrector-cert-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="corrector-cert-title"
        >
          <div className="corrector-cert-panel">
            <h3 id="corrector-cert-title">Certificat de propreté mécanique</h3>
            <p className="corrector-cert-legal">
              Ce document résume l&apos;état mécanique du texte au moment de l&apos;analyse (orthographe,
              grammaire de base, signaux automatiques). Il ne remplace pas une relecture humaine et
              n&apos;engage pas sur le style, la narration ou les sens cachés.
            </p>
            <label className="corrector-cert-label">
              Reconnaissance obligatoire (limitation)
              <textarea
                className="corrector-cert-textarea"
                rows={3}
                value={certAckText}
                onChange={(e) => setCertAckText(e.target.value)}
                placeholder="Je reconnais les limites de l’analyse automatique…"
              />
            </label>
            {!certResultShown ? (
              <button
                type="button"
                className="corrector-cert-submit"
                disabled={!certAckText.trim()}
                onClick={() => setCertResultShown(true)}
              >
                Obtenir le certificat
              </button>
            ) : (
              <div className="corrector-cert-result" role="status">
                <p>{getLibertyStatistics(project?.id).summary}</p>
                <p className="corrector-cert-rules">
                  Entrées mémoire d&apos;intention (profil) :{' '}
                  <strong>{getLibertyStatistics(project?.id).rulesCount}</strong>
                </p>
              </div>
            )}
            <button
              type="button"
              className="corrector-cert-close"
              onClick={() => setCertModalOpen(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default WritingTab

