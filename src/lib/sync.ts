import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fromCloudCategoryId,
  LEGACY_SEED_CLOUD_IDS,
  toCloudCategoryId,
} from '../data/seedCategories'
import { mapCloudCategory } from './categorySyncPlan'
import { db, type CategoryRow, type SpecimenRow } from './db'
import { hashBlob } from './hash'
import { getSupabase } from './supabase'
import {
  cloudBackupErrorMessage,
  dedupePayloadByFileHash,
  isSpecimenFileHashConflict,
  partitionDuplicateFileHashes,
} from './specimenHash'
import { rebaseSpecimenId } from './specimenMerge'
import {
  removeSpecimenObject,
  specimenObjectPath,
  uploadSpecimenOriginal,
} from './specimenStorage'
import { extraTagList, type ShadowStatus, type TagId } from './tags'
import { coversForPendingSpecimens, specimenNeedsCloudPush, type BackupProgress } from './syncBackup'

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
  imagePath?: string | null
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

function specimenCloudRow(
  userId: string,
  specimen: SpecimenRow,
  fileHash: string,
  imagePath: string | null,
) {
  return {
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
    image_path: imagePath,
    file_hash: fileHash,
    created_at: new Date(specimen.createdAt).toISOString(),
  }
}

async function uploadSpecimenPhoto(
  supabase: SupabaseClient,
  userId: string,
  specimen: SpecimenRow,
  fileHash: string,
  existingPath?: string | null,
): Promise<{ path: string | null; error?: string }> {
  if (existingPath) return { path: existingPath }
  const image = await db.images.get(specimen.imageId)
  if (!image?.original) return { path: null }
  const uploaded = await uploadSpecimenOriginal(supabase, userId, fileHash, image.original)
  if ('error' in uploaded) return { path: null, error: uploaded.error }
  return { path: uploaded.path }
}

export async function pushSpecimen(specimen: SpecimenRow): Promise<string | undefined> {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return

  const fileHash = await ensureFileHash(specimen)
  if (!fileHash) return 'Could not hash screenshot for cloud backup'

  let row: SpecimenRow = { ...specimen, fileHash }
  const photo = await uploadSpecimenPhoto(supabase, userId, row, fileHash)
  if (photo.error) return photo.error

  const { error } = await supabase.from('specimens').upsert(specimenCloudRow(userId, row, fileHash, photo.path))
  if (!error) return
  if (!isSpecimenFileHashConflict(error)) return cloudBackupErrorMessage(error.message)

  const { data: existing, error: lookupError } = await supabase
    .from('specimens')
    .select('id, image_path')
    .eq('user_id', userId)
    .eq('file_hash', fileHash)
    .maybeSingle()
  if (lookupError) return lookupError.message
  if (!existing?.id) return cloudBackupErrorMessage(error.message)

  const rebased = await rebaseSpecimenId(row.id, existing.id)
  if (!rebased) return cloudBackupErrorMessage(error.message)
  row = { ...rebased, fileHash }

  const retryPath = photo.path ?? (existing.image_path as string | null) ?? null
  const { error: retryError } = await supabase
    .from('specimens')
    .upsert(specimenCloudRow(userId, row, fileHash, retryPath))
  if (retryError) return cloudBackupErrorMessage(retryError.message)
}

