import {
  fromCloudCategoryId,
  LEGACY_SEED_CLOUD_IDS,
  toCloudCategoryId,
} from '../data/seedCategories'
import { mapCloudCategory } from './categorySyncPlan'
import { db, type CategoryRow, type SpecimenRow } from './db'
import { hashBlob } from './hash'
import { getSupabase } from './supabase'
import { extraTagList, type ShadowStatus, type TagId } from './tags'
import { coversForPendingSpecimens, specimenNeedsCloudBackup, type BackupProgress } from './syncBackup'

export type CloudSpecimen = {
  id: string
  speciesId: number
  form: string | null
  shiny: boolean
  shadowStatus: ShadowStatus
  costume: string | null
  background: string | null
  hundo: boolean
  nundo: boolean
  extraTags?: TagId[]
  fileHash: string
  createdAt: number
}

export type CloudCover = {
  categoryId: string
  speciesId: number
  specimenId: string
}

async function signedInUserId(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

const ownedLegacyByUser = new Map<string, Set<string>>()

async function ownedLegacySeedIds(userId: string): Promise<Set<string> | string> {
  const cached = ownedLegacyByUser.get(userId)
  if (cached) return cached
  const supabase = getSupabase()
  if (!supabase) return new Set()
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .in('id', LEGACY_SEED_CLOUD_IDS)
  if (error) return error.message
  const ids = new Set((data ?? []).map((row) => row.id as string))
  ownedLegacyByUser.set(userId, ids)
  return ids
}

export async function ensureFileHash(specimen: SpecimenRow): Promise<string | null> {
  if (specimen.fileHash) return specimen.fileHash
  const image = await db.images.get(specimen.imageId)
  if (!image) return null
  const fileHash = await hashBlob(image.original)
  await db.specimens.update(specimen.id, { fileHash })
  return fileHash
}

export async function pushCategories(): Promise<string | undefined> {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return

  const ownedLegacy = await ownedLegacySeedIds(userId)
  if (typeof ownedLegacy === 'string') return ownedLegacy

  const categories = await db.categories.toArray()
  const { error } = await supabase.from('categories').upsert(
    categories.map((row) => ({
      id: toCloudCategoryId(row.id, userId, ownedLegacy),
      user_id: userId,
      name: row.name,
      required_tags: row.requiredTags,
      sort_order: row.sortOrder,
      seed: row.seed,
      emoji: row.emoji ?? null,
      label_color: row.labelColor ?? null,
    })),
  )
  if (error) return error.message
  await markCategoriesBackedUp(categories.map((row) => row.id))
}

export async function pushSpecimen(specimen: SpecimenRow): Promise<string | undefined> {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return

  const fileHash = await ensureFileHash(specimen)
  if (!fileHash) return 'Could not hash screenshot for cloud backup'

  const { error } = await supabase.from('specimens').upsert({
    id: specimen.id,
    user_id: userId,
    species_id: specimen.speciesId,
    form: specimen.form,
    shiny: specimen.shiny,
    shadow_status: specimen.shadowStatus,
    costume: specimen.costume,
    background: specimen.background,
    hundo: specimen.hundo,
    nundo: specimen.nundo,
    extra_tags: extraTagList(specimen),
    image_path: null,
    file_hash: fileHash,
    created_at: new Date(specimen.createdAt).toISOString(),
  })
  if (error) return error.message
}

export async function pushCoversForSpecies(speciesId: number): Promise<string | undefined> {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return

  const ownedLegacy = await ownedLegacySeedIds(userId)
  if (typeof ownedLegacy === 'string') return ownedLegacy

  const covers = (await db.covers.toArray()).filter((row) => row.speciesId === speciesId)
  if (covers.length === 0) return
  const { error } = await supabase.from('covers').upsert(
    covers.map((row) => ({
      user_id: userId,
      category_id: toCloudCategoryId(row.categoryId, userId, ownedLegacy),
      species_id: row.speciesId,
      specimen_id: row.specimenId,
    })),
  )
  if (error) return error.message
}

export type CloudPushResult =
  | { kind: 'ok' }
  | { kind: 'skipped' }
  | { kind: 'error'; message: string }

export async function pushMetadataAfterSave(specimen: SpecimenRow): Promise<CloudPushResult> {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return { kind: 'skipped' }
  const message =
    (await pushCategories()) ||
    (await pushSpecimen(specimen)) ||
    (await pushCoversForSpecies(specimen.speciesId))
  if (message) return { kind: 'error', message }
  return { kind: 'ok' }
}

export async function pushCover(categoryId: string, speciesId: number, specimenId: string) {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return
  const ownedLegacy = await ownedLegacySeedIds(userId)
  if (typeof ownedLegacy === 'string') return ownedLegacy
  const { error } = await supabase.from('covers').upsert({
    user_id: userId,
    category_id: toCloudCategoryId(categoryId, userId, ownedLegacy),
    species_id: speciesId,
    specimen_id: specimenId,
  })
  if (error) return error.message
}

export async function pushCoversForCategory(categoryId: string): Promise<string | undefined> {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return
  const ownedLegacy = await ownedLegacySeedIds(userId)
  if (typeof ownedLegacy === 'string') return ownedLegacy
  const cloudCategoryId = toCloudCategoryId(categoryId, userId, ownedLegacy)
  const { error: delErr } = await supabase
    .from('covers')
    .delete()
    .eq('user_id', userId)
    .eq('category_id', cloudCategoryId)
  if (delErr) return delErr.message
  const covers = (await db.covers.toArray()).filter((row) => row.categoryId === categoryId)
  if (covers.length === 0) return
  const { error } = await supabase.from('covers').upsert(
    covers.map((row) => ({
      user_id: userId,
      category_id: cloudCategoryId,
      species_id: row.speciesId,
      specimen_id: row.specimenId,
    })),
  )
  if (error) return error.message
}

export async function pushCategory(row: CategoryRow) {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return
  const ownedLegacy = await ownedLegacySeedIds(userId)
  if (typeof ownedLegacy === 'string') return ownedLegacy
  const { error } = await supabase.from('categories').upsert({
    id: toCloudCategoryId(row.id, userId, ownedLegacy),
    user_id: userId,
    name: row.name,
    required_tags: row.requiredTags,
    sort_order: row.sortOrder,
    seed: row.seed,
    emoji: row.emoji ?? null,
    label_color: row.labelColor ?? null,
  })
  if (error) return error.message
  await markCategoriesBackedUp([row.id])
}

export async function deleteCloudCategory(id: string) {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return
  const ownedLegacy = await ownedLegacySeedIds(userId)
  if (typeof ownedLegacy === 'string') return ownedLegacy
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', toCloudCategoryId(id, userId, ownedLegacy))
    .eq('user_id', userId)
  if (error) return error.message
}

export async function deleteCloudSpecimen(id: string, speciesId: number) {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return
  const { error } = await supabase.from('specimens').delete().eq('user_id', userId).eq('id', id)
  if (error) return error.message
  return pushCoversForSpecies(speciesId)
}

async function fetchPaged<T>(table: string, userId: string): Promise<T[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  const page = 1000
  const rows: T[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < page) break
  }
  return rows
}

