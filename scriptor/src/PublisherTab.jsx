import { useState, useEffect, useRef, useMemo } from 'react'
import {
  buildManuscriptText,
  buildManuscriptHtml,
  getCurrentSaga,
  loadDossierEditeur,
  saveDossierEditeur,
  loadSagaCover,
  saveSagaCover,
  clearSagaCover,
} from './projectStore.js'
import {
  buildManuscriptDocxBlob,
  buildManuscriptPdfBlob,
  manuscriptSafeBasename,
} from './manuscriptExport.js'
import { buildManuscriptEpubBlob } from './epubExport.js'
import { PUBLISHERS, getPublisherById, VOIE_LABELS, prestigeStars } from './publishersData.js'
import kdpProfile from './print/profiles/kdp.json'
import ingramProfile from './print/profiles/ingram.json'
import {
  estimatePrintCost,
  computeSafeZoneAndBleed,
  computeSpineFromFinalPdfPages,
  computeFullCoverDimensions,
  computeCreepCompensation,
  gutterSafetyScore,
  spineOverflowAlert,
  buildFrontMatterPages,
  applyFrenchParagraphIndents,
  PaginationOrchestrator,
  getRenderingProfileForContext,
  exportPdfX4,
  imagePreflightEngine,
  exportManuscriptViaPrintEpub3Pipeline,
  buildPrintExportAuditLog,
  runEpubcheckDesktop,
  collectManuscriptInlineImagesForPreflight,
} from './print/index.js'
import { isDesktop } from './platform'
import { estimateGamutFromDataUrl } from './media/index.js'
import { PrintSafeZonePreview } from './print/PrintSafeZonePreview.jsx'
import { GutterSimCanvas } from './print/GutterSimCanvas.jsx'
import MediaKitTab from './MediaKitTab.jsx'
import { EPUB_KINDLE_SAFE_SNIPPET } from './print/epubKindlePreview.js'

const COVER_ACCEPT =
  'image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff,image/x-tiff,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.tif,.tiff,.heic,.heif'
const COVER_MAX_BYTES = 25 * 1024 * 1024

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Horodatage court pour exports print (CDC : versioning / traçabilité). */
function printExportStamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

const SECTION_SEP = '\n\n' + '—'.repeat(50) + '\n\n'

const EXPORT_SUBTABS = [
  { id: 'soumission', label: '🏛 Soumission éditeur' },
  { id: 'word',       label: 'Word (.docx)' },
  { id: 'pdf',        label: 'PDF' },
  { id: 'epub',       label: 'EPUB' },
  { id: 'print',      label: '🖨 Print pro' },
  { id: 'kitmedia',   label: '🎨 Kit média' },
]

const DOC_TYPES = [
  { id: 'lettre',        label: 'Lettre d\'accompagnement', field: 'lettre' },
  { id: 'synopsis',      label: 'Synopsis',                 field: 'synopsis' },
  { id: 'noteIntention', label: 'Note d\'intention',        field: 'noteIntention' },
  { id: 'bio',           label: 'Biographie auteur',        field: 'bio' },
]

const SUBMISSION_STORE_PREFIX = 'scriptor-submission-'
const PRINTER_PROFILES = {
  kdp: kdpProfile,
  ingramspark: ingramProfile,
}

function defaultFormat(profile) {
  return profile?.formatsIn?.[0] || { label: '6x9', width: 6, height: 9 }
}

function formatOptionValue(f) {
  return `${f.width}x${f.height}`
}

function loadSubmissionContext(sagaId) {
  if (!sagaId) return {}
  try {
    const raw = window.localStorage.getItem(`${SUBMISSION_STORE_PREFIX}${sagaId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveSubmissionContext(sagaId, data) {
  if (!sagaId) return
  try {
    window.localStorage.setItem(`${SUBMISSION_STORE_PREFIX}${sagaId}`, JSON.stringify(data))
  } catch {
    // quota/localStorage indisponible: pas bloquant
  }
}

function PublisherRequirementsCard({ publisher }) {
  const ex = publisher.exigences
  const voieLabel = VOIE_LABELS[publisher.voie] || publisher.voie

  const docs = []
  if (ex.lettre)        docs.push(`Lettre d'accompagnement`)
  if (ex.synopsis)      docs.push(`Synopsis (${ex.synopsisLongueur || 'libre'})`)
  if (ex.noteIntention) docs.push(`Note d'intention (${ex.noteIntentionLongueur || 'libre'})`)
  if (ex.bio)           docs.push('Biographie auteur')
  if (ex.extraits)      docs.push(`Extraits manuscrit (${ex.extraitsNbPages || '?'} pages)`)

  return (
    <div className="pub-card">
      <div className="pub-card-header">
        <div className="pub-card-title-row">
          <h3 className="pub-card-nom">{publisher.nom}</h3>
          <span className="pub-card-stars">{prestigeStars(publisher.prestige)}</span>
        </div>
        <div className="pub-card-meta">
          <span className="pub-card-groupe">{publisher.groupe}</span>
          <span className="pub-card-sep">·</span>
          <span>{publisher.ville}</span>
        </div>
        <p className="pub-card-specialite">{publisher.specialite}</p>
      </div>

      <div className="pub-card-body">
        <div className="pub-card-section">
          <div className="pub-card-label">Genres acceptés</div>
          <div className="pub-card-genres">
            {publisher.genres.map(g => <span key={g} className="pub-card-genre-tag">{g}</span>)}
          </div>
        </div>

        <div className="pub-card-section">
          <div className="pub-card-label">Voie d'envoi</div>
          <div className="pub-card-voie">{voieLabel}</div>
          <div className="pub-card-contact">{publisher.contact}</div>
        </div>

        <div className="pub-card-section">
          <div className="pub-card-label">Documents requis</div>
          <ul className="pub-card-docs">
            {docs.map(d => <li key={d}><span className="pub-card-check">✓</span> {d}</li>)}
          </ul>
          {ex.formatManuscrit && (
            <div className="pub-card-format">Format : {ex.formatManuscrit}</div>
          )}
          {(ex.longueurMin || ex.longueurMax) && (
            <div className="pub-card-format">
              Longueur : {ex.longueurMin ? `${(ex.longueurMin / 1000).toFixed(0)}k` : '?'} – {ex.longueurMax ? `${(ex.longueurMax / 1000).toFixed(0)}k` : '∞'} signes
            </div>
          )}
        </div>

        <div className="pub-card-section">
          <div className="pub-card-label">Délai de réponse</div>
          <div className="pub-card-delai">{publisher.delaiReponse}</div>
        </div>

        {publisher.conseil && (
          <div className="pub-card-conseil">
            <span className="pub-card-conseil-icon">💡</span>
            {publisher.conseil}
          </div>
        )}
        {publisher.noteExpert && (
          <div className="pub-card-expert">
            <span className="pub-card-conseil-icon">📖</span>
            {publisher.noteExpert}
          </div>
        )}
      </div>
    </div>
  )
}

function DocSection({ publisher, docType, label, value, onChange, auteurNom, auteurBioRaw, manuscritInfo }) {
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)
  const ex = publisher?.exigences || {}

  const isRequired = docType === 'lettre'   ? ex.lettre
                   : docType === 'synopsis' ? ex.synopsis
                   : docType === 'noteIntention' ? ex.noteIntention
                   : ex.bio

  const longueur = docType === 'lettre'        ? ex.synopsisLongueur || '1 page'
                 : docType === 'synopsis'       ? ex.synopsisLongueur || '1 à 2 pages'
                 : docType === 'noteIntention'  ? ex.noteIntentionLongueur || '1 page'
                 : '5 à 10 lignes'

  const handleGenerate = async () => {
    if (!publisher) return
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/v1/ia/publisher/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: docType,
          publisherNom: publisher.nom,
          publisherSpecialite: publisher.specialite,
          publisherGenres: publisher.genres.join(', '),
          documentLongueur: longueur,
          manuscritTitre: manuscritInfo.titre,
          manuscritGenre: manuscritInfo.genre,
          manuscritSignes: manuscritInfo.signes,
          manuscritResume: manuscritInfo.resume,
          auteurNom: auteurNom,
          auteurBioRaw: auteurBioRaw,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      onChange(data.text || '')
    } catch (e) {
      setGenError('Erreur IA : ' + (e.message || 'vérifiez que le backend est lancé.'))
    } finally {
      setGenerating(false)
    }
  }

  const rowClass = isRequired ? 'pub-doc-section' : 'pub-doc-section pub-doc-optional'

  return (
    <div className={rowClass}>
      <div className="pub-doc-header">
        <div className="pub-doc-title-row">
          <h4 className="pub-doc-title">{label}</h4>
          {!isRequired && publisher && (
            <span className="pub-doc-badge pub-doc-badge-optional">Non requis par {publisher.nom}</span>
          )}
          {isRequired && publisher && longueur && (
            <span className="pub-doc-badge pub-doc-badge-length">{longueur}</span>
          )}
        </div>
        {publisher && (
          <button
            type="button"
            className="pub-gen-btn"
            onClick={handleGenerate}
            disabled={generating || !manuscritInfo.resume}
            title={!manuscritInfo.resume ? 'Remplissez d\'abord le résumé du manuscrit' : ''}
          >
            {generating
              ? <><span className="pub-gen-spinner" /> Génération…</>
              : <><span className="pub-gen-icon">✦</span> Générer avec l'IA</>
            }
          </button>
        )}
      </div>
      {genError && <p className="pub-gen-error">{genError}</p>}
      <textarea
        className="pub-doc-textarea"
        rows={8}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={
          !publisher ? 'Sélectionnez d\'abord une maison d\'édition…'
          : !manuscritInfo.resume ? 'Remplissez le résumé ci-dessus pour activer la génération IA…'
          : generating ? 'Génération en cours…'
          : `Rédigez ou générez automatiquement votre ${label.toLowerCase()}…`
        }
      />
    </div>
  )
}

