/**
 * LanguageTool strictement local : 127.0.0.1 (invoke Tauri en desktop, fetch direct en web dev).
 */
import { isDesktop } from '../../platform'

/**
 * @param {string} text
 * @param {string} [language]
 * @returns {Promise<object>} Réponse JSON brute /v2/check
 */
export async function fetchLanguageToolCheck(text, language = 'fr') {
  const lang = language || 'fr'
  if (isDesktop()) {
    const { invoke } = await import('@tauri-apps/api/core')
    const json = await invoke('corrector_languagetool_check', { text, language: lang })
    return JSON.parse(json)
  }

  const form = new URLSearchParams()
  form.set('text', text)
  form.set('language', lang)
  const res = await fetch('http://127.0.0.1:8010/v2/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: form.toString(),
  })
  if (!res.ok) {
    throw new Error(
      `LanguageTool local HTTP ${res.status} — lancez le serveur sur http://127.0.0.1:8010`,
    )
  }
  return res.json()
}
