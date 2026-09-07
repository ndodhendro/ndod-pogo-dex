import { hasAllRequired, isExactMatch, specimenTags, type SpecimenFields, type TagId } from './tags'

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

export type CoverRef = {
  categoryId: string
  speciesId: number
  specimenId: string
}

export type CoverMutation =
  | { op: 'put'; categoryId: string; speciesId: number; specimenId: string }
  | { op: 'delete'; categoryId: string; speciesId: number }

type CoverSpecimen = SpecimenFields & { id: string; createdAt: number }

/**
 * After a specimen's tags or species change: replace invalid covers that still
 * point at it, then auto-cover tracks the same way a new save would.
 */
export function coverMutationsAfterEdit(
  previous: { id: string; speciesId: number },
  updated: CoverSpecimen,
  categories: { id: string; requiredTags: TagId[] }[],
  covers: CoverRef[],
  specimens: CoverSpecimen[],
): CoverMutation[] {
  const nextTags = specimenTags(updated)
  const byKey = new Map(covers.map((row) => [`${row.categoryId}:${row.speciesId}`, { ...row }]))
  const mutations: CoverMutation[] = []

  function applyPut(categoryId: string, speciesId: number, specimenId: string) {
    const key = `${categoryId}:${speciesId}`
    const current = byKey.get(key)
    if (current?.specimenId === specimenId) return
    byKey.set(key, { categoryId, speciesId, specimenId })
    mutations.push({ op: 'put', categoryId, speciesId, specimenId })
  }

  function applyDelete(categoryId: string, speciesId: number) {
    const key = `${categoryId}:${speciesId}`
    if (!byKey.has(key)) return
    byKey.delete(key)
    mutations.push({ op: 'delete', categoryId, speciesId })
  }

  for (const cover of covers) {
    if (cover.specimenId !== previous.id) continue
    const category = categories.find((row) => row.id === cover.categoryId)
    const stillHere =
      cover.speciesId === updated.speciesId &&
      Boolean(category) &&
      hasAllRequired(nextTags, category?.requiredTags ?? [])
    if (stillHere) continue
    const remaining = specimens
      .filter((row) => row.speciesId === cover.speciesId)
      .map((row) => ({ id: row.id, tags: specimenTags(row), createdAt: row.createdAt }))
    const nextId = category ? pickCoverAfterDelete(category.requiredTags, remaining) : null
    if (nextId) applyPut(cover.categoryId, cover.speciesId, nextId)
    else applyDelete(cover.categoryId, cover.speciesId)
  }

  for (const category of categories) {
    if (!hasAllRequired(nextTags, category.requiredTags)) continue
    const current = byKey.get(`${category.id}:${updated.speciesId}`)
    let currentTags: TagId[] | null = null
    if (current) {
      const coverSpecimen = specimens.find((row) => row.id === current.specimenId)
      currentTags = coverSpecimen ? specimenTags(coverSpecimen) : null
    }
    if (shouldAutoReplaceCover(category.requiredTags, currentTags, nextTags)) {
      applyPut(category.id, updated.speciesId, updated.id)
    }
  }

  return mutations
}
