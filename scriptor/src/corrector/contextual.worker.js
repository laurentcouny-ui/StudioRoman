/**
 * Worker dédié — CamemBERT / multilingue via Transformers.js (analyse à la demande uniquement).
 * Jamais sur le thread UI. Timeout géré côté main (5 s par défaut).
 */
self.addEventListener('message', async (ev) => {
  if (ev.data?.type !== 'ANALYZE') return
  const { text, maxWords } = ev.data
  const wc = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  if (wc > (maxWords || 2000)) {
    self.postMessage({ ok: false, reason: 'batch-too-large', words: wc })
    return
  }
  try {
    const { pipeline, env } = await import('@huggingface/transformers')
    env.allowLocalModels = false
    env.useBrowserCache = true
    /** CamemBERT (fr) ONNX — fallback multilingue si modèle indisponible hors ligne. */
    let pipe
    let modelId = 'Xenova/camembert-base'
    try {
      pipe = await pipeline('feature-extraction', 'Xenova/camembert-base', { quantized: true })
    } catch {
      modelId = 'Xenova/bert-base-multilingual-cased'
      pipe = await pipeline('feature-extraction', 'Xenova/bert-base-multilingual-cased', {
        quantized: true,
      })
    }
    const output = await pipe(text, { pooling: 'mean', normalize: true })
    const data = output?.data ? Array.from(output.data) : []
    self.postMessage({
      ok: true,
      embeddingDims: data.length,
      model: modelId.includes('camembert') ? 'camembert-base-quantized' : 'bert-base-multilingual-cased-quantized',
      modelId,
      note: 'Embedding pour analyse contextuelle — seuils contextuels en séquence 3.',
    })
  } catch (e) {
    self.postMessage({
      ok: false,
      error: String(e),
      fallback: 'languagetool',
    })
  }
})
