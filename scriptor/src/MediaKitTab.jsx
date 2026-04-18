import { useState, useEffect, useCallback, useMemo } from 'react'
import { buildManuscriptText, getCurrentSaga } from './projectStore.js'
import {
  promptArchitect,
  generationEngines,
  getLeonardoTutorialSteps,
  buildCoverComposition,
  buildMediaKitManifest,
  buildMockup2p5DPlan,
  createTypoLabPlan,
  compileTtfAfterValidation,
  estimateGamutFromImageBase64,
  analyzeSafeZoneReposition,
  renderSocialMaskPreviewBlob,
  buildSocialNetworkPackZip,
  renderCoverWithTitleBlob,
  renderImageCoverFitToBlob,
  renderEbookCoverBlob,
  SocialMaskPreview,
  MediaMockupCanvas,
} from './media/index.js'
import { getPrintCoverPlancheSpec } from './print/kitMediaPrintCoverSpec.js'

const AXIS_LABELS = {
  palette: 'Palette',
  composition: 'Composition',
  genre_visuel: 'Genre visuel',
  personnage_principal: 'Personnage central',
  elements_recurrents: 'Éléments récurrents',
  epoque_ambiance: 'Époque / ambiance',
  tension_composition: 'Tension / cadrage',
  genre_commercial: 'Lecture marché',
}

const SOCIAL_FORMAT_LABELS = {
  instagramPost1080: 'Instagram carré 1080',
  instagramStory1080x1920: 'Instagram story 1080×1920',
  tiktok1080x1920: 'TikTok 1080×1920',
  facebook1200x630: 'Facebook 1200×630',
  twitter1200x675: 'X / Twitter 1200×675',
  pinterest1000x1500: 'Pinterest 1000×1500',
}

const TYPO_VARIANTS = [
  { id: 'fantasy', label: 'Fantasy organique' },
  { id: 'thriller', label: 'Thriller' },
  { id: 'romance', label: 'Romance' },
  { id: 'scifi', label: 'Science-fiction' },
  { id: 'historical', label: 'Historique' },
]

function pct(c) {
  const n = Number(c)
  if (Number.isNaN(n)) return '—'
  return `${Math.round(n * 100)} %`
}

