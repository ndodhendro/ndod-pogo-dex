import { BASIC_CROP_TAG } from '../data/tagCrops'
import {
  SPECIES_SLOT_VARIANT,
  specimenFillsSlot,
  slotVariantForTrack,
  type TagCatalog,
} from './roster'
import {
  hasAllRequired,
  isExactMatch,
  isNotPure,
  isSilhouette,
  specimenTags,
  type SpecimenFields,
  type TagId,
} from './tags'

export type CoverPurity = 'green' | 'gray'

export type CoverSilhouetteOpts = {
  currentSilhouette?: boolean
  incomingSilhouette?: boolean
  currentNotPure?: boolean
  incomingNotPure?: boolean
  speciesId?: number
  currentGender?: string | null
  incomingGender?: string | null
  /** When both covers are gray, a higher compare sortOrder replaces the current one. */
  rankCategories?: readonly CoverRankCategory[]
  /** `Set as cover` stays until a green specimen replaces it. */
  keepUserCover?: boolean
}

const SNEASEL_ID = 215
const TAUROS_ID = 128
const ALTERNATE_FORME_TAG = 'alternate-forme'

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

function isPaldeanTauros(speciesId: number | undefined, required: readonly TagId[]) {
  return speciesId === TAUROS_ID && required.includes('paldean')
}

function tagsForOtherCategoryPurity(
  tags: readonly TagId[],
  required: readonly TagId[],
  speciesId?: number,
): TagId[] {
  let next = required.includes('gender') ? [...tags] : tags.filter((tag) => tag !== 'gender')
  if (required.length === 0) next = next.filter((tag) => tag !== BASIC_CROP_TAG)
  if (isPaldeanTauros(speciesId, required) && !required.includes(ALTERNATE_FORME_TAG)) {
    next = next.filter((tag) => tag !== ALTERNATE_FORME_TAG)
  }
  return next
}

export function isGreenCover(
  tags: TagId[],
  required: TagId[],
  silhouette = false,
  speciesId?: number,
  gender?: string | null,
  notPure = false,
): boolean {
  if (silhouette || notPure) return false
  if (isGenderCategory(required)) {
    if (isHisuianSneaselGender(speciesId, gender)) {
      return tagsAreExactly(tags, ['gender', 'hisuian'])
    }
    return tagsAreExactly(tags, ['gender']) || tagsAreExactly(tags, ['gender', BASIC_CROP_TAG])
  }
  return isExactMatch(tagsForOtherCategoryPurity(tags, required, speciesId), required)
}

export function coverPurity(
  specimenTags: TagId[],
  required: TagId[],
  silhouette = false,
  speciesId?: number,
  gender?: string | null,
  notPure = false,
): CoverPurity | null {
  if (!hasAllRequired(specimenTags, required)) return null
  return isGreenCover(specimenTags, required, silhouette, speciesId, gender, notPure) ? 'green' : 'gray'
}

export function speciesInCategory(
  specimensForSpecies: { tags: TagId[] }[],
  required: TagId[],
): boolean {
  return specimensForSpecies.some((s) => hasAllRequired(s.tags, required))
}

export type CoverRankCategory = {
  requiredTags: readonly TagId[]
  sortOrder: number
}

/** Smallest non-Basic category sortOrder this screenshot matches. Basic matches everything, so it is not a score. */
export function coverCompareSortOrder(
  tags: readonly TagId[],
  categories: readonly CoverRankCategory[],
): number | null {
  let min: number | null = null
  for (const row of categories) {
    if (row.requiredTags.length === 0) continue
    if (!hasAllRequired(tags, row.requiredTags)) continue
    if (min === null || row.sortOrder < min) min = row.sortOrder
  }
  return min
}

function rankIsHigher(incoming: number | null, current: number | null) {
  if (incoming === null) return false
  if (current === null) return true
  return incoming > current
}

/**
 * A Set as cover sticks against later gray screenshots and against later pures.
 * The first pure for the slot still takes a gray cover.
 */
