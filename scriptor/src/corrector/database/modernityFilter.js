/**
 * Filtre de modernité : en l’absence d’option Archaïsme, la règle moderne prime.
 * Avec respectArchaism=true, la règle ancienne prime et la moderne devient note pédagogique.
 */

/**
 * @param {{ modern?: object, legacy?: object, respectArchaism?: boolean }} opts
 * @returns {{ applied: object, stylisticNote?: object }}
 */
export function pickPrimaryRule({ modern, legacy, respectArchaism = false }) {
  if (!modern && !legacy) return { applied: null }
  if (!legacy) return { applied: modern }
  if (!modern) return { applied: legacy }
  if (respectArchaism) {
    return { applied: legacy, stylisticNote: modern }
  }
  return { applied: modern, stylisticNote: legacy }
}
