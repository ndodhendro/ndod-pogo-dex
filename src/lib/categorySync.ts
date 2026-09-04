import { fromCloudCategoryId } from '../data/seedCategories'
import {
  mapCloudCategory,
  mergeCategoryPull,
  shouldApplyRemoteCategory,
  type CloudCategoryRaw,
} from './categorySyncPlan'
import { ensureCustomCategoryTags, ensureSeedCategories, db, type CategoryRow } from './db'
import { getSupabase } from './supabase'

export {
  categoryNeedsCloudBackup,
  mapCloudCategory,
  mergeCategoryPull,
  shouldApplyRemoteCategory,
} from './categorySyncPlan'
export type { CloudCategoryRaw } from './categorySyncPlan'

export async function applyCategoryPull(cloud: CategoryRow[]) {
  const local = await db.categories.toArray()
  const { next, removeIds } = mergeCategoryPull(local, cloud)
  await db.transaction('rw', db.categories, db.covers, async () => {
    if (removeIds.length > 0) {
      await db.covers.where('categoryId').anyOf(removeIds).delete()
      await db.categories.bulkDelete(removeIds)
    }
    if (next.length > 0) await db.categories.bulkPut(next)
  })
  await ensureCustomCategoryTags()
}

export async function applyRemoteCategoryChange(
  event: 'INSERT' | 'UPDATE' | 'DELETE',
  raw: CloudCategoryRaw,
  userId: string,
) {
  const id = fromCloudCategoryId(raw.id, userId, { name: raw.name, seed: raw.seed })
  const local = await db.categories.get(id)
  if (!shouldApplyRemoteCategory(local)) return

  if (event === 'DELETE') {
    await db.transaction('rw', db.categories, db.covers, async () => {
      await db.covers.where('categoryId').equals(id).delete()
      await db.categories.delete(id)
    })
    return
  }

  const row = mapCloudCategory(raw, userId)
  await db.categories.put(row)
  await ensureCustomCategoryTags()
  const { refreshCoversForCategory } = await import('./collection')
  await refreshCoversForCategory(row)
}

async function fetchCloudCategories(userId: string): Promise<CloudCategoryRaw[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const page = 1000
  const rows: CloudCategoryRaw[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as CloudCategoryRaw[]
    rows.push(...batch)
    if (batch.length < page) break
  }
  return rows
}

export async function hydrateCategoriesFromCloud(): Promise<string | undefined> {
  const supabase = getSupabase()
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return

  try {
    const cloud = (await fetchCloudCategories(userId)).map((row) => mapCloudCategory(row, userId))
    if (cloud.length > 0) await applyCategoryPull(cloud)
    else await ensureSeedCategories()
    await ensureCustomCategoryTags()
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not load categories'
  }
}

export function subscribeCategoryChanges(userId: string): () => void {
  const supabase = getSupabase()
  if (!supabase) return () => {}

  const channel = supabase
    .channel(`categories:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${userId}` },
      (payload) => {
        const raw = (payload.eventType === 'DELETE' ? payload.old : payload.new) as CloudCategoryRaw | null
        if (!raw?.id) return
        void applyRemoteCategoryChange(payload.eventType, raw, userId)
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}