function formatAxisValue(key, axis) {
  if (!axis) return '—'
  if (key === 'elements_recurrents' && Array.isArray(axis.value)) {
    return axis.value.length ? axis.value.join(', ') : '—'
  }
  return String(axis.value ?? '—')
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result)
      const i = s.indexOf(',')
      resolve(i >= 0 ? s.slice(i + 1) : s)
    }
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image illisible'))
    }
    img.src = url
  })
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadBlobFile(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Brique 4 — Kit média : génération + post-traitement (saliency, couleurs, réseaux, TypoLab, manifeste).
 */
export default function MediaKitTab({ project }) {
  const saga = getCurrentSaga(project)
  const [engine, setEngine] = useState('pollinations')
  const [lowInference, setLowInference] = useState(false)
  const [axes, setAxes] = useState(null)
  const [questionnaire, setQuestionnaire] = useState([])
  const [promptId, setPromptId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [lastImageBlob, setLastImageBlob] = useState(null)
  const [leonardoKey, setLeonardoKey] = useState('')
  const [mjCopy, setMjCopy] = useState('')

  const [postBusy, setPostBusy] = useState(false)
  const [composition, setComposition] = useState(null)
  const [socialFormat, setSocialFormat] = useState('instagramPost1080')
  const [typoVariant, setTypoVariant] = useState('fantasy')
  const [typoPlan, setTypoPlan] = useState(null)
  const [typoFontBuffer, setTypoFontBuffer] = useState(null)
  const [typoAuthorValidated, setTypoAuthorValidated] = useState(false)
  const [gamutScreening, setGamutScreening] = useState(null)
  const [socialShowMaskOverlay, setSocialShowMaskOverlay] = useState(true)
  const [socialShowTitleGuides, setSocialShowTitleGuides] = useState(true)
  const [kitMediaAuthor, setKitMediaAuthor] = useState('')
  const [socialPackBusy, setSocialPackBusy] = useState(false)
  const [titleOverlayUrl, setTitleOverlayUrl] = useState(null)
  const [titleOverlayGamut, setTitleOverlayGamut] = useState(null)
  const [kitPrintPlatform, setKitPrintPlatform] = useState('kdp')
  const [kitDimExportBusy, setKitDimExportBusy] = useState(false)

  const manuscriptTextForKit = useMemo(() => buildManuscriptText(project), [project])
  const printPlancheSpec = useMemo(
    () => getPrintCoverPlancheSpec({ manuscriptText: manuscriptTextForKit, platform: kitPrintPlatform }),
    [manuscriptTextForKit, kitPrintPlatform],
  )

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handlePrepare = useCallback(() => {
    setErr('')
    setAxes(null)
    setQuestionnaire([])
    setPromptId(null)
    setMjCopy('')
    setComposition(null)
    setGamutScreening(null)
    setTypoPlan(null)
    setTypoFontBuffer(null)
    setLastImageBlob(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    const manuscriptText = buildManuscriptText(project)
    if (!String(manuscriptText || '').trim()) {
      setErr('Manuscrit vide : écrivez du texte avant d’analyser.')
      return
    }
    try {
      const out = promptArchitect.buildFromManuscript({
        manuscriptText,
        saga,
        lowInference,
        engine: engine === 'midjourney' ? 'midjourney' : engine === 'leonardo' ? 'leonardo' : 'pollinations',
      })
      setAxes(out.axes)
      setQuestionnaire(out.questionnaire || [])
      setPromptId(out.promptId)
    } catch (e) {
      setErr(String(e?.message || e))
    }
  }, [project, saga, lowInference, engine])

  const handleImportImage = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) {
      setErr('Choisissez un fichier image.')
      return
    }
    setErr('')
    setComposition(null)
    setGamutScreening(null)
    setTypoPlan(null)
    setTypoFontBuffer(null)
    setLastImageBlob(file)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const handleGenerate = async () => {
    setErr('')
    if (!promptId) {
      setErr('Cliquez d’abord sur « Préparer à partir du manuscrit ».')
      return
    }
    if (engine === 'midjourney') {
      setErr('Utilisez les boutons Midjourney (copier + ouvrir le site).')
      return
    }
    setBusy(true)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setLastImageBlob(null)
    setComposition(null)
    setGamutScreening(null)
    setTypoPlan(null)
    try {
      const out = await generationEngines.generateFromPromptId({
        promptId,
        engine,
        width: 1024,
        height: 1536,
        apiKey: engine === 'leonardo' ? leonardoKey : undefined,
      })
      if (out?.blob && out.blob instanceof Blob) {
        setLastImageBlob(out.blob)
        const url = URL.createObjectURL(out.blob)
        setPreviewUrl(url)
      } else if (out?.copyPrompt) {
        setMjCopy(out.copyPrompt)
      } else {
        setErr('Réponse moteur sans image — vérifiez la clé API ou le réseau.')
      }
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const handleAnalyzePost = async () => {
    setErr('')
    if (!lastImageBlob && !previewUrl) {
      setErr('Générez une image, ou importez un fichier image pour l’analyse.')
      return
    }
    setPostBusy(true)
    try {
      const blob =
        lastImageBlob ||
        (await fetch(previewUrl).then((r) => {
          if (!r.ok) throw new Error('Téléchargement image impossible')
          return r.blob()
        }))
      const b64 = await blobToBase64(blob)
      const img = await loadImageFromBlob(blob)
      const title = saga?.title || 'Titre'
      const author = ''
      const [comp, gamut] = await Promise.all([
        buildCoverComposition({
          imageInfo: { width: img.width, height: img.height, bytesBase64: b64 },
          title,
          author,
          platform: 'kdp',
        }),
        estimateGamutFromImageBase64(b64),
      ])
      setComposition(comp)
      setGamutScreening(gamut)
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setPostBusy(false)
    }
  }

  const handleTypoFontFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setErr('')
    setTypoAuthorValidated(false)
    setTypoPlan(null)
    const reader = new FileReader()
    reader.onload = () => {
      const buf = reader.result
      if (buf instanceof ArrayBuffer) setTypoFontBuffer(buf)
      else setErr('Lecture du fichier police impossible.')
    }
    reader.onerror = () => setErr('Lecture du fichier police impossible.')
    reader.readAsArrayBuffer(file)
  }

  const handleTypoPlan = () => {
    setErr('')
    setTypoAuthorValidated(false)
    try {
      const plan = createTypoLabPlan({
        fontMeta: {
          family: 'EB Garamond',
          licenseName: 'SIL Open Font License',
          licenseText: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
        },
        fontBuffer: typoFontBuffer || undefined,
        variantKey: typoVariant,
      })
      setTypoPlan(plan)
    } catch (e) {
      setErr(String(e?.message || e))
    }
  }

  const handleCompileTtf = async () => {
    setErr('')
    if (!typoPlan) {
      setErr('Générez d’abord un plan TypoLab.')
      return
    }
    if (!typoFontBuffer) {
      setErr('Réimportez le fichier .ttf / .otf utilisé pour le plan.')
      return
    }
    if (!typoAuthorValidated) {
      setErr('Cochez la validation auteur pour la compilation .ttf (CDC).')
      return
    }
    try {
      const blob = await compileTtfAfterValidation(typoPlan, true, typoFontBuffer)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = blob.type.includes('otf') ? 'otf' : 'ttf'
      a.download = `${typoPlan.renamedFont || 'scriptor-font'}-validated.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErr(String(e?.message || e))
    }
  }

  const handleDownloadManifest = () => {
    const mockup = buildMockup2p5DPlan({ coverWidth: 1200, coverHeight: 1800, spinePx: 120 })
    const manifest = buildMediaKitManifest({
      mockup3d: mockup,
      report: {
        composition: composition
          ? {
              placementScore: composition.placementScore,
              zone: composition.zone,
              zoneCandidates: composition.zoneCandidates,
              pipelineReport: composition.pipelineReport,
              averageRgb: composition.averageRgb,
              dominantHexes: (composition.dominantPalette || []).map((p) => p.hex),
              cmykCheck: composition.cmykCheck,
              saliency: composition.saliency?.suggestion,
              saliencyContext: composition.saliency?.saliencyContext,
            }
          : null,
        socialFormat,
        typoVariant: typoPlan?.variant?.id || null,
        mockup2p5d: mockup,
        gamutScreening: gamutScreening
          ? { level: gamutScreening.level, percentRisky: gamutScreening.percentRisky }
          : null,
        coverTitleCompositionGamut: titleOverlayGamut
          ? { level: titleOverlayGamut.level, percentRisky: titleOverlayGamut.percentRisky, label: titleOverlayGamut.label }
          : null,
        safeZoneReposition: composition?.zone
          ? analyzeSafeZoneReposition(composition.zone, socialFormat)
          : null,
        printPlancheSpec: {
          platform: printPlancheSpec.platform,
          estimatedPages: printPlancheSpec.estimatedPages,
          widthIn: printPlancheSpec.widthIn,
          heightIn: printPlancheSpec.heightIn,
          widthPx: printPlancheSpec.widthPx,
          heightPx: printPlancheSpec.heightPx,
          dpi: printPlancheSpec.dpi,
        },
      },
      priceEuro: 1,
    })
    const base = (saga?.title || 'kit-media').replace(/[^\w\u00C0-\u024f-]+/gi, '-').slice(0, 48) || 'kit-media'
    downloadJson(manifest, `${base}-kit-manifest.json`)
  }

  const handleMidjourney = async () => {
    setErr('')
    if (!promptId) {
      setErr('Préparez d’abord le prompt à partir du manuscrit.')
      return
    }
    setBusy(true)
    try {
      const out = await generationEngines.generateFromPromptId({
        promptId,
        engine: 'midjourney',
      })
      if (out?.copyPrompt) {
        setMjCopy(out.copyPrompt)
        try {
          await navigator.clipboard.writeText(out.copyPrompt)
          window.alert('Prompt Midjourney copié. Le site va s’ouvrir dans un nouvel onglet.')
        } catch {
          window.prompt('Copiez ce prompt Midjourney :', out.copyPrompt)
        }
        if (typeof out.open === 'function') out.open()
      }
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setBusy(false)
    }
  }

  const saveLeonardoKey = async () => {
    setErr('')
    try {
      await generationEngines.setLeonardoApiKey(leonardoKey.trim())
      window.alert('Clé Leonardo enregistrée sur cet appareil.')
    } catch (e) {
      setErr(String(e?.message || e))
    }
  }

  const socialReposition = useMemo(
    () =>
      composition?.zone ? analyzeSafeZoneReposition(composition.zone, socialFormat) : null,
    [composition?.zone, socialFormat],
  )
  const zoneAfterSocial = socialReposition?.zone ?? null

  const socialAlternateZones = useMemo(
    () => composition?.zoneCandidates?.filter((z) => z.rank > 1) ?? [],
    [composition?.zoneCandidates],
  )

  useEffect(() => {
    if (!previewUrl || !composition?.zone || !composition?.selectedColor?.rgb) {
      setTitleOverlayGamut(null)
      setTitleOverlayUrl((u) => {
        if (u) URL.revokeObjectURL(u)
        return null
      })
      return
    }
    const rgb = composition.selectedColor.rgb
    let cancelled = false
    ;(async () => {
      try {
        const { blob, gamutScreening: compGamut } = await renderCoverWithTitleBlob(previewUrl, {
          zone: composition.zone,
          title: saga?.title || 'Titre',
          author: kitMediaAuthor,
          rgb,
          fontBuffer: typoFontBuffer,
        })
        if (cancelled) return
        setTitleOverlayGamut(compGamut)
        const url = URL.createObjectURL(blob)
        setTitleOverlayUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      } catch {
        if (!cancelled) {
          setTitleOverlayGamut(null)
          setTitleOverlayUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return null
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [previewUrl, composition, kitMediaAuthor, typoFontBuffer, saga?.title])

  const handleExportSocialPng = async () => {
    setErr('')
    if (!previewUrl || !composition?.zone) {
      setErr('Aperçu image et analyse couverture requis.')
      return
    }
    try {
      const blob = await renderSocialMaskPreviewBlob(previewUrl, {
        formatId: socialFormat,
        zone: composition.zone,
        zoneAdjusted: zoneAfterSocial,
        alternateZones: socialAlternateZones,
        showBlockedOverlay: socialShowMaskOverlay,
        showTitleGuides: socialShowTitleGuides,
      })
      const base =
        (saga?.title || 'social').replace(/[^\w\u00C0-\u024f-]+/gi, '-').slice(0, 40) || 'social'
      downloadBlobFile(blob, `${base}-social-${socialFormat}.png`)
    } catch (e) {
      setErr(String(e?.message || e))
    }
  }

  const handleExportSocialZip = async () => {
    setErr('')
    if (!previewUrl || !composition?.zone) {
      setErr('Aperçu image et analyse couverture requis.')
      return
    }
    setSocialPackBusy(true)
    try {
      const blob = await buildSocialNetworkPackZip(previewUrl, {
        zone: composition.zone,
        alternateZones: socialAlternateZones,
        showBlockedOverlay: socialShowMaskOverlay,
        showTitleGuides: socialShowTitleGuides,
      })
      const base =
        (saga?.title || 'kit-social').replace(/[^\w\u00C0-\u024f-]+/gi, '-').slice(0, 40) || 'kit-social'
      downloadBlobFile(blob, `${base}-social-pack.zip`)
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setSocialPackBusy(false)
    }
  }

  const handleDownloadPrintPlanche = async () => {
    const src = titleOverlayUrl || previewUrl
    if (!src) {
      setErr('Aucune image couverture : générez ou importez une image.')
      return
    }
    setErr('')
    setKitDimExportBusy(true)
    try {
      const blob = await renderImageCoverFitToBlob(
        src,
        printPlancheSpec.widthPx,
        printPlancheSpec.heightPx,
        'image/png',
        0.95,
      )
      const base =
        (saga?.title || 'planche-print').replace(/[^\w\u00C0-\u024f-]+/gi, '-').slice(0, 40) || 'planche-print'
      downloadBlobFile(
        blob,
        `${base}-${printPlancheSpec.platform}-planche-${printPlancheSpec.widthPx}x${printPlancheSpec.heightPx}px.png`,
      )
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setKitDimExportBusy(false)
    }
  }

  const handleDownloadEbookCover = async () => {
    const src = titleOverlayUrl || previewUrl
    if (!src) {
      setErr('Aucune image couverture : générez ou importez une image.')
      return
    }
    setErr('')
    setKitDimExportBusy(true)
    try {
      const blob = await renderEbookCoverBlob(src, 1600, 4000)
      const base =
        (saga?.title || 'couverture-ebook').replace(/[^\w\u00C0-\u024f-]+/gi, '-').slice(0, 40) || 'couverture-ebook'
      downloadBlobFile(blob, `${base}-ebook-min1600.jpg`)
    } catch (e) {
      setErr(String(e?.message || e))
    } finally {
      setKitDimExportBusy(false)
    }
  }

  const handleDownloadTitleOverlay = async () => {
    setErr('')
    if (!previewUrl || !composition?.zone || !composition?.selectedColor?.rgb) {
      setErr('Analyse couverture et couleur titre requises.')
      return
    }
    try {
      const { blob } = await renderCoverWithTitleBlob(previewUrl, {
        zone: composition.zone,
        title: saga?.title || 'Titre',
        author: kitMediaAuthor,
        rgb: composition.selectedColor.rgb,
        fontBuffer: typoFontBuffer,
      })
      const base =
        (saga?.title || 'couverture-titre').replace(/[^\w\u00C0-\u024f-]+/gi, '-').slice(0, 40) || 'couverture-titre'
      downloadBlobFile(blob, `${base}-cover-title.png`)
    } catch (e) {
      setErr(String(e?.message || e))
    }
  }

  return (
    <div className="publisher-subpanel" role="tabpanel">
      <section className="publisher-section">
        <h3>Kit média (Brique 4)</h3>
        <p className="publisher-hint">
          Analyse du manuscrit → axes visuels (pas de prompt brut). Génération via Pollinations (sans clé), Leonardo
          (clé API), ou Midjourney (copie + site web). Ensuite : saliency, couleurs titre, réseaux sociaux, TypoLab,
          manifeste JSON.
        </p>
        <div className="publisher-actions" style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <label className="publisher-field">
            <span className="publisher-field-label">Moteur</span>
            <select className="publisher-input" value={engine} onChange={(e) => setEngine(e.target.value)}>
              <option value="pollinations">Pollinations.ai</option>
              <option value="leonardo">Leonardo.ai</option>
              <option value="midjourney">Midjourney (web)</option>
            </select>
          </label>
          <label className="publisher-field publisher-checkbox-row">
            <input
              type="checkbox"
              checked={lowInference}
              onChange={(e) => setLowInference(e.target.checked)}
            />
            <span>Mode faible inférence (moins d’extrapolation stylistique)</span>
          </label>
        </div>
        {engine === 'leonardo' && (
          <div className="pub-context-grid" style={{ marginTop: 12 }}>
            <label className="pub-context-field pub-context-field-full">
              <span className="pub-context-label">Clé API Leonardo</span>
              <input
                className="pub-context-input"
                type="password"
                autoComplete="off"
                value={leonardoKey}
                onChange={(e) => setLeonardoKey(e.target.value)}
                placeholder="Collez la clé puis enregistrez"
              />
            </label>
            <button type="button" className="publisher-btn" onClick={() => void saveLeonardoKey()}>
              Enregistrer la clé
            </button>
            <ul className="publisher-hint" style={{ gridColumn: '1 / -1', margin: 0, paddingLeft: '1.2em' }}>
              {getLeonardoTutorialSteps().map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="publisher-actions" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="publisher-btn publisher-btn-primary" onClick={handlePrepare}>
            Préparer à partir du manuscrit
          </button>
          {engine !== 'midjourney' && (
            <button type="button" className="publisher-btn" disabled={busy || !promptId} onClick={() => void handleGenerate()}>
              {busy ? 'Génération…' : 'Générer l’image'}
            </button>
          )}
          {engine === 'midjourney' && (
            <button type="button" className="publisher-btn" disabled={busy || !promptId} onClick={() => void handleMidjourney()}>
              Copier prompt + ouvrir Midjourney
            </button>
          )}
        </div>
        <p className="publisher-hint" style={{ marginTop: 10 }}>
          <label className="publisher-btn publisher-cover-file-label" style={{ display: 'inline-block' }}>
            Importer une image (analyse post-traitement)
            <input type="file" accept="image/*" className="publisher-cover-file-input" onChange={handleImportImage} />
          </label>
        </p>
        {err && (
          <p className="publisher-hint" style={{ color: '#c33', marginTop: 10 }}>
            {err}
          </p>
        )}
      </section>

      {questionnaire.length > 0 && (
        <section className="publisher-section">
          <h3>Questionnaire (réflexion avant génération)</h3>
          <ol className="publisher-hint" style={{ margin: 0, paddingLeft: '1.4em' }}>
            {questionnaire.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </section>
      )}

      {axes && (
        <section className="publisher-section">
          <h3>Axes extraits (confiance)</h3>
          <ul style={{ margin: 0, paddingLeft: '1.2em', lineHeight: 1.5 }}>
            {Object.entries(AXIS_LABELS).map(([key, label]) => {
              const ax = axes[key]
              return (
                <li key={key}>
                  <strong>{label}</strong> : {formatAxisValue(key, ax)} ({pct(ax?.confidence)})
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {previewUrl && (
        <section className="publisher-section">
          <h3>Aperçu</h3>
          <div className="publisher-cover-preview" style={{ maxWidth: 420 }}>
            <img src={previewUrl} alt="Aperçu génération couverture" style={{ maxWidth: '100%', height: 'auto' }} />
          </div>
        </section>
      )}

      {(previewUrl || lastImageBlob) && (
        <section className="publisher-section">
          <h3>Post-traitement (saliency, titre, CMJN)</h3>
          <p className="publisher-hint">
            Utilise l’image courante (générée ou importée). Saliency + score de placement + contrôle CMJN (LittleCMS
            natif ou simulation selon plateforme).
          </p>
          <button
            type="button"
            className="publisher-btn publisher-btn-primary"
            disabled={postBusy || (!lastImageBlob && !previewUrl)}
            onClick={() => void handleAnalyzePost()}
          >
            {postBusy ? 'Analyse…' : 'Analyser la couverture'}
          </button>
          {composition && (
            <div style={{ marginTop: 12, lineHeight: 1.5 }}>
              <p>
                <strong>Score placement</strong> : {composition.placementScore} —{' '}
                <strong>Zone titre suggérée</strong> : x={composition.zone.x.toFixed(2)}, y={composition.zone.y.toFixed(2)},
                w={composition.zone.w.toFixed(2)}, h={composition.zone.h.toFixed(2)}
              </p>
              <p>
                <strong>Saliency</strong> : {composition.saliency?.suggestion?.zone} ({composition.saliency?.suggestion?.reason}
                ){composition.saliency?.fallbackUsed ? ' — mode dégradé' : ''}
                {composition.saliency?.tfjsPathUsed ? ' — TensorFlow.js' : ''}
              </p>
              {composition.pipelineReport?.steps?.length > 0 && (
                <p className="publisher-hint" style={{ marginTop: 8 }}>
                  <strong>Pipeline espaces négatifs</strong> : {composition.pipelineReport.steps.join(' → ')}
                  {composition.pipelineReport.localVariance01 != null &&
                    ` — variance locale (0–1) : ${composition.pipelineReport.localVariance01}`}
                  {composition.pipelineReport.amazonListingRoughness01 != null &&
                    ` — roughness vignette 150×240 : ${composition.pipelineReport.amazonListingRoughness01}`}
                </p>
              )}
              {composition.zoneCandidates && composition.zoneCandidates.length > 1 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer' }}>Zones titre (2–3 candidats)</summary>
                  <ol style={{ margin: '8px 0 0', paddingLeft: '1.25rem', fontSize: '0.92rem' }}>
                    {composition.zoneCandidates.map((z, i) => (
                      <li key={i}>
                        #{z.rank} — {z.source} : x={z.x.toFixed(2)}, y={z.y.toFixed(2)}, w={z.w.toFixed(2)}, h={z.h.toFixed(2)}
                        {z.meanEdge != null ? ` (arête moy. ${z.meanEdge})` : ''}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <p>
                <strong>Couleur titre (proposition)</strong> : RGB({composition.selectedColor?.rgb?.r},{' '}
                {composition.selectedColor?.rgb?.g}, {composition.selectedColor?.rgb?.b}) — WCAG vs fond ~{' '}
                {composition.selectedColor?.wcag} {composition.selectedColor?.wcagAA ? '(AA)' : '(sous AA)'}
              </p>
              <p>
                <strong>CMJN / certif</strong> :{' '}
                {composition.cmykCheck?.certified ? 'certifié' : 'non certifié ou simulé'}
                {composition.cmykCheck?.warning ? ` — ${composition.cmykCheck.warning}` : ''}
              </p>
              {composition.averageRgb && (
                <p>
                  <strong>RGB moyen (image)</strong> : {composition.averageRgb.r}, {composition.averageRgb.g},{' '}
                  {composition.averageRgb.b} — référence de contraste pour les propositions de couleur titre.
                </p>
              )}
              {composition.dominantPalette && composition.dominantPalette.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <strong>Palette dominante (histogramme)</strong>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                    {composition.dominantPalette.map((c, i) => (
                      <span
                        key={i}
                        title={c.hex}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: c.hex,
                          border: '1px solid rgba(255,255,255,0.35)',
                          boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {gamutScreening && (
            <p
              className="publisher-hint"
              style={{
                marginTop: 12,
                color:
                  gamutScreening.level === 'critical' ? '#c33' : gamutScreening.level === 'soft' ? '#a60' : 'inherit',
              }}
            >
              <strong>Gamut (échantillonnage canvas)</strong> : {gamutScreening.label}
              {gamutScreening.suggestion ? ` — ${gamutScreening.suggestion}` : ''}
            </p>
          )}
        </section>
      )}

      {composition && previewUrl && (
        <section className="publisher-section">
          <h3>Couverture avec titre (typo locale)</h3>
          <p className="publisher-hint">
            Rendu Canvas : titre (nom de saga) + auteur optionnel dans la zone suggérée ; police importée (TypoLab) si
            disponible, sinon empattement système. Couleur = proposition WCAG du post-traitement. Ombre portée légère pour
            la lisibilité sur photos chargées.
          </p>
          <label className="publisher-field">
            <span className="publisher-field-label">Auteur (ligne sous le titre)</span>
            <input
              className="publisher-input"
              type="text"
              value={kitMediaAuthor}
              onChange={(e) => setKitMediaAuthor(e.target.value)}
              placeholder="Optionnel"
            />
          </label>
          {titleOverlayUrl && (
            <div style={{ marginTop: 12, maxWidth: 480 }}>
              <img
                src={titleOverlayUrl}
                alt="Aperçu couverture avec titre"
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)' }}
              />
              {titleOverlayGamut && titleOverlayGamut.level !== 'ok' && (
                <p
                  className="publisher-hint"
                  style={{
                    marginTop: 8,
                    color: titleOverlayGamut.level === 'critical' ? '#c33' : '#a60',
                  }}
                >
                  {titleOverlayGamut.label}
                  {titleOverlayGamut.suggestion ? ` — ${titleOverlayGamut.suggestion}` : ''}
                </p>
              )}
            </div>
          )}
          <div className="publisher-actions" style={{ marginTop: 10 }}>
            <button type="button" className="publisher-btn" onClick={() => void handleDownloadTitleOverlay()}>
              Télécharger PNG (couverture + titre)
            </button>
          </div>
        </section>
      )}

      {(previewUrl || titleOverlayUrl) && (
        <section className="publisher-section">
          <h3>Exports dimensions — imprimeur & ebook (§H)</h3>
          <p className="publisher-hint">
            <strong>Planche print</strong> : dimensions pleine couverture (dos + fond perdu) à 300 DPI, même logique que
            l’onglet Print pro — format <strong>6×9</strong> par défaut. L’image (avec titre si disponible) remplit la
            planche (échelle « cover »). <strong>Ebook</strong> : JPEG, côté court ≥ 1600 px (usage boutiques courant).
          </p>
          <label className="publisher-field">
            <span className="publisher-field-label">Profil planche (dos / fond perdu)</span>
            <select
              className="publisher-input"
              value={kitPrintPlatform}
              onChange={(e) => setKitPrintPlatform(e.target.value)}
            >
              <option value="kdp">KDP</option>
              <option value="ingramspark">IngramSpark</option>
            </select>
          </label>
          <p className="publisher-hint" style={{ marginTop: 8 }}>
            Estimation <strong>{printPlancheSpec.estimatedPages}</strong> p. — planche ≈{' '}
            <strong>
              {printPlancheSpec.widthIn.toFixed(3)}&quot; × {printPlancheSpec.heightIn.toFixed(3)}&quot;
            </strong>{' '}
            — <strong>
              {printPlancheSpec.widthPx} × {printPlancheSpec.heightPx} px
            </strong>{' '}
            @ {printPlancheSpec.dpi} DPI (dos {printPlancheSpec.spineWidthIn.toFixed(3)}&quot;).
          </p>
          <div className="publisher-actions" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="publisher-btn publisher-btn-primary"
              disabled={kitDimExportBusy}
              onClick={() => void handleDownloadPrintPlanche()}
            >
              {kitDimExportBusy ? 'Préparation…' : 'Télécharger planche print (PNG)'}
            </button>
            <button
              type="button"
              className="publisher-btn"
              disabled={kitDimExportBusy}
              onClick={() => void handleDownloadEbookCover()}
            >
              {kitDimExportBusy ? 'Préparation…' : 'Télécharger couverture ebook (JPEG)'}
            </button>
          </div>
        </section>
      )}

      {composition && (
        <section className="publisher-section">
          <h3>Réseaux sociaux — safe zones</h3>
          <p className="publisher-hint">
            Repositionnement indicatif du bloc titre pour éviter les zones masquées (UI des apps). Calques affichables
            séparément ci-dessous.
          </p>
          <label className="publisher-field">
            <span className="publisher-field-label">Format</span>
            <select
              className="publisher-input"
              value={socialFormat}
              onChange={(e) => setSocialFormat(e.target.value)}
            >
              {Object.entries(SOCIAL_FORMAT_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="publisher-actions" style={{ flexWrap: 'wrap', gap: 12, marginTop: 10, alignItems: 'center' }}>
            <label className="publisher-field publisher-checkbox-row">
              <input
                type="checkbox"
                checked={socialShowMaskOverlay}
                onChange={(e) => setSocialShowMaskOverlay(e.target.checked)}
              />
              <span>Afficher les masques UI (rouge)</span>
            </label>
            <label className="publisher-field publisher-checkbox-row">
              <input
                type="checkbox"
                checked={socialShowTitleGuides}
                onChange={(e) => setSocialShowTitleGuides(e.target.checked)}
              />
              <span>Afficher les guides titre (orange / vert / bleu)</span>
            </label>
          </div>
          {zoneAfterSocial && (
            <p className="publisher-hint" style={{ marginTop: 8 }}>
              <strong>Après ajustement</strong> : x={zoneAfterSocial.x.toFixed(3)}, y={zoneAfterSocial.y.toFixed(3)}, w=
              {zoneAfterSocial.w.toFixed(3)}, h={zoneAfterSocial.h.toFixed(3)}
              {socialReposition && socialReposition.iterations > 0
                ? ` — ${socialReposition.iterations} passe(s) de repositionnement`
                : ''}
            </p>
          )}
          {socialReposition?.overlapRemaining && (
            <p className="publisher-hint" style={{ marginTop: 6, color: '#a60', maxWidth: 520 }}>
              Le bloc titre ne peut pas être entièrement placé hors des masques pour ce format (rectangle trop large ou
              masques étendus). Vérifiez manuellement ou changez de format réseau.
            </p>
          )}
          <div className="publisher-actions" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="publisher-btn"
              disabled={!previewUrl || !composition.zone}
              onClick={() => void handleExportSocialPng()}
            >
              Télécharger l’aperçu social (PNG, 1080 px)
            </button>
            <button
              type="button"
              className="publisher-btn publisher-btn-primary"
              disabled={!previewUrl || !composition.zone || socialPackBusy}
              onClick={() => void handleExportSocialZip()}
            >
              {socialPackBusy ? 'Génération du ZIP…' : 'Télécharger le pack réseaux (ZIP, 6 formats)'}
            </button>
          </div>
          {previewUrl && composition.zone && (
            <div style={{ marginTop: 12 }}>
              <SocialMaskPreview
                imageSrc={previewUrl}
                formatId={socialFormat}
                formatLabel={SOCIAL_FORMAT_LABELS[socialFormat]}
                zone={composition.zone}
                zoneAdjusted={zoneAfterSocial}
                alternateZones={socialAlternateZones}
                showBlockedOverlay={socialShowMaskOverlay}
                showTitleGuides={socialShowTitleGuides}
              />
            </div>
          )}
        </section>
      )}

      {previewUrl && (
        <section className="publisher-section">
          <h3>Mockup livre (2.5D)</h3>
          <p className="publisher-hint">Vue simplifiée recto + tranche pour le kit média (CDC Brique 4).</p>
          <MediaMockupCanvas imageSrc={previewUrl} bookTitle={saga?.title || 'Titre'} />
        </section>
      )}

      <section className="publisher-section">
        <h3>TypoLab (police dérivée OFL)</h3>
        <p className="publisher-hint">
          Importez une police OFL (.ttf / .otf), puis plan + aperçu SVG. La compilation produit un vrai fichier .ttf
          renommé (tables <code>name</code>) après validation auteur (CDC).
        </p>
        <div className="publisher-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <label className="publisher-field">
            <span className="publisher-field-label">Fichier police (OFL)</span>
            <input
              type="file"
              accept=".ttf,.otf,font/ttf,font/otf,application/x-font-ttf,application/x-font-opentype"
              className="publisher-input"
              onChange={handleTypoFontFile}
            />
          </label>
          {typoFontBuffer && (
            <span className="publisher-hint" style={{ alignSelf: 'center' }}>
              {(typoFontBuffer.byteLength / 1024).toFixed(1)} Ko chargés
            </span>
          )}
          <label className="publisher-field">
            <span className="publisher-field-label">Variation</span>
            <select className="publisher-input" value={typoVariant} onChange={(e) => setTypoVariant(e.target.value)}>
              {TYPO_VARIANTS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="publisher-btn" onClick={handleTypoPlan}>
            Générer plan TypoLab + SVG
          </button>
        </div>
        {typoPlan && (
          <div style={{ marginTop: 12 }}>
            <p className="publisher-hint">
              Police renommée proposée : <code>{typoPlan.renamedFont}</code> — variant <code>{typoPlan.variant.id}</code>
            </p>
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(typoPlan.svgPreview)}`}
              alt="Aperçu TypoLab"
              style={{ border: '1px solid #444', borderRadius: 8, maxWidth: '100%', height: 'auto' }}
            />
            <label className="publisher-field publisher-checkbox-row" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={typoAuthorValidated}
                onChange={(e) => setTypoAuthorValidated(e.target.checked)}
              />
              <span>Je valide l’aperçu SVG (obligatoire avant export .ttf, CDC)</span>
            </label>
            <div className="publisher-actions" style={{ marginTop: 8 }}>
              <button type="button" className="publisher-btn" onClick={() => void handleCompileTtf()}>
                Télécharger .ttf (pipeline TypoLab)
              </button>
            </div>
            <p className="publisher-hint">
              Le .ttf exporté est une copie renommée dérivée (métadonnées + description TypoLab) — respectez toujours la
              licence OFL et le renommage pour les travaux dérivés.
            </p>
          </div>
        )}
      </section>

      <section className="publisher-section">
        <h3>Manifeste kit média (JSON)</h3>
        <p className="publisher-hint">Export archive des métadonnées (prix min. 1 € dans le schéma CDC).</p>
        <button type="button" className="publisher-btn" onClick={handleDownloadManifest}>
          Télécharger le manifeste (.json)
        </button>
      </section>

      {mjCopy && engine === 'midjourney' && (
        <section className="publisher-section">
          <h3>Prompt Midjourney</h3>
          <p className="publisher-hint">Copié dans le presse-papiers ; importez l’image générée pour l’analyse ci-dessus.</p>
          <textarea className="pub-context-textarea" readOnly rows={6} value={mjCopy} style={{ width: '100%', maxWidth: 640 }} />
        </section>
      )}
    </div>
  )
}
