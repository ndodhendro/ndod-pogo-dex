import { forgetImageUrls } from '../hooks/useImageUrl'
import { colorForCategory, iconForCategory } from '../data/navIcons'
import { categoryOrderPatch } from './categoryOrder'
import { firstGrapheme, normalizeHexColor } from './categoryStyle'
import { coverMutationsAfterEdit, coverPurity, pickCoverAfterDelete, shouldAutoReplaceCover } from './covers'
import { db, ensureSeedCategories, type CategoryRow, type InboxRow, type SpecimenRow, type TagCatalogRow } from './db'
import { galleryOrderPatch } from './galleryOrder'
import { newId } from './id'
import { cropBottomFromBlob, makeImageVariants } from './images'
import { hashBlob } from './hash'
import {
  collectScreenshotFileNameKeys,
  DuplicateScreenshotFileNameError,
  screenshotFileName,
  screenshotFileNameIsTaken,
  screenshotFileNameKey,
} from './screenshotFileName'
import { cloudBackupErrorMessage, pickSpecimenToKeepForHash, sameSpecimenMetadata } from './specimenHash'
import { rebaseSpecimenId } from './specimenMerge'
import {
  pushCategory,
  pushCategories,
  pushCover,
  pushCoversForCategory,
  pushMetadataAfterSave,
  pushTagCatalog,
  pushTagRosterEntry,
  deleteCloudCategory,
  deleteCloudSpecimen,
  deleteCloudTagRosterEntry,
  pushSpecimenGallerySort,
} from './sync'
import { removeSpecimenPhoto } from './specimenStorage'
import {
  defaultLimitPokedex,
  defaultSlotMode,
  normalizeVariant,
  slotVariantForTrack,
  specimenFillsSlot,
  type SlotMode,
} from './roster'
import { appendInboxDiscardLog, appendTransferLog, appendDuplicateFileNameLog, replaceTransferLogTimes } from './transferLogs'
import {
  extraTagList,
  isNotPure,
  isSilhouette,
  pickDuplicateLook,
  pickDuplicateLookForEdit,
  resolveRequiredTags,
  specimenTags,
  type SpecimenFields,
  type TagId,
} from './tags'

export async function loadTakenScreenshotFileNames(): Promise<Set<string>> {
  const [inbox, specimens] = await Promise.all([db.inbox.toArray(), db.specimens.toArray()])
  return collectScreenshotFileNameKeys([...inbox, ...specimens])
}

async function findScreenshotFileOwner(
  fileName: string,
): Promise<{ id: string; imageId: string } | undefined> {
  const key = screenshotFileNameKey(fileName)
  if (!key) return undefined
  const inbox = await db.inbox.toArray()
  const inboxHit = inbox.find((row) => screenshotFileNameKey(row.fileName) === key)
  if (inboxHit) return { id: inboxHit.id, imageId: inboxHit.imageId }
  const specimens = await db.specimens.toArray()
  const specimenHit = specimens.find((row) => screenshotFileNameKey(row.fileName) === key)
  if (specimenHit) return { id: specimenHit.id, imageId: specimenHit.imageId }
  return undefined
}

export async function ingestFile(
  file: File | Blob,
  fileName?: string | null,
  takenNames?: Set<string>,
): Promise<InboxRow> {
  const name = screenshotFileName(fileName) ?? screenshotFileName(file)
  const taken = takenNames ?? (await loadTakenScreenshotFileNames())
  if (name && screenshotFileNameIsTaken(name, taken)) {
    await appendDuplicateFileNameLog(name, await findScreenshotFileOwner(name))
    throw new DuplicateScreenshotFileNameError(name)
  }
  const variants = await makeImageVariants(file)
  const imageId = newId()
  const inboxId = newId()
  await db.transaction('rw', db.images, db.inbox, async () => {
    await db.images.add({ id: imageId, ...variants })
    await db.inbox.add({
      id: inboxId,
      imageId,
      fileName: name,
      createdAt: Date.now(),
    })
  })
  const key = screenshotFileNameKey(name)
  if (key) taken.add(key)
  return (await db.inbox.get(inboxId))!
}

