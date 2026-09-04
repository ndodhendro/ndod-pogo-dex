import { describe, expect, it } from 'vitest'
import { coversForPendingSpecimens, specimenNeedsCloudBackup, backupProgressLabel } from './syncBackup'

describe('specimenNeedsCloudBackup', () => {
  it('retries after a failed or skipped specimen upsert', () => {
    expect(specimenNeedsCloudBackup({ cloudBackupPending: true })).toBe(true)
  })

  it('skips specimens that already upserted successfully', () => {
    expect(specimenNeedsCloudBackup({ cloudBackupPending: false })).toBe(false)
  })

  it('retries legacy rows that never recorded a cloud result', () => {
    expect(specimenNeedsCloudBackup({})).toBe(true)
  })
})

describe('backupProgressLabel', () => {
  it('shows preparing current / total', () => {
    expect(backupProgressLabel({ phase: 'preparing', current: 3, total: 12 })).toBe(
      'Preparing 3 / 12',
    )
  })

  it('shows backing up current / total', () => {
    expect(backupProgressLabel({ phase: 'uploading', current: 12, total: 12 })).toBe(
      'Backing up 12 / 12',
    )
  })
})

describe('coversForPendingSpecimens', () => {
  it('keeps covers only for species that still need backup', () => {
    const covers = [
      { speciesId: 1, specimenId: 'a' },
      { speciesId: 2, specimenId: 'b' },
      { speciesId: 1, specimenId: 'c' },
    ]
    expect(coversForPendingSpecimens(covers, [{ speciesId: 1 }])).toEqual([
      { speciesId: 1, specimenId: 'a' },
      { speciesId: 1, specimenId: 'c' },
    ])
  })
})