function PublisherTab({ project }) {
  const currentSaga = getCurrentSaga(project)
  const [exportSubtab, setExportSubtab] = useState('soumission')
  const [pdfUseWatermark, setPdfUseWatermark] = useState(true)
  const [epubUseWatermark, setEpubUseWatermark] = useState(false)
  const [epubPipelineKindleSafeCss, setEpubPipelineKindleSafeCss] = useState(false)
  const [epubPipelineWarnings, setEpubPipelineWarnings] = useState([])
  const [lastEpubcheckFilename, setLastEpubcheckFilename] = useState(null)
  const [epubAutoEpubcheck, setEpubAutoEpubcheck] = useState(true)
  const [epubcheckDesktopResult, setEpubcheckDesktopResult] = useState(null)
  const [watermarkText, setWatermarkText] = useState("À l'attention du bêta-lecteur — usage personnel")
  const [exportBusy, setExportBusy] = useState(false)
  const [coverInfo, setCoverInfo] = useState(null)
  const [coverMeta, setCoverMeta] = useState(null)
  const [printerPlatform, setPrinterPlatform] = useState('kdp')
  const [printerMarket, setPrinterMarket] = useState('FR')
  const [printerDistribution, setPrinterDistribution] = useState('standard')
  const profile = PRINTER_PROFILES[printerPlatform] || kdpProfile
  const [trimFormat, setTrimFormat] = useState(() =>
    formatOptionValue(defaultFormat(PRINTER_PROFILES[printerPlatform] || kdpProfile)),
  )
  const [coverType, setCoverType] = useState('soft')
  const [fontMode, setFontMode] = useState('embedded')
  const [userReadingAngle, setUserReadingAngle] = useState(110)
  const [coverStiffness, setCoverStiffness] = useState('soft')
  const [insideIndentCm, setInsideIndentCm] = useState(0.5)
  const [massicotShiftIn, setMassicotShiftIn] = useState(0.02)
  const [pdfExportX1a, setPdfExportX1a] = useState(false)
  const [coverGamutScreening, setCoverGamutScreening] = useState(null)
  const [printValidationBusy, setPrintValidationBusy] = useState(false)
  const [printValidationReport, setPrintValidationReport] = useState(null)
  const [coverPrintPreflight, setCoverPrintPreflight] = useState(null)
  const [manuscriptImagesPreflight, setManuscriptImagesPreflight] = useState(null)
  /** Livres &gt; 200 p. : réactivation auto du creep à la première montée au-dessus du seuil (CDC). */
  const [creepCompensationOn, setCreepCompensationOn] = useState(true)
  const prevEstimatedPagesRef = useRef(null)
  const [frontMatter, setFrontMatter] = useState({
    title: '',
    author: '',
    isbn: '',
    legalNotice: '',
    dedication: '',
    acknowledgements: '',
  })

  // Dossier texts
  const [lettre, setLettre]               = useState('')
  const [synopsis, setSynopsis]           = useState('')
  const [noteIntention, setNoteIntention] = useState('')
  const [bio, setBio]                     = useState('')
  const valuesRef = useRef({ lettre: '', synopsis: '', noteIntention: '', bio: '' })
  valuesRef.current = { lettre, synopsis, noteIntention, bio }

  // Publisher selection + manuscript context
  const [selectedPublisherId, setSelectedPublisherId] = useState(null)
  const [publisherSearch, setPublisherSearch]         = useState('')
  const [auteurNom, setAuteurNom]                     = useState('')
  const [auteurBioRaw, setAuteurBioRaw]               = useState('')
  const [manuscritInfo, setManuscritInfo] = useState({
    titre: '', genre: '', resume: '', signes: 0,
  })
  const submCtxRef = useRef({})
  submCtxRef.current = { selectedPublisherId, auteurNom, auteurBioRaw, manuscritInfo }

  useEffect(() => {
    const d = defaultFormat(profile)
    const ok = profile.formatsIn.some((f) => formatOptionValue(f) === trimFormat)
    if (!ok) setTrimFormat(formatOptionValue(d))
  }, [profile, trimFormat])

  // Load persisted data on saga change
  useEffect(() => {
    if (!currentSaga?.id) return
    const stored = loadDossierEditeur(currentSaga.id)
    setLettre(stored.lettre)
    setSynopsis(stored.synopsis)
    setNoteIntention(stored.noteIntention)
    setBio(stored.bio)

    const ctx = loadSubmissionContext(currentSaga.id)
    if (ctx.selectedPublisherId) setSelectedPublisherId(ctx.selectedPublisherId)
    if (ctx.auteurNom) setAuteurNom(ctx.auteurNom)
    if (ctx.auteurBioRaw) setAuteurBioRaw(ctx.auteurBioRaw)
    if (ctx.manuscritInfo) {
      setManuscritInfo(prev => ({ ...prev, ...ctx.manuscritInfo }))
    }
    // Auto-fill titre from saga
    if (currentSaga.title) {
      setManuscritInfo(prev => ({ ...prev, titre: prev.titre || currentSaga.title }))
    }
  }, [currentSaga?.id, currentSaga?.title])

  // Auto-compute signes from manuscript
  useEffect(() => {
    if (!project) return
    const text = buildManuscriptText(project)
    setManuscritInfo(prev => ({ ...prev, signes: text.length }))
  }, [project])

  useEffect(() => {
    if (!currentSaga?.title) return
    setFrontMatter((prev) => ({
      ...prev,
      title: prev.title || currentSaga.title,
    }))
  }, [currentSaga?.title])

  // Debounced save — dossier texts
  useEffect(() => {
    if (!currentSaga?.id) return
    const t = setTimeout(() => {
      saveDossierEditeur(currentSaga.id, valuesRef.current)
    }, 600)
    return () => clearTimeout(t)
  }, [currentSaga?.id, lettre, synopsis, noteIntention, bio])

  // Debounced save — submission context
  useEffect(() => {
    if (!currentSaga?.id) return
    const t = setTimeout(() => {
      const c = submCtxRef.current
      saveSubmissionContext(currentSaga.id, {
        selectedPublisherId: c.selectedPublisherId,
        auteurNom: c.auteurNom,
        auteurBioRaw: c.auteurBioRaw,
        manuscritInfo: c.manuscritInfo,
      })
    }, 600)
    return () => clearTimeout(t)
  }, [currentSaga?.id, selectedPublisherId, auteurNom, auteurBioRaw, manuscritInfo])

  const selectedPublisher = selectedPublisherId ? getPublisherById(selectedPublisherId) : null
  const baseName = manuscriptSafeBasename(project)
  const coverDataUrlForExport = coverInfo?.dataUrl ?? loadSagaCover(currentSaga?.id)?.dataUrl ?? null
  const manuscriptText = buildManuscriptText(project)
  const estimatedPages = Math.max(1, Math.ceil(manuscriptText.length / 1500))

  const selectedFormat = useMemo(() => {
    const found = profile.formatsIn.find((f) => formatOptionValue(f) === trimFormat)
    return found || defaultFormat(profile)
  }, [profile, trimFormat])

  const geometry = useMemo(() => {
    const safe = computeSafeZoneAndBleed({
      trimWidthIn: selectedFormat.width,
      trimHeightIn: selectedFormat.height,
      bleedIn: profile.bleedIn,
      safeIn: profile.safeZoneIn,
      dpi: 300,
    })
    const spine = computeSpineFromFinalPdfPages({
      pages: estimatedPages,
      platform: printerPlatform === 'kdp' ? 'kdp' : 'ingramspark',
      paper: printerPlatform === 'kdp' ? '60# white' : '60# white',
    })
    const cover = computeFullCoverDimensions({
      trimWidthIn: selectedFormat.width,
      trimHeightIn: selectedFormat.height,
      spineWidthIn: spine.widthIn,
      bleedIn: profile.bleedIn,
    })
    return { safe, spine, cover }
  }, [selectedFormat, profile, estimatedPages, printerPlatform])

  const printCost = useMemo(
    () =>
      estimatePrintCost({
        platform: printerPlatform,
        market: printerMarket,
        distribution: printerDistribution,
        pageCount: estimatedPages,
        coverType,
        color: Boolean(coverDataUrlForExport),
      }),
    [printerPlatform, printerMarket, printerDistribution, estimatedPages, coverType, coverDataUrlForExport],
  )

  const creep = useMemo(
    () =>
      computeCreepCompensation({
        pageCount: estimatedPages,
        bindingType: coverType === 'hard' ? 'sewn' : 'perfect',
        paperThickness: geometry.spine.factorIn,
        signatureSize: 16,
        enabled: creepCompensationOn,
      }),
    [estimatedPages, coverType, geometry.spine.factorIn, creepCompensationOn],
  )

  useEffect(() => {
    const prev = prevEstimatedPagesRef.current
    if (prev != null && estimatedPages > 200 && prev <= 200) {
      setCreepCompensationOn(true)
    }
    prevEstimatedPagesRef.current = estimatedPages
  }, [estimatedPages])

  const gutterScore = useMemo(
    () => gutterSafetyScore({ pageCount: estimatedPages, userReadingAngle, coverStiffness }),
    [estimatedPages, userReadingAngle, coverStiffness],
  )

  const spineOverflow = useMemo(
    () =>
      spineOverflowAlert({
        titleLengthApproxPx: (frontMatter.title || currentSaga?.title || '').length * 14,
        spineWidthIn: geometry.spine.widthIn,
        dpi: 300,
      }),
    [frontMatter.title, currentSaga?.title, geometry.spine.widthIn],
  )

  const filteredPublishers = PUBLISHERS.filter(p => {
    if (!publisherSearch) return true
    const q = publisherSearch.toLowerCase()
    return p.nom.toLowerCase().includes(q)
        || p.genres.some(g => g.toLowerCase().includes(q))
        || p.groupe.toLowerCase().includes(q)
  })

  async function maybeRunEpubcheckAfterExport(blob) {
    if (!blob || !epubAutoEpubcheck) return
    setEpubcheckDesktopResult(null)
    try {
      const r = await runEpubcheckDesktop(blob)
      setEpubcheckDesktopResult(r)
    } catch (e) {
      setEpubcheckDesktopResult({
        skipped: false,
        ok: false,
        exitCode: -1,
        tool: 'epubcheck',
        stdout: '',
        stderr: String(e?.message || e),
        details: `Erreur EPUBCheck : ${e?.message || e}`,
      })
    }
  }

  /* ── Export handlers ── */
  const handleExportTxt = () => {
    const text = buildManuscriptText(project)
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${baseName}-manuscrit.txt`)
  }
  const handleExportHtml = () => {
    const html = buildManuscriptHtml(project)
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${baseName}-manuscrit.html`)
  }
  const handleExportDocx = async () => {
    setExportBusy(true)
    try {
      const blob = await buildManuscriptDocxBlob(project)
      if (!blob) return
      downloadBlob(blob, `${baseName}-manuscrit.docx`)
    } catch (e) {
      console.error(e)
      window.alert('Export Word impossible.')
    } finally { setExportBusy(false) }
  }
  const handleExportPdf = async () => {
    setExportBusy(true)
    try {
      const blob = await buildManuscriptPdfBlob(project, { useWatermark: pdfUseWatermark, watermarkText, coverDataUrl: coverDataUrlForExport })
      if (!blob) return
      downloadBlob(blob, `${baseName}-manuscrit.pdf`)
    } catch (e) {
      console.error(e)
      window.alert('Export PDF impossible.')
    } finally { setExportBusy(false) }
  }
  const handleExportEpub = async () => {
    setEpubPipelineWarnings([])
    setExportBusy(true)
    try {
      const blob = await buildManuscriptEpubBlob(project, {
        coverDataUrl: coverDataUrlForExport,
        useWatermark: epubUseWatermark,
        watermarkText,
        author: frontMatter.author || auteurNom || '',
      })
      if (!blob) return
      const epubName = `${baseName}-manuscrit.epub`
      downloadBlob(blob, epubName)
      setLastEpubcheckFilename(epubName)
      await maybeRunEpubcheckAfterExport(blob)
    } catch (e) {
      console.error(e)
      window.alert('Export EPUB impossible.')
    } finally { setExportBusy(false) }
  }
  const handleExportEpubPrintPipeline = async () => {
    setEpubPipelineWarnings([])
    setExportBusy(true)
    try {
      const out = await exportManuscriptViaPrintEpub3Pipeline(project, {
        coverDataUrl: coverDataUrlForExport,
        useWatermark: epubUseWatermark,
        watermarkText,
        author: frontMatter.author || auteurNom || '',
        kindleSafeCss: epubPipelineKindleSafeCss,
      })
      if (!out?.blob) return
      const epubName = `${baseName}-manuscrit-print.epub`
      downloadBlob(out.blob, epubName)
      setLastEpubcheckFilename(epubName)
      await maybeRunEpubcheckAfterExport(out.blob)
      const w = out.report?.warnings || []
      setEpubPipelineWarnings(w)
      if (w.length) console.warn('EPUB pipeline (print)', w)
    } catch (e) {
      console.error(e)
      window.alert('Export EPUB (pipeline print) impossible.')
    } finally {
      setExportBusy(false)
    }
  }
  const copyEpubcheckCommand = async () => {
    const fn = lastEpubcheckFilename
    if (!fn) return
    const safe = fn.replace(/"/g, '')
    const cmd = `npm run epubcheck -- "./${safe}"`
    const winHint =
      'PowerShell (dossier Téléchargements) :\r\n' +
      `cd $env:USERPROFILE\\Downloads\r\n` +
      cmd
    const unixHint = `cd ~/Downloads && ${cmd}`
    const isWin = typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent || '')
    const block = `${isWin ? winHint : unixHint}\r\n\r\n(Remplacez le dossier si votre EPUB n’est pas dans Téléchargements ; définissez EPUBCHECK_JAR.)`
    try {
      await navigator.clipboard.writeText(block)
      window.alert('Commande EPUBCheck copiée (avec rappel du dossier Téléchargements).')
    } catch {
      window.prompt('Copiez manuellement :', block)
    }
  }
  const handleCoverFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !currentSaga?.id) return
    if (!file.type.startsWith('image/')) { window.alert('Choisissez un fichier image.'); return }
    if (file.size > COVER_MAX_BYTES) { window.alert('Fichier trop volumineux (max. 25 Mo).'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return
      const ok = saveSagaCover(currentSaga.id, dataUrl, file.type)
      if (ok) {
        setCoverInfo({ dataUrl, mime: file.type })
        const img = new Image()
        img.onload = () => setCoverMeta({ width: img.width, height: img.height })
        img.src = dataUrl
      }
      else window.alert('Impossible d\'enregistrer la couverture (quota navigateur dépassé).')
    }
    reader.onerror = () => window.alert('Lecture du fichier impossible.')
    reader.readAsDataURL(file)
  }
  const handleClearCover = () => {
    if (!currentSaga?.id) return
    clearSagaCover(currentSaga.id)
    setCoverInfo(null)
    setCoverMeta(null)
  }

  const handleExportDossier = () => {
    const titre = currentSaga?.title || 'Sans titre'
    const pubNom = selectedPublisher ? `\nMaison d'édition ciblée : ${selectedPublisher.nom}` : ''
    const parts = []
    parts.push(`DOSSIER DE PRÉSENTATION\n${titre.toUpperCase()}${pubNom}\n\n`)
    if (lettre.trim()) {
      parts.push('1. LETTRE D\'ACCOMPAGNEMENT\n\n')
      parts.push(lettre.trim())
      parts.push(SECTION_SEP)
    }
    if (synopsis.trim()) {
      parts.push('2. SYNOPSIS\n\n')
      parts.push(synopsis.trim())
      parts.push(SECTION_SEP)
    }
    if (noteIntention.trim()) {
      parts.push('3. NOTE D\'INTENTION\n\n')
      parts.push(noteIntention.trim())
      parts.push(SECTION_SEP)
    }
    if (bio.trim()) {
      parts.push('4. BIOGRAPHIE DE L\'AUTEUR\n\n')
      parts.push(bio.trim())
      parts.push(SECTION_SEP)
    }
    parts.push('5. MANUSCRIT\n\n')
    parts.push(buildManuscriptText(project))
    const safeName = titre.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'dossier'
    const pubSuffix = selectedPublisher ? `-${selectedPublisher.id}` : ''
    downloadBlob(new Blob([parts.join('')], { type: 'text/plain;charset=utf-8' }), `${safeName}${pubSuffix}-dossier.txt`)
  }

  useEffect(() => {
    if (exportSubtab !== 'print') {
      setCoverPrintPreflight(null)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      if (!coverDataUrlForExport || !geometry?.cover?.widthIn) {
        if (!cancelled) {
          setCoverPrintPreflight({
            status: 'OK',
            images: [],
            note: 'Aucune couverture : préflight image print non applicable.',
          })
        }
        return
      }
      const dpi =
        coverMeta?.width && geometry.cover.widthIn
          ? Math.round(coverMeta.width / geometry.cover.widthIn)
          : 0
      try {
        const r = await imagePreflightEngine.run(
          [{ id: 'cover-print', dpi, scaleFactor: 1, iccProfile: null }],
          { platform: printerPlatform === 'kdp' ? 'kdp' : 'ingramspark' },
        )
        if (!cancelled) setCoverPrintPreflight(r)
      } catch (e) {
        if (!cancelled) {
          setCoverPrintPreflight({
            status: 'Warning',
            images: [],
            note: String(e?.message || e || 'preflight-error'),
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    exportSubtab,
    coverDataUrlForExport,
    coverMeta,
    geometry.cover.widthIn,
    printerPlatform,
  ])

  useEffect(() => {
    if (exportSubtab !== 'print') {
      setManuscriptImagesPreflight(null)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      const payloads = collectManuscriptInlineImagesForPreflight(project)
      if (payloads.length === 0) {
        if (!cancelled) {
          setManuscriptImagesPreflight({
            status: 'OK',
            images: [],
            note: 'Aucune image inline (data URL) dans le corps du manuscrit — préflight images intérieur non applicable.',
          })
        }
        return
      }
      try {
        const r = await imagePreflightEngine.run(payloads, {
          platform: printerPlatform === 'kdp' ? 'kdp' : 'ingramspark',
        })
        if (!cancelled) setManuscriptImagesPreflight(r)
      } catch (e) {
        if (!cancelled) {
          setManuscriptImagesPreflight({
            status: 'Warning',
            images: [],
            note: String(e?.message || e || 'preflight-manuscript-images'),
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [exportSubtab, project, printerPlatform])

  useEffect(() => {
    if (exportSubtab !== 'print' || !coverDataUrlForExport) {
      setCoverGamutScreening(null)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      const g = await estimateGamutFromDataUrl(coverDataUrlForExport)
      if (!cancelled) setCoverGamutScreening(g)
    })()
    return () => {
      cancelled = true
    }
  }, [exportSubtab, coverDataUrlForExport])

  const printAlerts = useMemo(() => {
    const out = []
    const coverDpi = coverMeta?.width
      ? Math.round(coverMeta.width / (geometry.cover.widthIn || 1))
      : null
    if (coverDpi != null && coverDpi < 300) {
      out.push({ level: 'blocking', text: `Couverture < 300 DPI (${coverDpi} DPI).` })
    }
    if (estimatedPages > 200 && creep.suggested && !creep.enabled) {
      out.push({
        level: 'warning',
        text: 'Livre > 200 pages : activer le compensateur de chasse (creep) — recommandé pour la pose des signatures.',
      })
    }
    if (estimatedPages > 400 && gutterScore.warning) {
      out.push({ level: 'warning', text: `Gutter Safety Score faible (${gutterScore.score}/100).` })
    }
    if (spineOverflow.warning) {
      out.push({ level: 'warning', text: 'Spine Overflow : titre dos > 90% largeur du dos.' })
    }
    if (fontMode === 'outlined') {
      out.push({ level: 'warning', text: 'Mode outlined : texte non sélectionnable.' })
    }
    if (coverGamutScreening?.level === 'critical') {
      out.push({
        level: 'blocking',
        text: `${coverGamutScreening.label}${coverGamutScreening.suggestion ? ` — ${coverGamutScreening.suggestion}` : ''}`,
      })
    } else if (coverGamutScreening?.level === 'soft') {
      out.push({
        level: 'warning',
        text: `${coverGamutScreening.label}${coverGamutScreening.suggestion ? ` — ${coverGamutScreening.suggestion}` : ''}`,
      })
    }
    if (manuscriptImagesPreflight?.status === 'Bloquant') {
      const first = manuscriptImagesPreflight.images?.find((r) => r.blocking?.length)
      out.push({
        level: 'blocking',
        text: `Images manuscrit (préflight) : ${first?.blocking?.[0] || 'au moins un problème bloquant.'}`,
      })
    } else if (manuscriptImagesPreflight?.status === 'Warning') {
      out.push({
        level: 'warning',
        text: 'Images inline du manuscrit : au moins un avertissement préflight (voir détail ci-dessous).',
      })
    }
    return { list: out, coverDpi }
  }, [
    coverMeta,
    geometry.cover.widthIn,
    estimatedPages,
    creep.enabled,
    creep.suggested,
    gutterScore.warning,
    gutterScore.score,
    spineOverflow.warning,
    fontMode,
    coverGamutScreening,
    manuscriptImagesPreflight,
  ])

  const handleDownloadPrintAudit = () => {
    const stamp = printExportStamp()
    const payload = buildPrintExportAuditLog({
      stamp,
      sagaTitle: currentSaga?.title,
      profile,
      printerPlatform,
      printerMarket,
      printerDistribution,
      coverType,
      trimFormat,
      selectedFormat,
      estimatedPages,
      geometry,
      fontMode,
      pdfExportX1a,
      massicotShiftIn,
      printAlerts,
      coverGamutScreening,
      coverPrintPreflight,
      manuscriptImagesPreflight,
      printValidationReport,
      printCost,
      creep,
      spineOverflow,
      gutterScore,
    })
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }),
      `${baseName}-print-audit-${stamp}.json`,
    )
  }

  const handleExportFrontMatter = () => {
    const pages = buildFrontMatterPages({
      ...frontMatter,
      tocItems: (currentSaga?.volumes || []).flatMap((v) => (v.chapters || []).map((ch) => ch.title || 'Chapitre')),
    })
    const txt = pages
      .map((p, i) => `=== PAGE ${i + 1} (${p.type}) ===\n${applyFrenchParagraphIndents(p.content, insideIndentCm)}`)
      .join('\n\n')
    downloadBlob(new Blob([txt], { type: 'text/plain;charset=utf-8' }), `${baseName}-frontmatter.txt`)
  }

  const handleRunPdfxValidation = async () => {
    setPrintValidationBusy(true)
    setPrintValidationReport(null)
    try {
      const parsed = {
        chapters: [
          {
            id: 'chapter-export',
            title: currentSaga?.title || 'Chapitre',
            scenes: [{ id: 'scene-export', text: manuscriptText || '' }],
          },
        ],
      }
      const profileCtx = getRenderingProfileForContext('final-validation')
      const orchestrator = new PaginationOrchestrator({
        pageWidth: 595.28,
        pageHeight: 841.89,
      })
      const layoutAst = orchestrator.buildLayoutAst(parsed, profileCtx)
      const out = await exportPdfX4({
        layoutAst,
        fontMode,
        profile: profile.iccProfile,
        isbn: frontMatter.isbn,
        author: frontMatter.author || auteurNom,
        title: frontMatter.title || currentSaga?.title,
        fallbackToX1a: pdfExportX1a,
      })
      setPrintValidationReport(out.report)
      const stamp = printExportStamp()
      if (out?.blob) {
        downloadBlob(out.blob, `${baseName}-print-pro-${stamp}.pdf`)
      }
      // Archive-proof (CDC Brique 4) : JSON Layout AST figé, réimportable plus tard.
      try {
        const astJson = JSON.stringify(layoutAst, null, 2)
        downloadBlob(
          new Blob([astJson], { type: 'application/json;charset=utf-8' }),
          `${baseName}-layout-ast-${stamp}.json`,
        )
      } catch {
        // ignore serialisation
      }
    } catch (e) {
      setPrintValidationReport({
        validation: {
          ok: false,
          tool: 'none',
          mode: 'failed',
          details: String(e?.message || e),
          errors: [String(e?.message || e)],
          warnings: [],
        },
        warnings: [],
      })
    } finally {
      setPrintValidationBusy(false)
    }
  }

  if (!currentSaga) {
    return (
      <div className="publisher-tab empty">
        <p>Sélectionnez une saga dans la barre du haut.</p>
      </div>
    )
  }

  return (
    <div className="publisher-tab">
      {/* ── Sous-onglets ── */}
      <div className="publisher-subtabs" role="tablist">
        {EXPORT_SUBTABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={exportSubtab === t.id}
            className={`publisher-subtab ${exportSubtab === t.id ? 'is-active' : ''}`}
            onClick={() => setExportSubtab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          SOUMISSION ÉDITEUR
      ═══════════════════════════════════════════ */}
      {exportSubtab === 'soumission' && (
        <div className="publisher-subpanel pub-submission-layout" role="tabpanel">

          {/* ── Colonne gauche : liste éditeurs ── */}
          <aside className="pub-list-col">
            <div className="pub-list-search-wrap">
              <input
                type="text"
                className="pub-list-search"
                placeholder="🔍 Rechercher une maison…"
                value={publisherSearch}
                onChange={e => setPublisherSearch(e.target.value)}
              />
            </div>
            <div className="pub-list">
              {filteredPublishers.length === 0 && (
                <p className="pub-list-empty">Aucune maison trouvée.</p>
              )}
              {filteredPublishers.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`pub-list-item ${selectedPublisherId === p.id ? 'is-selected' : ''}`}
                  onClick={() => setSelectedPublisherId(p.id)}
                >
                  <div className="pub-list-item-nom">{p.nom}</div>
                  <div className="pub-list-item-meta">
                    <span className="pub-list-item-stars">{prestigeStars(p.prestige)}</span>
                    <span className="pub-list-item-genre">{p.genres[0]}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Colonne droite : fiche + formulaires ── */}
          <div className="pub-main-col">
            {!selectedPublisher ? (
              <div className="pub-no-selection">
                <div className="pub-no-selection-icon">🏛</div>
                <p>Sélectionnez une maison d'édition dans la liste pour voir ses exigences de soumission et générer vos documents avec l'IA.</p>
                <p className="pub-no-selection-hint">{PUBLISHERS.length} maisons d'édition françaises indexées.</p>
              </div>
            ) : (
              <>
                {/* Fiche éditeur */}
                <PublisherRequirementsCard publisher={selectedPublisher} />

                {/* Contexte manuscrit */}
                <div className="pub-context-section">
                  <h3 className="pub-section-title">Contexte du manuscrit</h3>
                  <p className="pub-section-hint">Ces informations guident l'IA pour personnaliser chaque document.</p>
                  <div className="pub-context-grid">
                    <label className="pub-context-field">
                      <span className="pub-context-label">Titre de l'œuvre</span>
                      <input
                        type="text"
                        className="pub-context-input"
                        value={manuscritInfo.titre}
                        onChange={e => setManuscritInfo(p => ({ ...p, titre: e.target.value }))}
                        placeholder="Titre exact du manuscrit"
                      />
                    </label>
                    <label className="pub-context-field">
                      <span className="pub-context-label">Genre littéraire</span>
                      <input
                        type="text"
                        className="pub-context-input"
                        value={manuscritInfo.genre}
                        onChange={e => setManuscritInfo(p => ({ ...p, genre: e.target.value }))}
                        placeholder="Roman, thriller, fantasy…"
                      />
                    </label>
                    <label className="pub-context-field">
                      <span className="pub-context-label">Nom de l'auteur</span>
                      <input
                        type="text"
                        className="pub-context-input"
                        value={auteurNom}
                        onChange={e => setAuteurNom(e.target.value)}
                        placeholder="Prénom Nom"
                      />
                    </label>
                    <label className="pub-context-field pub-context-field-signes">
                      <span className="pub-context-label">Longueur du manuscrit</span>
                      <span className="pub-context-signes-val">
                        {manuscritInfo.signes > 0
                          ? `${manuscritInfo.signes.toLocaleString('fr-FR')} signes — ~${Math.round(manuscritInfo.signes / 1500)} pages`
                          : 'calculé automatiquement'}
                      </span>
                    </label>
                  </div>
                  <label className="pub-context-field pub-context-field-full">
                    <span className="pub-context-label">
                      Résumé de l'intrigue <span className="pub-context-required">*</span>
                      <span className="pub-context-hint-inline"> — indispensable pour la génération IA</span>
                    </span>
                    <textarea
                      className="pub-context-textarea"
                      rows={5}
                      value={manuscritInfo.resume}
                      onChange={e => setManuscritInfo(p => ({ ...p, resume: e.target.value }))}
                      placeholder="Décrivez l'intrigue, les personnages principaux, les enjeux et le dénouement. Plus c'est précis, meilleure est la génération IA."
                    />
                  </label>
                  <label className="pub-context-field pub-context-field-full">
                    <span className="pub-context-label">
                      Informations sur l'auteur
                      <span className="pub-context-hint-inline"> — pour la biographie</span>
                    </span>
                    <textarea
                      className="pub-context-textarea"
                      rows={3}
                      value={auteurBioRaw}
                      onChange={e => setAuteurBioRaw(e.target.value)}
                      placeholder="Parcours, formation, expériences, publications antérieures…"
                    />
                  </label>
                </div>

                {/* Documents */}
                <div className="pub-docs-section">
                  <h3 className="pub-section-title">Documents de soumission</h3>
                  <p className="pub-section-hint">
                    Documents requis par {selectedPublisher.nom} marqués en premier. Cliquez sur <strong>✦ Générer avec l'IA</strong> pour une première version.
                  </p>
                  {DOC_TYPES.map(dt => (
                    <DocSection
                      key={dt.id}
                      publisher={selectedPublisher}
                      docType={dt.id}
                      label={dt.label}
                      value={
                        dt.field === 'lettre'        ? lettre
                      : dt.field === 'synopsis'      ? synopsis
                      : dt.field === 'noteIntention' ? noteIntention
                      : bio
                      }
                      onChange={
                        dt.field === 'lettre'        ? setLettre
                      : dt.field === 'synopsis'      ? setSynopsis
                      : dt.field === 'noteIntention' ? setNoteIntention
                      : setBio
                      }
                      auteurNom={auteurNom}
                      auteurBioRaw={auteurBioRaw}
                      manuscritInfo={manuscritInfo}
                    />
                  ))}
                </div>

                {/* Export */}
                <div className="pub-export-section">
                  <h3 className="pub-section-title">Télécharger le dossier</h3>
                  <p className="pub-section-hint">Exporte lettre + synopsis + note d'intention + bio + manuscrit dans un fichier .txt prêt à l'envoi.</p>
                  <button type="button" className="publisher-btn publisher-btn-primary" onClick={handleExportDossier}>
                    📥 Télécharger le dossier complet (.txt)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          WORD
      ═══════════════════════════════════════════ */}
      {exportSubtab === 'word' && (
        <div className="publisher-subpanel" role="tabpanel">
          <section className="publisher-section">
            <h3>Microsoft Word (.docx)</h3>
            <p className="publisher-hint">
              Hiérarchie complète : saga → tome → chapitre → scène. Ouvrez dans Word pour ajuster polices et marges.
            </p>
            <div className="publisher-actions">
              <button type="button" className="publisher-btn publisher-btn-primary" disabled={exportBusy} onClick={handleExportDocx}>
                Télécharger le manuscrit (.docx)
              </button>
              <button type="button" className="publisher-btn" onClick={handleExportHtml}>
                Télécharger (.html)
              </button>
              <button type="button" className="publisher-btn" onClick={handleExportTxt}>
                Texte brut (.txt)
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          PDF
      ═══════════════════════════════════════════ */}
      {exportSubtab === 'pdf' && (
        <div className="publisher-subpanel" role="tabpanel">
          <section className="publisher-section publisher-cover-section">
            <h3>Couverture (PDF &amp; EPUB)</h3>
            <div className="publisher-cover-row">
              <label className="publisher-btn publisher-cover-file-label">
                Choisir une image…
                <input type="file" accept={COVER_ACCEPT} className="publisher-cover-file-input" onChange={handleCoverFile} />
              </label>
              {coverInfo?.dataUrl && (
                <button type="button" className="publisher-btn" onClick={handleClearCover}>Retirer</button>
              )}
            </div>
            {coverInfo?.dataUrl
              ? <div className="publisher-cover-preview"><img src={coverInfo.dataUrl} alt="Aperçu couverture" /></div>
              : <p className="publisher-hint">Aucune couverture définie.</p>
            }
          </section>
          <section className="publisher-section">
            <h3>Document PDF</h3>
            <p className="publisher-hint">PDF A4 — couverture en première page si définie.</p>
            <label className="publisher-field publisher-checkbox-row">
              <input type="checkbox" checked={pdfUseWatermark} onChange={e => setPdfUseWatermark(e.target.checked)} />
              <span>Filigrane sur toutes les pages</span>
            </label>
            {pdfUseWatermark && (
              <label className="publisher-field">
                <span className="publisher-field-label">Texte du filigrane</span>
                <input type="text" className="publisher-input" value={watermarkText} onChange={e => setWatermarkText(e.target.value)} />
              </label>
            )}
            <div className="publisher-actions">
              <button type="button" className="publisher-btn publisher-btn-primary" disabled={exportBusy} onClick={handleExportPdf}>
                Télécharger le manuscrit (.pdf)
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          EPUB
      ═══════════════════════════════════════════ */}
      {exportSubtab === 'epub' && (
        <div className="publisher-subpanel" role="tabpanel">
          <section className="publisher-section publisher-cover-section">
            <h3>Couverture (PDF &amp; EPUB)</h3>
            <div className="publisher-cover-row">
              <label className="publisher-btn publisher-cover-file-label">
                Choisir une image…
                <input type="file" accept={COVER_ACCEPT} className="publisher-cover-file-input" onChange={handleCoverFile} />
              </label>
              {coverInfo?.dataUrl && (
                <button type="button" className="publisher-btn" onClick={handleClearCover}>Retirer</button>
              )}
            </div>
            {coverInfo?.dataUrl
              ? <div className="publisher-cover-preview"><img src={coverInfo.dataUrl} alt="Aperçu couverture" /></div>
              : <p className="publisher-hint">Aucune couverture définie.</p>
            }
          </section>
          <section className="publisher-section">
            <h3>Livre EPUB 3</h3>
            <p className="publisher-hint">Table des matières, un fichier par chapitre. Compatible liseuses.</p>
            <label className="publisher-field publisher-checkbox-row">
              <input type="checkbox" checked={epubUseWatermark} onChange={e => setEpubUseWatermark(e.target.checked)} />
              <span>Filigrane sur les pages de chapitre</span>
            </label>
            {epubUseWatermark && (
              <label className="publisher-field">
                <span className="publisher-field-label">Texte du filigrane</span>
                <input type="text" className="publisher-input" value={watermarkText} onChange={e => setWatermarkText(e.target.value)} />
              </label>
            )}
            <label className="publisher-field publisher-checkbox-row">
              <input
                type="checkbox"
                checked={epubPipelineKindleSafeCss}
                onChange={(e) => setEpubPipelineKindleSafeCss(e.target.checked)}
              />
              <span>CSS « Kindle-safe » pour l’export via le pipeline print (même moteur que exportEpub3)</span>
            </label>
            {isDesktop() && (
              <label className="publisher-field publisher-checkbox-row">
                <input
                  type="checkbox"
                  checked={epubAutoEpubcheck}
                  onChange={(e) => setEpubAutoEpubcheck(e.target.checked)}
                />
                <span>
                  Lancer EPUBCheck après export (voir la configuration Java + JAR ci-dessous)
                </span>
              </label>
            )}
            <details className="publisher-hint" style={{ marginTop: 8, maxWidth: 560 }}>
              <summary style={{ cursor: 'pointer' }}>Rappel : extraits CSS Kindle-safe (aperçu)</summary>
              <pre
                style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                  fontSize: '0.8rem',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {EPUB_KINDLE_SAFE_SNIPPET.trim()}
              </pre>
            </details>
            <div className="publisher-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button type="button" className="publisher-btn publisher-btn-primary" disabled={exportBusy} onClick={handleExportEpub}>
                Télécharger le manuscrit (.epub)
              </button>
              <button type="button" className="publisher-btn" disabled={exportBusy} onClick={handleExportEpubPrintPipeline}>
                Télécharger (.epub, pipeline print)
              </button>
              <button
                type="button"
                className="publisher-btn"
                disabled={!lastEpubcheckFilename}
                onClick={() => void copyEpubcheckCommand()}
                title="Copie une commande prête à coller dans un terminal (dossier Téléchargements par défaut)."
              >
                Copier commande EPUBCheck
              </button>
            </div>
            {lastEpubcheckFilename && (
              <p className="publisher-hint" style={{ marginTop: 4 }}>
                Dernier export EPUB : <code>{lastEpubcheckFilename}</code>
              </p>
            )}
            <p className="publisher-hint">
              <strong>Recommandé</strong> avant diffusion sur les boutiques : valider l’EPUB (EPUBCheck). En
              application desktop, une passe peut s’enchaîner après export si Java et le JAR sont configurés. En
              navigateur ou sans JAR, utilisez la commande copiée ou{' '}
              <code>npm run epubcheck -- chemin/fichier.epub</code>.
            </p>
            <details className="publisher-hint" style={{ marginTop: 8, maxWidth: 640 }}>
              <summary style={{ cursor: 'pointer' }}>Configuration EPUBCheck (Java + JAR)</summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: '1.25rem', fontSize: '0.92rem', lineHeight: 1.45 }}>
                <li>
                  <strong>Java</strong> : résolu comme pour LanguageTool (JRE sur le <code>PATH</code>, ou runtime
                  embarqué selon votre installation Book Note / Scriptor).
                </li>
                <li>
                  <strong>JAR EPUBCheck</strong> : définissez une variable d’environnement pointant vers le fichier (
                  <code>EPUBCHECK_JAR</code>, <code>SCRIPTOR_EPUBCHECK_JAR</code> ou <code>BOOKNOTE_EPUBCHECK_JAR</code>
                  ) — chemin absolu vers <code>epubcheck-all.jar</code> ou <code>epubcheck.jar</code>.
                </li>
                <li>
                  <strong>Sans variable</strong> : placez le JAR dans le dossier données locales de l’application sous{' '}
                  <code>epubcheck/epubcheck-all.jar</code> ou <code>epubcheck/epubcheck.jar</code> (dossier utilisateur /
                  cache app, même logique que les autres données Scriptor).
                </li>
                <li>
                  Si le résultat indique que la validation a été ignorée, vérifiez Java et le chemin du JAR, ou lancez
                  EPUBCheck manuellement avec la commande copiée.
                </li>
              </ul>
            </details>
            {epubcheckDesktopResult && (
              <div
                role="status"
                style={{
                  marginTop: 12,
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: `1px solid ${
                    epubcheckDesktopResult.skipped
                      ? 'rgba(120, 120, 120, 0.4)'
                      : epubcheckDesktopResult.ok
                        ? 'rgba(60, 160, 90, 0.45)'
                        : 'rgba(200, 90, 60, 0.5)'
                  }`,
                  background: epubcheckDesktopResult.skipped
                    ? 'rgba(0,0,0,0.12)'
                    : epubcheckDesktopResult.ok
                      ? 'rgba(60, 160, 90, 0.08)'
                      : 'rgba(200, 90, 60, 0.07)',
                  maxWidth: 720,
                }}
              >
                <strong style={{ display: 'block', marginBottom: 8 }}>Résultat EPUBCheck (desktop)</strong>
                <p style={{ margin: '0 0 8px', fontSize: '0.92rem' }}>{epubcheckDesktopResult.details}</p>
                {!epubcheckDesktopResult.skipped && (
                  <>
                    <p className="publisher-hint" style={{ margin: '0 0 8px' }}>
                      Code : {epubcheckDesktopResult.exitCode ?? epubcheckDesktopResult.exit_code ?? '—'} —{' '}
                      {epubcheckDesktopResult.ok ? 'validation réussie' : 'signalements ou erreurs'}
                    </p>
                    {(epubcheckDesktopResult.stdout || epubcheckDesktopResult.stderr) && (
                      <pre
                        style={{
                          margin: 0,
                          maxHeight: 220,
                          overflow: 'auto',
                          fontSize: '0.75rem',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {epubcheckDesktopResult.stdout}
                        {epubcheckDesktopResult.stderr ? `\n--- stderr ---\n${epubcheckDesktopResult.stderr}` : ''}
                      </pre>
                    )}
                  </>
                )}
              </div>
            )}
            {epubPipelineWarnings.length > 0 && (
              <div
                role="status"
                className="publisher-hint"
                style={{
                  marginTop: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(200, 120, 0, 0.45)',
                  background: 'rgba(200, 120, 0, 0.08)',
                }}
              >
                <strong style={{ display: 'block', marginBottom: 6 }}>Notes après export pipeline</strong>
                <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
                  {epubPipelineWarnings.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}

      {exportSubtab === 'print' && (
        <div className="publisher-subpanel" role="tabpanel">
          <section className="publisher-section">
            <h3>Profils imprimeur (JSON versionnés)</h3>
            <div className="publisher-actions" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <label className="publisher-field">
                <span className="publisher-field-label">Plateforme</span>
                <select className="publisher-input" value={printerPlatform} onChange={(e) => setPrinterPlatform(e.target.value)}>
                  <option value="kdp">KDP</option>
                  <option value="ingramspark">IngramSpark</option>
                </select>
              </label>
              <label className="publisher-field">
                <span className="publisher-field-label">Format</span>
                <select className="publisher-input" value={trimFormat} onChange={(e) => setTrimFormat(e.target.value)}>
                  {profile.formatsIn.map((f) => (
                    <option key={formatOptionValue(f)} value={formatOptionValue(f)}>{f.label}"</option>
                  ))}
                </select>
              </label>
              <label className="publisher-field">
                <span className="publisher-field-label">Marché</span>
                <select className="publisher-input" value={printerMarket} onChange={(e) => setPrinterMarket(e.target.value)}>
                  <option value="FR">FR</option>
                  <option value="US">US</option>
                  <option value="UK">UK</option>
                </select>
              </label>
            </div>
            <p className="publisher-hint">
              <strong>{profile.name}</strong> — version profil {profile.version} — ICC{' '}
              <strong>{profile.iccProfile}</strong> — données de référence à partir du{' '}
              <strong>{profile.validFrom}</strong> (fonds perdus {profile.bleedIn}&quot;, marge de sécurité{' '}
              {profile.safeZoneIn}&quot;).
            </p>
          </section>

          <section className="publisher-section">
            <h3>Pages de garde automatiques</h3>
            <div className="pub-context-grid">
              <label className="pub-context-field">
                <span className="pub-context-label">Titre</span>
                <input className="pub-context-input" value={frontMatter.title} onChange={(e) => setFrontMatter((p) => ({ ...p, title: e.target.value }))} />
              </label>
              <label className="pub-context-field">
                <span className="pub-context-label">Auteur</span>
                <input className="pub-context-input" value={frontMatter.author} onChange={(e) => setFrontMatter((p) => ({ ...p, author: e.target.value }))} />
              </label>
              <label className="pub-context-field">
                <span className="pub-context-label">ISBN</span>
                <input className="pub-context-input" value={frontMatter.isbn} onChange={(e) => setFrontMatter((p) => ({ ...p, isbn: e.target.value }))} />
              </label>
              <label className="pub-context-field">
                <span className="pub-context-label">Retrait paragraphes (cm)</span>
                <input className="pub-context-input" type="number" step="0.1" value={insideIndentCm} onChange={(e) => setInsideIndentCm(Number(e.target.value || 0.5))} />
              </label>
              <label className="pub-context-field pub-context-field-full">
                <span className="pub-context-label">Mentions légales / copyright</span>
                <textarea className="pub-context-textarea" rows={2} value={frontMatter.legalNotice} onChange={(e) => setFrontMatter((p) => ({ ...p, legalNotice: e.target.value }))} />
              </label>
              <label className="pub-context-field">
                <span className="pub-context-label">Dédicace</span>
                <textarea className="pub-context-textarea" rows={2} value={frontMatter.dedication} onChange={(e) => setFrontMatter((p) => ({ ...p, dedication: e.target.value }))} />
              </label>
              <label className="pub-context-field">
                <span className="pub-context-label">Remerciements</span>
                <textarea className="pub-context-textarea" rows={2} value={frontMatter.acknowledgements} onChange={(e) => setFrontMatter((p) => ({ ...p, acknowledgements: e.target.value }))} />
              </label>
            </div>
            <button type="button" className="publisher-btn" onClick={handleExportFrontMatter}>
              Générer pages de garde + TOC (.txt)
            </button>
          </section>

          <section className="publisher-section">
            <h3>Vérifications pré-export</h3>
            <p className="publisher-hint">
              Estimation pages : <strong>{estimatedPages}</strong> — dos : <strong>{geometry.spine.widthIn.toFixed(3)}"</strong> (tolérance ±{geometry.spine.toleranceIn.toFixed(3)}").
            </p>
            <p className="publisher-hint" style={{ marginTop: 6 }}>
              Contrôle « texte hors marges » : pas de mesure pixel par caractère — alertes géométrie, coût, réticule et
              profils ci-dessous couvrent le risque principal.
            </p>
            <label className="publisher-field publisher-checkbox-row" style={{ marginTop: 6, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <input
                type="checkbox"
                checked={creepCompensationOn}
                onChange={(e) => setCreepCompensationOn(e.target.checked)}
              />
              <span>
                Compensateur de chasse (creep) : activer les offsets par signature dans les rapports d’audit —{' '}
                <strong>recommandé au-delà de 200 pages</strong> (réactivé automatiquement quand l’estimation dépasse ce
                seuil).
              </span>
            </label>
            <p className="publisher-hint">
              Coût estimé ({printCost.mode}) : <strong>{printCost.price} {printCost.currency}</strong>
              {printCost.outdated ? (
                <>
                  {' '}
                  — tarifs figés au <strong>{printCost.validFrom}</strong> : au-delà de six mois, l’outil bascule en{' '}
                  <strong>estimation approximative</strong> (vérifiez les grilles officielles KDP / IngramSpark).
                </>
              ) : (
                <> — table à jour (réf. {printCost.validFrom}).</>
              )}
            </p>
            <div style={{ border: '1px dashed #999', padding: 8, marginTop: 8 }}>
              <strong>Réticule sécurité</strong>
              <PrintSafeZonePreview
                profile={profile}
                selectedFormat={selectedFormat}
                estimatedPages={estimatedPages}
                geometry={geometry}
                massicotShiftIn={massicotShiftIn}
              />
              <label className="publisher-field" style={{ marginTop: 10, display: 'block', maxWidth: 360 }}>
                <span className="publisher-field-label">
                  Tolérance massicot simulée (pouces, vers l’intérieur du fond de coupe)
                </span>
                <input
                  className="publisher-input"
                  type="range"
                  min={0}
                  max={0.125}
                  step={0.005}
                  value={massicotShiftIn}
                  onChange={(e) => setMassicotShiftIn(Number(e.target.value))}
                />
                <span className="publisher-hint">{massicotShiftIn.toFixed(3)}&quot;</span>
              </label>
            </div>
            <div className="publisher-actions" style={{ gap: 8, marginTop: 10 }}>
              <label className="publisher-field">
                <span className="publisher-field-label">Distribution</span>
                <select className="publisher-input" value={printerDistribution} onChange={(e) => setPrinterDistribution(e.target.value)}>
                  <option value="standard">Standard</option>
                  <option value="expanded">Expanded</option>
                </select>
              </label>
              <label className="publisher-field">
                <span className="publisher-field-label">Couverture</span>
                <select className="publisher-input" value={coverType} onChange={(e) => setCoverType(e.target.value)}>
                  <option value="soft">Souple</option>
                  <option value="hard">Rigide</option>
                </select>
              </label>
              <label className="publisher-field">
                <span className="publisher-field-label">fontMode</span>
                <select className="publisher-input" value={fontMode} onChange={(e) => setFontMode(e.target.value)}>
                  <option value="embedded">embedded</option>
                  <option value="outlined">outlined</option>
                  <option value="hybrid-safe">hybrid-safe</option>
                </select>
              </label>
              <label className="publisher-field publisher-checkbox-row" style={{ alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={pdfExportX1a}
                  onChange={(e) => setPdfExportX1a(e.target.checked)}
                />
                <span>
                  Exporter en <strong>PDF/X-1a</strong> (pas de transparence dans les métadonnées ; flux legacy — voir
                  avertissements)
                </span>
              </label>
            </div>
            <div style={{ marginTop: 10 }}>
              {printAlerts.list.length === 0 ? (
                <p className="publisher-hint">Aucune alerte bloquante détectée.</p>
              ) : (
                <ul>
                  {printAlerts.list.map((a, i) => (
                    <li key={i} style={{ color: a.level === 'blocking' ? '#c00' : '#a60' }}>{a.level.toUpperCase()} — {a.text}</li>
                  ))}
                </ul>
              )}
              {printAlerts.coverDpi != null && (
                <p className="publisher-hint">DPI couverture estimé : {printAlerts.coverDpi}</p>
              )}
              {coverGamutScreening && coverGamutScreening.level !== 'ok' && (
                <p className="publisher-hint" style={{ color: coverGamutScreening.level === 'critical' ? '#c33' : '#a60' }}>
                  {coverGamutScreening.label}
                </p>
              )}
              {coverPrintPreflight && (
                <div className="publisher-hint" style={{ marginTop: 10 }}>
                  <strong>Préflight image (couverture print)</strong> — statut global :{' '}
                  <span
                    style={{
                      color:
                        coverPrintPreflight.status === 'Bloquant'
                          ? '#c00'
                          : coverPrintPreflight.status === 'Warning'
                            ? '#a60'
                            : 'inherit',
                    }}
                  >
                    {coverPrintPreflight.status}
                  </span>
                  {coverPrintPreflight.note && <span> — {coverPrintPreflight.note}</span>}
                  {coverPrintPreflight.images?.length > 0 && (
                    <ul style={{ margin: '6px 0 0 1em' }}>
                      {coverPrintPreflight.images.map((row) => (
                        <li key={row.id}>
                          {row.id} : {row.status}
                          {row.blocking?.length ? ` — bloquant : ${row.blocking.join('; ')}` : ''}
                          {row.warnings?.length ? ` — ${row.warnings.join('; ')}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {manuscriptImagesPreflight && (
                <div className="publisher-hint" style={{ marginTop: 10 }}>
                  <strong>Préflight images (corps manuscrit, data URL)</strong> — statut :{' '}
                  <span
                    style={{
                      color:
                        manuscriptImagesPreflight.status === 'Bloquant'
                          ? '#c00'
                          : manuscriptImagesPreflight.status === 'Warning'
                            ? '#a60'
                            : 'inherit',
                    }}
                  >
                    {manuscriptImagesPreflight.status}
                  </span>
                  {manuscriptImagesPreflight.note && <span> — {manuscriptImagesPreflight.note}</span>}
                  {manuscriptImagesPreflight.images?.length > 0 && (
                    <ul style={{ margin: '6px 0 0 1em' }}>
                      {manuscriptImagesPreflight.images.map((row) => (
                        <li key={row.id}>
                          {row.id} : {row.status}
                          {row.blocking?.length ? ` — bloquant : ${row.blocking.join('; ')}` : ''}
                          {row.warnings?.length ? ` — ${row.warnings.join('; ')}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="publisher-section">
            <h3>Simulation imprimeur</h3>
            <p className="publisher-hint">
              GutterSim : aperçu <strong>2D</strong> du pli central (ergonomie de lecture, pas une vue 3D moteur) — score
              pli : <strong>{gutterScore.score}/100</strong>
              {estimatedPages > 400 ? '' : ' (score détaillé si plus de 400 p.)'}.
            </p>
            <GutterSimCanvas
              userReadingAngle={userReadingAngle}
              coverStiffness={coverStiffness}
              gutterScore={gutterScore}
            />
            <div className="publisher-actions" style={{ gap: 8, marginTop: 10 }}>
              <label className="publisher-field">
                <span className="publisher-field-label">Angle lecture</span>
                <input className="publisher-input" type="number" min="90" max="140" value={userReadingAngle} onChange={(e) => setUserReadingAngle(Number(e.target.value || 110))} />
              </label>
              <label className="publisher-field">
                <span className="publisher-field-label">Rigidité couverture</span>
                <select className="publisher-input" value={coverStiffness} onChange={(e) => setCoverStiffness(e.target.value)}>
                  <option value="soft">soft</option>
                  <option value="hard">hard</option>
                </select>
              </label>
            </div>
            <p className="publisher-hint">
              Tolérances de coupe + dos réel : {selectedFormat.width}"x{selectedFormat.height}" / full cover {geometry.cover.widthIn.toFixed(3)}"x{geometry.cover.heightIn.toFixed(3)}".
            </p>
          </section>

          <section className="publisher-section">
            <h3>Rapport validation PDF/X</h3>
            <p className="publisher-hint">
              Lance un export print pro puis une validation native. Lecture double niveau : message auteur + détails techniques. Deux fichiers sont proposés au téléchargement : le PDF et le JSON Layout AST (archive-proof, réimport futur). Vous pouvez aussi exporter un JSON d’audit print (paramètres, alertes, coûts) sans relancer la validation.
            </p>
            <details className="publisher-hint" style={{ marginTop: 6, maxWidth: 640 }}>
              <summary style={{ cursor: 'pointer' }}>Validation ISO (veraPDF / Ghostscript)</summary>
              <ul style={{ margin: '8px 0 0', paddingLeft: '1.25rem', fontSize: '0.92rem', lineHeight: 1.45 }}>
                <li>
                  <strong>veraPDF</strong> : si la commande <code>verapdf</code> est dans le <code>PATH</code>, une passe
                  JSON est exécutée (conformité, règles en échec). Vous pouvez aussi définir le chemin complet de
                  l’exécutable : <code>SCRIPTOR_VERAPDF</code>, <code>VERAPDF_PATH</code> ou <code>VERAPDF_BIN</code>.
                </li>
                <li>
                  <strong>Sinon</strong> : si <code>gswin64c</code>, <code>gswin32c</code> ou <code>gs</code> est
                  disponible, Ghostscript ouvre le PDF en <code>nullpage</code> (test d’ouverture, pas une certification
                  ISO).
                </li>
                <li>
                  Sans outil externe, seule la validation structurelle interne Scriptor est effectuée (voir le badge
                  ci-dessous).
                </li>
              </ul>
            </details>
            <div className="publisher-actions">
              <button
                type="button"
                className="publisher-btn publisher-btn-primary"
                disabled={printValidationBusy}
                onClick={() => void handleRunPdfxValidation()}
              >
                {printValidationBusy ? 'Validation en cours…' : pdfExportX1a ? 'Contrôler PDF/X-1a' : 'Contrôler PDF/X-4'}
              </button>
              <button type="button" className="publisher-btn" onClick={handleDownloadPrintAudit}>
                Télécharger l’audit print (JSON)
              </button>
            </div>
            {printValidationReport && (
              <div style={{ marginTop: 10 }}>
                {(() => {
                  const mode = printValidationReport?.validation?.mode || ''
                  const isoRun =
                    printValidationReport?.isoToolValidated === true ||
                    mode === 'structural-plus-tool-run'
                  const badgeStyle = {
                    display: 'inline-block',
                    marginBottom: 8,
                    marginRight: 8,
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }
                  if (isoRun) {
                    return (
                      <span
                        style={{
                          ...badgeStyle,
                          background: 'rgba(0, 120, 90, 0.18)',
                          color: 'var(--success, #0a6)',
                          border: '1px solid rgba(0, 120, 90, 0.35)',
                        }}
                        title="Un outil externe (veraPDF ou Ghostscript) a été exécuté sur le PDF généré."
                      >
                        ISO outillée
                      </span>
                    )
                  }
                  return (
                    <span
                      style={{
                        ...badgeStyle,
                        background: 'rgba(200, 120, 0, 0.15)',
                        color: 'var(--warning, #a60)',
                        border: '1px solid rgba(200, 120, 0, 0.35)',
                      }}
                      title="Seule la validation structurelle Scriptor a été effectuée. Installez veraPDF ou Ghostscript dans le PATH pour une passe ISO."
                    >
                      Structurelle uniquement
                    </span>
                  )
                })()}
                {(() => {
                  const isoCompliant = printValidationReport?.validation?.isoCompliant
                  if (typeof isoCompliant !== 'boolean') return null
                  return (
                    <span
                      style={{
                        display: 'inline-block',
                        marginBottom: 8,
                        marginRight: 8,
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        background: isoCompliant ? 'rgba(0, 120, 90, 0.18)' : 'rgba(210, 40, 40, 0.16)',
                        color: isoCompliant ? 'var(--success, #0a6)' : '#a11',
                        border: isoCompliant
                          ? '1px solid rgba(0, 120, 90, 0.35)'
                          : '1px solid rgba(210, 40, 40, 0.35)',
                      }}
                      title="Statut de conformité remonté par veraPDF (quand disponible)."
                    >
                      {isoCompliant ? 'veraPDF conforme' : 'veraPDF non conforme'}
                    </span>
                  )
                })()}
                <p className="publisher-hint" style={{ color: printValidationReport?.validation?.ok ? '#0a0' : '#c00' }}>
                  {printValidationReport?.validation?.ok
                    ? 'Conformité structurelle validée.'
                    : 'Validation échouée ou incomplète.'}{' '}
                  Outil: {printValidationReport?.validation?.tool || 'n/a'} — mode:{' '}
                  {printValidationReport?.validation?.mode || 'n/a'}
                </p>
                {printValidationReport?.validation?.details && (
                  <p className="publisher-hint">
                    Détail auteur : {printValidationReport.validation.details}
                  </p>
                )}
                {(printValidationReport?.warnings?.length || printValidationReport?.validation?.warnings?.length) > 0 && (
                  <details>
                    <summary>Détails techniques (warnings)</summary>
                    <ul>
                      {(printValidationReport.warnings || []).map((w, i) => (
                        <li key={`rw-${i}`}>{w}</li>
                      ))}
                      {(printValidationReport.validation?.warnings || []).map((w, i) => (
                        <li key={`vw-${i}`}>{w}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {printValidationReport?.validation?.errors?.length > 0 && (
                  <details open>
                    <summary>Détails techniques (erreurs)</summary>
                    <ul>
                      {printValidationReport.validation.errors.map((e, i) => (
                        <li key={`ve-${i}`}>{e}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {exportSubtab === 'kitmedia' && <MediaKitTab project={project} />}
    </div>
  )
}

export default PublisherTab
