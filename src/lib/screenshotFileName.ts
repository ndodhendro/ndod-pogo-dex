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

/** Gallery File.name wins; fall back to a stored basename. */
export function restoredScreenshotFileName(
  file: File | Blob | string | null | undefined,
  stored?: string | null,
): string | null {
  return screenshotFileName(file) ?? screenshotFileName(stored)
}
