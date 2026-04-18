/**
 * Mode Fantôme — homophones (CDC : 4 conditions simultanées).
 * Branché côté UX : menu contextuel mode Expert (rappel) ; choix manuel ne passe pas par ce garde-fou.
 * Pour toute auto-suggestion future, appeler evaluatePhantomHomophone avant d’appliquer.
 */

/**
 * @param {{
 *   word: string,
 *   inBaseDictionary: boolean,
 *   camembertConfidence?: number,
 *   inBible?: boolean,
 *   phoneticNearBibleTerm?: boolean,
 *   rejectedBefore?: boolean,
 * }} ctx
 * @returns {{ allow: boolean, reason?: string }}
 */
export function evaluatePhantomHomophone(ctx) {
  if (ctx.rejectedBefore) {
    return { allow: false, reason: 'previously-rejected' }
  }
  if (!ctx.inBaseDictionary) {
    return { allow: false, reason: 'not-in-dictionary' }
  }
  if (ctx.inBible) {
    return { allow: false, reason: 'bible-term' }
  }
  if (ctx.phoneticNearBibleTerm) {
    return { allow: false, reason: 'phonetic-bible-shield' }
  }
  if ((ctx.camembertConfidence ?? 0) < 0.99) {
    return { allow: false, reason: 'embedding-below-99' }
  }
  return { allow: true }
}
