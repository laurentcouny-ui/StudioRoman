function GlobalBackupAlert({
  severity,
  message,
  lastSuccessText,
  nextAttemptText,
  showDismiss,
  onDismiss,
}) {
  const dot = severity === 'ok' ? '●' : severity === 'degraded' ? '▲' : '✖'

  return (
    <div
      className={`global-backup-alert global-backup-alert-${severity}`}
      role={severity === 'ok' ? 'status' : 'alert'}
    >
      <span className="global-backup-alert-dot">{dot}</span>
      <span className="global-backup-alert-msg">{message}</span>
      <span className="global-backup-alert-sep">·</span>
      <span className="global-backup-alert-meta">Dernière&nbsp;: {lastSuccessText}</span>
      <span className="global-backup-alert-sep">·</span>
      <span className="global-backup-alert-meta">Prochaine&nbsp;: {nextAttemptText}</span>
      {showDismiss && (
        <button
          type="button"
          className="global-backup-alert-close"
          onClick={onDismiss}
          title="Masquer l'alerte locale"
        >
          ✕
        </button>
      )}
    </div>
  )
}

export default GlobalBackupAlert