export async function discardInbox(id: string) {
  const row = await db.inbox.get(id)
  if (!row) return
  let droppedImage = false
  await db.transaction('rw', db.inbox, db.images, db.specimens, db.transferLogs, async () => {
    await appendInboxDiscardLog(row)
    await db.inbox.delete(id)
    const used = await db.specimens.where('imageId').equals(row.imageId).count()
    if (used === 0) {
      await db.images.delete(row.imageId)
      droppedImage = true
    }
  })
  if (droppedImage) forgetImageUrls(row.imageId)
}

export async function discardAllInbox() {
  const rows = await db.inbox.toArray()
  if (rows.length === 0) return 0
  const imageIds = [...new Set(rows.map((row) => row.imageId))]
  let droppedImageIds: string[] = []
  await db.transaction('rw', db.inbox, db.images, db.specimens, async () => {
    await db.inbox.clear()
    droppedImageIds = []
    for (const imageId of imageIds) {
      const used = await db.specimens.where('imageId').equals(imageId).count()
      if (used === 0) droppedImageIds.push(imageId)
    }
    if (droppedImageIds.length > 0) await db.images.bulkDelete(droppedImageIds)
  })
  for (const imageId of droppedImageIds) forgetImageUrls(imageId)
  return rows.length
}

export async function saveSpecimenFromInbox(
  inboxId: string,
  fields: SpecimenFields,
  cropBottom: number,
): Promise<{
  duplicate: boolean
  sameScreenshot?: boolean
  cloudError?: string
  existing?: SpecimenRow
}> {
  await ensureSeedCategories()
  const inbox = await db.inbox.get(inboxId)
  if (!inbox) throw new Error('Transfer item is gone')
  const image = await db.images.get(inbox.imageId)
  if (!image?.original) throw new Error('Transfer image is gone')
  // Hash the gallery screenshot before crop so Restore from gallery can match camera-roll files.
  const fileHash = await hashBlob(image.original)
  const form = fields.form?.trim() ? fields.form.trim() : null
  const extraTags = extraTagList(fields)
  const sameFiles = await db.specimens.where('fileHash').equals(fileHash).toArray()
  if (sameFiles.length === 0) {
    const match = pickDuplicateLook(await db.specimens.toArray(), {
      ...fields,
      form,
      extraTags,
    })
    if (match) return { duplicate: true, existing: match }
  }

  const variants = await makeImageVariants(image.original, cropBottom)
  await db.images.update(inbox.imageId, variants)
  forgetImageUrls(inbox.imageId)

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
    gender: fields.gender ?? null,
    hundo: fields.hundo,
    nundo: fields.nundo,
    extraTags,
    silhouette: isSilhouette(fields),
    notPure: isNotPure(fields),
    imageId: inbox.imageId,
    fileHash,
    fileName: inbox.fileName ?? null,
    createdAt: Date.now(),
    cloudBackupPending: true,
  }
  const incomingTags = specimenTags(specimen)
  const categories = await db.categories.toArray()
  const catalogs = await db.tagCatalogs.toArray()

  await db.transaction('rw', db.specimens, db.inbox, db.covers, db.images, db.transferLogs, async () => {
    await db.specimens.add(specimen)
    await db.inbox.delete(inboxId)
    for (const category of categories) {
      await maybeSetCover(category, specimen, incomingTags, catalogs)
    }
    await appendTransferLog(specimen, 'save')
  })

  return finishSave(specimen, { duplicate: false })
}

