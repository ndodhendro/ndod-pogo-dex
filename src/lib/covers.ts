import { BASIC_CROP_TAG } from '../data/tagCrops'
import {
  SPECIES_SLOT_VARIANT,
  specimenFillsSlot,
  slotVariantForTrack,
  type TagCatalog,
} from './roster'
import { hasAllRequired, isExactMatch, isSilhouette, specimenTags, type SpecimenFields, type TagId } from './tags'

export type CoverPurity = 'green' | 'gray'

export type CoverSilhouetteOpts = {
  currentSilhouette?: boolean
  incomingSilhouette?: boolean
  speciesId?: number
  currentGender?: string | null
  incomingGender?: string | null
}

const SNEASEL_ID = 215

function tagsAreExactly(tags: readonly TagId[], wanted: readonly TagId[]) {
  if (tags.length !== wanted.length) return false
  const set = new Set(tags)
  return wanted.every((tag) => set.has(tag))
}

function isGenderCategory(required: readonly TagId[]) {
  return tagsAreExactly(required, ['gender'])
}

function isHisuianSneaselGender(speciesId: number | undefined, gender: string | null | undefined) {
  if (speciesId !== SNEASEL_ID) return false
  const label = (gender ?? '').trim().toLowerCase()
  return label === 'hisuian male' || label === 'hisuian female'
}

function tagsForOtherCategoryPurity(tags: readonly TagId[], required: readonly TagId[]): TagId[] {
  let next = required.includes('gender') ? [...tags] : tags.filter((tag) => tag !== 'gender')
  if (required.length === 0) next = next.filter((tag) => tag !== BASIC_CROP_TAG)
  return next
}

export function isGreenCover(
  tags: TagId[],
  required: TagId[],
  silhouette = false,
  speciesId?: number,
  gender?: string | null,
): boolean {
  if (silhouette) return false
  if (isGenderCategory(required)) {
    if (isHisuianSneaselGender(speciesId, gender)) {
      return tagsAreExactly(tags, ['gender', 'hisuian'])
    }
    return tagsAreExactly(tags, ['gender']) || tagsAreExactly(tags, ['gender', BASIC_CROP_TAG])
  }
  return isExactMatch(tagsForOtherCategoryPurity(tags, required), required)
}

export function coverPurity(
  specimenTags: TagId[],
  required: TagId[],
  silhouette = false,
  speciesId?: number,
  gender?: string | null,
): CoverPurity | null {
  if (!hasAllRequired(specimenTags, required)) return null
  return isGreenCover(specimenTags, required, silhouette, speciesId, gender) ? 'green' : 'gray'
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
  opts?: CoverSilhouetteOpts,
): boolean {
  if (!hasAllRequired(incomingTags, required)) return false
  if (!currentCoverTags) return true
  const speciesId = opts?.speciesId
  const incomingExact = isGreenCover(
    incomingTags,
    required,
    opts?.incomingSilhouette,
    speciesId,
    opts?.incomingGender,
  )
  const currentExact = isGreenCover(
    currentCoverTags,
    required,
    opts?.currentSilhouette,
    speciesId,
    opts?.currentGender,
  )
  return incomingExact && !currentExact
}

/** Prefer a remaining green cover, else the newest in-category photo. */
export function pickCoverAfterDelete(
  required: TagId[],
  remaining: {
    id: string
    tags: TagId[]
    createdAt: number
    silhouette?: boolean
    gender?: string | null
  }[],
  speciesId?: number,
): string | null {
  const candidates = remaining.filter((row) => hasAllRequired(row.tags, required))
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => {
    const aExact = isGreenCover(a.tags, required, a.silhouette, speciesId, a.gender) ? 1 : 0
    const bExact = isGreenCover(b.tags, required, b.silhouette, speciesId, b.gender) ? 1 : 0
    if (aExact !== bExact) return bExact - aExact
    return b.createdAt - a.createdAt
  })
  return sorted[0]?.id ?? null
}

export type CoverRef = {
  categoryId: string
  speciesId: number
  variant?: string
  specimenId: string
}

export type CoverMutation =
  | { op: 'put'; categoryId: string; speciesId: number; variant: string; specimenId: string }
  | { op: 'delete'; categoryId: string; speciesId: number; variant: string }

