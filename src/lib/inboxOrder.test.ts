import { describe, expect, it } from 'vitest'
import {
  mergeInboxDisplay,
  nextInboxSort,
  inboxMatchesFileNameQuery,
  sortInboxByFileName,
} from './inboxOrder'

const row = (id: string, fileName: string | null, createdAt: number) => ({
  id,
  fileName,
  createdAt,
})

describe('sortInboxByFileName', () => {
  it('sorts filenames ascending, ignoring case', () => {
    expect(
      sortInboxByFileName(
        [row('b', 'charizard.png', 2), row('a', 'Bulbasaur.png', 1), row('c', 'abra.png', 3)],
        'asc',
      ).map((item) => item.id),
    ).toEqual(['c', 'a', 'b'])
  })

  it('sorts filenames descending', () => {
    expect(
      sortInboxByFileName(
        [row('b', 'charizard.png', 2), row('a', 'Bulbasaur.png', 1), row('c', 'abra.png', 3)],
        'desc',
      ).map((item) => item.id),
    ).toEqual(['b', 'a', 'c'])
  })

  it('uses numeric order so 2 comes before 10', () => {
    expect(
      sortInboxByFileName(
        [row('10', 'Screenshot_10.png', 1), row('2', 'Screenshot_2.png', 2)],
        'asc',
      ).map((item) => item.id),
    ).toEqual(['2', '10'])
  })

  it('breaks filename ties with newest createdAt first', () => {
    expect(
      sortInboxByFileName(
        [row('old', 'same.png', 1), row('new', 'same.png', 9)],
        'asc',
      ).map((item) => item.id),
    ).toEqual(['new', 'old'])
  })

  it('places a newly added row in the current filename order', () => {
    const n = row('n', 'm.png', 4)
    const c = row('c', 'c.png', 3)
    const b = row('b', 'b.png', 2)
    const a = row('a', 'a.png', 1)
    expect(sortInboxByFileName([n, c, b, a], 'asc').map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
      'n',
    ])
  })
})

describe('mergeInboxDisplay', () => {
  const a = row('a', 'a.png', 1)
  const b = row('b', 'b.png', 2)
  const c = row('c', 'c.png', 3)

  it('uses live newest-first order when nothing has been arranged yet', () => {
    expect(mergeInboxDisplay([c, b, a], []).map((item) => item.id)).toEqual(['c', 'b', 'a'])
  })

  it('keeps the current order and puts newly added rows on top', () => {
    const n = row('n', 'n.png', 4)
    expect(mergeInboxDisplay([n, c, b, a], ['a', 'c', 'b']).map((item) => item.id)).toEqual([
      'n',
      'a',
      'c',
      'b',
    ])
  })

  it('drops rows that left the inbox', () => {
    expect(mergeInboxDisplay([c, a], ['a', 'b', 'c']).map((item) => item.id)).toEqual(['a', 'c'])
  })
})

describe('nextInboxSort', () => {
  const a = row('a', 'a.png', 1)
  const b = row('b', 'b.png', 2)
  const c = row('c', 'c.png', 3)

  it('applies the current direction when the list is not yet sorted that way', () => {
    expect(nextInboxSort([c, a, b], 'asc')).toEqual({ dir: 'asc', ids: ['a', 'b', 'c'] })
  })

  it('toggles direction when the list is already sorted', () => {
    expect(nextInboxSort([a, b, c], 'asc')).toEqual({ dir: 'desc', ids: ['c', 'b', 'a'] })
    expect(nextInboxSort([c, b, a], 'desc')).toEqual({ dir: 'asc', ids: ['a', 'b', 'c'] })
  })

  it('re-applies the current direction so a newly added row is sorted only after a click', () => {
    const n = row('n', 'm.png', 4)
    expect(nextInboxSort([n, a, b, c], 'asc')).toEqual({ dir: 'asc', ids: ['a', 'b', 'c', 'n'] })
  })
})

describe('inboxMatchesFileNameQuery', () => {
  it('matches a case-insensitive filename fragment', () => {
    expect(inboxMatchesFileNameQuery('Screenshot_2026.png', 'shot_2026')).toBe(true)
    expect(inboxMatchesFileNameQuery('Screenshot_2026.png', 'PNG')).toBe(true)
    expect(inboxMatchesFileNameQuery('Screenshot_2026.png', 'charizard')).toBe(false)
  })

  it('treats an empty query as a match and ignores missing names', () => {
    expect(inboxMatchesFileNameQuery('shot.png', '  ')).toBe(true)
    expect(inboxMatchesFileNameQuery(null, 'shot')).toBe(false)
    expect(inboxMatchesFileNameQuery(null, '')).toBe(true)
  })
})
