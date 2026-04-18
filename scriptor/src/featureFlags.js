/**
 * Feature flags pour modules futurs (IA, thésaurus).
 * Désactivés par défaut : aucun impact si les variables ne sont pas définies.
 */

function envBool(key) {
  const v = import.meta.env?.[key]
  if (v == null || v === '') return false
  return /^(1|true|yes|on)$/i.test(String(v).trim())
}

export function getAddonFeatureFlags() {
  const rawAi = import.meta.env?.VITE_ENABLE_AI_PANEL
  // Par défaut le panneau IA est actif (intégré à l’écriture). Mettre VITE_ENABLE_AI_PANEL=0 pour désactiver.
  const aiPanel =
    rawAi == null || rawAi === '' ? true : envBool('VITE_ENABLE_AI_PANEL')
  const rawTh = import.meta.env?.VITE_ENABLE_THESAURUS
  // Thésaurus narratif local actif par défaut. Mettre VITE_ENABLE_THESAURUS=0 pour désactiver.
  const thesaurus =
    rawTh == null || rawTh === '' ? true : envBool('VITE_ENABLE_THESAURUS')
  return {
    aiPanel,
    thesaurus,
  }
}