export async function replaceSpecimenFromInbox(
  inboxId: string,
  existingId: string,
  fields: SpecimenFields,
  cropBottom: number,
): Promise<{ cloudError?: string; specimen: SpecimenRow }> {
  await ensureSeedCategories()
  const inbox = await db.inbox.get(inboxId)
  if (!inbox) throw new Error('Transfer item is gone')
  const existing = await db.specimens.get(existingId)
  if (!existing) throw new Error('Specimen is gone')
  const image = await db.images.get(inbox.imageId)
  if (!image?.original) throw new Error('Transfer image is gone')

  const fileHash = await hashBlob(image.original)
  const variants = await makeImageVariants(image.original, cropBottom)
  await db.images.update(inbox.imageId, variants)
  forgetImageUrls(inbox.imageId)

  const form = fields.form?.trim() ? fields.form.trim() : null
  const extraTags = extraTagList(fields)
  const updated: SpecimenRow = {
    ...existing,
    speciesId: fields.speciesId,
    form,
    shiny: fields.shiny,
    shadowStatus: fields.shadowStatus,
    costume: fields.costume,
    background: fields.background,
    gender: fields.gender ?? null,
    hundo: fields.hundo,
    nundo: fields.nundo,
    extraTags,
    silhouette: isSilhouette(fields),
    notPure: isNotPure(fields),
    imageId: inbox.imageId,
    fileHash,
    fileName: inbox.fileName ?? existing.fileName ?? null,
    cloudBackupPending: true,
  }
  const oldImageId = existing.imageId
  const oldHash = existing.fileHash
  const catalogs = await db.tagCatalogs.toArray()

  await db.transaction(
    'rw',
    [db.specimens, db.inbox, db.covers, db.images, db.categories, db.transferLogs],
    async () => {
    const { deletedAt, savedAt } = replaceTransferLogTimes()
    await appendTransferLog(existing, 'delete', deletedAt, { prune: false })
    await db.specimens.put(updated)
    await db.inbox.delete(inboxId)
    const imageStillUsed =
      (await db.specimens.where('imageId').equals(oldImageId).count()) +
      (await db.inbox.where('imageId').equals(oldImageId).count())
    if (oldImageId !== inbox.imageId && imageStillUsed === 0) await db.images.delete(oldImageId)

    const specimens = await db.specimens.toArray()
    const categories = await db.categories.toArray()
    const covers = await db.covers.toArray()
    const mutations = coverMutationsAfterEdit(
      existing,
      updated,
      categories,
      covers,
      specimens,
      catalogs,
    )
    for (const mutation of mutations) {
      if (mutation.op === 'put') {
        await db.covers.put({
          categoryId: mutation.categoryId,
          speciesId: mutation.speciesId,
          variant: mutation.variant,
          specimenId: mutation.specimenId,
        })
      } else {
        await db.covers.delete([mutation.categoryId, mutation.speciesId, mutation.variant])
      }
    }
    await appendTransferLog(updated, 'save', savedAt)
  })

  if (oldImageId !== inbox.imageId) forgetImageUrls(oldImageId)

  const saved = await finishSave(updated, { duplicate: false })
  if (
    oldHash &&
    oldHash !== fileHash &&
    saved.specimen.cloudBackupPending === false
  ) {
    await removeSpecimenPhoto(oldHash)
  }
  return { cloudError: saved.cloudError, specimen: saved.specimen }
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
    gender: fields.gender ?? null,
    hundo: fields.hundo,
    nundo: fields.nundo,
    extraTags: extraTagList(fields),
    silhouette: isSilhouette(fields),
    notPure: isNotPure(fields),
    fileName: inbox.fileName ?? existing.fileName ?? null,
    cloudBackupPending: true,
  }
  const unchanged = sameSpecimenMetadata(existing, updated)
  const incomingTags = specimenTags(updated)
  const categories = await db.categories.toArray()
  const catalogs = await db.tagCatalogs.toArray()

  await db.transaction('rw', db.specimens, db.inbox, db.covers, db.images, db.transferLogs, async () => {
    if (!unchanged) await db.specimens.put(updated)
    else if ((updated.fileName ?? null) !== (existing.fileName ?? null)) {
      await db.specimens.update(existing.id, {
        fileName: updated.fileName ?? null,
        cloudBackupPending: true,
      })
    }
    await db.inbox.delete(inbox.id)
    const imageStillUsed =
      (await db.specimens.where('imageId').equals(inbox.imageId).count()) +
      (await db.inbox.where('imageId').equals(inbox.imageId).count())
    if (imageStillUsed === 0) await db.images.delete(inbox.imageId)
    if (!unchanged) {
      for (const category of categories) {
        await maybeSetCover(category, updated, incomingTags, catalogs)
      }
    }
    await appendTransferLog(updated, 'save')
  })

  const row = unchanged ? existing : updated
  return finishSave(row, { duplicate: unchanged, sameScreenshot: true })
}