export function keepUserChosenCover(
  userChosen: boolean,
  required: TagId[],
  incomingTags: TagId[],
  incoming: {
    silhouette?: boolean
    notPure?: boolean
    gender?: string | null
    speciesId?: number
  },
  othersInSlot: {
    tags: TagId[]
    silhouette?: boolean
    notPure?: boolean
    gender?: string | null
  }[],
): boolean {
  if (!userChosen) return false
  const incomingGreen = isGreenCover(
    incomingTags,
    required,
    incoming.silhouette,
    incoming.speciesId,
    incoming.gender,
    incoming.notPure,
  )
  if (!incomingGreen) return true
  return othersInSlot.some((row) =>
    isGreenCover(row.tags, required, row.silhouette, incoming.speciesId, row.gender, row.notPure),
  )
}

export function rankCategoriesFrom(
  categories: readonly { requiredTags: readonly TagId[]; sortOrder?: number }[],
): CoverRankCategory[] {
  return categories.flatMap((row) =>
    typeof row.sortOrder === 'number' ? [{ requiredTags: row.requiredTags, sortOrder: row.sortOrder }] : [],
  )
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
    opts?.incomingNotPure,
  )
  const currentExact = isGreenCover(
    currentCoverTags,
    required,
    opts?.currentSilhouette,
    speciesId,
    opts?.currentGender,
    opts?.currentNotPure,
  )
  if (opts?.keepUserCover) return false
  if (incomingExact && !currentExact) return true
  if (incomingExact || currentExact) return false
  const categories = opts?.rankCategories
  if (!categories?.length) return false
  return rankIsHigher(
    coverCompareSortOrder(incomingTags, categories),
    coverCompareSortOrder(currentCoverTags, categories),
  )
}

type CoverCandidate = {
  id: string
  tags: TagId[]
  createdAt: number
  silhouette?: boolean
  notPure?: boolean
  gender?: string | null
}

/** Prefer a remaining green cover. Otherwise the highest compare sortOrder, then the newest photo. */
export function pickCoverAfterDelete(
  required: TagId[],
  remaining: CoverCandidate[],
  speciesId?: number,
  rankCategories?: readonly CoverRankCategory[],
): string | null {
  const candidates = remaining.filter((row) => hasAllRequired(row.tags, required))
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) => compareCoverCandidates(required, a, b, speciesId, rankCategories))
  return sorted[0]?.id ?? null
}

