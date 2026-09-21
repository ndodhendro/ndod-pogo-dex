import { db, type InboxRow, type SpecimenRow, type TransferLogRow } from './db'
import { newId } from './id'
import { extraTagList, fieldsFromSpecimen, isNotPure, isSilhouette, type SpecimenFields } from './tags'

export type TransferLogAction =
  | 'save'
  | 'edit'
  | 'delete'
  | 'restore'
  | 'discard'
  | 'duplicate'
  | 'duplicate-untagged'
  | 'duplicate-pokedex'

export type DuplicateFilePlace = 'untagged' | 'pokedex'

export const TRANSFER_LOG_LIMIT = 100

export const TRANSFER_LOG_ACTIONS: Record<TransferLogAction, { icon: string; label: string }> = {
  save: { icon: '📥', label: 'Saved' },
  edit: { icon: '🏷️', label: 'Edited' },
  delete: { icon: '🗑️', label: 'Deleted' },
  restore: { icon: '☁️', label: 'Restored' },
  discard: { icon: '🗑️', label: 'Discarded' },
  duplicate: { icon: '⚠️', label: 'Duplicate filename' },
  'duplicate-untagged': { icon: '📥', label: 'Duplicate in Untagged' },
  'duplicate-pokedex': { icon: '📖', label: 'Duplicate in Pokédex' },
}

export function duplicateFileNameAction(place?: DuplicateFilePlace): TransferLogAction {
  if (place === 'untagged') return 'duplicate-untagged'
  if (place === 'pokedex') return 'duplicate-pokedex'
  return 'duplicate'
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

export function transferLogIsUntaggedDiscard(log: TransferLogRow): boolean {
  return log.action === 'discard' && !transferLogHasSnapshot(log)
}

export function transferLogIsDuplicateFileName(log: TransferLogRow): boolean {
  return (
    (log.action === 'duplicate' ||
      log.action === 'duplicate-untagged' ||
      log.action === 'duplicate-pokedex') &&
    !transferLogHasSnapshot(log)
  )
}

export function transferLogIsFileOnly(log: TransferLogRow): boolean {
  return transferLogIsUntaggedDiscard(log) || transferLogIsDuplicateFileName(log)
}

export function transferLogIsListed(log: TransferLogRow, live?: SpecimenRow): boolean {
  return transferLogIsFileOnly(log) || transferLogHasSnapshot(log) || Boolean(live)
}

export function inboxDiscardLogSnapshot(
  inbox: Pick<InboxRow, 'id' | 'imageId' | 'fileName'>,
  thumb?: Blob,
): Omit<TransferLogRow, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    specimenId: inbox.id,
    action: 'discard',
    imageId: inbox.imageId,
    fileName: inbox.fileName ?? null,
    thumb,
  }
}

/** Live photo only when it is still the same file the log row captured. */
export function transferLogLiveImageId(
  log: Pick<TransferLogRow, 'imageId'>,
  live?: Pick<SpecimenRow, 'imageId'>,
): string | undefined {
  if (!live?.imageId) return undefined
  if (log.imageId && log.imageId !== live.imageId) return undefined
  return live.imageId
}

export function replaceTransferLogTimes(now = Date.now()) {
  return { deletedAt: now, savedAt: now + 1 }
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
        notPure: isNotPure(log),
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
    notPure: isNotPure(specimen),
    imageId: specimen.imageId,
    fileName: specimen.fileName ?? null,
    thumb,
  }
}

/** Always insert so save, edit, delete, restore, and discard stay as separate history rows. */
export async function appendTransferLog(
  specimen: SpecimenRow,
  action: TransferLogAction,
  now = Date.now(),
  options: { prune?: boolean } = {},
) {
  const image = await db.images.get(specimen.imageId)
  const snapshot = snapshotFromSpecimen(specimen, action, image?.thumb?.slice())
  await db.transferLogs.add({
    id: newId(),
    ...snapshot,
    createdAt: now,
    updatedAt: now,
  })
  if (options.prune !== false) await pruneTransferLogs()
}

export async function appendInboxDiscardLog(
  inbox: InboxRow,
  now = Date.now(),
  options: { prune?: boolean } = {},
) {
  const image = await db.images.get(inbox.imageId)
  await db.transferLogs.add({
    id: newId(),
    ...inboxDiscardLogSnapshot(inbox, image?.thumb?.slice()),
    createdAt: now,
    updatedAt: now,
  })
  if (options.prune !== false) await pruneTransferLogs()
}

export function duplicateFileNameLogSnapshot(
  fileName: string,
  source?: { imageId: string; place?: DuplicateFilePlace },
  thumb?: Blob,
): Omit<TransferLogRow, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    specimenId: newId(),
    action: duplicateFileNameAction(source?.place),
    imageId: source?.imageId ?? null,
    fileName,
    thumb,
  }
}

export async function appendDuplicateFileNameLog(
  fileName: string,
  source?: { id: string; imageId: string; place?: DuplicateFilePlace },
  now = Date.now(),
  options: { prune?: boolean } = {},
) {
  const image = source?.imageId ? await db.images.get(source.imageId) : undefined
  await db.transferLogs.add({
    id: newId(),
    ...duplicateFileNameLogSnapshot(fileName, source, image?.thumb?.slice()),
    createdAt: now,
    updatedAt: now,
  })
  if (options.prune !== false) await pruneTransferLogs()
}