export async function updateSpecimen(
  id: string,
  fields: SpecimenFields,
  cropBottom: number,
): Promise<{ duplicate: boolean; existing?: SpecimenRow; cloudError?: string; specimen: SpecimenRow }> {
  const existing = await db.specimens.get(id)
  if (!existing) throw new Error('Specimen is gone')
  const image = await db.images.get(existing.imageId)
  if (!image?.original) throw new Error('Image is gone')

  const form = fields.form?.trim() ? fields.form.trim() : null
  const extraTags = extraTagList(fields)
  const updated: SpecimenRow = {
    ...existing,
    speciesId: fields.speciesId,
    form,
    shiny: fields.shiny,
    shadowStatus: fields.shadowStatus,
    costume: fields.costume,
    background: fields.background,
    gender: fields.gender ?? null,
    hundo: fields.hundo,
    nundo: fields.nundo,
    extraTags,
    silhouette: isSilhouette(fields),
    notPure: isNotPure(fields),
    cloudBackupPending: true,
  }
  const others = await db.specimens.toArray()
  const match = pickDuplicateLookForEdit(existing, others, updated)
  if (match) return { duplicate: true, existing: match, specimen: existing }

  const metaUnchanged = sameSpecimenMetadata(existing, updated)
  const currentCrop = await cropBottomFromBlob(image.original)
  const cropChanged = currentCrop !== cropBottom

  if (cropChanged) {
    const variants = await makeImageVariants(image.original, cropBottom)
    await db.images.update(existing.imageId, variants)
    forgetImageUrls(existing.imageId)
    updated.fileHash = await hashBlob(variants.original)
  }

  if (metaUnchanged && !cropChanged) {
    return { duplicate: false, specimen: existing }
  }

  const catalogs = await db.tagCatalogs.toArray()

  await db.transaction('rw', db.specimens, db.covers, db.categories, db.images, db.transferLogs, async () => {
    await db.specimens.put(updated)
    const specimens = await db.specimens.toArray()
    const categories = await db.categories.toArray()
    const covers = await db.covers.toArray()
    const mutations = coverMutationsAfterEdit(
      existing,
      updated,
      categories,
      covers,
      specimens,
      catalogs,
    )
    for (const mutation of mutations) {
      if (mutation.op === 'put') {
        await db.covers.put({
          categoryId: mutation.categoryId,
          speciesId: mutation.speciesId,
          variant: mutation.variant,
          specimenId: mutation.specimenId,
        })
      } else {
        await db.covers.delete([mutation.categoryId, mutation.speciesId, mutation.variant])
      }
    }
    await appendTransferLog(updated, 'edit')
  })

  const extraSpecies = existing.speciesId === updated.speciesId ? [] : [existing.speciesId]
  const saved = await finishSave(updated, { duplicate: false }, extraSpecies)
  if (
    cropChanged &&
    existing.fileHash &&
    existing.fileHash !== updated.fileHash &&
    saved.specimen.cloudBackupPending === false
  ) {
    await removeSpecimenPhoto(existing.fileHash)
  }
  return saved
}

