import { specimenNeedsPhotoUpload } from './specimenStorage'

export function specimenNeedsCloudBackup(row: { cloudBackupPending?: boolean }): boolean {
  return row.cloudBackupPending !== false
}

/** Metadata still pending, or the screenshot is not in the Storage bucket yet. */
export function specimenNeedsCloudPush(
  row: { cloudBackupPending?: boolean },
  cloudImagePath: string | null | undefined,
): boolean {
  if (specimenNeedsCloudBackup(row)) return true
  return specimenNeedsPhotoUpload(cloudImagePath)
}

export type BackupProgress = {
  phase: 'preparing' | 'uploading'
  current: number
  total: number
}

export function backupProgressLabel(progress: BackupProgress): string {
  if (progress.phase === 'preparing') {
    return `Preparing ${progress.current} / ${progress.total}`
  }
  return `Backing up ${progress.current} / ${progress.total}`
}

export function coversForPendingSpecimens<T extends { speciesId: number }>(
  covers: T[],
  pending: { speciesId: number }[],
): T[] {
  const speciesIds = new Set(pending.map((row) => row.speciesId))
  return covers.filter((row) => speciesIds.has(row.speciesId))
}
