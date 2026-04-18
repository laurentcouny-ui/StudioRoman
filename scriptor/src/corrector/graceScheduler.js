/**
 * Délai de grâce : aucune passe silencieuse pendant la frappe continue ;
 * déclenchement après inactivité ou changement de paragraphe.
 *
 * @param {{ delayMs: number, onFire: (paragraphKey: string) => void, ecoParagraphOnly?: boolean }} opts
 * — si ecoParagraphOnly : uniquement changement de paragraphe (CDC smart throttling).
 */

export function createGraceScheduler({ delayMs, onFire, ecoParagraphOnly = false }) {
  let timer = null
  let lastParagraphKey = ''

  function clear() {
    if (timer != null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function schedule(paragraphKey) {
    clear()
    timer = setTimeout(() => {
      timer = null
      onFire(paragraphKey)
    }, delayMs)
  }

  /** Appeler à chaque frappe / input. */
  function onInput(getPlainText, getParagraphKey) {
    const pk = getParagraphKey()
    if (ecoParagraphOnly) {
      if (pk !== lastParagraphKey) {
        lastParagraphKey = pk
        clear()
        onFire(pk)
      }
      return
    }
    if (pk !== lastParagraphKey) {
      lastParagraphKey = pk
      onFire(pk)
      return
    }
    schedule(pk)
  }

  /** Fin de session / démontage */
  function dispose() {
    clear()
  }

  return { onInput, dispose, flush: () => onFire(lastParagraphKey) }
}
