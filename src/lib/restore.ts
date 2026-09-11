import { ingestFile } from './collection'
import { db, ensureCustomCategoryTags, ensureSeedCategories } from './db'
import { applyCategoryPull } from './categorySync'
import { extraTagList, cropTagsFromFields, isSilhouette } from './tags'
import { cropHeightForTags } from '../data/tagCrops'
import { hashBlob } from './hash'
import { newId } from './id'
import { isProbablyImageFile, makeImageVariants } from './images'
import { planCloudPhotoRestore, planGalleryRestore } from './restorePlan'
import { downloadSpecimenOriginal } from './specimenStorage'
import { getSupabase } from './supabase'
import { applyCloudCatalogs, pullCloudCollection, type CloudSpecimen } from './sync'

export type RestoreProgress = {
  phase: 'loading' | 'hashing' | 'downloading' | 'writing'
  current: number
  total: number
}

export type RestoreResult = {
  restored: number
  alreadyLocal: number
  inbox: number
  cloudWithoutPhoto: number
  failed?: number
  downloadError?: string
}

function yieldUi() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0)
  })
}

async function applyCloudCategories(
  cloud: NonNullable<Awaited<ReturnType<typeof pullCloudCollection>>>,
) {
  if (cloud.categories.length > 0) {
    await applyCategoryPull(cloud.categories)
  } else {
    await ensureSeedCategories()
    await ensureCustomCategoryTags()
  }
}

async function applyCloudCovers(cloud: NonNullable<Awaited<ReturnType<typeof pullCloudCollection>>>) {
  for (const cover of cloud.covers) {
    if (await db.specimens.get(cover.specimenId)) {
      await db.covers.put({
        categoryId: cover.categoryId,
        speciesId: cover.speciesId,
        variant: cover.variant ?? '',
        specimenId: cover.specimenId,
      })
    }
  }
}

export async function restoreFromCloud(
  onProgress?: (progress: RestoreProgress) => void,
): Promise<RestoreResult> {
  onProgress?.({ phase: 'loading', current: 0, total: 1 })
  const supabase = getSupabase()
  const cloud = await pullCloudCollection()
  if (!supabase || !cloud) throw new Error('Sign in with Google first')
  if (cloud.specimens.length === 0) {
    throw new Error('No cloud metadata yet. Save tagged specimens while signed in first.')
  }

  await applyCloudCategories(cloud)
  await applyCloudCatalogs(cloud)

  const localWithHash = await db.specimens.filter((row) => Boolean(row.fileHash)).toArray()
  const localHashes = new Set(localWithHash.map((row) => row.fileHash as string))
  const plan = planCloudPhotoRestore(cloud.specimens, localHashes)
  if (plan.download.length === 0 && plan.missingPhoto === cloud.specimens.length) {
    throw new Error(
      'No screenshots in the cloud bucket yet. Backup this collection first, or restore from gallery.',
    )
  }

  const cloudById = new Map(cloud.specimens.map((row) => [row.id, row]))
  let restored = 0
  let failed = 0
  let downloadError: string | undefined
  for (let i = 0; i < plan.download.length; i++) {
    const item = plan.download[i]
    const spec = cloudById.get(item.id)
    onProgress?.({ phase: 'downloading', current: i + 1, total: plan.download.length })
    if (!spec) continue
    const downloaded = await downloadSpecimenOriginal(supabase, item.imagePath)
    if ('error' in downloaded) {
      if (downloaded.error.includes('Storage bucket "specimens"')) {
        throw new Error(downloaded.error)
      }
      failed += 1
      downloadError = downloaded.error
      continue
    }
    // Cloud objects are cropped card JPEGs. fileHash is the gallery screenshot
    // (hashed before crop) so Restore from gallery can match the camera roll.
    try {
      await writeRestoredSpecimen(spec, downloaded.blob, true)
    } catch (err) {
      failed += 1
      downloadError = err instanceof Error ? err.message : 'Could not write screenshot'
      continue
    }
    restored += 1
    if (i % 2 === 0) await yieldUi()
  }

  await applyCloudCovers(cloud)

  return {
    restored,
    alreadyLocal: plan.alreadyLocal,
    inbox: 0,
    cloudWithoutPhoto: plan.missingPhoto,
    failed,
    downloadError,
  }
}