const UPSERT_PAGE = 100
const BACKUP_FP_KEY = 'ndod.meta.backupFp'

function yieldUi() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0)
  })
}

async function markSpecimensBackedUp(ids: string[]) {
  if (ids.length === 0) return
  await db.specimens.where('id').anyOf(ids).modify({ cloudBackupPending: false })
}

async function markCategoriesBackedUp(ids: string[]) {
  if (ids.length === 0) return
  await db.categories.where('id').anyOf(ids).modify({ cloudBackupPending: false })
}

export async function backupAllMetadata(
  onProgress?: (progress: BackupProgress) => void,
): Promise<string | undefined> {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return
  localStorage.removeItem(BACKUP_FP_KEY)

  const catErr = await pushCategories()
  if (catErr) return catErr

  const pending = (await db.specimens.toArray()).filter(specimenNeedsCloudBackup)
  if (pending.length === 0) return

  onProgress?.({ phase: 'preparing', current: 0, total: pending.length })
  await yieldUi()

  const payload: Record<string, unknown>[] = []
  const hashedIds: string[] = []
  for (let i = 0; i < pending.length; i++) {
    const specimen = pending[i]
    const fileHash = await ensureFileHash(specimen)
    if (fileHash) {
      hashedIds.push(specimen.id)
      payload.push({
        id: specimen.id,
        user_id: userId,
        species_id: specimen.speciesId,
        form: specimen.form,
        shiny: specimen.shiny,
        shadow_status: specimen.shadowStatus,
        costume: specimen.costume,
        background: specimen.background,
        hundo: specimen.hundo,
        nundo: specimen.nundo,
        extra_tags: extraTagList(specimen),
        image_path: null,
        file_hash: fileHash,
        created_at: new Date(specimen.createdAt).toISOString(),
      })
    }
    onProgress?.({ phase: 'preparing', current: i + 1, total: pending.length })
    if (i % 4 === 0) await yieldUi()
  }

  if (payload.length === 0) return

  onProgress?.({ phase: 'uploading', current: 0, total: payload.length })
  await yieldUi()

  for (let i = 0; i < payload.length; i += UPSERT_PAGE) {
    const batch = payload.slice(i, i + UPSERT_PAGE)
    const { error } = await supabase.from('specimens').upsert(batch)
    if (error) return error.message
    onProgress?.({ phase: 'uploading', current: i + batch.length, total: payload.length })
    await yieldUi()
  }

  const ownedLegacy = await ownedLegacySeedIds(userId)
  if (typeof ownedLegacy === 'string') return ownedLegacy
  const hashedIdSet = new Set(hashedIds)
  const hashedPending = pending.filter((row) => hashedIdSet.has(row.id))
  const coverRows = coversForPendingSpecimens(await db.covers.toArray(), hashedPending).map((row) => ({
    user_id: userId,
    category_id: toCloudCategoryId(row.categoryId, userId, ownedLegacy),
    species_id: row.speciesId,
    specimen_id: row.specimenId,
  }))
  for (let i = 0; i < coverRows.length; i += UPSERT_PAGE) {
    const { error } = await supabase.from('covers').upsert(coverRows.slice(i, i + UPSERT_PAGE))
    if (error) return error.message
  }

  await markSpecimensBackedUp(hashedIds)
}

