/**
 * Construit un index de paragraphes (snippets) depuis database/processed/*.txt
 * pour la recherche "mentor" (Fuse.js) dans l app.
 *
 * Prerequis : npm run extract:corrector-sources
 * Sortie : src/corrector/database/index/corpusChunks.json
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PROCESSED = join(ROOT, 'src', 'corrector', 'database', 'processed')
const OUT = join(ROOT, 'src', 'corrector', 'database', 'index', 'corpusChunks.json')

const MIN_PARA = 120
const MAX_PARA = 2000
const MAX_SNIPPET = 480
const CHUNK_BUDGET = 7500
const MIN_WORDS = 7

function stripHeader(body) {
  const lines = body.split(/\r?\n/)
  let i = 0
  while (i < lines.length && lines[i].startsWith('---')) {
    i += 1
    while (i < lines.length && !lines[i].startsWith('---')) i += 1
    if (i < lines.length && lines[i].startsWith('---')) i += 1
    while (i < lines.length && lines[i].trim() === '') i += 1
    break
  }
  return lines.slice(i).join('\n').trim()
}

function wordCount(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

function splitParagraphs(raw) {
  const text = stripHeader(raw)
  const blocks = text.split(/\n{2,}/)
  const out = []
  for (const b of blocks) {
    const p = b.replace(/\s+/g, ' ').trim()
    if (p.length < MIN_PARA || p.length > MAX_PARA) continue
    if (wordCount(p) < MIN_WORDS) continue
    out.push(p.slice(0, MAX_SNIPPET))
  }
  return out
}

async function main() {
  await mkdir(dirname(OUT), { recursive: true })
  const names = (await readdir(PROCESSED)).filter((n) => n.endsWith('.txt'))
  if (names.length === 0) {
    console.warn('Aucun .txt dans processed/. Lancez npm run extract:corrector-sources')
    await writeFile(
      OUT,
      JSON.stringify({ version: 1, generatedAt: null, chunks: [], hint: 'empty' }),
      'utf8',
    )
    return
  }

  const queues = []
  for (const n of names.sort()) {
    const full = join(PROCESSED, n)
    const raw = await readFile(full, 'utf8')
    const paras = splitParagraphs(raw)
    const rel = relative(PROCESSED, full).replace(/\\/g, '/')
    queues.push({ source: rel, paras })
  }

  const chunks = []
  let round = 0
  while (chunks.length < CHUNK_BUDGET) {
    let added = false
    for (const q of queues) {
      if (chunks.length >= CHUNK_BUDGET) break
      const p = q.paras[round]
      if (p) {
        chunks.push({
          id: `c${chunks.length}`,
          source: q.source,
          text: p,
        })
        added = true
      }
    }
    if (!added) break
    round += 1
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    chunkBudget: CHUNK_BUDGET,
    chunkCount: chunks.length,
    chunks,
  }
  await writeFile(OUT, JSON.stringify(payload), 'utf8')
  console.log('OK', OUT, 'chunks=', chunks.length)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
