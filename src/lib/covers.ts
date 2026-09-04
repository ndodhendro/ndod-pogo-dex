import { hasAllRequired, isExactMatch, type TagId } from './tags'

export type CoverPurity = 'green' | 'gray'

export function coverPurity(
  specimenTags: TagId[],
  required: TagId[],
): CoverPurity | null {
  if (!hasAllRequired(specimenTags, required)) return null
  return isExactMatch(specimenTags, required) ? 'green' : 'gray'
}

export function speciesInCategory(
  specimensForSpecies: { tags: TagId[] }[],
  required: TagId[],
): boolean {
  return specimensForSpecies.some((s) => hasAllRequired(s.tags, required))
}

export function shouldAutoReplaceCover(
  required: TagId[],
  currentCoverTags: TagId[] | null,
  incomingTags: TagId[],
): boolean {
  if (!hasAllRequired(incomingTags, required)) return false
  if (!currentCoverTags) return true
  const incomingExact = isExactMatch(incomingTags, required)
  const currentExact = isExactMatch(currentCoverTags, required)
  return incomingExact && !currentExact
}

/** Prefer a remaining green cover, else the newest in-category photo. */
export function pickCoverAfterDelete(
  required: TagId[],
  remaining: { id: string; tags: TagId[]; createdAt: number }[],
): string | null {
  const candidates = remaining.filter((row) => hasAllRequired(row.tags, required))
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => {
    const aExact = isExactMatch(a.tags, required) ? 1 : 0
    const bExact = isExactMatch(b.tags, required) ? 1 : 0
    if (aExact !== bExact) return bExact - aExact
    return b.createdAt - a.createdAt
  })
  return sorted[0]?.id ?? null
}
