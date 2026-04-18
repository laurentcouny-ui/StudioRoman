/**
 * Moteur 3 — IA arbitre : uniquement pour suggestions entre 90 % et 97 % (CDC).
 * Séquence 1 : aucun appel réseau — piste vide ; les clés API premium seront branchées en séquence ultérieure.
 */

/** @param {object} match */
export async function maybeArbitrate(match) {
  const c = match.confidence ?? 0
  if (c < 0.9 || c >= 0.97) return match
  return {
    ...match,
    arbiterZone: '90-97',
    arbiterHint: null,
    seeHintAvailable: true,
  }
}
