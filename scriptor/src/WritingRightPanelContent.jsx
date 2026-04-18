import { useState, lazy, Suspense, Component } from 'react'
import { getAddonFeatureFlags } from './featureFlags.js'

function isRecoverableChunkError(err) {
  const text = String(err?.message || err || '')
  return /failed to fetch dynamically imported module|err_cache_read_failure/i.test(text)
}

function lazyWithRetry(importer, maxRetries = 2) {
  return lazy(async () => {
    let lastError = null
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await importer()
      } catch (err) {
        lastError = err
        if (!isRecoverableChunkError(err) || attempt >= maxRetries) break
        await new Promise((resolve) => setTimeout(resolve, 220 * (attempt + 1)))
      }
    }
    throw lastError || new Error('Chargement du module impossible')
  })
}

class PanelErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  reset = () => {
    this.setState({ error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="writing-addon-muted">
          <p style={{ marginBottom: '0.5rem' }}>
            Le panneau n&apos;a pas pu se charger (cache navigateur instable).
          </p>
          <button type="button" className="tm-reset-btn" onClick={this.reset}>
            Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const LazyWritingIAPanel = lazyWithRetry(() => import('./ia/WritingIAPanel.tsx'))
const LazyThesaurusModule = lazyWithRetry(() => import('./ThesaurusModule.jsx'))

/**
 * Contenu du panneau latéral Écriture (IA intégrée + thésaurus optionnel).
 * Chunk IA chargé en lazy quand le panneau est ouvert.
 */
export default function WritingRightPanelContent({
  sceneId,
  sceneTitle,
  sceneText = '',
  sessionScopeId = null,
}) {
  const [thesaurusRetryKey, setThesaurusRetryKey] = useState(0)
  const [aiRetryKey, setAiRetryKey] = useState(0)

  const { aiPanel, thesaurus } = getAddonFeatureFlags()
  const iframeUrl = (import.meta.env?.VITE_THESAURUS_IFRAME_URL || '').trim()

  if (!aiPanel && !thesaurus) {
    return (
      <>
        <p>
          Panneau désactivé (<code>VITE_ENABLE_AI_PANEL=0</code> et pas de thésaurus). Réactivez l’IA
          dans <code>.env</code> ou activez le thésaurus.
        </p>
      </>
    )
  }

  return (
    <div className="writing-addon-shell writing-addon-shell--integrated">
      {thesaurus && iframeUrl ? (
        <iframe
          className="writing-addon-iframe"
          title="Thésaurus externe"
          src={iframeUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : null}
      {thesaurus ? (
        <PanelErrorBoundary onRetry={() => setThesaurusRetryKey((v) => v + 1)}>
          <Suspense
            fallback={<p className="writing-addon-muted">Chargement du thésaurus narratif…</p>}
          >
            <LazyThesaurusModule key={thesaurusRetryKey} />
          </Suspense>
        </PanelErrorBoundary>
      ) : null}

      {aiPanel ? (
        <div className="writing-ia-panel-slot">
          <PanelErrorBoundary onRetry={() => setAiRetryKey((v) => v + 1)}>
            <Suspense
              fallback={<p className="writing-addon-muted">Chargement du panneau IA…</p>}
            >
              <LazyWritingIAPanel
                key={aiRetryKey}
                editorText={sceneText}
                sceneId={sceneId}
                sceneTitle={sceneTitle}
                sessionScopeId={sessionScopeId}
              />
            </Suspense>
          </PanelErrorBoundary>
        </div>
      ) : null}
    </div>
  )
}
