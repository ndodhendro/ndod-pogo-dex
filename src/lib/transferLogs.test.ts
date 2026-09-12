import { describe, expect, it } from 'vitest'
import { extraTagList } from './tags'
import {
  idsToPrune,
  sortTransferLogs,
  specimenFromTransferLog,
  transferLogHasSnapshot,
} from './transferLogs'

describe('sortTransferLogs', () => {
  it('puts the latest updatedAt first', () => {
    expect(
      sortTransferLogs([
        { id: 'old', createdAt: 1, updatedAt: 1 },
        { id: 'new', createdAt: 2, updatedAt: 3 },
        { id: 'mid', createdAt: 3, updatedAt: 2 },
      ]).map((row) => row.id),
    ).toEqual(['new', 'mid', 'old'])
  })

  it('breaks updatedAt ties with createdAt descending', () => {
    expect(
      sortTransferLogs([
        { id: 'a', createdAt: 1, updatedAt: 5 },
        { id: 'b', createdAt: 4, updatedAt: 5 },
      ]).map((row) => row.id),
    ).toEqual(['b', 'a'])
  })
})

describe('idsToPrune', () => {
  it('keeps the newest logs up to the limit', () => {
    const rows = [
      { id: 'keep-new', createdAt: 3, updatedAt: 9 },
      { id: 'keep-mid', createdAt: 2, updatedAt: 8 },
      { id: 'drop-old', createdAt: 1, updatedAt: 1 },
      { id: 'drop-older', createdAt: 0, updatedAt: 0 },
    ]
    expect(idsToPrune(rows, 2)).toEqual(['drop-old', 'drop-older'])
  })

  it('returns nothing when the table is within the limit', () => {
    expect(idsToPrune([{ id: 'only', createdAt: 1, updatedAt: 1 }], 2)).toEqual([])
  })
})

describe('specimenFromTransferLog', () => {
  it('rebuilds fields from a snapshot so deleted cards still render', () => {
    const specimen = specimenFromTransferLog({
      id: 'log',
      specimenId: 'spec',
      action: 'delete',
      speciesId: 25,
      form: null,
      shiny: true,
      shadowStatus: 'none',
      costume: null,
      background: null,
      hundo: false,
      nundo: false,
      extraTags: ['basic'],
      silhouette: false,
      imageId: 'img',
      createdAt: 1,
      updatedAt: 2,
    })
    expect(specimen.speciesId).toBe(25)
    expect(specimen.shiny).toBe(true)
    expect(extraTagList(specimen)).toEqual(['basic'])
    expect(transferLogHasSnapshot({ id: 'old', specimenId: 'x', createdAt: 1, updatedAt: 1 })).toBe(
      false,
    )
  })
})
