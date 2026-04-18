import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { PlatformProvider } from './platform/PlatformContext'
import { BootstrapGate } from './platform/BootstrapGate'
import { DesktopBootstrap } from './platform/DesktopBootstrap'
import { initDiagLog } from './platform/initDiagnostics'
import { scheduleInitModuleProbe } from './platform/initModuleProbe'

initDiagLog('main: modules statiques chargés, montage React à venir')

// Enregistrer le service worker pour PWA (installation sur bureau / mobile)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: '2rem',
            background: '#0f172a',
            color: '#e2e8f0',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            Une erreur s&apos;est produite
          </h1>
          <p style={{ marginBottom: '0.5rem' }}>
            Rechargez la page (F5). Si le problème continue, ouvrez la console (F12) et
            copiez le message d&apos;erreur.
          </p>
          {this.state.error && (
            <pre
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#1e293b',
                borderRadius: '8px',
                fontSize: '0.85rem',
                overflow: 'auto',
              }}
            >
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#e2e8f0;font-family:system-ui">' +
    '<p>Élément #root introuvable. Vérifiez que index.html est chargé.</p></div>'
} else {
  try {
    initDiagLog('main: createRoot(#root) + premier render')
    createRoot(rootEl).render(
      <StrictMode>
        <PlatformProvider>
          <BootstrapGate>
            <DesktopBootstrap />
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </BootstrapGate>
        </PlatformProvider>
      </StrictMode>,
    )
    initDiagLog('main: render synchrone terminé')
    scheduleInitModuleProbe()
  } catch (e) {
    console.error('[Scriptor:init] Échec createRoot / premier render', e)
    throw e
  }
}
