/**
 * Scoring chapitres vs Bible + mentions personnages (Levenshtein léger) — CDC Brique 3.
 */

function normalizeTitle(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Distance de Levenshtein (petites chaînes). */
export function levenshtein(a, b) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const row = new Array(n + 1)
  for (let j = 0; j <= n; j += 1) row[j] = j
  for (let i = 1; i <= m; i += 1) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= n; j += 1) {
      const tmp = row[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = tmp
    }
  }
  return row[n]
}

function bibleEntryLabels(entry) {
  const out = []
  let t = String(entry?.title ?? '').trim()
  if (t && t !== 'Sans titre') out.push(t)
  const body = String(entry?.content ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  if (body) out.push(body)
  return out
}

/**
 * @returns {{ chapterScores: object[], characterHints: object[] }}
 */
export function scoreImportAgainstSaga(parsed, saga, project) {
  const chapters = parsed?.chapters ?? []
  const entries = Array.isArray(saga?.bible?.entries) ? saga.bible.entries : []
  const bibleLabels = []
  for (const e of entries) {
    for (const lab of bibleEntryLabels(e)) {
      const n = normalizeTitle(lab)
      if (n.length >= 2) bibleLabels.push(n)
    }
  }

  const chapterScores = chapters.map((ch) => {
    const t = normalizeTitle(ch.title || '')
    if (!t || t.length < 2) {
      return { title: ch.title || '—', bestBible: null, distance: null, note: 'titre court' }
    }
    let best = { label: null, d: 999 }
    const slice = t.slice(0, 120)
    for (const lab of bibleLabels) {
      const d = levenshtein(slice, lab.slice(0, 120))
      if (d < best.d) best = { label: lab, d }
    }
    return {
      title: ch.title || '—',
      bestBible: best.label,
      distance: best.d,
      note:
        best.d <= 2
          ? 'très proche Bible'
          : best.d <= 6
            ? 'proche Bible'
            : best.label
              ? 'éloigné'
              : 'aucune Bible',
    }
  })

  const names = (project?.characters ?? [])
    .map((c) => String(c?.name ?? '').trim())
    .filter((n) => n.length >= 2)
    .slice(0, 80)

  const firstChunk = joinedFirstScenesText(chapters, 12_000)
  const tokens = firstChunk.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2)

  const characterHints = []
  for (const name of names) {
    const nn = normalizeTitle(name)
    let bestTok = null
    let bestD = 999
    for (const tok of tokens) {
      if (tok.length < 2) continue
      const tnorm = normalizeTitle(tok)
      if (tnorm.length > 48) continue
      const d = levenshtein(nn, tnorm)
      if (d < bestD) {
        bestD = d
        bestTok = tok
      }
    }
    if (bestD <= 2 && bestTok) {
      characterHints.push({ name, match: bestTok, distance: bestD })
    }
  }

  return { chapterScores, characterHints }
}

function joinedFirstScenesText(chapters, maxLen) {
  let s = ''
  outer: for (const ch of chapters) {
    for (const sc of ch.scenes || []) {
      s += `${sc.text || ''}\n`
      if (s.length >= maxLen) break outer
    }
  }
  return s
}