export async function restoreFromGallery(
  files: File[],
  onProgress?: (progress: RestoreProgress) => void,
): Promise<RestoreResult> {
  onProgress?.({ phase: 'loading', current: 0, total: 1 })
  const cloud = await pullCloudCollection()
  if (!cloud) throw new Error('Sign in with Google first')
  if (cloud.specimens.length === 0) {
    throw new Error('No cloud metadata yet. Save tagged specimens while signed in first.')
  }

  await applyCloudCategories(cloud)
  await applyCloudCatalogs(cloud)

  const images = files.filter(isProbablyImageFile)
  const hashed: { hash: string; file: File }[] = []
  for (let i = 0; i < images.length; i++) {
    hashed.push({ hash: await hashBlob(images[i]), file: images[i] })
    if (i % 4 === 0) {
      onProgress?.({ phase: 'hashing', current: i + 1, total: images.length })
      await yieldUi()
    }
  }

  const localWithHash = await db.specimens.filter((row) => Boolean(row.fileHash)).toArray()
  const localHashes = new Set(localWithHash.map((row) => row.fileHash as string))
  const cloudByHash = new Map(cloud.specimens.map((row) => [row.fileHash, row]))
  const plan = planGalleryRestore(
    hashed.map((row) => row.hash),
    cloudByHash,
    localHashes,
  )

  const blobByHash = new Map<string, File>()
  for (const row of hashed) {
    if (!blobByHash.has(row.hash)) blobByHash.set(row.hash, row.file)
  }

  const cloudById = new Map(cloud.specimens.map((row) => [row.id, row]))
  let restored = 0
  for (let i = 0; i < plan.restoreIds.length; i++) {
    const spec = cloudById.get(plan.restoreIds[i])
    if (!spec) continue
    const file = blobByHash.get(spec.fileHash)
    if (!file) continue
    await writeRestoredSpecimen(spec, file, false)
    restored += 1
    if (i % 2 === 0) {
      onProgress?.({ phase: 'writing', current: i + 1, total: plan.restoreIds.length })
      await yieldUi()
    }
  }

  const unmatchedSet = new Set(plan.unmatchedHashes)
  const unmatchedFiles = hashed.filter((row) => unmatchedSet.has(row.hash))
  const seenUnmatched = new Set<string>()
  let inbox = 0
  for (const row of unmatchedFiles) {
    if (seenUnmatched.has(row.hash)) continue
    seenUnmatched.add(row.hash)
    await ingestFile(row.file)
    inbox += 1
  }

  await applyCloudCovers(cloud)

  return {
    restored,
    alreadyLocal: plan.alreadyLocalHashes.length,
    inbox,
    cloudWithoutPhoto: cloud.specimens.filter((row) => !blobByHash.has(row.fileHash)).length,
  }
}

async function writeRestoredSpecimen(spec: CloudSpecimen, file: Blob, alreadyCropped: boolean) {
  if (await db.specimens.get(spec.id)) return
  const heightMap = Object.fromEntries(
    (await db.tagCrops.toArray()).map((row) => [row.tag, row.height]),
  )
  const variants = alreadyCropped
    ? await makeImageVariants(file)
    : await makeImageVariants(file, cropHeightForTags(cropTagsFromFields(spec), heightMap))
  const imageId = newId()
  await db.transaction('rw', db.images, db.specimens, async () => {
    await db.images.add({ id: imageId, ...variants })
    await db.specimens.add({
      id: spec.id,
      speciesId: spec.speciesId,
      form: spec.form,
      shiny: spec.shiny,
      shadowStatus: spec.shadowStatus,
      costume: spec.costume,
      background: spec.background,
      gender: spec.gender ?? null,
      hundo: spec.hundo,
      nundo: spec.nundo,
      extraTags: extraTagList(spec),
      silhouette: isSilhouette(spec),
      imageId,
      fileHash: spec.fileHash,
      createdAt: spec.createdAt,
      gallerySort: spec.gallerySort,
      cloudBackupPending: false,
    })
  })
}
