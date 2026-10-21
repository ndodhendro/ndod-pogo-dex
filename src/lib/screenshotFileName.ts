import { fuzzyMatches } from './fuzzySearch'

/** Basename with extension. Paths and empty names are dropped. */
export function screenshotFileName(
  source: File | Blob | string | null | undefined,
): string | null {
  const raw =
    typeof source === 'string' ? source : source instanceof File ? source.name : null
  if (!raw) return null
  const base = raw.replace(/\\/g, '/').split('/').pop()?.trim() ?? ''
  return base || null
}

/** Lowercased basename for matching Transfer and Pokédex filenames. */
export function screenshotFileNameKey(
  source: File | Blob | string | null | undefined,
): string | null {
  const name = screenshotFileName(source)
  return name ? name.toLowerCase() : null
}

/** Basename without a short file extension. `IMG_1234.PNG` becomes `IMG_1234`. */
export function screenshotFileStem(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return name
  const ext = name.slice(dot + 1)
  if (!/^[a-z0-9]{1,8}$/i.test(ext)) return name
  return name.slice(0, dot)
}

/**
 * Empty query matches. The file extension is ignored for a short query,
 * so `p` does not hit every `.png`. `png` and `img_1234.png` still match.
 */
export function screenshotFileNameMatchesQuery(
  fileName: string | null | undefined,
  query: string,
): boolean {
  const q = query.trim()
  if (!q) return true
  const name = screenshotFileName(fileName)
  if (!name) return false
  const stem = screenshotFileStem(name)
  if (fuzzyMatches(q, stem)) return true
  if (stem === name) return false
  if (q.includes('.') && fuzzyMatches(q, name)) return true
  const ext = name.slice(stem.length + 1)
  return q.length >= ext.length && fuzzyMatches(q, ext)
}

/** Query is the whole basename, including a file extension. */
export function screenshotFileNameIsExact(
  fileName: string | null | undefined,
  query: string,
): boolean {
  const stored = screenshotFileNameKey(fileName)
  const q = screenshotFileNameKey(query)
  if (!stored || !q || stored !== q) return false
  const dot = q.lastIndexOf('.')
  return dot > 0 && dot < q.length - 1
}

export function collectScreenshotFileNameKeys(
  rows: readonly { fileName?: string | null }[],
): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    const key = screenshotFileNameKey(row.fileName)
    if (key) keys.add(key)
  }
  return keys
}

export function screenshotFileNameIsTaken(
  source: File | Blob | string | null | undefined,
  taken: ReadonlySet<string>,
): boolean {
  const key = screenshotFileNameKey(source)
  return Boolean(key && taken.has(key))
}

export class DuplicateScreenshotFileNameError extends Error {
  readonly fileName: string

  constructor(fileName: string) {
    super('Screenshot filename already in the app')
    this.name = 'DuplicateScreenshotFileNameError'
    this.fileName = fileName
  }
}

/** Gallery File.name wins; fall back to a stored basename. */
export function restoredScreenshotFileName(
  file: File | Blob | string | null | undefined,
  stored?: string | null,
): string | null {
  return screenshotFileName(file) ?? screenshotFileName(stored)
}

/** Same look: Discard/Replace wait until at least one visible filename has been copied. */
export function sameLookFilenamesCopied(
  copied: { current: boolean; next: boolean },
  currentFileName?: string | null,
  newFileName?: string | null,
): boolean {
  const canCopyCurrent = Boolean(screenshotFileName(currentFileName))
  const canCopyNew = Boolean(screenshotFileName(newFileName))
  if (!canCopyCurrent && !canCopyNew) return true
  return (canCopyCurrent && copied.current) || (canCopyNew && copied.next)
}