function coverSlotKey(categoryId: string, speciesId: number, variant = SPECIES_SLOT_VARIANT) {
  return `${categoryId}:${speciesId}:${variant}`
}

function coverVariantOf(row: CoverRef) {
  return row.variant ?? SPECIES_SLOT_VARIANT
}

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
  catalogs: readonly TagCatalog[] = [],
): CoverMutation[] {
  const nextTags = specimenTags(updated)
  const byKey = new Map(
    covers.map((row) => [coverSlotKey(row.categoryId, row.speciesId, coverVariantOf(row)), { ...row }]),
  )
  const mutations: CoverMutation[] = []

  function applyPut(categoryId: string, speciesId: number, variant: string, specimenId: string) {
    const key = coverSlotKey(categoryId, speciesId, variant)
    const current = byKey.get(key)
    if (current?.specimenId === specimenId) return
    byKey.set(key, { categoryId, speciesId, variant, specimenId })
    mutations.push({ op: 'put', categoryId, speciesId, variant, specimenId })
  }

  function applyDelete(categoryId: string, speciesId: number, variant: string) {
    const key = coverSlotKey(categoryId, speciesId, variant)
    if (!byKey.has(key)) return
    byKey.delete(key)
    mutations.push({ op: 'delete', categoryId, speciesId, variant })
  }

  for (const cover of covers) {
    if (cover.specimenId !== previous.id) continue
    const category = categories.find((row) => row.id === cover.categoryId)
    const variant = coverVariantOf(cover)
    const stillHere =
      cover.speciesId === updated.speciesId &&
      Boolean(category) &&
      hasAllRequired(nextTags, category?.requiredTags ?? []) &&
      slotVariantForTrack(updated, category?.requiredTags ?? [], catalogs) === variant
    if (stillHere) continue
    const remaining = category
      ? specimens
          .filter((row) =>
            specimenFillsSlot(
              row,
              category.requiredTags,
              { speciesId: cover.speciesId, variant, name: '' },
              catalogs,
            ),
          )
          .map((row) => ({
            id: row.id,
            tags: specimenTags(row),
            createdAt: row.createdAt,
            silhouette: isSilhouette(row),
            gender: row.gender,
          }))
      : []
    const nextId = category
      ? pickCoverAfterDelete(category.requiredTags, remaining, cover.speciesId)
      : null
    if (nextId) applyPut(cover.categoryId, cover.speciesId, variant, nextId)
    else applyDelete(cover.categoryId, cover.speciesId, variant)
  }

  for (const category of categories) {
    if (!hasAllRequired(nextTags, category.requiredTags)) continue
    const variant = slotVariantForTrack(updated, category.requiredTags, catalogs)
    const current = byKey.get(coverSlotKey(category.id, updated.speciesId, variant))
    let currentTags: TagId[] | null = null
    let currentSilhouette = false
    let currentGender: string | null | undefined
    if (current) {
      const coverSpecimen = specimens.find((row) => row.id === current.specimenId)
      currentTags = coverSpecimen ? specimenTags(coverSpecimen) : null
      currentSilhouette = isSilhouette(coverSpecimen)
      currentGender = coverSpecimen?.gender
    }
    if (
      shouldAutoReplaceCover(category.requiredTags, currentTags, nextTags, {
        currentSilhouette,
        incomingSilhouette: isSilhouette(updated),
        speciesId: updated.speciesId,
        currentGender,
        incomingGender: updated.gender,
      })
    ) {
      applyPut(category.id, updated.speciesId, variant, updated.id)
    }
  }

  return mutations
}

export function findCover(
  covers: readonly CoverRef[],
  categoryId: string,
  speciesId: number,
  variant = SPECIES_SLOT_VARIANT,
): CoverRef | undefined {
  const wanted = variant
  const exact = covers.find(
    (row) =>
      row.categoryId === categoryId &&
      row.speciesId === speciesId &&
      coverVariantOf(row) === wanted,
  )
  if (exact) return exact
  if (wanted !== SPECIES_SLOT_VARIANT) return undefined
  return covers.find((row) => row.categoryId === categoryId && row.speciesId === speciesId)
}
