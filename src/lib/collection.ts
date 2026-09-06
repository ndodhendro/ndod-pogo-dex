import { colorForCategory, iconForCategory } from '../data/navIcons'
import { categoryOrderPatch } from './categoryOrder'
import { firstGrapheme, normalizeHexColor } from './categoryStyle'
import { coverPurity, pickCoverAfterDelete, shouldAutoReplaceCover } from './covers'
import { db, ensureSeedCategories, type CategoryRow, type InboxRow, type SpecimenRow } from './db'
import { newId } from './id'
import { makeImageVariants } from './images'
import { hashBlob } from './hash'
import { cloudBackupErrorMessage, pickSpecimenToKeepForHash, sameSpecimenMetadata } from './specimenHash'
import { rebaseSpecimenId } from './specimenMerge'
import { pushCategory, pushCategories, pushCover, pushCoversForCategory, pushMetadataAfterSave, deleteCloudCategory, deleteCloudSpecimen } from './sync'
import {
  extraTagList,
  hasAllRequired,
  resolveRequiredTags,
  specimenTags,
  visualKey,
  type SpecimenFields,
  type TagId,
} from './tags'

export async function ingestFile(file: File | Blob): Promise<InboxRow> {
  const variants = await makeImageVariants(file)
  const imageId = newId()
  const inboxId = newId()
  await db.transaction('rw', db.images, db.inbox, async () => {
    await db.images.add({ id: imageId, ...variants })
    await db.inbox.add({
      id: inboxId,
      imageId,
      createdAt: Date.now(),
    })
  })
  return (await db.inbox.get(inboxId))!
}

export async function discardInbox(id: string) {
  const row = await db.inbox.get(id)
  if (!row) return
  await db.transaction('rw', db.inbox, db.images, db.specimens, async () => {
    await db.inbox.delete(id)
    const used = await db.specimens.where('imageId').equals(row.imageId).count()
    if (used === 0) await db.images.delete(row.imageId)
  })
}

export async function saveSpecimenFromInbox(
  inboxId: string,
  fields: SpecimenFields,
): Promise<{ duplicate: boolean; sameScreenshot?: boolean; cloudError?: string }> {
  await ensureSeedCategories()
  const inbox = await db.inbox.get(inboxId)
  if (!inbox) throw new Error('Transfer item is gone')
  const image = await db.images.get(inbox.imageId)
  if (!image?.original) throw new Error('Transfer image is gone')
  const fileHash = await hashBlob(image.original)

  const form = fields.form?.trim() ? fields.form.trim() : null
  const extraTags = extraTagList(fields)
  const sameFiles = await db.specimens.where('fileHash').equals(fileHash).toArray()
  if (sameFiles.length > 0) {
    const keep = pickSpecimenToKeepForHash(sameFiles)
    for (const extra of sameFiles) {
      if (extra.id !== keep.id) await rebaseSpecimenId(extra.id, keep.id)
    }
    const live = (await db.specimens.get(keep.id)) ?? keep
    return saveExistingScreenshot(inbox, live, {
      ...fields,
      form,
      extraTags,
    })
  }

  const specimen: SpecimenRow = {
    id: newId(),
    speciesId: fields.speciesId,
    form,
    shiny: fields.shiny,
    shadowStatus: fields.shadowStatus,
    costume: fields.costume,
    background: fields.background,
    hundo: fields.hundo,
    nundo: fields.nundo,
    extraTags,
    imageId: inbox.imageId,
    fileHash,
    createdAt: Date.now(),
    cloudBackupPending: true,
  }

  const existing = await db.specimens.toArray()
  const duplicate = existing.some((row) => visualKey(row) === visualKey(specimen))
  const incomingTags = specimenTags(specimen)
  const categories = await db.categories.toArray()

  await db.transaction('rw', db.specimens, db.inbox, db.covers, async () => {
    await db.specimens.add(specimen)
    await db.inbox.delete(inboxId)
    for (const category of categories) {
      await maybeSetCover(category, specimen, incomingTags)
    }
  })

  return finishSave(specimen, { duplicate })
}

