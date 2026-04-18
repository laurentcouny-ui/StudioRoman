/**
 * Clé phonétique simplifiée (homophones / zone Bible) — partagé analyse & Bible.
 */
export function normalizePhoneticKey(word) {
  return String(word || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/qu/g, 'k')
    .replace(/ou/g, 'u')
    .replace(/e?nt$/g, '')
    .replace(/[aeiouy]+/g, 'a')
}
