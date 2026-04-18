/**
 * Connecteurs temporels : fenêtre de grâce après un connecteur (CDC).
 * Les analyses « ligne temporelle » (séq. 3+) doivent respecter ce bouclier.
 */

const RE =
  /\b(jadis|plus tard|il se souvint|en ce temps-là|autrefois|dans un autre temps|auparavant|naguère|depuis lors)\b/gi

/**
 * @param {string} text
 * @param {number} cursorOffset
 */
export function isUnderTemporalShield(text, cursorOffset) {
  const before = String(text || '').slice(0, Math.max(0, cursorOffset))
  let last = -1
  let m
  const r = new RegExp(RE.source, RE.flags)
  while ((m = r.exec(before)) !== null) {
    last = m.index
  }
  if (last < 0) return false
  const after = before.slice(last)
  const sentenceEnds = (after.match(/[.!?…]/g) || []).length
  return sentenceEnds < 3
}