async function saveExistingScreenshot(
  inbox: InboxRow,
  existing: SpecimenRow,
  fields: SpecimenFields,
): Promise<{ duplicate: boolean; sameScreenshot?: boolean; cloudError?: string }> {
  const updated: SpecimenRow = {
    ...existing,
    speciesId: fields.speciesId,
    form: fields.form,
    shiny: fields.shiny,
    shadowStatus: fields.shadowStatus,
    costume: fields.costume,
    background: fields.background,
    hundo: fields.hundo,
    nundo: fields.nundo,
    extraTags: extraTagList(fields),
    cloudBackupPending: true,
  }
  const unchanged = sameSpecimenMetadata(existing, updated)
  const incomingTags = specimenTags(updated)
  const categories = await db.categories.toArray()

  await db.transaction('rw', db.specimens, db.inbox, db.covers, db.images, async () => {
    if (!unchanged) await db.specimens.put(updated)
    await db.inbox.delete(inbox.id)
    const imageStillUsed =
      (await db.specimens.where('imageId').equals(inbox.imageId).count()) +
      (await db.inbox.where('imageId').equals(inbox.imageId).count())
    if (imageStillUsed === 0) await db.images.delete(inbox.imageId)
    if (!unchanged) {
      for (const category of categories) {
        await maybeSetCover(category, updated, incomingTags)
      }
    }
  })

  const row = unchanged ? existing : updated
  return finishSave(row, { duplicate: unchanged, sameScreenshot: true })
}

async function finishSave(
  specimen: SpecimenRow,
  flags: { duplicate: boolean; sameScreenshot?: boolean },
): Promise<{ duplicate: boolean; sameScreenshot?: boolean; cloudError?: string }> {
  const result = await pushMetadataAfterSave(specimen)
  if (result.kind === 'ok') {
    const live = specimen.fileHash
      ? await db.specimens.where('fileHash').equals(specimen.fileHash).first()
      : await db.specimens.get(specimen.id)
    if (live) await db.specimens.update(live.id, { cloudBackupPending: false })
    return flags
  }
  if (result.kind === 'error') return { ...flags, cloudError: cloudBackupErrorMessage(result.message) }
  return flags
}

async function maybeSetCover(
  category: CategoryRow,
  specimen: SpecimenRow,
  incomingTags: TagId[],
) {
  const current = await db.covers.get([category.id, specimen.speciesId])
  let currentTags: TagId[] | null = null
  if (current) {
    const coverSpecimen = await db.specimens.get(current.specimenId)
    currentTags = coverSpecimen ? specimenTags(coverSpecimen) : null
  }
  if (shouldAutoReplaceCover(category.requiredTags, currentTags, incomingTags)) {
    await db.covers.put({
      categoryId: category.id,
      speciesId: specimen.speciesId,
      specimenId: specimen.id,
    })
  }
}

export async function setAsCover(categoryId: string, specimenId: string) {
  const specimen = await db.specimens.get(specimenId)
  const category = await db.categories.get(categoryId)
  if (!specimen || !category) throw new Error('Missing specimen or category')
  if (coverPurity(specimenTags(specimen), category.requiredTags) == null) {
    throw new Error('This specimen is not in this category')
  }
  await db.covers.put({
    categoryId,
    speciesId: specimen.speciesId,
    specimenId,
  })
  return pushCover(categoryId, specimen.speciesId, specimenId)
}

export async function deleteSpecimen(id: string) {
  const specimen = await db.specimens.get(id)
  if (!specimen) throw new Error('Specimen is gone')
  const { speciesId, imageId } = specimen

  await db.transaction('rw', db.specimens, db.covers, db.images, db.inbox, db.categories, async () => {
    const affectedCovers = await db.covers.where('specimenId').equals(id).toArray()
    await db.specimens.delete(id)
    const imageStillUsed =
      (await db.specimens.where('imageId').equals(imageId).count()) +
      (await db.inbox.where('imageId').equals(imageId).count())
    if (imageStillUsed === 0) await db.images.delete(imageId)

    const remaining = await db.specimens.where('speciesId').equals(speciesId).toArray()
    const remainingForPick = remaining.map((row) => ({
      id: row.id,
      tags: specimenTags(row),
      createdAt: row.createdAt,
    }))
    const categories = await db.categories.toArray()
    for (const cover of affectedCovers) {
      const category = categories.find((row) => row.id === cover.categoryId)
      const nextId = category ? pickCoverAfterDelete(category.requiredTags, remainingForPick) : null
      if (nextId) {
        await db.covers.put({
          categoryId: cover.categoryId,
          speciesId: cover.speciesId,
          specimenId: nextId,
        })
      } else {
        await db.covers.delete([cover.categoryId, cover.speciesId])
      }
    }
  })

  return deleteCloudSpecimen(id, speciesId)
}

function resolvedLook(
  name: string,
  requiredTags: TagId[],
  look?: { emoji?: string; labelColor?: string },
) {
  const draft = { name, requiredTags, emoji: look?.emoji, labelColor: look?.labelColor }
  return {
    emoji: firstGrapheme(look?.emoji ?? '') || iconForCategory(draft),
    labelColor: normalizeHexColor(look?.labelColor) || colorForCategory(draft),
  }
}

