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