function compareCoverCandidates(
  required: TagId[],
  a: CoverCandidate,
  b: CoverCandidate,
  speciesId: number | undefined,
  rankCategories?: readonly CoverRankCategory[],
) {
  const aExact = isGreenCover(a.tags, required, a.silhouette, speciesId, a.gender, a.notPure) ? 1 : 0
  const bExact = isGreenCover(b.tags, required, b.silhouette, speciesId, b.gender, b.notPure) ? 1 : 0
  if (aExact !== bExact) return bExact - aExact
  if (rankCategories?.length) {
    const aRank = coverCompareSortOrder(a.tags, rankCategories)
    const bRank = coverCompareSortOrder(b.tags, rankCategories)
    if (aRank !== bRank) {
      if (aRank === null) return 1
      if (bRank === null) return -1
      return bRank - aRank
    }
  }
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Cover to keep for a slot. A green cover stays. A user-chosen gray stays until a green exists.
 * Otherwise pure wins, then the highest compare sortOrder.
 */
export function preferredCoverId(
  required: TagId[],
  candidates: CoverCandidate[],
  speciesId: number | undefined,
  rankCategories: readonly CoverRankCategory[],
  current: { id: string; userChosen?: boolean } | null,
): string | null {
  const pool = candidates.filter((row) => hasAllRequired(row.tags, required))
  if (pool.length === 0) return null
  const currentRow = current ? pool.find((row) => row.id === current.id) : undefined
  if (current?.userChosen && currentRow) return currentRow.id
  if (
    currentRow &&
    isGreenCover(currentRow.tags, required, currentRow.silhouette, speciesId, currentRow.gender, currentRow.notPure)
  ) {
    return currentRow.id
  }
  return pickCoverAfterDelete(required, pool, speciesId, rankCategories)
}

export type CoverRef = {
  categoryId: string
  speciesId: number
  variant?: string
  specimenId: string
  userChosen?: boolean
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
  categories: { id: string; requiredTags: TagId[]; sortOrder?: number }[],
  covers: CoverRef[],
  specimens: CoverSpecimen[],
  catalogs: readonly TagCatalog[] = [],
): CoverMutation[] {
  const nextTags = specimenTags(updated)
  const rankCategories = rankCategoriesFrom(categories)
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
            notPure: isNotPure(row),
            gender: row.gender,
          }))
      : []
    const nextId = category
      ? pickCoverAfterDelete(category.requiredTags, remaining, cover.speciesId, rankCategories)
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
    let currentNotPure = false
    let currentGender: string | null | undefined
    if (current) {
      const coverSpecimen = specimens.find((row) => row.id === current.specimenId)
      currentTags = coverSpecimen ? specimenTags(coverSpecimen) : null
      currentSilhouette = isSilhouette(coverSpecimen)
      currentNotPure = isNotPure(coverSpecimen)
      currentGender = coverSpecimen?.gender
    }
    if (
      shouldAutoReplaceCover(category.requiredTags, currentTags, nextTags, {
        currentSilhouette,
        incomingSilhouette: isSilhouette(updated),
        currentNotPure,
        incomingNotPure: isNotPure(updated),
        speciesId: updated.speciesId,
        currentGender,
        incomingGender: updated.gender,
        rankCategories,
        keepUserCover: keepUserChosenCover(
          current?.userChosen === true,
          category.requiredTags,
          nextTags,
          {
            silhouette: isSilhouette(updated),
            notPure: isNotPure(updated),
            gender: updated.gender,
            speciesId: updated.speciesId,
          },
          specimens
            .filter(
              (row) =>
                row.id !== updated.id &&
                specimenFillsSlot(
                  row,
                  category.requiredTags,
                  { speciesId: updated.speciesId, variant, name: '' },
                  catalogs,
                ),
            )
            .map((row) => ({
              tags: specimenTags(row),
              silhouette: isSilhouette(row),
              notPure: isNotPure(row),
              gender: row.gender,
            })),
        ),
      })
    ) {
      applyPut(category.id, updated.speciesId, variant, updated.id)
    }
  }

  return mutations
}

/** Automatic cover rows that should change. A green cover and a user-chosen gray stay. */
export function planCategoryCoverPuts(
  category: { id: string; requiredTags: TagId[] },
  specimens: CoverSpecimen[],
  covers: CoverRef[],
  catalogs: readonly TagCatalog[],
  rankCategories: readonly CoverRankCategory[],
): CoverMutation[] {
  const groups = new Map<string, CoverSpecimen[]>()
  for (const specimen of specimens) {
    if (!hasAllRequired(specimenTags(specimen), category.requiredTags)) continue
    const variant = slotVariantForTrack(specimen, category.requiredTags, catalogs)
    const key = `${specimen.speciesId}\0${variant}`
    const list = groups.get(key)
    if (list) list.push(specimen)
    else groups.set(key, [specimen])
  }
  const mutations: CoverMutation[] = []
  for (const [key, group] of groups) {
    const variant = key.slice(key.indexOf('\0') + 1)
    const speciesId = group[0].speciesId
    const current = covers.find(
      (row) =>
        row.categoryId === category.id &&
        row.speciesId === speciesId &&
        coverVariantOf(row) === variant,
    )
    const nextId = preferredCoverId(
      category.requiredTags,
      group.map((row) => ({
        id: row.id,
        tags: specimenTags(row),
        createdAt: row.createdAt,
        silhouette: isSilhouette(row),
        notPure: isNotPure(row),
        gender: row.gender,
      })),
      speciesId,
      rankCategories,
      current ? { id: current.specimenId, userChosen: current.userChosen } : null,
    )
    if (!nextId || nextId === current?.specimenId) continue
    mutations.push({ op: 'put', categoryId: category.id, speciesId, variant, specimenId: nextId })
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
