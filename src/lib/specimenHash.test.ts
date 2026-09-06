import { describe, expect, it } from 'vitest'
import {
  cloudBackupErrorMessage,
  dedupePayloadByFileHash,
  isSpecimenFileHashConflict,
  partitionDuplicateFileHashes,
  pickSpecimenToKeepForHash,
  sameSpecimenMetadata,
} from './specimenHash'

describe('isSpecimenFileHashConflict', () => {
  it('detects the Postgres unique index on user + file hash', () => {
    expect(
      isSpecimenFileHashConflict({
        code: '23505',
        message: 'duplicate key value violates unique constraint "specimens_user_file_hash"',
      }),
    ).toBe(true)
  })

  it('ignores other unique violations', () => {
    expect(
      isSpecimenFileHashConflict({
        code: '23505',
        message: 'duplicate key value violates unique constraint "specimens_pkey"',
      }),
    ).toBe(false)
  })
})

describe('cloudBackupErrorMessage', () => {
  it('hides the raw unique-constraint text', () => {
    expect(
      cloudBackupErrorMessage('duplicate key value violates unique constraint "specimens_user_file_hash"'),
    ).toBe('Screenshot already in the collection')
  })
})

describe('sameSpecimenMetadata', () => {
  const base = {
    speciesId: 25,
    form: null,
    shiny: true,
    shadowStatus: 'none' as const,
    costume: null,
    background: null,
    hundo: false,
    nundo: false,
    extraTags: [] as string[],
  }

  it('treats the same tags as unchanged', () => {
    expect(sameSpecimenMetadata(base, { ...base })).toBe(true)
  })

  it('notices a tag change on the same screenshot', () => {
    expect(sameSpecimenMetadata(base, { ...base, shiny: false })).toBe(false)
  })
})

describe('pickSpecimenToKeepForHash', () => {
  it('keeps a row that already backed up', () => {
    const keep = pickSpecimenToKeepForHash([
      { id: 'new', createdAt: 1, cloudBackupPending: true },
      { id: 'old', createdAt: 9, cloudBackupPending: false },
    ])
    expect(keep.id).toBe('old')
  })

  it('keeps the oldest pending row when none are backed up', () => {
    const keep = pickSpecimenToKeepForHash([
      { id: 'b', createdAt: 20, cloudBackupPending: true },
      { id: 'a', createdAt: 10, cloudBackupPending: true },
    ])
    expect(keep.id).toBe('a')
  })
})

describe('partitionDuplicateFileHashes', () => {
  it('keeps one specimen per hash and lists extras', () => {
    const { keep, extras } = partitionDuplicateFileHashes([
      { id: 'a', fileHash: 'h1', createdAt: 1, cloudBackupPending: true },
      { id: 'b', fileHash: 'h1', createdAt: 2, cloudBackupPending: true },
      { id: 'c', fileHash: 'h2', createdAt: 3, cloudBackupPending: true },
    ])
    expect(keep.map((row) => row.id).sort()).toEqual(['a', 'c'])
    expect(extras).toEqual([
      {
        extra: { id: 'b', fileHash: 'h1', createdAt: 2, cloudBackupPending: true },
        keep: { id: 'a', fileHash: 'h1', createdAt: 1, cloudBackupPending: true },
      },
    ])
  })
})

describe('dedupePayloadByFileHash', () => {
  it('drops later rows with the same file_hash', () => {
    expect(
      dedupePayloadByFileHash([
        { id: 'a', file_hash: 'h1' },
        { id: 'b', file_hash: 'h1' },
        { id: 'c', file_hash: 'h2' },
      ]),
    ).toEqual([
      { id: 'a', file_hash: 'h1' },
      { id: 'c', file_hash: 'h2' },
    ])
  })
})
