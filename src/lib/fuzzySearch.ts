/** Shared fuzzy matcher for every user-facing search field. */

const SUBSTRING_SCORE = 1_000
const WORD_SCORE = 700

type Folded = {
  text: string
  compact: string
  words: string[]
}

type PreparedQuery = {
  compact: string
  words: string[]
  edits: number[]
}

const foldedCache = new Map<string, Folded>()
let preparedKey: string | null = null
let preparedValue: PreparedQuery | null = null
let rowPrev2: number[] = []
let rowPrev: number[] = []
let rowCurr: number[] = []

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

function foldedOf(value: string): Folded {
  const cached = foldedCache.get(value)
  if (cached) return cached
  const text = fold(value)
  const row: Folded = {
    text,
    compact: text.replace(/ /g, ''),
    words: text ? text.split(' ') : [],
  }
  foldedCache.set(value, row)
  return row
}

/** Fold once so later keystrokes reuse the normalized label. */
export function indexFuzzyText(text: string | null | undefined) {
  if (text) foldedOf(text)
}

function maxEdits(length: number): number {
  if (length < 4) return 0
  if (length < 8) return 1
  return 2
}

function prepareQuery(trimmed: string): PreparedQuery | null {
  if (trimmed === preparedKey) return preparedValue
  preparedKey = trimmed
  if (!trimmed) {
    preparedValue = null
    return null
  }
  const folded = foldedOf(trimmed)
  if (!folded.text) {
    preparedValue = null
    return null
  }
  preparedValue = {
    compact: folded.compact,
    words: folded.words,
    edits: folded.words.map((word) => maxEdits(word.length)),
  }
  return preparedValue
}

/** Optimal string alignment (adjacent transposition counts as one edit). */
function osaDistance(a: string, b: string, max: number): number {
  const n = a.length
  const m = b.length
  if (Math.abs(n - m) > max) return max + 1
  if (n === 0) return m
  if (m === 0) return n

  if (rowPrev2.length < m + 1) {
    const size = m + 1
    rowPrev2 = new Array<number>(size)
    rowPrev = new Array<number>(size)
    rowCurr = new Array<number>(size)
  }
  let prev2 = rowPrev2
  let prev = rowPrev
  let curr = rowCurr
  for (let j = 0; j <= m; j++) prev[j] = j

  for (let i = 1; i <= n; i++) {
    curr[0] = i
    let rowMin = curr[0]
    const aCode = a.charCodeAt(i - 1)
    const aPrev = i > 1 ? a.charCodeAt(i - 2) : 0
    for (let j = 1; j <= m; j++) {
      const cost = aCode === b.charCodeAt(j - 1) ? 0 : 1
      let value = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && aCode === b.charCodeAt(j - 2) && aPrev === b.charCodeAt(j - 1)) {
        value = Math.min(value, prev2[j - 2] + 1)
      }
      curr[j] = value
      if (value < rowMin) rowMin = value
    }
    if (rowMin > max) {
      rowPrev2 = prev2
      rowPrev = prev
      rowCurr = curr
      return max + 1
    }
    const older = prev2
    prev2 = prev
    prev = curr
    curr = older
  }
  rowPrev2 = prev2
  rowPrev = prev
  rowCurr = curr
  return prev[m]
}

function scoreIncludes(needle: string, haystack: string): number | null {
  const index = haystack.indexOf(needle)
  if (index < 0) return null
  const prefix = index === 0 ? 200 : 0
  return SUBSTRING_SCORE + prefix - index * 2 - (haystack.length - needle.length)
}

function scriptOf(value: string): 'digit' | 'letter' | 'mixed' {
  let digit = false
  let letter = false
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code >= 48 && code <= 57) digit = true
    else letter = true
    if (digit && letter) return 'mixed'
  }
  return digit ? 'digit' : 'letter'
}

function scoreWord(query: string, token: string, allowed: number): number | null {
  const included = token.indexOf(query)
  if (included >= 0) return WORD_SCORE + 100 - included - (token.length - query.length)

  if (allowed === 0) return null
  if (Math.abs(query.length - token.length) > allowed) return null
  // A pure letter word cannot be one or two edits from a pure number, or the reverse.
  const queryScript = scriptOf(query)
  const tokenScript = scriptOf(token)
  if (queryScript !== 'mixed' && tokenScript !== 'mixed' && queryScript !== tokenScript) return null
  const distance = osaDistance(query, token, allowed)
  if (distance > allowed) return null
  return WORD_SCORE - distance * 80 - Math.abs(query.length - token.length) * 10
}

function scoreWords(
  queryWords: readonly string[],
  edits: readonly number[],
  textWords: readonly string[],
): number | null {
  if (queryWords.length === 0) return null
  const used = new Set<number>()
  let total = 0
  for (let w = 0; w < queryWords.length; w++) {
    const word = queryWords[w]
    const allowed = edits[w]
    let bestIndex = -1
    let best = -1
    for (let i = 0; i < textWords.length; i++) {
      if (used.has(i)) continue
      const score = scoreWord(word, textWords[i], allowed)
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

function scorePrepared(prepared: PreparedQuery, folded: Folded): number | null {
  if (!folded.text) return null
  const compact = scoreIncludes(prepared.compact, folded.compact)
  const words = scoreWords(prepared.words, prepared.edits, folded.words)
  if (compact == null) return words
  if (words == null) return compact
  return Math.max(compact, words)
}

function matchesPrepared(prepared: PreparedQuery, folded: Folded): boolean {
  if (!folded.text) return false
  if (folded.compact.includes(prepared.compact)) return true
  return scoreWords(prepared.words, prepared.edits, folded.words) != null
}

/** Higher is closer. Null means the text does not match. An empty query matches with score 0. */
export function fuzzyScore(query: string, text: string | null | undefined): number | null {
  const q = query.trim()
  if (!q) return 0
  if (!text) return null
  const prepared = prepareQuery(q)
  if (!prepared) return null
  return scorePrepared(prepared, foldedOf(text))
}

/** Best score across labels. An empty query matches. */
export function fuzzyBestScore(
  query: string,
  texts: readonly (string | null | undefined)[],
): number | null {
  const q = query.trim()
  if (!q) return 0
  const prepared = prepareQuery(q)
  if (!prepared) return null
  let best: number | null = null
  for (const text of texts) {
    if (!text) continue
    const score = scorePrepared(prepared, foldedOf(text))
    if (score == null) continue
    if (best == null || score > best) best = score
  }
  return best
}

export function fuzzyMatches(
  query: string,
  ...texts: Array<string | null | undefined>
): boolean {
  const q = query.trim()
  if (!q) return true
  const prepared = prepareQuery(q)
  if (!prepared) return false
  for (const text of texts) {
    if (!text) continue
    if (matchesPrepared(prepared, foldedOf(text))) return true
  }
  return false
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
  const prepared = prepareQuery(q)
  return items
    .map((item, index) => {
      let score = Number.NEGATIVE_INFINITY
      if (prepared) {
        for (const text of texts(item)) {
          if (!text) continue
          const next = scorePrepared(prepared, foldedOf(text))
          if (next != null && next > score) score = next
        }
      }
      return { item, index, score }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item)
}