export async function addCategory(
  name: string,
  requiredTags: TagId[],
  look?: { emoji?: string; labelColor?: string },
) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')
  const last = await db.categories.orderBy('sortOrder').last()
  const existing = await db.categories.toArray()
  const tags = resolveRequiredTags(requiredTags, {
    name: trimmed,
    takenTags: existing.flatMap((row) => row.requiredTags),
  })
  const row = {
    id: newId(),
    name: trimmed,
    requiredTags: tags,
    sortOrder: (last?.sortOrder ?? 0) + 1,
    seed: false as const,
    cloudBackupPending: true,
    ...resolvedLook(trimmed, tags, look),
  }
  await db.categories.add(row)
  return pushCategory(row)
}

export async function updateCategory(
  id: string,
  name: string,
  requiredTags: TagId[],
  look?: { emoji?: string; labelColor?: string },
) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')
  const row = await db.categories.get(id)
  if (!row) throw new Error('Category is gone')
  const others = (await db.categories.toArray()).filter((row) => row.id !== id)
  const nextTags = resolveRequiredTags(requiredTags, {
    name: trimmed,
    seed: row.seed,
    takenTags: others.flatMap((item) => item.requiredTags),
  })
  const tagsChanged =
    nextTags.length !== row.requiredTags.length ||
    nextTags.some((tag) => !row.requiredTags.includes(tag))
  const updated: CategoryRow = {
    ...row,
    name: trimmed,
    requiredTags: nextTags,
    cloudBackupPending: true,
    ...resolvedLook(trimmed, nextTags, look),
  }

  await db.transaction('rw', db.categories, db.covers, db.specimens, async () => {
    await db.categories.put(updated)
    if (tagsChanged) await refreshCoversForCategory(updated)
  })

  return (await pushCategory(updated)) || (tagsChanged ? await pushCoversForCategory(id) : undefined)
}

export async function refreshCoversForCategory(category: CategoryRow) {
  const covers = await db.covers.where('categoryId').equals(category.id).toArray()
  for (const cover of covers) {
    const spec = await db.specimens.get(cover.specimenId)
    if (!spec || !hasAllRequired(specimenTags(spec), category.requiredTags)) {
      await db.covers.delete([cover.categoryId, cover.speciesId])
    }
  }
  const specimens = await db.specimens.toArray()
  for (const specimen of specimens) {
    await maybeSetCover(category, specimen, specimenTags(specimen))
  }
}

export async function deleteCategory(id: string) {
  const row = await db.categories.get(id)
  if (!row) throw new Error('Category is gone')
  await db.transaction('rw', db.categories, db.covers, async () => {
    await db.covers.where('categoryId').equals(id).delete()
    await db.categories.delete(id)
  })
  return deleteCloudCategory(id)
}

export async function reorderCategories(orderedIds: string[]) {
  const existing = await db.categories.toArray()
  const patch = categoryOrderPatch(
    existing.map((row) => row.id),
    orderedIds,
  )
  await db.transaction('rw', db.categories, async () => {
    await Promise.all(
      patch.map((row) => db.categories.update(row.id, { sortOrder: row.sortOrder, cloudBackupPending: true })),
    )
  })
  return pushCategories()
}

export const SHARE_DB_NAME = 'ndod-pogo-dex-share'
export const SHARE_STORE = 'pending'

export async function importPendingShares() {
  const open = indexedDB.open(SHARE_DB_NAME, 1)
  const shareDb = await new Promise<IDBDatabase | null>((resolve) => {
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(SHARE_STORE)) {
        open.result.createObjectStore(SHARE_STORE, { keyPath: 'id' })
      }
    }
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => resolve(null)
  })
  if (!shareDb) return 0

  const items = await new Promise<{ id: string; blob: Blob }[]>((resolve) => {
    const tx = shareDb.transaction(SHARE_STORE, 'readonly')
    const req = tx.objectStore(SHARE_STORE).getAll()
    req.onsuccess = () => resolve(req.result as { id: string; blob: Blob }[])
    req.onerror = () => resolve([])
  })

  for (const item of items) {
    try {
      await ingestFile(item.blob)
    } catch {
      // Keep the share row so the user can retry from Transfer refresh.
      continue
    }
    await new Promise<void>((resolve) => {
      const tx = shareDb.transaction(SHARE_STORE, 'readwrite')
      tx.objectStore(SHARE_STORE).delete(item.id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  }
  shareDb.close()
  return items.length
}
