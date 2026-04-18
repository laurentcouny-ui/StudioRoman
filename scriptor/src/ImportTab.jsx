import { useState, useRef, useEffect, useMemo } from 'react'
import { parseImportedText, saveSceneText } from './projectStore.js'
import { isDesktop } from './platform'
import {
  deriveProjectSlugFromProject,
  runPreflight,
  startImportSession,
  sha256HexFile,
  commitImportSession,
  attachBackupToSession,
  saveImportLog,
  listRecentImportLogs,
  importStageSceneText,
  importCommitStagedScenes,
  importRestoreFromPreImportBackup,
  readFileAsArrayBufferChunked,
  sha256HexArrayBuffer,
  extractManuscriptFromArrayBuffer,
  buildAstFromParsed,
  generatePatchesForText,
  collapseTypoPatches,
  detectFrench,
  buildParserContextSnapshot,
  applyTypoGroupsToParsed,
  applyTypoPatchesToString,
  buildDiffSpans,
  spansToHtml,
  joinedPlainFromParsed,
  semanticFingerprint50,
  scoreImportAgainstSaga,
} from './import/index.js'

const PREFLIGHT_FAIL_MSG =
  'Scriptor ne peut pas écrire dans ce dossier. Vérifiez vos droits ou votre antivirus.'

const PDF_WARN_MSG =
  "L'import PDF reconstruit le texte à partir de la mise en page ; le résultat peut nécessiter une relecture. Continuer ?"

const SHADOW_FAIL_MSG =
  'Le fichier a été modifié pendant votre analyse. Deux versions existent. Réessayez avec le fichier inchangé ou recommencez l’import.'

function firstSceneText(parsed) {
  return String(parsed?.chapters?.[0]?.scenes?.[0]?.text ?? '')
}

function buildImportReport({
  importId,
  parserContext,
  chapters,
  scenes,
  patchCount,
  compactCount,
  ms,
  rootHash,
}) {
  return [
    `Scriptor — rapport d’import`,
    `Import ID : ${importId}`,
    `Durée totale (analyse UI) : ${ms} ms`,
    `Structure : ${chapters} chapitre(s), ${scenes} scène(s)`,
    `Typographie : ${patchCount} patch(s) généré(s) → ${compactCount} lot(s) compacté(s)`,
    `Hash racine AST : ${rootHash}`,
    `Parser : v${parserContext.parserVersion} / rules ${parserContext.rulesChecksum?.slice(0, 12)}…`,
    `Horodatage : ${parserContext.timestamp}`,
    '',
    'Les corrections typographiques ne sont appliquées que si vous cochez l’option correspondante avant validation.',
  ].join('\n')
}