export async function replaceSpecimenLook(
  editedId: string,
  existingId: string,
  fields: SpecimenFields,
  cropBottom: number,
): Promise<{ cloudError?: string; specimen: SpecimenRow }> {
  const edited = await db.specimens.get(editedId)
  if (!edited) throw new Error('Specimen is gone')
  const current = await db.specimens.get(existingId)
  if (!current) throw new Error('Specimen is gone')
  const image = await db.images.get(edited.imageId)
  if (!image?.original) throw new Error('Image is gone')

  const form = fields.form?.trim() ? fields.form.trim() : null
  const extraTags = extraTagList(fields)
  const updated: SpecimenRow = {
    ...edited,
    speciesId: fields.speciesId,
    form,
    shiny: fields.shiny,
    shadowStatus: fields.shadowStatus,
    costume: fields.costume,
    background: fields.background,
    gender: fields.gender ?? null,
    hundo: fields.hundo,
    nundo: fields.nundo,
    extraTags,
    silhouette: isSilhouette(fields),
    notPure: isNotPure(fields),
    cloudBackupPending: true,
  }
  const currentCrop = await cropBottomFromBlob(image.original)
  const cropChanged = currentCrop !== cropBottom
  if (cropChanged) {
    const variants = await makeImageVariants(image.original, cropBottom)
    await db.images.update(edited.imageId, variants)
    forgetImageUrls(edited.imageId)
    updated.fileHash = await hashBlob(variants.original)
  }

  const catalogs = await db.tagCatalogs.toArray()
  const currentImageId = current.imageId
  const currentHash = current.fileHash
  const currentSpeciesId = current.speciesId

  await db.transaction(
    'rw',
    [db.specimens, db.covers, db.categories, db.images, db.inbox, db.transferLogs],
    async () => {
      const { deletedAt, savedAt } = replaceTransferLogTimes()
      await appendTransferLog(current, 'delete', deletedAt, { prune: false })
      await db.specimens.put(updated)
      await db.specimens.delete(existingId)
      const imageStillUsed =
        (await db.specimens.where('imageId').equals(currentImageId).count()) +
        (await db.inbox.where('imageId').equals(currentImageId).count())
      if (imageStillUsed === 0) await db.images.delete(currentImageId)

      const remaining = await db.specimens.where('speciesId').equals(currentSpeciesId).toArray()
      const categories = await db.categories.toArray()
      const affectedCovers = await db.covers.where('specimenId').equals(existingId).toArray()
      for (const cover of affectedCovers) {
        const category = categories.find((row) => row.id === cover.categoryId)
        const variant = cover.variant ?? ''
        const remainingForPick = remaining
          .filter(
            (row) =>
              category &&
              specimenFillsSlot(
                row,
                category.requiredTags,
                { speciesId: cover.speciesId, variant, name: '' },
                catalogs,
              ),
          )
          .map((row) => ({
            id: row.id,
            tags: specimenTags(row),
            createdAt: row.createdAt,
            silhouette: isSilhouette(row),
            notPure: isNotPure(row),
            gender: row.gender,
          }))
        const nextId = category
          ? pickCoverAfterDelete(category.requiredTags, remainingForPick, cover.speciesId)
          : null
        if (nextId) {
          await db.covers.put({
            categoryId: cover.categoryId,
            speciesId: cover.speciesId,
            variant,
            specimenId: nextId,
          })
        } else {
          await db.covers.delete([cover.categoryId, cover.speciesId, variant])
        }
      }

      const specimens = await db.specimens.toArray()
      const covers = await db.covers.toArray()
      const mutations = coverMutationsAfterEdit(
        edited,
        updated,
        categories,
        covers,
        specimens,
        catalogs,
      )
      for (const mutation of mutations) {
        if (mutation.op === 'put') {
          await db.covers.put({
            categoryId: mutation.categoryId,
            speciesId: mutation.speciesId,
            variant: mutation.variant,
            specimenId: mutation.specimenId,
          })
        } else {
          await db.covers.delete([mutation.categoryId, mutation.speciesId, mutation.variant])
        }
      }
      await appendTransferLog(updated, 'edit', savedAt)
    },
  )

  if (currentImageId !== edited.imageId) forgetImageUrls(currentImageId)

  const extraSpecies = [
    ...(edited.speciesId === updated.speciesId ? [] : [edited.speciesId]),
    ...(currentSpeciesId === updated.speciesId ? [] : [currentSpeciesId]),
  ]
  const saved = await finishSave(updated, { duplicate: false }, extraSpecies)
  const cloudDelete = await deleteCloudSpecimen(existingId, currentSpeciesId, currentHash)
  if (
    cropChanged &&
    edited.fileHash &&
    edited.fileHash !== updated.fileHash &&
    saved.specimen.cloudBackupPending === false
  ) {
    await removeSpecimenPhoto(edited.fileHash)
  }
  return { cloudError: saved.cloudError || cloudDelete, specimen: saved.specimen }
}

async function finishSave(
  specimen: SpecimenRow,
  flags: { duplicate: boolean; sameScreenshot?: boolean },
  extraSpeciesIds: number[] = [],
): Promise<{ duplicate: boolean; sameScreenshot?: boolean; cloudError?: string; specimen: SpecimenRow }> {
  const result = await pushMetadataAfterSave(specimen, extraSpeciesIds)
  if (result.kind === 'ok') {
    const live = specimen.fileHash
      ? await db.specimens.where('fileHash').equals(specimen.fileHash).first()
      : await db.specimens.get(specimen.id)
    if (live) await db.specimens.update(live.id, { cloudBackupPending: false })
    return { ...flags, specimen: live ?? specimen }
  }
  if (result.kind === 'error') {
    return { ...flags, cloudError: cloudBackupErrorMessage(result.message), specimen }
  }
  return { ...flags, specimen }
}

