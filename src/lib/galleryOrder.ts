import { insertCategoryIdAt } from './categoryOrder'
import { isGreenCover } from './covers'
import { hasAllRequired, isSilhouette, specimenTags, type SpecimenFields, type TagId } from './tags'

export type GalleryCategory = {
  requiredTags: TagId[]
  sortOrder: number
}

function compareNumberLists(a: readonly number[], b: readonly number[]) {
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const av = i < a.length ? a[i] : -1
    const bv = i < b.length ? b[i] : -1
    if (av !== bv) return av - bv
  }
  return 0
}

/**
 * Default gallery slot: the Settings tag order.
 * Green/exact category wins (combo tracks included). Otherwise all matching
 * non-Basic tracks, so Shiny+Shadow sits after Shiny and before Shadow.
 */
export function galleryDefaultRank(specimen: SpecimenFields, categories: readonly GalleryCategory[]) {
  const tags = specimenTags(specimen)
  const silhouette = isSilhouette(specimen)
  const green = categories.filter((row) =>
    isGreenCover(tags, row.requiredTags, silhouette, specimen.speciesId, specimen.gender),
  )
  if (green.length > 0) {
    const best = green.reduce((a, b) => {
      if (b.requiredTags.length !== a.requiredTags.length) {
        return b.requiredTags.length > a.requiredTags.length ? b : a
      }
      return b.sortOrder < a.sortOrder ? b : a
    })
    return [best.sortOrder]
  }
  const matching = categories
    .filter((row) => row.requiredTags.length > 0 && hasAllRequired(tags, row.requiredTags))
    .map((row) => row.sortOrder)
    .sort((a, b) => a - b)
  if (matching.length > 0) return matching
  const basic = categories.find((row) => row.requiredTags.length === 0)
  return [basic?.sortOrder ?? Number.MAX_SAFE_INTEGER]
}

export function sortGallerySpecimens<T extends SpecimenFields & { id: string; gallerySort?: number | null }>(
  rows: readonly T[],
  categories: readonly GalleryCategory[] = [],
): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const aCustom = a.row.gallerySort
      const bCustom = b.row.gallerySort
      const aHas = typeof aCustom === 'number'
      const bHas = typeof bCustom === 'number'
      if (aHas && bHas && aCustom !== bCustom) return aCustom - bCustom
      if (aHas !== bHas) return aHas ? 1 : -1
      const rank = compareNumberLists(
        galleryDefaultRank(a.row, categories),
        galleryDefaultRank(b.row, categories),
      )
      if (rank !== 0) return rank
      if (a.row.id !== b.row.id) return a.row.id < b.row.id ? -1 : 1
      return a.index - b.index
    })
    .map((item) => item.row)
}

/** Keep hidden cards in place; replace visible slots with the dragged order. */
export function applyVisibleGalleryOrder<T extends { id: string }>(
  fullSorted: readonly T[],
  visibleOrderedIds: string[],
): T[] {
  const byId = new Map(fullSorted.map((row) => [row.id, row]))
  if (visibleOrderedIds.some((id) => !byId.has(id)) || new Set(visibleOrderedIds).size !== visibleOrderedIds.length) {
    throw new Error('Gallery list is out of date')
  }
  const visibleSet = new Set(visibleOrderedIds)
  const currentVisible = fullSorted.filter((row) => visibleSet.has(row.id)).map((row) => row.id)
  if (currentVisible.length !== visibleOrderedIds.length) {
    throw new Error('Gallery list is out of date')
  }
  let next = 0
  return fullSorted.map((row) => {
    if (!visibleSet.has(row.id)) return row
    return byId.get(visibleOrderedIds[next++])!
  })
}

export function galleryOrderPatch(existingIds: string[], orderedIds: string[]) {
  if (orderedIds.length !== existingIds.length) {
    throw new Error('Gallery list is out of date')
  }
  const ids = new Set(existingIds)
  if (orderedIds.some((id) => !ids.has(id)) || new Set(orderedIds).size !== orderedIds.length) {
    throw new Error('Gallery list is out of date')
  }
  return orderedIds.map((id, gallerySort) => ({ id, gallerySort }))
}

export function mergeGalleryDraft(draftIds: string[], liveIds: string[]) {
  const liveSet = new Set(liveIds)
  const kept = draftIds.filter((id) => liveSet.has(id))
  const keptSet = new Set(kept)
  const added = liveIds.filter((id) => !keptSet.has(id))
  return [...added, ...kept]
}

export function moveVisibleGalleryId(visibleIds: string[], id: string, to: number) {
  return insertCategoryIdAt(visibleIds, id, to)
}

export type GallerySlot = { left: number; top: number; width: number; height: number }

export function galleryTargetIndex(slots: readonly GallerySlot[], clientX: number, clientY: number) {
  if (slots.length === 0) return 0
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]
    const cx = slot.left + slot.width / 2
    const cy = slot.top + slot.height / 2
    const dist = (clientX - cx) ** 2 + (clientY - cy) ** 2
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

export function galleryItemShift(
  originIndex: number,
  nextIndex: number,
  slots: readonly Pick<GallerySlot, 'left' | 'top'>[],
) {
  const from = slots[originIndex]
  const to = slots[nextIndex]
  if (!from || !to) return { x: 0, y: 0 }
  return { x: to.left - from.left, y: to.top - from.top }
}
