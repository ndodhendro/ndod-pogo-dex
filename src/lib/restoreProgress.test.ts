import { describe, expect, it } from 'vitest'
import {
  formatRestoreProgressPercent,
  restoreBusyLabel,
  restoreProgressLabel,
  restoreProgressPercent,
} from './restoreProgress'

describe('restoreProgressPercent', () => {
  it('is 0 without a total, 100 when complete, and rounded in between', () => {
    expect(restoreProgressPercent({ phase: 'picking', current: 0, total: 0 })).toBe(0)
    expect(restoreProgressPercent({ phase: 'reading', current: 12, total: 0 })).toBe(0)
    expect(restoreProgressPercent({ phase: 'hashing', current: 3, total: 1000 })).toBe(0)
    expect(restoreProgressPercent({ phase: 'hashing', current: 12, total: 1000 })).toBe(1)
    expect(restoreProgressPercent({ phase: 'writing', current: 8, total: 50 })).toBe(16)
    expect(restoreProgressPercent({ phase: 'writing', current: 50, total: 50 })).toBe(100)
    expect(formatRestoreProgressPercent({ phase: 'inbox', current: 2, total: 10 })).toBe('20%')
  })
})

describe('restoreProgressLabel', () => {
  it('asks to choose a folder while the picker is open', () => {
    expect(restoreProgressLabel({ phase: 'picking', current: 0, total: 0 })).toBe(
      'Choose the Screenshots folder… (0%)',
    )
  })

  it('counts files while listing, then reading with a total', () => {
    expect(restoreProgressLabel({ phase: 'reading', current: 0, total: 0 })).toBe(
      'Reading photos from the folder… (0%)',
    )
    expect(restoreProgressLabel({ phase: 'reading', current: 12, total: 0 })).toBe(
      'Looking through folder… 12 (0%)',
    )
    expect(restoreProgressLabel({ phase: 'reading', current: 12, total: 1000 })).toBe(
      'Reading photos 12 / 1000 (1%)',
    )
  })

  it('shows hashing, loading, download, restore, and Transfer counts with percent', () => {
    expect(restoreProgressLabel({ phase: 'hashing', current: 3, total: 1000 })).toBe(
      'Hashing photos 3 / 1000 (0%)',
    )
    expect(restoreProgressLabel({ phase: 'loading', current: 0, total: 1 })).toBe(
      'Loading cloud metadata… (0%)',
    )
    expect(restoreProgressLabel({ phase: 'downloading', current: 4, total: 40 })).toBe(
      'Downloading 4 / 40 (10%)',
    )
    expect(restoreProgressLabel({ phase: 'writing', current: 8, total: 50 })).toBe(
      'Restoring 8 / 50 (16%)',
    )
    expect(restoreProgressLabel({ phase: 'inbox', current: 2, total: 10 })).toBe(
      'Sending to Transfer 2 / 10 (20%)',
    )
  })
})

describe('restoreBusyLabel', () => {
  it('names the live restore phase on the button', () => {
    expect(restoreBusyLabel({ phase: 'picking', current: 0, total: 0 })).toBe('Choose folder…')
    expect(restoreBusyLabel({ phase: 'reading', current: 12, total: 0 })).toBe('Reading…')
    expect(restoreBusyLabel({ phase: 'hashing', current: 3, total: 1000 })).toBe('Hashing…')
    expect(restoreBusyLabel({ phase: 'loading', current: 0, total: 1 })).toBe('Loading…')
    expect(restoreBusyLabel({ phase: 'downloading', current: 1, total: 2 })).toBe('Downloading…')
    expect(restoreBusyLabel({ phase: 'writing', current: 1, total: 2 })).toBe('Restoring…')
    expect(restoreBusyLabel({ phase: 'inbox', current: 1, total: 2 })).toBe('Transfer…')
  })
})
