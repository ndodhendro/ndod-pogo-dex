import { screenshotFileNameIsTaken, screenshotFileNameKey } from './screenshotFileName'

export type RestorePlan = {
  restoreIds: string[]
  unmatchedHashes: string[]
  alreadyLocalHashes: string[]
}

export type RestoreInboxPlan<T extends { hash: string; fileName?: string | null }> = {
  ingest: T[]
  skipped: T[]
}

/** Unmatched restore photos already in Untagged (or Pokédex) stay put. */
export function planRestoreInbox<T extends { hash: string; fileName?: string | null }>(
  unmatched: readonly T[],
  takenNames: ReadonlySet<string>,
): RestoreInboxPlan<T> {
  const ingest: T[] = []
  const skipped: T[] = []
  const seen = new Set<string>()
  const claimed = new Set(takenNames)

  for (const row of unmatched) {
    if (seen.has(row.hash)) continue
    seen.add(row.hash)
    if (screenshotFileNameIsTaken(row.fileName, claimed)) {
      skipped.push(row)
      continue
    }
    const key = screenshotFileNameKey(row.fileName)
    if (key) claimed.add(key)
    ingest.push(row)
  }

  return { ingest, skipped }
}

export function planGalleryRestore(
  fileHashes: string[],
  cloudByHash: Map<string, { id: string }>,
  localHashes: Set<string>,
): RestorePlan {
  const restoreIds: string[] = []
  const unmatchedHashes: string[] = []
  const alreadyLocalHashes: string[] = []
  const claimed = new Set<string>()

  for (const hash of fileHashes) {
    const cloud = cloudByHash.get(hash)
    if (!cloud) {
      unmatchedHashes.push(hash)
      continue
    }
    if (localHashes.has(hash) || claimed.has(cloud.id)) {
      alreadyLocalHashes.push(hash)
      continue
    }
    claimed.add(cloud.id)
    restoreIds.push(cloud.id)
  }

  return { restoreIds, unmatchedHashes, alreadyLocalHashes }
}

export type CloudPhotoRestorePlan = {
  download: Array<{ id: string; imagePath: string }>
  alreadyLocal: number
  missingPhoto: number
}

export function planCloudPhotoRestore(
  cloud: Array<{ id: string; fileHash: string; imagePath?: string | null }>,
  localHashes: Set<string>,
): CloudPhotoRestorePlan {
  const download: Array<{ id: string; imagePath: string }> = []
  let alreadyLocal = 0
  let missingPhoto = 0

  for (const row of cloud) {
    if (localHashes.has(row.fileHash)) {
      alreadyLocal += 1
      continue
    }
    if (!row.imagePath) {
      missingPhoto += 1
      continue
    }
    download.push({ id: row.id, imagePath: row.imagePath })
  }

  return { download, alreadyLocal, missingPhoto }
}