export async function pushCoversForSpecies(speciesId: number): Promise<string | undefined> {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return

  const ownedLegacy = await ownedLegacySeedIds(userId)
  if (typeof ownedLegacy === 'string') return ownedLegacy

  const { error: delErr } = await supabase
    .from('covers')
    .delete()
    .eq('user_id', userId)
    .eq('species_id', speciesId)
  if (delErr) return delErr.message

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

export async function pushMetadataAfterSave(
  specimen: SpecimenRow,
  extraSpeciesIds: number[] = [],
): Promise<CloudPushResult> {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return { kind: 'skipped' }
  const speciesIds = [specimen.speciesId, ...extraSpeciesIds.filter((id) => id !== specimen.speciesId)]
  let message = (await pushCategories()) || (await pushSpecimen(specimen))
  for (const speciesId of speciesIds) {
    if (message) break
    message = await pushCoversForSpecies(speciesId)
  }
  if (message) return { kind: 'error', message: cloudBackupErrorMessage(message) }
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

export async function deleteCloudSpecimen(id: string, speciesId: number, fileHash?: string | null) {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return
  const { data: existing } = await supabase
    .from('specimens')
    .select('image_path, file_hash')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  const imagePath =
    (existing?.image_path as string | null) ??
    (fileHash || existing?.file_hash
      ? specimenObjectPath(userId, (fileHash || existing?.file_hash) as string)
      : null)
  const storageError = await removeSpecimenObject(supabase, imagePath)
  const { error } = await supabase.from('specimens').delete().eq('user_id', userId).eq('id', id)
  if (error) return error.message
  if (storageError) return storageError
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

  type CloudPathRow = { file_hash: string | null; image_path: string | null }
  let pathByHash = new Map<string, string | null>()
  try {
    const cloudRows = await fetchPaged<CloudPathRow>('specimens', userId)
    pathByHash = new Map(
      cloudRows
        .filter((row) => Boolean(row.file_hash))
        .map((row) => [row.file_hash as string, row.image_path]),
    )
  } catch (err) {
    return err instanceof Error ? err.message : 'Could not read cloud specimens'
  }

  const locals = await db.specimens.toArray()
  const pending = locals.filter((row) => specimenNeedsCloudPush(row, row.fileHash ? pathByHash.get(row.fileHash) : null))
  if (pending.length === 0) return

  onProgress?.({ phase: 'preparing', current: 0, total: pending.length })
  await yieldUi()

  const hashed: Array<SpecimenRow & { fileHash: string }> = []
  for (let i = 0; i < pending.length; i++) {
    const specimen = pending[i]
    const fileHash = await ensureFileHash(specimen)
    if (fileHash) hashed.push({ ...specimen, fileHash })
    onProgress?.({ phase: 'preparing', current: i + 1, total: pending.length })
    if (i % 4 === 0) await yieldUi()
  }

  const { keep, extras } = partitionDuplicateFileHashes(hashed)
  for (const pair of extras) {
    await rebaseSpecimenId(pair.extra.id, pair.keep.id)
  }

  const payload: ReturnType<typeof specimenCloudRow>[] = []
  for (let i = 0; i < keep.length; i++) {
    const specimen = keep[i]
    const photo = await uploadSpecimenPhoto(
      supabase,
      userId,
      specimen,
      specimen.fileHash,
      pathByHash.get(specimen.fileHash),
    )
    if (photo.error) return photo.error
    payload.push(specimenCloudRow(userId, specimen, specimen.fileHash, photo.path))
    onProgress?.({ phase: 'uploading', current: i + 1, total: keep.length })
    if (i % 2 === 0) await yieldUi()
  }

  const uniquePayload = dedupePayloadByFileHash(payload)
  if (uniquePayload.length === 0) return

  for (let i = 0; i < uniquePayload.length; i += UPSERT_PAGE) {
    const batch = uniquePayload.slice(i, i + UPSERT_PAGE)
    const { error } = await supabase.from('specimens').upsert(batch)
    if (error && isSpecimenFileHashConflict(error)) {
      for (const row of batch) {
        const local = await db.specimens.get(row.id)
        if (!local) continue
        const rowErr = await pushSpecimen(local)
        if (rowErr) return rowErr
      }
    } else if (error) {
      return cloudBackupErrorMessage(error.message)
    }
    await yieldUi()
  }

  const liveIds: string[] = []
  for (const specimen of keep) {
    const live = await db.specimens.where('fileHash').equals(specimen.fileHash).first()
    if (live) liveIds.push(live.id)
  }
  const liveIdSet = new Set(liveIds)
  const liveRows = (await db.specimens.toArray()).filter((row) => liveIdSet.has(row.id))

  const ownedLegacy = await ownedLegacySeedIds(userId)
  if (typeof ownedLegacy === 'string') return ownedLegacy
  const coverRows = coversForPendingSpecimens(await db.covers.toArray(), liveRows).map((row) => ({
    user_id: userId,
    category_id: toCloudCategoryId(row.categoryId, userId, ownedLegacy),
    species_id: row.speciesId,
    specimen_id: row.specimenId,
  }))
  for (let i = 0; i < coverRows.length; i += UPSERT_PAGE) {
    const { error } = await supabase.from('covers').upsert(coverRows.slice(i, i + UPSERT_PAGE))
    if (error) return error.message
  }

  await markSpecimensBackedUp(liveIds)
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
    image_path?: string | null
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
        imagePath: row.image_path ?? null,
        createdAt: new Date(row.created_at).getTime(),
      })),
    covers: rawCovers.map((row) => ({
      categoryId: fromCloudCategoryId(row.category_id, userId),
      speciesId: row.species_id,
      specimenId: row.specimen_id,
    })),
  }
}