export async function pullCloudCollection(): Promise<{
  categories: CategoryRow[]
  specimens: CloudSpecimen[]
  covers: CloudCover[]
} | null> {
  const userId = await signedInUserId()
  if (!userId) return null

  type RawSpecimen = {
    id: string
    species_id: number
    form: string | null
    shiny: boolean
    shadow_status: ShadowStatus
    costume: string | null
    background: string | null
    hundo: boolean
    nundo: boolean
    extra_tags?: string[] | null
    file_hash: string | null
    created_at: string
  }
  type RawCategory = {
    id: string
    name: string
    required_tags: TagId[]
    sort_order: number
    seed: boolean
    emoji?: string | null
    label_color?: string | null
  }
  type RawCover = {
    category_id: string
    species_id: number
    specimen_id: string
  }

  const [rawCats, rawSpecs, rawCovers] = await Promise.all([
    fetchPaged<RawCategory>('categories', userId),
    fetchPaged<RawSpecimen>('specimens', userId),
    fetchPaged<RawCover>('covers', userId),
  ])

  return {
    categories: rawCats.map((row) => mapCloudCategory(row, userId)),
    specimens: rawSpecs
      .filter((row) => Boolean(row.file_hash))
      .map((row) => ({
        id: row.id,
        speciesId: row.species_id,
        form: row.form,
        shiny: row.shiny,
        shadowStatus: row.shadow_status,
        costume: row.costume,
        background: row.background,
        hundo: row.hundo,
        nundo: row.nundo,
        extraTags: extraTagList({ extraTags: row.extra_tags ?? [] }),
        fileHash: row.file_hash as string,
        createdAt: new Date(row.created_at).getTime(),
      })),
    covers: rawCovers.map((row) => ({
      categoryId: fromCloudCategoryId(row.category_id, userId),
      speciesId: row.species_id,
      specimenId: row.specimen_id,
    })),
  }
}
