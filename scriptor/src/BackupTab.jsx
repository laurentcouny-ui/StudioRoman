import { useState, useEffect, useRef } from 'react'
import {
  exportFullBackup,
  importFullBackup,
  getLastLocalBackupTimestamp,
  setLastLocalBackupTimestamp,
  markAllowShrinkPersist,
} from './projectStore.js'
import {
  isGoogleDriveConnected,
  isDropboxConnected,
  connectGoogleDrive,
  disconnectGoogleDrive,
  connectDropbox,
  disconnectDropbox,
  uploadBackupToDrive,
  uploadBackupToDropbox,
  getUploadIntervalMinutes,
  completeDropboxAuth,
  completeGoogleAuth,
  subscribeBackupStatus,
  getBackupStatusSnapshot,
  setBackupEncryptionPassphrase,
} from './backupService.js'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function formatLastBackup(ts) {
  if (!ts) return 'Jamais'
  const d = new Date(ts)
  const now = Date.now()
  const diff = (now - ts) / 1000
  if (diff < 60) return "À l'instant"
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function BackupTab({ title = 'Sauvegarde & sécurité', onRestored }) {
  const fileInputRef = useRef(null)
  const [gdriveStatus, setGdriveStatus] = useState(() => isGoogleDriveConnected())
  const [dropboxStatus, setDropboxStatus] = useState(() => isDropboxConnected())
  const [cloudError, setCloudError] = useState('')
  const [cloudUploading, setCloudUploading] = useState(false)
  const [lastLocal, setLastLocal] = useState(() => getLastLocalBackupTimestamp())
  const [backupState, setBackupState] = useState(() => getBackupStatusSnapshot())
  const [storageWarning, setStorageWarning] = useState('')
  const [encryptCloud, setEncryptCloud] = useState(false)
  const [cloudPassphrase, setCloudPassphrase] = useState('')

  const isSecurityTab = title === 'Sauvegarde & sécurité'

  useEffect(() => {
    if (completeDropboxAuth()) queueMicrotask(() => setDropboxStatus(true))
    if (completeGoogleAuth()) queueMicrotask(() => setGdriveStatus(true))
  }, [])

  useEffect(() => {
    const unsub = subscribeBackupStatus((snapshot) => {
      setBackupState(snapshot)
      setGdriveStatus(snapshot.connected?.drive ?? isGoogleDriveConnected())
      setDropboxStatus(snapshot.connected?.dropbox ?? isDropboxConnected())
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    setBackupEncryptionPassphrase(encryptCloud ? cloudPassphrase : '')
  }, [encryptCloud, cloudPassphrase])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorageWarning = (e) => {
      const scope = e?.detail?.scope || 'storage'
      const hint = e?.detail?.message ? ` ${e.detail.message}` : ''
      setStorageWarning(
        `Problème de stockage navigateur (${scope}).${hint} Préférez un export JSON et vérifiez le quota localStorage (F12 → Stockage), pas seulement l’espace disque.`,
      )
    }
    window.addEventListener('scriptor-storage-warning', onStorageWarning)
    return () => window.removeEventListener('scriptor-storage-warning', onStorageWarning)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onAuthError = (e) => {
      const provider = e?.detail?.provider
      const message = e?.detail?.message || 'Connexion cloud impossible'
      if (provider === 'google') setGdriveStatus(false)
      if (provider === 'dropbox') setDropboxStatus(false)
      setCloudError(message)
    }
    window.addEventListener('scriptor-cloud-auth-error', onAuthError)
    return () => window.removeEventListener('scriptor-cloud-auth-error', onAuthError)
  }, [])

  const handleExport = () => {
    const data = exportFullBackup()
    if (!data) return
    setLastLocalBackupTimestamp()
    setLastLocal(getLastLocalBackupTimestamp())
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const date = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '-')
    downloadBlob(blob, `scriptor-backup-${date}.json`)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        const project = importFullBackup(data)
        if (project) {
          markAllowShrinkPersist()
          onRestored?.(project)
        }
      } catch {
        // fichier invalide: rien à restaurer
      }
      e.target.value = ''
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleConnectDrive = (e) => {
    e?.preventDefault?.()
    setCloudError('')
    connectGoogleDrive().catch((err) => setCloudError(err?.message || 'Connexion Google impossible'))
  }

  const handleDisconnectDrive = () => {
    disconnectGoogleDrive()
    setGdriveStatus(false)
  }

  const handleConnectDropbox = (e) => {
    e?.preventDefault?.()
    setCloudError('')
    connectDropbox().catch((err) => setCloudError(err?.message || 'Connexion Dropbox impossible'))
  }

  const handleDisconnectDropbox = () => {
    disconnectDropbox()
    setDropboxStatus(false)
  }

  const handleUploadNow = () => {
    if (!isGoogleDriveConnected() && !isDropboxConnected()) return
    setCloudError('')
    setCloudUploading(true)
    const done = () => setCloudUploading(false)
    Promise.all([
      isGoogleDriveConnected() ? uploadBackupToDrive(exportFullBackup) : Promise.resolve(),
      isDropboxConnected() ? uploadBackupToDropbox(exportFullBackup) : Promise.resolve(),
    ]).then(done).catch((err) => {
      setCloudError(err?.message || 'Envoi impossible')
      done()
    })
  }

  const handleUploadDriveOnly = () => {
    if (!isGoogleDriveConnected()) return
    setCloudError('')
    setCloudUploading(true)
    uploadBackupToDrive(exportFullBackup)
      .catch((err) => setCloudError(err?.message || 'Envoi Google impossible'))
      .finally(() => setCloudUploading(false))
  }

  const handleUploadDropboxOnly = () => {
    if (!isDropboxConnected()) return
    setCloudError('')
    setCloudUploading(true)
    uploadBackupToDropbox(exportFullBackup)
      .catch((err) => setCloudError(err?.message || 'Envoi Dropbox impossible'))
      .finally(() => setCloudUploading(false))
  }

  if (!isSecurityTab) {
    return (
      <div className="backup-tab">
        <h2>{title}</h2>
        <p className="backup-intro">
          Téléchargez une sauvegarde complète sur votre ordinateur ou restaurez depuis un fichier.
          Pour la stratégie complète (navigateur + Google Drive + local), ouvrez l’onglet <strong>Sauvegarde & sécurité</strong>.
        </p>
        <section className="backup-section">
          <h3>Télécharger la sauvegarde</h3>
          <button type="button" className="backup-btn backup-btn-export" onClick={handleExport}>
            Télécharger la sauvegarde
          </button>
        </section>
        <section className="backup-section">
          <h3>Relancer l&apos;envoi cloud</h3>
          <p style={{ marginBottom: '0.65rem', color: '#94a3b8', fontSize: '0.9rem' }}>
            Même action que « Envoyer maintenant » dans l’onglet <strong>Sauvegarde &amp; sécurité</strong> : poussez
            votre projet vers Google Drive ou Dropbox sans attendre le cycle automatique (toutes les{' '}
            {getUploadIntervalMinutes()} min).
          </p>
          {cloudError && <p className="backup-error">{cloudError}</p>}
          <div className="backup-cloud-buttons" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              className="backup-btn backup-btn-export"
              onClick={handleUploadDriveOnly}
              disabled={cloudUploading || !gdriveStatus}
              title={!gdriveStatus ? 'Connectez Google Drive dans Sauvegarde & sécurité' : undefined}
            >
              {cloudUploading ? 'Envoi…' : 'Envoyer vers Google Drive'}
            </button>
            <button
              type="button"
              className="backup-btn backup-btn-export"
              onClick={handleUploadDropboxOnly}
              disabled={cloudUploading || !dropboxStatus}
              title={!dropboxStatus ? 'Connectez Dropbox dans Sauvegarde & sécurité' : undefined}
            >
              {cloudUploading ? 'Envoi…' : 'Envoyer vers Dropbox'}
            </button>
          </div>
          {!gdriveStatus && !dropboxStatus ? (
            <p className="backup-status" style={{ marginTop: '0.5rem' }}>
              Aucun service connecté — ouvrez <strong>Sauvegarde &amp; sécurité</strong> pour lier votre compte.
            </p>
          ) : null}
        </section>

        <section className="backup-section">
          <h3>Restaurer depuis un fichier</h3>
          <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} style={{ display: 'none' }} />
          <button type="button" className="backup-btn backup-btn-import" onClick={handleImportClick}>
            Restaurer depuis un fichier
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="backup-tab backup-tab-security">
      <h2>{title}</h2>
      <p className="backup-intro">
        Trois niveaux pour ne jamais perdre des milliers d’heures de travail : sauvegarde en temps réel
        dans le navigateur, envoi automatique toutes les {getUploadIntervalMinutes()} min sur votre
        <strong> Google Drive ou Dropbox (gratuit, compte personnel)</strong>, et téléchargement
        d’un fichier sur votre ordinateur. Aucun abonnement. Côté cloud, le même fichier (
        <code>scriptor-backup-latest.json</code>) est <strong>remplacé</strong> à chaque envoi sur
        chaque service connecté — pas d’historique automatique toutes les X minutes (utilisez
        « Télécharger » pour garder des copies datées sur le disque).
      </p>

      <section className="backup-section backup-level">
        <span className="backup-level-badge">Niveau 1</span>
        <h3>Sauvegarde navigateur (temps réel)</h3>
        <p>
          Chaque modification est enregistrée immédiatement dans le navigateur. Aucune action requise.
        </p>
        <p className="backup-status backup-status-ok">Actif</p>
      </section>

      <section className="backup-section backup-level">
        <span className="backup-level-badge">Niveau 2</span>
        <h3>Google Drive ou Dropbox (toutes les {getUploadIntervalMinutes()} min)</h3>
        <p>
          Un fichier complet est envoyé automatiquement sur votre compte personnel (Google ou Dropbox).
          Gratuit — vous utilisez l’espace de votre compte existant.
        </p>
        <div className="backup-actions" style={{ marginBottom: '0.6rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1' }}>
            <input
              type="checkbox"
              checked={encryptCloud}
              onChange={(e) => setEncryptCloud(e.target.checked)}
            />
            Chiffrer les sauvegardes cloud (recommandé)
          </label>
        </div>
        {encryptCloud && (
          <div style={{ marginBottom: '0.65rem' }}>
            <input
              type="password"
              className="publisher-textarea"
              style={{ minHeight: 'auto', padding: '0.45rem 0.6rem' }}
              value={cloudPassphrase}
              onChange={(e) => setCloudPassphrase(e.target.value)}
              placeholder="Mot de passe de chiffrement cloud (non stocké)"
            />
          </div>
        )}
        {cloudError && <p className="backup-error">{cloudError}</p>}
        {storageWarning && <p className="backup-error">{storageWarning}</p>}
        <div className="backup-status" style={{ marginBottom: '0.45rem' }}>
          Dernier succès cloud :{' '}
          <strong>{backupState.lastSuccessAt ? formatLastBackup(backupState.lastSuccessAt) : 'Jamais'}</strong>
          {' · '}
          Échecs consécutifs : <strong>{backupState.consecutiveFailures || 0}</strong>
          {backupState.pendingQueue ? ' · File d’attente locale active' : ''}
        </div>
        {(isGoogleDriveConnected() || isDropboxConnected()) && (
          <div className="backup-actions" style={{ marginBottom: '0.75rem' }}>
            <span className="backup-status backup-status-ok">
              {isGoogleDriveConnected() && isDropboxConnected() ? 'Google Drive + Dropbox connectés' : isGoogleDriveConnected() ? 'Google Drive connecté' : 'Dropbox connecté'}
            </span>
            <button type="button" className="backup-btn backup-btn-small" onClick={handleUploadNow} disabled={cloudUploading}>
              {cloudUploading ? 'Envoi…' : 'Envoyer maintenant'}
            </button>
          </div>
        )}
        <div className="backup-cloud-buttons">
          {isGoogleDriveConnected() ? (
            <button type="button" className="backup-btn backup-btn-outline" onClick={handleDisconnectDrive}>
              Déconnecter Google Drive
            </button>
          ) : (
            <button type="button" className="backup-btn backup-btn-export" onClick={handleConnectDrive}>
              Connecter Google Drive
            </button>
          )}
          {isDropboxConnected() ? (
            <button type="button" className="backup-btn backup-btn-outline" onClick={handleDisconnectDropbox}>
              Déconnecter Dropbox
            </button>
          ) : (
            <button type="button" className="backup-btn backup-btn-export" onClick={handleConnectDropbox}>
              Connecter Dropbox
            </button>
          )}
        </div>
      </section>

      <section className="backup-section backup-level">
        <span className="backup-level-badge">Niveau 3</span>
        <h3>Sauvegarde locale (fichier sur votre ordinateur)</h3>
        <p>
          Téléchargez régulièrement un fichier et enregistrez-le sur votre disque, clé USB ou cloud.
          Dernière sauvegarde locale : <strong>{formatLastBackup(lastLocal)}</strong>.
        </p>
        <button type="button" className="backup-btn backup-btn-export" onClick={handleExport}>
          Télécharger la sauvegarde maintenant
        </button>
      </section>

      <section className="backup-section">
        <h3>Restaurer depuis un fichier</h3>
        <p>
          Choisissez un fichier de sauvegarde Scriptor (.json) pour remplacer le projet actuel.
        </p>
        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleFileChange} style={{ display: 'none' }} />
        <button type="button" className="backup-btn backup-btn-import" onClick={handleImportClick}>
          Restaurer depuis un fichier
        </button>
      </section>
    </div>
  )
}

export default BackupTab
