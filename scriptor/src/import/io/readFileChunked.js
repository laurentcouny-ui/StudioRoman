const CHUNK = 1024 * 1024

/**
 * Lit un File en ArrayBuffer par blocs d’1 Mo pour afficher une progression (CDC Brique 3).
 * @param {File} file
 * @param {(percent0to40: number) => void} [onProgress] — 0–40 % réservés à la lecture disque
 */
export async function readFileAsArrayBufferChunked(file, onProgress) {
  const total = file.size
  if (!total) {
    onProgress?.(40)
    return new ArrayBuffer(0)
  }
  if (total <= CHUNK) {
    const buf = await file.arrayBuffer()
    onProgress?.(40)
    return buf
  }
  const chunks = []
  let offset = 0
  while (offset < total) {
    const end = Math.min(offset + CHUNK, total)
    const slice = file.slice(offset, end)
    const buf = await slice.arrayBuffer()
    chunks.push(new Uint8Array(buf))
    offset = end
    onProgress?.(Math.round((offset / total) * 40))
  }
  const merged = new Uint8Array(total)
  let pos = 0
  for (const c of chunks) {
    merged.set(c, pos)
    pos += c.byteLength
  }
  return merged.buffer
}
