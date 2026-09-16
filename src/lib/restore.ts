import type { RestoreProgress } from './restoreProgress'
import { ingestFile } from './collection'
import { db, ensureCustomCategoryTags, ensureSeedCategories } from './db'
import { applyCategoryPull } from './categorySync'
import { extraTagList, cropTagsFromFields, isNotPure, isSilhouette } from './tags'
import { cropHeightForSpecimen } from '../data/tagCrops'
import { hashBlob } from './hash'
import { newId } from './id'
import { restoredScreenshotFileName } from './screenshotFileName'
import { isProbablyImageFile, makeImageVariants } from './images'
import { planCloudPhotoRestore, planGalleryRestore } from './restorePlan'
import { downloadSpecimenOriginal } from './specimenStorage'
import { getSupabase } from './supabase'
import { applyCloudCatalogs, pullCloudCollection, type CloudSpecimen } from './sync'
import { yieldUi } from './yieldUi'

export type { RestoreProgress } from './restoreProgress'

export type RestoreResult = {
  restored: number
  alreadyLocal: number
  inbox: number
  cloudWithoutPhoto: number
  failed?: number
  downloadError?: string
}

function isQuotaError(err: unknown) {
  return err instanceof DOMException && err.name === 'QuotaExceededError'
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
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
  await yieldUi()
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
  if (plan.download.length > 0) {
    onProgress?.({ phase: 'downloading', current: 0, total: plan.download.length })
    await yieldUi()
  }
  for (let i = 0; i < plan.download.length; i++) {
    const item = plan.download[i]
    const spec = cloudById.get(item.id)
    onProgress?.({ phase: 'downloading', current: i + 1, total: plan.download.length })
    await yieldUi()
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
  const images = files.filter(isProbablyImageFile)
  if (images.length === 0) throw new Error('No photos in that selection.')

  // Hash before any network so gallery File blobs stay readable (Android / large picks).
  onProgress?.({ phase: 'hashing', current: 0, total: images.length })
  await yieldUi()
  const hashed: { hash: string; file: File }[] = []
  const cloudPromise = pullCloudCollection()
  for (let i = 0; i < images.length; i++) {
    hashed.push({ hash: await hashBlob(images[i]), file: images[i] })
    onProgress?.({ phase: 'hashing', current: i + 1, total: images.length })
    await yieldUi()
  }

  onProgress?.({ phase: 'loading', current: 0, total: 1 })
  await yieldUi()
  const cloud = await cloudPromise
  if (!cloud) throw new Error('Sign in with Google first')

  await applyCloudCategories(cloud)
  await applyCloudCatalogs(cloud)

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
  let failed = 0
  let lastError: string | undefined
  if (plan.restoreIds.length > 0) {
    onProgress?.({ phase: 'writing', current: 0, total: plan.restoreIds.length })
    await yieldUi()
  }
  for (let i = 0; i < plan.restoreIds.length; i++) {
    const spec = cloudById.get(plan.restoreIds[i])
    onProgress?.({ phase: 'writing', current: i + 1, total: plan.restoreIds.length })
    await yieldUi()
    if (!spec) continue
    const file = blobByHash.get(spec.fileHash)
    if (!file) continue
    try {
      await writeRestoredSpecimen(spec, file, false)
      restored += 1
    } catch (err) {
      failed += 1
      lastError = errorMessage(err, 'Could not restore screenshot')
      if (isQuotaError(err)) break
    }
  }

  const unmatchedSet = new Set(plan.unmatchedHashes)
  const unmatchedFiles = hashed.filter((row) => unmatchedSet.has(row.hash))
  const seenUnmatched = new Set<string>()
  let inbox = 0
  let unmatchedIndex = 0
  const inboxTotal = plan.unmatchedHashes.length
  if (inboxTotal > 0) {
    onProgress?.({ phase: 'inbox', current: 0, total: inboxTotal })
    await yieldUi()
  }
  for (const row of unmatchedFiles) {
    if (seenUnmatched.has(row.hash)) continue
    seenUnmatched.add(row.hash)
    unmatchedIndex += 1
    onProgress?.({
      phase: 'inbox',
      current: unmatchedIndex,
      total: inboxTotal || unmatchedIndex,
    })
    await yieldUi()
    try {
      await ingestFile(row.file)
      inbox += 1
    } catch (err) {
      failed += 1
      lastError = errorMessage(err, 'Could not add screenshot')
      if (isQuotaError(err)) break
    }
  }

  await applyCloudCovers(cloud)

  return {
    restored,
    alreadyLocal: plan.alreadyLocalHashes.length,
    inbox,
    cloudWithoutPhoto: cloud.specimens.filter((row) => !blobByHash.has(row.fileHash)).length,
    failed,
    downloadError: lastError,
  }
}

async function writeRestoredSpecimen(spec: CloudSpecimen, file: Blob, alreadyCropped: boolean) {
  if (await db.specimens.get(spec.id)) return
  const heightMap = Object.fromEntries(
    (await db.tagCrops.toArray()).map((row) => [row.tag, row.height]),
  )
  const variants = alreadyCropped
    ? await makeImageVariants(file)
    : await makeImageVariants(
        file,
        cropHeightForSpecimen(cropTagsFromFields(spec), heightMap, isSilhouette(spec)),
      )
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
      notPure: isNotPure(spec),
      imageId,
      fileHash: spec.fileHash,
      fileName: restoredScreenshotFileName(file, spec.fileName),
      createdAt: spec.createdAt,
      gallerySort: spec.gallerySort,
      cloudBackupPending: false,
    })
  })
}
