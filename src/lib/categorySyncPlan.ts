import { fromCloudCategoryId, seedCategoryById, toCloudCategoryId } from '../data/seedCategories'
import type { CategoryRow } from './db'
import type { TagId } from './tags'

export type CloudCategoryRaw = {
  id: string
  name: string
  required_tags?: TagId[] | null
  sort_order: number
  seed: boolean
  emoji?: string | null
  label_color?: string | null
  user_id?: string
}

export function categoryNeedsCloudBackup(row: { cloudBackupPending?: boolean }): boolean {
  return row.cloudBackupPending !== false
}

export function mapCloudCategory(row: CloudCategoryRaw, userId: string): CategoryRow {
  const id = fromCloudCategoryId(row.id, userId, { name: row.name, seed: row.seed })
  return {
    id,
    name: seedCategoryById(id)?.name ?? row.name,
    requiredTags: row.required_tags ?? [],
    sortOrder: row.sort_order,
    seed: row.seed,
    emoji: row.emoji ?? undefined,
    labelColor: row.label_color ?? undefined,
    cloudBackupPending: false,
  }
}

export type CategoryUpsertRow = {
  id: string
  user_id: string
  name: string
  required_tags: TagId[]
  seed: boolean
  emoji: string | null
  label_color: string | null
  sort_order?: number
}

/** Cloud owns sort_order. Send it only on reorder, or when inserting a row that is not in cloud yet. */
export function includeSortOrderOnUpsert(syncOrder: boolean, alreadyInCloud: boolean) {
  return syncOrder || !alreadyInCloud
}

export function categoryUpsertRow(
  row: CategoryRow,
  userId: string,
  ownedLegacy: ReadonlySet<string>,
  includeSortOrder: boolean,
): CategoryUpsertRow {
  const payload: CategoryUpsertRow = {
    id: toCloudCategoryId(row.id, userId, ownedLegacy),
    user_id: userId,
    name: row.name,
    required_tags: row.requiredTags,
    seed: row.seed,
    emoji: row.emoji ?? null,
    label_color: row.labelColor ?? null,
  }
  if (includeSortOrder) payload.sort_order = Number.isFinite(row.sortOrder) ? row.sortOrder : 0
  return payload
}

/**
 * PostgREST fills a missing key with null across one bulk upsert.
 * A row that omits sort_order must not share a request with a row that sends it.
 */
export function splitCategoryUpserts<T extends { sort_order?: number }>(rows: readonly T[]) {
  const withOrder: T[] = []
  const metadata: T[] = []
  for (const row of rows) {
    if (Object.prototype.hasOwnProperty.call(row, 'sort_order')) withOrder.push(row)
    else metadata.push(row)
  }
  return { withOrder, metadata }
}

export function mergeCategoryPull(local: CategoryRow[], cloud: CategoryRow[]): {
  next: CategoryRow[]
  removeIds: string[]
} {
  const localById = new Map(local.map((row) => [row.id, row]))
  const next: CategoryRow[] = []
  const used = new Set<string>()

  for (const row of cloud) {
    const existing = localById.get(row.id)
    if (existing && !existing.seed && categoryNeedsCloudBackup(existing)) {
      next.push({ ...existing, sortOrder: row.sortOrder })
    } else next.push(row)
    used.add(row.id)
  }

  for (const row of local) {
    if (used.has(row.id)) continue
    if (row.seed) continue
    if (categoryNeedsCloudBackup(row)) next.push(row)
  }

  const nextIds = new Set(next.map((row) => row.id))
  return {
    next,
    removeIds: local.filter((row) => !nextIds.has(row.id)).map((row) => row.id),
  }
}

/** Skip a remote event when this device still has an unsynced local custom edit. */
export function shouldApplyRemoteCategory(local: CategoryRow | undefined): boolean {
  if (!local) return true
  if (local.seed) return true
  return !categoryNeedsCloudBackup(local)
}
