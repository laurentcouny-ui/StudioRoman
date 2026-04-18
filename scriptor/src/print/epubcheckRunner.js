import { isDesktop } from '../platform'

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

/**
 * Lance EPUBCheck via Tauri (Java + JAR). Sans desktop, retourne un objet `skipped`.
 * @param {Blob} epubBlob
 * @param {string | null} [jarPath] chemin absolu optionnel vers epubcheck-all.jar
 */
export async function runEpubcheckDesktop(epubBlob, jarPath = null) {
  if (!isDesktop()) {
    return {
      skipped: true,
      ok: false,
      exitCode: -1,
      tool: 'epubcheck',
      stdout: '',
      stderr: '',
      details:
        'EPUBCheck intégré : disponible uniquement dans l’application Windows (Tauri). En navigateur, utilisez la commande npm ou le JAR manuellement.',
    }
  }
  const epubBase64 = await blobToBase64(epubBlob)
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke('print_run_epubcheck', { epubBase64, jarPath: jarPath || null })
}