async function maybeSetCover(
  category: CategoryRow,
  specimen: SpecimenRow,
  incomingTags: TagId[],
  catalogs: TagCatalogRow[],
) {
  const variant = slotVariantForTrack(specimen, category.requiredTags, catalogs)
  const current = await db.covers.get([category.id, specimen.speciesId, variant])
  let currentTags: TagId[] | null = null
  let currentSilhouette = false
  let currentNotPure = false
  let currentGender: string | null | undefined
  if (current) {
    const coverSpecimen = await db.specimens.get(current.specimenId)
    currentTags = coverSpecimen ? specimenTags(coverSpecimen) : null
    currentSilhouette = isSilhouette(coverSpecimen)
    currentNotPure = isNotPure(coverSpecimen)
    currentGender = coverSpecimen?.gender
  }
  if (
    shouldAutoReplaceCover(category.requiredTags, currentTags, incomingTags, {
      currentSilhouette,
      incomingSilhouette: isSilhouette(specimen),
      currentNotPure,
      incomingNotPure: isNotPure(specimen),
      speciesId: specimen.speciesId,
      currentGender,
      incomingGender: specimen.gender,
    })
  ) {
    await db.covers.put({
      categoryId: category.id,
      speciesId: specimen.speciesId,
      variant,
      specimenId: specimen.id,
    })
  }
}

export async function setAsCover(categoryId: string, specimenId: string) {
  const specimen = await db.specimens.get(specimenId)
  const category = await db.categories.get(categoryId)
  if (!specimen || !category) throw new Error('Missing specimen or category')
  if (coverPurity(specimenTags(specimen), category.requiredTags, isSilhouette(specimen), specimen.speciesId, specimen.gender, isNotPure(specimen)) == null) {
    throw new Error('This specimen is not in this category')
  }
  const catalogs = await db.tagCatalogs.toArray()
  const variant = slotVariantForTrack(specimen, category.requiredTags, catalogs)
  await db.covers.put({
    categoryId,
    speciesId: specimen.speciesId,
    variant,
    specimenId,
  })
  return pushCover(categoryId, specimen.speciesId, specimenId, variant)
}

export async function deleteSpecimen(id: string) {
  const specimen = await db.specimens.get(id)
  if (!specimen) throw new Error('Specimen is gone')
  const { speciesId, imageId } = specimen
  const catalogs = await db.tagCatalogs.toArray()

  await db.transaction(
    'rw',
    [db.specimens, db.covers, db.images, db.inbox, db.categories, db.transferLogs],
    async () => {
    const affectedCovers = await db.covers.where('specimenId').equals(id).toArray()
    await appendTransferLog(specimen, 'delete')
    await db.specimens.delete(id)
    const imageStillUsed =
      (await db.specimens.where('imageId').equals(imageId).count()) +
      (await db.inbox.where('imageId').equals(imageId).count())
    if (imageStillUsed === 0) await db.images.delete(imageId)

    const remaining = await db.specimens.where('speciesId').equals(speciesId).toArray()
    const categories = await db.categories.toArray()
    for (const cover of affectedCovers) {
      const category = categories.find((row) => row.id === cover.categoryId)
      const variant = cover.variant ?? ''
      const remainingForPick = remaining
        .filter(
          (row) =>
            category &&
            specimenFillsSlot(
              row,
              category.requiredTags,
              { speciesId: cover.speciesId, variant, name: '' },
              catalogs,
            ),
        )
        .map((row) => ({
          id: row.id,
          tags: specimenTags(row),
          createdAt: row.createdAt,
          silhouette: isSilhouette(row),
          notPure: isNotPure(row),
          gender: row.gender,
        }))
      const nextId = category
        ? pickCoverAfterDelete(category.requiredTags, remainingForPick, cover.speciesId)
        : null
      if (nextId) {
        await db.covers.put({
          categoryId: cover.categoryId,
          speciesId: cover.speciesId,
          variant,
          specimenId: nextId,
        })
      } else {
        await db.covers.delete([cover.categoryId, cover.speciesId, variant])
      }
    }
  })

  return deleteCloudSpecimen(id, speciesId, specimen.fileHash)
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
  return pushCategory(row, { syncOrder: true })
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
  if (!row) throw new Error('Tag is gone')
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
  const catalogs = await db.tagCatalogs.toArray()
  const covers = await db.covers.where('categoryId').equals(category.id).toArray()
  for (const cover of covers) {
    const spec = await db.specimens.get(cover.specimenId)
    const variant = cover.variant ?? ''
    if (
      !spec ||
      !specimenFillsSlot(
        spec,
        category.requiredTags,
        { speciesId: cover.speciesId, variant, name: '' },
        catalogs,
      )
    ) {
      await db.covers.delete([cover.categoryId, cover.speciesId, variant])
    }
  }
  const specimens = await db.specimens.toArray()
  for (const specimen of specimens) {
    await maybeSetCover(category, specimen, specimenTags(specimen), catalogs)
  }
}

