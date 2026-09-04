import { fromCloudCategoryId, seedCategoryById } from '../data/seedCategories'
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

export function mergeCategoryPull(local: CategoryRow[], cloud: CategoryRow[]): {
  next: CategoryRow[]
  removeIds: string[]
} {
  const localById = new Map(local.map((row) => [row.id, row]))
  const next: CategoryRow[] = []
  const used = new Set<string>()

  for (const row of cloud) {
    const existing = localById.get(row.id)
    if (existing && !existing.seed && categoryNeedsCloudBackup(existing)) next.push(existing)
    else next.push(row)
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
