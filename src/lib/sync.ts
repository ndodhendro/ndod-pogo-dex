import {
  fromCloudCategoryId,
  toCloudCategoryId,
} from '../data/seedCategories'
import { db, type CategoryRow, type SpecimenRow } from './db'
import { hashBlob } from './hash'
import { getSupabase } from './supabase'
import type { ShadowStatus, TagId } from './tags'

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

  const categories = await db.categories.toArray()
  const { error } = await supabase.from('categories').upsert(
    categories.map((row) => ({
      id: toCloudCategoryId(row.id),
      user_id: userId,
      name: row.name,
      required_tags: row.requiredTags,
      sort_order: row.sortOrder,
      seed: row.seed,
    })),
  )
  if (error) return error.message
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

  const covers = (await db.covers.toArray()).filter((row) => row.speciesId === speciesId)
  if (covers.length === 0) return
  const { error } = await supabase.from('covers').upsert(
    covers.map((row) => ({
      user_id: userId,
      category_id: toCloudCategoryId(row.categoryId),
      species_id: row.speciesId,
      specimen_id: row.specimenId,
    })),
  )
  if (error) return error.message
}

export async function pushMetadataAfterSave(specimen: SpecimenRow): Promise<string | undefined> {
  return (
    (await pushCategories()) ||
    (await pushSpecimen(specimen)) ||
    (await pushCoversForSpecies(specimen.speciesId))
  )
}

export async function pushCover(categoryId: string, speciesId: number, specimenId: string) {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return
  const { error } = await supabase.from('covers').upsert({
    user_id: userId,
    category_id: toCloudCategoryId(categoryId),
    species_id: speciesId,
    specimen_id: specimenId,
  })
  if (error) return error.message
}

export async function pushCategory(row: CategoryRow) {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return
  const { error } = await supabase.from('categories').upsert({
    id: toCloudCategoryId(row.id),
    user_id: userId,
    name: row.name,
    required_tags: row.requiredTags,
    sort_order: row.sortOrder,
    seed: row.seed,
  })
  if (error) return error.message
}

export async function deleteCloudCategory(id: string) {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', toCloudCategoryId(id))
    .eq('user_id', userId)
  if (error) return error.message
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

const BACKUP_FP_KEY = 'ndod.meta.backupFp'
const UPSERT_PAGE = 100

function collectionFingerprint(
  specimenCount: number,
  hashedCount: number,
  coverCount: number,
  categoryCount: number,
  latestCreatedAt: number,
) {
  return `${specimenCount}:${hashedCount}:${coverCount}:${categoryCount}:${latestCreatedAt}`
}

export async function backupAllMetadata(): Promise<string | undefined> {
  const supabase = getSupabase()
  const userId = await signedInUserId()
  if (!supabase || !userId) return

  const catErr = await pushCategories()
  if (catErr) return catErr

  const specimens = await db.specimens.toArray()
  const payload: Record<string, unknown>[] = []
  for (const specimen of specimens) {
    const fileHash = await ensureFileHash(specimen)
    if (!fileHash) continue
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
      image_path: null,
      file_hash: fileHash,
      created_at: new Date(specimen.createdAt).toISOString(),
    })
  }

  const covers = await db.covers.toArray()
  const categories = await db.categories.toArray()
  const fp = collectionFingerprint(
    specimens.length,
    payload.length,
    covers.length,
    categories.length,
    specimens.reduce((latest, row) => Math.max(latest, row.createdAt), 0),
  )
  if (localStorage.getItem(BACKUP_FP_KEY) === fp) return

  for (let i = 0; i < payload.length; i += UPSERT_PAGE) {
    const { error } = await supabase.from('specimens').upsert(payload.slice(i, i + UPSERT_PAGE))
    if (error) return error.message
  }

  const coverRows = covers.map((row) => ({
    user_id: userId,
    category_id: toCloudCategoryId(row.categoryId),
    species_id: row.speciesId,
    specimen_id: row.specimenId,
  }))
  for (let i = 0; i < coverRows.length; i += UPSERT_PAGE) {
    const { error } = await supabase.from('covers').upsert(coverRows.slice(i, i + UPSERT_PAGE))
    if (error) return error.message
  }

  localStorage.setItem(BACKUP_FP_KEY, fp)
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
    file_hash: string | null
    created_at: string
  }
  type RawCategory = {
    id: string
    name: string
    required_tags: TagId[]
    sort_order: number
    seed: boolean
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
    categories: rawCats.map((row) => ({
      id: fromCloudCategoryId(row.id),
      name: row.name,
      requiredTags: row.required_tags ?? [],
      sortOrder: row.sort_order,
      seed: row.seed,
    })),
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
        fileHash: row.file_hash as string,
        createdAt: new Date(row.created_at).getTime(),
      })),
    covers: rawCovers.map((row) => ({
      categoryId: fromCloudCategoryId(row.category_id),
      speciesId: row.species_id,
      specimenId: row.specimen_id,
    })),
  }
}