export async function deleteCategory(id: string) {
  const row = await db.categories.get(id)
  if (!row) throw new Error('Tag is gone')
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
  return pushCategories({ syncOrder: true })
}

export async function reorderGallerySpecimens(speciesId: number, orderedIds: string[]) {
  const existing = await db.specimens.where('speciesId').equals(speciesId).toArray()
  const patch = galleryOrderPatch(
    existing.map((row) => row.id),
    orderedIds,
  )
  await db.transaction('rw', db.specimens, async () => {
    await Promise.all(
      patch.map((row) =>
        db.specimens.update(row.id, { gallerySort: row.gallerySort, cloudBackupPending: true }),
      ),
    )
  })
  return pushSpecimenGallerySort(patch)
}

export async function saveTagCatalog(
  tag: TagId,
  patch: { limitPokedex: boolean; slotMode: SlotMode },
) {
  const current = (await db.tagCatalogs.get(tag)) ?? {
    tag,
    limitPokedex: defaultLimitPokedex(tag),
    slotMode: defaultSlotMode(tag),
  }
  const row: TagCatalogRow = {
    ...current,
    tag,
    limitPokedex: patch.limitPokedex,
    slotMode: patch.slotMode,
    cloudBackupPending: true,
  }
  await db.tagCatalogs.put(row)
  return pushTagCatalog(row)
}

export async function addRosterEntry(tag: TagId, speciesId: number, variant: string) {
  const row = {
    tag,
    speciesId,
    variant: normalizeVariant(variant),
    cloudBackupPending: true,
  }
  await db.tagRoster.put(row)
  return pushTagRosterEntry(row)
}

export async function removeRosterEntry(tag: TagId, speciesId: number, variant: string) {
  const normalized = normalizeVariant(variant)
  await db.tagRoster.delete([tag, speciesId, normalized])
  return deleteCloudTagRosterEntry(tag, speciesId, normalized)
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
  if (!shareDb) return { imported: 0, duplicateNames: [] }

  const items = await new Promise<{ id: string; blob: Blob; fileName?: string }[]>((resolve) => {
    const tx = shareDb.transaction(SHARE_STORE, 'readonly')
    const req = tx.objectStore(SHARE_STORE).getAll()
    req.onsuccess = () => resolve(req.result as { id: string; blob: Blob; fileName?: string }[])
    req.onerror = () => resolve([])
  })

  const duplicateNames: string[] = []
  let imported = 0
  for (const item of items) {
    let duplicateName: string | null = null
    try {
      await ingestFile(item.blob, item.fileName)
    } catch (err) {
      if (err instanceof DuplicateScreenshotFileNameError) {
        duplicateName = err.fileName
      } else {
        // Keep the share row so the user can retry from Transfer refresh.
        continue
      }
    }
    await new Promise<void>((resolve) => {
      const tx = shareDb.transaction(SHARE_STORE, 'readwrite')
      tx.objectStore(SHARE_STORE).delete(item.id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
    if (duplicateName) duplicateNames.push(duplicateName)
    else imported += 1
  }
  shareDb.close()
  return { imported, duplicateNames }
}
