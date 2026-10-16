/** Shared fuzzy matcher for every user-facing search field. */

const SUBSTRING_SCORE = 1_000
const WORD_SCORE = 700

function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/♀/g, ' f')
    .replace(/♂/g, ' m')
    .replace(/[''`´]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function maxEdits(length: number): number {
  if (length < 4) return 0
  if (length < 8) return 1
  return 2
}

/** Optimal string alignment (adjacent transposition counts as one edit). */
function osaDistance(a: string, b: string, max: number): number {
  const n = a.length
  const m = b.length
  if (Math.abs(n - m) > max) return max + 1
  if (n === 0) return m
  if (m === 0) return n

  let prev2 = new Array<number>(m + 1).fill(0)
  let prev = new Array<number>(m + 1)
  let curr = new Array<number>(m + 1)
  for (let j = 0; j <= m; j++) prev[j] = j

  for (let i = 1; i <= n; i++) {
    curr[0] = i
    let rowMin = curr[0]
    for (let j = 1; j <= m; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      let value = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
      if (
        i > 1 &&
        j > 1 &&
        a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
      ) {
        value = Math.min(value, prev2[j - 2] + 1)
      }
      curr[j] = value
      if (value < rowMin) rowMin = value
    }
    if (rowMin > max) return max + 1
    const older = prev2
    prev2 = prev
    prev = curr
    curr = older
  }
  return prev[m]
}

function scoreIncludes(needle: string, haystack: string): number | null {
  const index = haystack.indexOf(needle)
  if (index < 0) return null
  const prefix = index === 0 ? 200 : 0
  return SUBSTRING_SCORE + prefix - index * 2 - (haystack.length - needle.length)
}

function scoreWord(query: string, token: string): number | null {
  const included = token.indexOf(query)
  if (included >= 0) return WORD_SCORE + 100 - included - (token.length - query.length)

  const allowed = maxEdits(query.length)
  if (allowed === 0) return null
  if (Math.abs(query.length - token.length) > allowed) return null
  const distance = osaDistance(query, token, allowed)
  if (distance > allowed) return null
  return WORD_SCORE - distance * 80 - Math.abs(query.length - token.length) * 10
}

function scoreWords(queryWords: readonly string[], textWords: readonly string[]): number | null {
  if (queryWords.length === 0) return null
  const used = new Set<number>()
  let total = 0
  for (const word of queryWords) {
    let bestIndex = -1
    let best = -1
    for (let i = 0; i < textWords.length; i++) {
      if (used.has(i)) continue
      const score = scoreWord(word, textWords[i])
      if (score == null || score <= best) continue
      best = score
      bestIndex = i
    }
    if (bestIndex < 0) return null
    used.add(bestIndex)
    total += best
  }
  return total
}

function scoreFolded(query: string, text: string): number | null {
  const compact = scoreIncludes(query.replace(/ /g, ''), text.replace(/ /g, ''))
  const words = scoreWords(query.split(' '), text.split(' '))
  if (compact == null) return words
  if (words == null) return compact
  return Math.max(compact, words)
}

function scoreText(query: string, text: string): number | null {
  const foldedQuery = fold(query)
  const foldedText = fold(text)
  if (!foldedQuery || !foldedText) return null
  return scoreFolded(foldedQuery, foldedText)
}

/** Higher is closer. Null means the text does not match. An empty query matches with score 0. */
export function fuzzyScore(query: string, text: string | null | undefined): number | null {
  const q = query.trim()
  if (!q) return 0
  if (!text) return null
  return scoreText(q, text)
}

/** Best score across labels. An empty query matches. */
export function fuzzyBestScore(
  query: string,
  texts: readonly (string | null | undefined)[],
): number | null {
  const q = query.trim()
  if (!q) return 0
  let best: number | null = null
  for (const text of texts) {
    const score = fuzzyScore(q, text)
    if (score == null) continue
    if (best == null || score > best) best = score
  }
  return best
}

export function fuzzyMatches(
  query: string,
  ...texts: Array<string | null | undefined>
): boolean {
  return fuzzyBestScore(query, texts) != null
}

/**
 * National number match. `25`, `025`, and `0025` match species 25.
 * Digits are not a substring of other numbers, so `25` does not match 125.
 */
export function speciesIdMatchesQuery(speciesId: number, query: string): boolean {
  const q = query.trim()
  if (!/^\d+$/.test(q)) return false
  const id = String(speciesId)
  const padded = id.padStart(4, '0')
  return id === q || padded === q || padded === q.padStart(4, '0')
}

export function matchesSpeciesSearch(
  query: string,
  speciesId: number,
  labels: readonly (string | null | undefined)[],
): boolean {
  const q = query.trim()
  if (!q) return true
  return speciesIdMatchesQuery(speciesId, q) || fuzzyMatches(q, ...labels)
}

/** Keep input order. Unscored rows stay in place behind scored matches. */
export function rankByFuzzy<T>(
  items: readonly T[],
  query: string,
  texts: (item: T) => readonly (string | null | undefined)[],
): T[] {
  const q = query.trim()
  if (!q) return [...items]
  return items
    .map((item, index) => ({
      item,
      index,
      score: fuzzyBestScore(q, texts(item)) ?? Number.NEGATIVE_INFINITY,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item)
}
