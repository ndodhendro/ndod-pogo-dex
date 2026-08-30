import { ingestFile } from './collection'
import { db, ensureSeedCategories } from './db'
import { hashBlob } from './hash'
import { makeImageVariants } from './images'
import { planGalleryRestore } from './restorePlan'
import { pullCloudCollection, type CloudSpecimen } from './sync'

export type RestoreProgress = {
  phase: 'loading' | 'hashing' | 'writing'
  current: number
  total: number
}

export type RestoreResult = {
  restored: number
  alreadyLocal: number
  inbox: number
  cloudWithoutPhoto: number
}

function yieldUi() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0)
  })
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

  await ensureSeedCategories()
  if (cloud.categories.length > 0) {
    await db.categories.bulkPut(cloud.categories)
  }

  const images = files.filter((file) => file.type.startsWith('image/') || !file.type)
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
    await writeRestoredSpecimen(spec, file)
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

  for (const cover of cloud.covers) {
    if (await db.specimens.get(cover.specimenId)) {
      await db.covers.put(cover)
    }
  }

  return {
    restored,
    alreadyLocal: plan.alreadyLocalHashes.length,
    inbox,
    cloudWithoutPhoto: cloud.specimens.filter((row) => !blobByHash.has(row.fileHash)).length,
  }
}

async function writeRestoredSpecimen(spec: CloudSpecimen, file: File) {
  if (await db.specimens.get(spec.id)) return
  const variants = await makeImageVariants(file)
  const imageId = crypto.randomUUID()
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
      hundo: spec.hundo,
      nundo: spec.nundo,
      imageId,
      fileHash: spec.fileHash,
      createdAt: spec.createdAt,
    })
  })
}