function ImportTab({ project, currentSaga, onImport, onRollbackVolume }) {
  const [rawText, setRawText] = useState('')
  const [preview, setPreview] = useState(null)
  const fileInputRef = useRef(null)

  const [manuscriptPreview, setManuscriptPreview] = useState(null)
  const [manuscriptError, setManuscriptError] = useState(null)
  const [manuscriptLoading, setManuscriptLoading] = useState(false)
  const [manuscriptLabel, setManuscriptLabel] = useState('')
  const [quickManuscript, setQuickManuscript] = useState(false)
  const [lastImportId, setLastImportId] = useState(null)
  const [diskHashAtStart, setDiskHashAtStart] = useState('')
  const [shadowVerified, setShadowVerified] = useState(false)
  const [shadowOverride, setShadowOverride] = useState(false)
  const [manuscriptKind, setManuscriptKind] = useState('')
  const [plainFingerprint50, setPlainFingerprint50] = useState('')
  const [astRootSnapshot, setAstRootSnapshot] = useState('')
  const [mergeComparePlain, setMergeComparePlain] = useState(null)
  const [restoreLogs, setRestoreLogs] = useState([])
  const mergePickRef = useRef(null)
  const [importTypoCorrections, setImportTypoCorrections] = useState(false)
  const [patchGroups, setPatchGroups] = useState({
    spaces: true,
    punct: true,
    dialogue: false,
    signals: false,
  })
  const [astInfo, setAstInfo] = useState(null)
  const [parseMs, setParseMs] = useState(0)
  const [parseProgress, setParseProgress] = useState(0)
  const sessionRef = useRef(null)
  const manuscriptFileRef = useRef(null)
  const shadowFileRef = useRef(null)

  const langGuess = useMemo(
    () => detectFrench(firstSceneText(manuscriptPreview)),
    [manuscriptPreview],
  )

  const previewPatches = useMemo(() => {
    const t = firstSceneText(manuscriptPreview)
    if (!t) return { collapsed: [], raw: [] }
    const { patches } = generatePatchesForText(t, patchGroups, { targetNodeId: 'preview' })
    const collapsed = collapseTypoPatches(patches)
    return { collapsed, raw: patches }
  }, [manuscriptPreview, patchGroups])

  const patchedPreviewHtml = useMemo(() => {
    const orig = firstSceneText(manuscriptPreview)
    if (!orig) return ''
    const { patches } = generatePatchesForText(orig, patchGroups, { targetNodeId: 'preview' })
    const mod = applyTypoPatchesToString(orig, patches)
    const spans = buildDiffSpans(orig, mod)
    return spansToHtml(spans)
  }, [manuscriptPreview, patchGroups])

  useEffect(() => {
    return () => {
      void sessionRef.current?.stop?.()
    }
  }, [])

  useEffect(() => {
    if (!isDesktop()) return
    void listRecentImportLogs(12).then(setRestoreLogs).catch(() => setRestoreLogs([]))
  }, [])

  const importScores = useMemo(() => {
    if (!manuscriptPreview || !currentSaga) return null
    return scoreImportAgainstSaga(manuscriptPreview, currentSaga, project)
  }, [manuscriptPreview, currentSaga, project])

  const handleAnalyze = () => {
    const parsed = parseImportedText(rawText)
    setPreview(parsed)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setRawText(String(reader.result ?? ''))
      setPreview(null)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const handleImport = () => {
    if (!preview) return
    onImport?.(preview)
    setRawText('')
    setPreview(null)
  }

  const handleManuscriptPick = () => {
    manuscriptFileRef.current?.click()
  }

  const runManuscriptPipeline = async (file) => {
    setManuscriptError(null)
    setManuscriptPreview(null)
    setAstInfo(null)
    setManuscriptLabel(file.name)
    setShadowVerified(!isDesktop())
    setShadowOverride(false)
    setDiskHashAtStart('')
    setManuscriptKind('')
    setMergeComparePlain(null)
    setPlainFingerprint50('')
    setAstRootSnapshot('')
    const lower = file.name.toLowerCase()
    const isPdf = lower.endsWith('.pdf')
    const isDocx = lower.endsWith('.docx')

    if (isPdf) {
      const ok = window.confirm(PDF_WARN_MSG)
      if (!ok) {
        setManuscriptLabel('')
        return
      }
    }

    if (file.size > 10 * 1024 * 1024) {
      const ok = window.confirm(
        'Ce fichier dépasse 10 Mo. La mémoire peut être sollicitée fortement. Le parsing s’exécute en arrière-plan (worker). Continuer ?',
      )
      if (!ok) {
        setManuscriptLabel('')
        return
      }
    }

    setManuscriptLoading(true)
    setParseProgress(0)
    const t0 = performance.now()
    let sessionHandles = null
    try {
      const slug = deriveProjectSlugFromProject(project)
      let plain = ''

      if (isDocx || isPdf) {
        if (isDesktop()) {
          try {
            await runPreflight(slug)
          } catch {
            setManuscriptError(PREFLIGHT_FAIL_MSG)
            setManuscriptLoading(false)
            setManuscriptLabel('')
            setParseProgress(0)
            return
          }
        }
        const buf = await readFileAsArrayBufferChunked(file, (p) =>
          setParseProgress(Math.round(p * 0.12)),
        )
        if (isDesktop()) {
          const diskHash = await sha256HexArrayBuffer(buf)
          setDiskHashAtStart(diskHash)
          sessionHandles = await startImportSession({
            projectSlug: slug,
            projectId: currentSaga?.id || 'unknown',
            diskHashAtStart: diskHash,
          })
          sessionRef.current = sessionHandles
          setLastImportId(sessionHandles.importId)
        }
        const kind = isDocx ? 'docx' : 'pdf'
        setManuscriptKind(kind)
        const { plain: p } = await extractManuscriptFromArrayBuffer(buf, kind, (pr) =>
          setParseProgress(12 + Math.round(pr * 0.88)),
        )
        plain = p
      } else if (lower.endsWith('.txt')) {
        if (isDesktop()) {
          try {
            await runPreflight(slug)
          } catch {
            setManuscriptError(PREFLIGHT_FAIL_MSG)
            setManuscriptLoading(false)
            setManuscriptLabel('')
            setParseProgress(0)
            return
          }
        }
        if (isDesktop()) {
          const buf = await readFileAsArrayBufferChunked(file, (p) =>
            setParseProgress(Math.round(p * 0.5)),
          )
          const diskHash = await sha256HexArrayBuffer(buf)
          setDiskHashAtStart(diskHash)
          sessionHandles = await startImportSession({
            projectSlug: slug,
            projectId: currentSaga?.id || 'unknown',
            diskHashAtStart: diskHash,
          })
          sessionRef.current = sessionHandles
          setLastImportId(sessionHandles.importId)
          setManuscriptKind('txt')
          plain = new TextDecoder('utf-8', { fatal: false }).decode(buf)
          setParseProgress(100)
        } else {
          setManuscriptKind('txt')
          plain = await new Promise((resolve, reject) => {
            const r = new FileReader()
            r.onload = () => resolve(String(r.result ?? ''))
            r.onerror = () => reject(new Error('lecture'))
            r.readAsText(file, 'UTF-8')
          })
        }
      } else {
        setManuscriptError('Format non pris en charge pour ce flux.')
        setManuscriptLoading(false)
        setManuscriptLabel('')
        setParseProgress(0)
        void sessionHandles?.stop?.()
        return
      }

      const parsed = parseImportedText(plain)
      setManuscriptPreview(parsed)
      const ast = buildAstFromParsed(parsed)
      if (!quickManuscript) {
        setAstInfo(ast)
      } else {
        setAstInfo(null)
      }
      const joined = joinedPlainFromParsed(parsed)
      setPlainFingerprint50(await semanticFingerprint50(joined))
      setAstRootSnapshot(ast.rootHash)
      setParseMs(Math.round(performance.now() - t0))
    } catch (err) {
      console.error(err)
      setManuscriptError(String(err?.message || err))
      void sessionHandles?.stop?.()
    } finally {
      setManuscriptLoading(false)
      setParseProgress(0)
    }
  }

  const handleManuscriptFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void runManuscriptPipeline(file)
  }

  const handleShadowFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !diskHashAtStart) return
    try {
      const h = await sha256HexFile(file)
      if (h !== diskHashAtStart) {
        setManuscriptError(SHADOW_FAIL_MSG)
        setShadowVerified(false)
        return
      }
      setManuscriptError(null)
      setShadowVerified(true)
      setShadowOverride(false)
    } catch (err) {
      setManuscriptError(String(err?.message || err))
      setShadowVerified(false)
    }
  }

  const handleShadowResetImport = () => {
    setManuscriptPreview(null)
    setManuscriptLabel('')
    setDiskHashAtStart('')
    setShadowVerified(false)
    setShadowOverride(false)
    setManuscriptError(null)
    setAstInfo(null)
    setLastImportId(null)
    setManuscriptKind('')
    setPlainFingerprint50('')
    setAstRootSnapshot('')
    setMergeComparePlain(null)
    void sessionRef.current?.stop?.()
    sessionRef.current = null
  }

  const handleShadowDangerousOverride = () => {
    const ok = window.confirm(
      [
        'Le fichier que vous proposez ne correspond pas au hash enregistré lors de l’analyse.',
        'Importer quand même peut mélanger deux versions du manuscrit (risque de perte ou doublons).',
        'Confirmez-vous l’import final sans vérification Shadow Merge ?',
      ].join('\n'),
    )
    if (!ok) return
    setShadowOverride(true)
    setManuscriptError(null)
  }

  const handleMergeComparePick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !manuscriptKind) return
    try {
      const lower = file.name.toLowerCase()
      let kind = manuscriptKind
      if (lower.endsWith('.pdf')) kind = 'pdf'
      else if (lower.endsWith('.docx')) kind = 'docx'
      else if (lower.endsWith('.txt')) kind = 'txt'
      else {
        setManuscriptError('Comparer : utilisez .docx, .pdf ou .txt.')
        return
      }
      let plain = ''
      if (kind === 'txt') {
        plain = await new Promise((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result ?? ''))
          r.onerror = () => reject(new Error('lecture'))
          r.readAsText(file, 'UTF-8')
        })
      } else {
        const buf = await file.arrayBuffer()
        const { plain: p } = await extractManuscriptFromArrayBuffer(buf, kind, () => {})
        plain = p
      }
      setMergeComparePlain(plain)
      setManuscriptError(null)
    } catch (err) {
      setManuscriptError(String(err?.message || err))
    }
  }

  const handleReplacePreviewFromComparedFile = async () => {
    if (mergeComparePlain == null) return
    const ok = window.confirm(
      [
        'Remplacer l’aperçu par le texte du fichier comparé ?',
        'La session d’import et le hash disque seront réinitialisés : vous devrez repasser par « Choisir un manuscrit » (ou Shadow Merge) avant un import final CDC.',
      ].join('\n'),
    )
    if (!ok) return
    const parsed = parseImportedText(mergeComparePlain)
    setManuscriptPreview(parsed)
    const ast = buildAstFromParsed(parsed)
    setAstInfo(quickManuscript ? null : ast)
    setPlainFingerprint50(await semanticFingerprint50(joinedPlainFromParsed(parsed)))
    setAstRootSnapshot(ast.rootHash)
    setMergeComparePlain(null)
    setDiskHashAtStart('')
    setShadowVerified(!isDesktop())
    setShadowOverride(false)
    setLastImportId(null)
    void sessionRef.current?.stop?.()
    sessionRef.current = null
    setManuscriptError(
      'Aperçu remplacé. Relancez une analyse complète du fichier cible pour recréer session + hash, puis Shadow Merge.',
    )
  }

  const handleRestoreFromBackupLog = async (backupPath) => {
    if (!backupPath || !isDesktop()) return
    const slug = deriveProjectSlugFromProject(project)
    const ok = window.confirm(
      [
        'Restaurer le disque du projet depuis ce backup pré-import ?',
        'Les fichiers sous Documents/Scriptor seront écrasés. Fermez l’édition en cours, puis rechargez le projet dans Scriptor.',
      ].join('\n'),
    )
    if (!ok) return
    try {
      await importRestoreFromPreImportBackup({ projectSlug: slug, backupPath })
      window.alert('Restauration disque terminée. Rechargez le projet (ou redémarrez l’app) pour lire l’état restauré.')
      void listRecentImportLogs(12).then(setRestoreLogs).catch(() => {})
    } catch (err) {
      setManuscriptError(String(err?.message || err))
    }
  }

  const handleManuscriptImport = async () => {
    if (!manuscriptPreview || !currentSaga) return
    if (isDesktop() && !shadowVerified && !shadowOverride) {
      setManuscriptError('Sélectionnez à nouveau le fichier source pour vérifier son intégrité (Shadow Merge).')
      return
    }
    const nCh = manuscriptPreview.chapters?.length ?? 0
    const nSc =
      manuscriptPreview.chapters?.reduce((s, ch) => s + (ch.scenes?.length ?? 0), 0) ?? 0

    let toImport = manuscriptPreview
    if (importTypoCorrections && !quickManuscript) {
      toImport = applyTypoGroupsToParsed(manuscriptPreview, patchGroups)
    }

    const astNow = buildAstFromParsed(toImport).rootHash
    const astMismatch = Boolean(astRootSnapshot && astNow !== astRootSnapshot)
    const fpNow = await semanticFingerprint50(joinedPlainFromParsed(toImport))
    const fpMismatch = Boolean(plainFingerprint50 && fpNow !== plainFingerprint50)

    const diskStaging =
      isDesktop() && lastImportId
        ? '\n• Écriture disque : staging sous .tmp_import puis WAL (scènes), conformément au CDC.'
        : ''
    const drift =
      (astMismatch ? '\n• Empreinte AST différente de l’analyse initiale.' : '') +
      (fpMismatch ? '\n• Empreinte des 50 premiers mots différente de l’analyse initiale.' : '')
    const msg = [
      'Confirmer l’import dans la saga en cours ?',
      `${nCh} chapitre(s), ${nSc} scène(s).`,
      importTypoCorrections
        ? 'Les corrections typographiques cochées seront appliquées au texte importé.'
        : 'Texte importé tel quel (sans corrections typo automatiques).',
      diskStaging,
      drift,
      isDesktop() ? '\n• Validation finale : écriture dans le projet courant (double confirmation CDC).' : '',
    ]
      .filter(Boolean)
      .join('\n')
    if (!window.confirm(msg)) return

    const slug = deriveProjectSlugFromProject(project)
    let backupPath = ''
    try {
      if (isDesktop() && lastImportId) {
        const { invoke } = await import('@tauri-apps/api/core')
        backupPath = await invoke('import_pre_import_backup', {
          projectSlug: slug,
          importId: lastImportId,
        })
        await attachBackupToSession(lastImportId, backupPath)
      }

      const useStaging = Boolean(isDesktop() && lastImportId)
      const meta = onImport?.(toImport, { deferSceneWrite: useStaging })

      if (useStaging && meta?.scenePairs?.length) {
        for (const pair of meta.scenePairs) {
          await importStageSceneText({
            projectSlug: slug,
            importId: lastImportId,
            sceneId: pair.id,
            text: pair.text,
          })
        }
        await importCommitStagedScenes({ projectSlug: slug, importId: lastImportId })
        for (const { id, text } of meta.scenePairs) {
          saveSceneText(id, text)
        }
      }
      const parserContext = await buildParserContextSnapshot()

      if (isDesktop() && lastImportId && meta?.volumeId) {
        await saveImportLog({
          importId: lastImportId,
          projectSlug: slug,
          sagaId: meta.sagaId,
          backupPath,
          createdAt: Math.floor(Date.now() / 1000),
          volumeId: meta.volumeId,
          sceneIds: meta.sceneIds || [],
          parserVersion: parserContext.parserVersion,
        })
      }

      const report = buildImportReport({
        importId: lastImportId || 'web',
        parserContext,
        chapters: nCh,
        scenes: nSc,
        patchCount: previewPatches.raw.length,
        compactCount: previewPatches.collapsed.length,
        ms: parseMs,
        rootHash: astInfo?.rootHash || 'n/a',
      })
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `import-report-${lastImportId || 'session'}.txt`
      a.click()
      URL.revokeObjectURL(a.href)

      if (lastImportId && isDesktop()) {
        await commitImportSession(lastImportId)
      }

      void listRecentImportLogs(12).then(setRestoreLogs).catch(() => {})

      sessionRef.current?.stopHeartbeat?.()
      sessionRef.current = null
      setManuscriptPreview(null)
      setManuscriptLabel('')
      setLastImportId(null)
      setAstInfo(null)
      setDiskHashAtStart('')
      setShadowVerified(!isDesktop())
    } catch (e) {
      console.error(e)
      setManuscriptError(String(e?.message || e))
      sessionRef.current?.stopHeartbeat?.()
    }
  }

  const handleRollbackLast = async () => {
    if (!onRollbackVolume || !isDesktop()) return
    const logs = await listRecentImportLogs(1)
    const log = logs[0]
    if (!log) {
      window.alert('Aucun import récent enregistré.')
      return
    }
    if (
      !window.confirm(
        'Annuler le dernier import enregistré ? Le tome importé sera retiré et les textes de scène supprimés du stockage local.',
      )
    ) {
      return
    }
    onRollbackVolume(log.sagaId, log.volumeId, log.sceneIds || [])
  }

  const canImport = currentSaga && preview && preview.chapters?.length > 0
  const canManuscriptImport =
    currentSaga &&
    manuscriptPreview &&
    manuscriptPreview.chapters?.length > 0 &&
    (!isDesktop() || shadowVerified || shadowOverride)

  return (
    <div className="import-tab">
      <h2>Import</h2>
      <p className="import-intro">
        Collez un texte ou chargez un fichier .txt. Scriptor détecte les chapitres
        (lignes commençant par &quot;Chapitre 1&quot;, &quot;Chapitre : Titre&quot;, &quot;## Titre&quot;)
        et crée un nouveau tome dans la saga en cours.
      </p>

      <section className="import-section">
        <h3>Saisie du texte</h3>
        <textarea
          className="import-textarea"
          rows={12}
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value)
            setPreview(null)
          }}
          placeholder="Collez ici votre texte ou chargez un fichier ci-dessous..."
        />
        <div className="import-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="import-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Charger un fichier .txt
          </button>
          <button
            type="button"
            className="import-btn import-btn-primary"
            onClick={handleAnalyze}
            disabled={!rawText.trim()}
          >
            Analyser la structure
          </button>
        </div>
      </section>

      {preview && (
        <section className="import-section import-preview">
          <h3>Aperçu</h3>
          <p className="import-stats">
            <strong>{preview.volumeTitle}</strong> — {preview.chapters?.length ?? 0} chapitre(s),{' '}
            {preview.chapters?.reduce((s, ch) => s + (ch.scenes?.length ?? 0), 0) ?? 0} scène(s).
          </p>
          <ul className="import-chapter-list">
            {preview.chapters?.map((ch, i) => (
              <li key={i}>
                <span className="import-chapter-title">{ch.title}</span>
                <span className="import-chapter-meta">
                  {ch.scenes?.length ?? 0} scène(s)
                  {ch.scenes?.[0]?.text?.length
                    ? ` — ${ch.scenes[0].text.slice(0, 60).replace(/\n/g, ' ')}…`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
          {canImport && (
            <button
              type="button"
              className="import-btn import-btn-import"
              onClick={handleImport}
            >
              Importer dans la saga en cours
            </button>
          )}
        </section>
      )}

      <section className="import-section" style={{ marginTop: '1.5rem' }}>
        <h3>Manuscrit (Brique 3)</h3>
        <p className="import-intro">
          Word (.docx), PDF ou texte brut : préflight disque sur l’app bureau, session d’import,
          sauvegarde pré-import sur disque, vérification Shadow Merge (même fichier), AST + patches
          typographiques proposés (non appliqués sans accord explicite).
        </p>
        <label className="import-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={quickManuscript}
            onChange={(e) => setQuickManuscript(e.target.checked)}
          />
          Import rapide (structure + texte, sans panneau typo / AST)
        </label>
        <div className="import-actions">
          <input
            ref={manuscriptFileRef}
            type="file"
            accept=".docx,.pdf,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
            onChange={handleManuscriptFile}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="import-btn"
            onClick={handleManuscriptPick}
            disabled={manuscriptLoading}
          >
            {manuscriptLoading ? 'Traitement…' : 'Choisir un manuscrit…'}
          </button>
        </div>
        {manuscriptLoading && (
          <div className="import-progress-row" aria-live="polite">
            <progress className="import-progress-bar" value={parseProgress} max={100} />
            <span className="import-progress-label">{parseProgress}%</span>
          </div>
        )}
        {manuscriptLabel && (
          <p className="import-stats">
            <strong>Fichier :</strong> {manuscriptLabel}
          </p>
        )}
        {manuscriptError && (
          <p className="import-no-saga" role="alert">
            {manuscriptError}
          </p>
        )}
      </section>

      {manuscriptPreview && !quickManuscript && (
        <section className="import-section">
          <h3>Corrections proposées (aperçu 1ʳᵉ scène)</h3>
          <p className="import-stats">
            Langue détectée : <strong>{langGuess === 'fr' ? 'français' : 'incertaine'}</strong> — le
            groupe « Dialogues » n’est pertinent que si le texte est en français.
          </p>
          <div className="import-patch-groups">
            {[
              ['spaces', 'Espaces (doubles, etc.)'],
              ['punct', 'Ponctuation (…, etc.)'],
              ['dialogue', 'Dialogues (guillemets FR)'],
              ['signals', 'Signalements (mots en majuscules courts)'],
            ].map(([groupKey, label]) => (
              <label key={groupKey} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={patchGroups[groupKey]}
                  disabled={groupKey === 'dialogue' && langGuess !== 'fr'}
                  onChange={(e) =>
                    setPatchGroups((prev) => ({ ...prev, [groupKey]: e.target.checked }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={importTypoCorrections}
              onChange={(e) => setImportTypoCorrections(e.target.checked)}
            />
            <span>
              <strong>Appliquer</strong> les corrections ci-dessus au texte importé (sinon import
              brut)
            </span>
          </label>

          <div className="import-dual-view" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div>
              <h4>Original (extrait)</h4>
              <pre className="import-dual-pre">{firstSceneText(manuscriptPreview).slice(0, 4000)}</pre>
            </div>
            <div>
              <h4>Diff (première scène)</h4>
              <div
                className="import-dual-pre"
                dangerouslySetInnerHTML={{ __html: patchedPreviewHtml || '—' }}
              />
            </div>
          </div>
          {astInfo && (
            <p className="import-stats">
              AST racine : <code>{astInfo.rootHash}</code> — {astInfo.nodes?.length ?? 0} chapitre(s)
              dans l’arbre
            </p>
          )}
        </section>
      )}

      {manuscriptPreview && isDesktop() && diskHashAtStart && (
        <section className="import-section">
          <h3>Shadow Merge</h3>
          <p className="import-intro">
            Sélectionnez <strong>le même fichier</strong> que celui analysé pour confirmer qu’il n’a
            pas été modifié sur le disque (cloud, éditeur externe).
          </p>
          <input
            ref={shadowFileRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleShadowFile}
          />
          <button
            type="button"
            className="import-btn"
            onClick={() => shadowFileRef.current?.click()}
          >
            Vérifier le fichier source
          </button>
          {shadowVerified ? (
            <p className="import-stats" style={{ color: 'var(--success, #0a0)' }}>
              Fichier vérifié — hash identique.
            </p>
          ) : shadowOverride ? (
            <p className="import-stats" style={{ color: 'var(--warning, #a60)' }}>
              Import sans vérification Shadow Merge (confirmé manuellement).
            </p>
          ) : (
            <p className="import-no-saga">Vérification requise avant l’import final.</p>
          )}
          {manuscriptError === SHADOW_FAIL_MSG && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              <button type="button" className="import-btn" onClick={handleShadowResetImport}>
                Réinitialiser l’import
              </button>
              <button
                type="button"
                className="import-btn"
                onClick={handleShadowDangerousOverride}
              >
                Importer quand même…
              </button>
            </div>
          )}
          {manuscriptKind && (
            <div style={{ marginTop: 14 }}>
              <h4>Merge manuel (deux versions)</h4>
              <p className="import-stats">
                Chargez une autre version du fichier pour comparer la première scène côte à côte, puis
                remplacez l’aperçu si vous choisissez ce texte (session réinitialisée).
              </p>
              <input
                ref={mergePickRef}
                type="file"
                accept=".docx,.pdf,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                style={{ display: 'none' }}
                onChange={(ev) => void handleMergeComparePick(ev)}
              />
              <button
                type="button"
                className="import-btn"
                onClick={() => mergePickRef.current?.click()}
              >
                Charger une version à comparer…
              </button>
              {mergeComparePlain != null && (
                <div style={{ marginTop: 10 }}>
                  <div
                    className="import-dual-view"
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
                  >
                    <div>
                      <h5>Analysé (1ʳᵉ scène)</h5>
                      <pre className="import-dual-pre">
                        {firstSceneText(manuscriptPreview).slice(0, 4000)}
                      </pre>
                    </div>
                    <div>
                      <h5>Fichier comparé (1ʳᵉ scène)</h5>
                      <pre className="import-dual-pre">
                        {firstSceneText(parseImportedText(mergeComparePlain)).slice(0, 4000)}
                      </pre>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="import-btn"
                    style={{ marginTop: 8 }}
                    onClick={() => void handleReplacePreviewFromComparedFile()}
                  >
                    Remplacer l’aperçu par le fichier comparé
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {manuscriptPreview && importScores && (
        <section className="import-section">
          <h3>Scoring Bible / personnages (CDC)</h3>
          <p className="import-stats">
            Rapprochement des titres de chapitres avec la Bible de la saga (Levenshtein) et des noms du
            projet avec les tokens du texte (fenêtre début de manuscrit).
          </p>
          <ul className="import-chapter-list">
            {importScores.chapterScores.map((row, i) => (
              <li key={i}>
                <span className="import-chapter-title">{row.title}</span>
                <span className="import-chapter-meta">
                  {row.bestBible
                    ? `Bible ~ « ${row.bestBible.slice(0, 48)}${row.bestBible.length > 48 ? '…' : ''} » — distance ${row.distance} — ${row.note}`
                    : row.note}
                </span>
              </li>
            ))}
          </ul>
          {importScores.characterHints.length > 0 && (
            <p className="import-stats">
              Personnages détectés (Levenshtein ≤ 2) :{' '}
              {importScores.characterHints
                .slice(0, 12)
                .map((h) => `${h.name} ~ «${h.match}»`)
                .join(' · ')}
            </p>
          )}
        </section>
      )}

      {manuscriptPreview && (
        <section className="import-section import-preview">
          <h3>Aperçu manuscrit</h3>
          <p className="import-stats">
            <strong>{manuscriptPreview.volumeTitle}</strong> —{' '}
            {manuscriptPreview.chapters?.length ?? 0} chapitre(s),{' '}
            {manuscriptPreview.chapters?.reduce((s, ch) => s + (ch.scenes?.length ?? 0), 0) ?? 0}{' '}
            scène(s).
            {quickManuscript && ' (import rapide)'}
          </p>
          <ul className="import-chapter-list">
            {manuscriptPreview.chapters?.map((ch, i) => (
              <li key={i}>
                <span className="import-chapter-title">{ch.title}</span>
                <span className="import-chapter-meta">
                  {ch.scenes?.length ?? 0} scène(s)
                  {ch.scenes?.[0]?.text?.length
                    ? ` — ${ch.scenes[0].text.slice(0, 60).replace(/\n/g, ' ')}…`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
          {canManuscriptImport && (
            <button
              type="button"
              className="import-btn import-btn-import"
              onClick={() => void handleManuscriptImport()}
            >
              Importer dans la saga en cours
            </button>
          )}
        </section>
      )}

      {isDesktop() && restoreLogs.length > 0 && (
        <section className="import-section">
          <h3>Restauration disque (backup pré-import)</h3>
          <p className="import-intro">
            Réécrit le dossier projet sur disque depuis une sauvegarde <code>pre-import-*</code>{' '}
            (commande Rust). Utile si le rollback applicatif ne suffit pas.
          </p>
          <ul className="import-chapter-list">
            {restoreLogs.map((log) => (
              <li key={log.importId}>
                <span className="import-chapter-title">{log.importId.slice(0, 8)}…</span>
                <span className="import-chapter-meta" style={{ display: 'block', marginTop: 4 }}>
                  <code style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>{log.backupPath}</code>
                </span>
                <button
                  type="button"
                  className="import-btn"
                  style={{ marginTop: 6 }}
                  onClick={() => void handleRestoreFromBackupLog(log.backupPath)}
                >
                  Restaurer ce backup sur le disque
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isDesktop() && (
        <section className="import-section">
          <h3>Annulation (rollback)</h3>
          <p className="import-intro">
            Retire le <strong>dernier</strong> import enregistré (tome + textes de scène) d’après le
            journal AppData.
          </p>
          <button type="button" className="import-btn" onClick={() => void handleRollbackLast()}>
            Annuler le dernier import manuscrit
          </button>
        </section>
      )}

      {!currentSaga && (
        <p className="import-no-saga">
          Sélectionnez ou créez une saga dans le panneau de gauche pour importer.
        </p>
      )}
    </div>
  )
}

export default ImportTab
