import { db, type SpecimenRow, type TransferLogRow } from './db'
import { newId } from './id'
import { extraTagList, fieldsFromSpecimen, isSilhouette, type SpecimenFields } from './tags'

export type TransferLogAction = 'save' | 'edit' | 'delete'

export const TRANSFER_LOG_LIMIT = 30

export const TRANSFER_LOG_ACTIONS: Record<TransferLogAction, { icon: string; label: string }> = {
  save: { icon: '📥', label: 'Saved' },
  edit: { icon: '🏷️', label: 'Edited' },
  delete: { icon: '🗑️', label: 'Deleted' },
}

export function sortTransferLogs<T extends { createdAt: number; updatedAt: number }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt)
}

export function idsToPrune(
  rows: readonly { id: string; createdAt: number; updatedAt: number }[],
  limit = TRANSFER_LOG_LIMIT,
): string[] {
  if (rows.length <= limit) return []
  return sortTransferLogs(rows)
    .slice(limit)
    .map((row) => row.id)
}

export async function pruneTransferLogs(limit = TRANSFER_LOG_LIMIT) {
  const ids = idsToPrune(await db.transferLogs.toArray(), limit)
  if (ids.length === 0) return
  await db.transferLogs.bulkDelete(ids)
}

export function transferLogHasSnapshot(
  log: TransferLogRow,
): log is TransferLogRow & { speciesId: number } {
  return typeof log.speciesId === 'number' && log.speciesId > 0
}

export function specimenFromTransferLog(
  log: TransferLogRow,
  fallback?: SpecimenRow,
): SpecimenFields & { id: string; imageId: string } {
  if (transferLogHasSnapshot(log)) {
    return {
      id: log.specimenId,
      imageId: log.imageId || fallback?.imageId || '',
      ...fieldsFromSpecimen({
        speciesId: log.speciesId,
        form: log.form ?? null,
        shiny: Boolean(log.shiny),
        shadowStatus: log.shadowStatus ?? 'none',
        costume: log.costume ?? null,
        background: log.background ?? null,
        gender: log.gender ?? null,
        hundo: Boolean(log.hundo),
        nundo: Boolean(log.nundo),
        extraTags: extraTagList(log),
        silhouette: isSilhouette(log),
      }),
    }
  }
  if (!fallback) {
    return {
      id: log.specimenId,
      imageId: log.imageId || '',
      ...fieldsFromSpecimen({
        speciesId: 0,
        form: null,
        shiny: false,
        shadowStatus: 'none',
        costume: null,
        background: null,
        hundo: false,
        nundo: false,
      }),
    }
  }
  return fallback
}

function snapshotFromSpecimen(
  specimen: SpecimenRow,
  action: TransferLogAction,
  thumb?: Blob,
): Omit<TransferLogRow, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    specimenId: specimen.id,
    action,
    speciesId: specimen.speciesId,
    form: specimen.form,
    shiny: specimen.shiny,
    shadowStatus: specimen.shadowStatus,
    costume: specimen.costume,
    background: specimen.background,
    gender: specimen.gender ?? null,
    hundo: specimen.hundo,
    nundo: specimen.nundo,
    extraTags: extraTagList(specimen),
    silhouette: isSilhouette(specimen),
    imageId: specimen.imageId,
    thumb,
  }
}

export async function upsertTransferLog(
  specimen: SpecimenRow,
  action: TransferLogAction,
  now = Date.now(),
) {
  const image = await db.images.get(specimen.imageId)
  const snapshot = snapshotFromSpecimen(specimen, action, image?.thumb)
  const existing = await db.transferLogs.where('specimenId').equals(specimen.id).first()
  if (existing) {
    await db.transferLogs.update(existing.id, { ...snapshot, updatedAt: now })
  } else {
    await db.transferLogs.add({
      id: newId(),
      ...snapshot,
      createdAt: now,
      updatedAt: now,
    })
  }
  await pruneTransferLogs()
}
