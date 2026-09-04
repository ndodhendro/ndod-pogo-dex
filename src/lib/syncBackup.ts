export function specimenNeedsCloudBackup(row: { cloudBackupPending?: boolean }): boolean {
  return row.cloudBackupPending !== false
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
