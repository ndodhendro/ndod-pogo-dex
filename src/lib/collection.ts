import { coverPurity, shouldAutoReplaceCover } from './covers'
import { db, ensureSeedCategories, type CategoryRow, type InboxRow, type SpecimenRow } from './db'
import { makeImageVariants } from './images'
import {
  specimenTags,
  visualKey,
  type SpecimenFields,
  type TagId,
} from './tags'

export async function ingestFile(file: File | Blob): Promise<InboxRow> {
  const variants = await makeImageVariants(file)
  const imageId = crypto.randomUUID()
  const inboxId = crypto.randomUUID()
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
  await db.transaction('rw', db.inbox, db.images, async () => {
    await db.inbox.delete(id)
    const used = await db.specimens.where('imageId').equals(row.imageId).count()
    if (used === 0) await db.images.delete(row.imageId)
  })
}

export async function saveSpecimenFromInbox(
  inboxId: string,
  fields: SpecimenFields,
): Promise<{ duplicate: boolean }> {
  await ensureSeedCategories()
  const inbox = await db.inbox.get(inboxId)
  if (!inbox) throw new Error('Inbox item is gone')

  const specimen: SpecimenRow = {
    id: crypto.randomUUID(),
    speciesId: fields.speciesId,
    form: fields.form?.trim() ? fields.form.trim() : null,
    shiny: fields.shiny,
    shadowStatus: fields.shadowStatus,
    costume: fields.costume,
    background: fields.background,
    hundo: fields.hundo,
    nundo: fields.nundo,
    imageId: inbox.imageId,
    createdAt: Date.now(),
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

  return { duplicate }
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
}

export async function addCategory(name: string, requiredTags: TagId[]) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')
  const last = await db.categories.orderBy('sortOrder').last()
  await db.categories.add({
    id: crypto.randomUUID(),
    name: trimmed,
    requiredTags: [...new Set(requiredTags)],
    sortOrder: (last?.sortOrder ?? 0) + 1,
    seed: false,
  })
}

export async function deleteCategory(id: string) {
  const row = await db.categories.get(id)
  if (!row || row.seed) throw new Error('Seed categories cannot be removed')
  await db.transaction('rw', db.categories, db.covers, async () => {
    await db.covers.where('categoryId').equals(id).delete()
    await db.categories.delete(id)
  })
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
      // Keep the share row so the user can retry from Inbox refresh.
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
