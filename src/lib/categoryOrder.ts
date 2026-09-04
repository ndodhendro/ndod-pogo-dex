export function categoryOrderPatch(existingIds: string[], orderedIds: string[]) {
  if (orderedIds.length !== existingIds.length) {
    throw new Error('Category list is out of date')
  }
  const ids = new Set(existingIds)
  if (orderedIds.some((id) => !ids.has(id)) || new Set(orderedIds).size !== orderedIds.length) {
    throw new Error('Category list is out of date')
  }
  return orderedIds.map((id, sortOrder) => ({ id, sortOrder }))
}

export function moveCategoryId(ids: string[], id: string, delta: number) {
  const from = ids.indexOf(id)
  if (from < 0) return ids
  const to = from + delta
  if (to < 0 || to >= ids.length) return ids
  return insertCategoryIdAt(ids, id, to)
}

export function insertCategoryIdAt(ids: string[], id: string, to: number) {
  const from = ids.indexOf(id)
  if (from < 0) return ids
  const next = ids.slice()
  next.splice(from, 1)
  const clamped = Math.max(0, Math.min(to, next.length))
  next.splice(clamped, 0, id)
  return next
}

export function sameCategoryOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index])
}
