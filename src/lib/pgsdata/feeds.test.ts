import { describe, expect, it } from 'vitest'
import { GO_FORM_SPECIES_IDS } from '../../data/goFormReleased'
import { GO_RELEASED_IDS } from '../../data/goReleased'
import type { CategoryRow, SpecimenRow } from '../db'
import { packJavaHashMap, type HashMapPayload } from './javaHashMap'
import { feedDexRange, matchFeedCategory, normalizeFeedLabel, syncFeeds } from './feeds'
import { syncPgsData } from './sync'

const DEFAULT_SUIDS: Record<string, bigint> = {
  'java.util.HashMap': 0x0507dac1c31660d1n,
  'java.lang.Integer': 0x12e2a0a4f7818738n,
  'java.lang.Boolean': 0xcd207280d59cfaeen,
  'java.lang.Number': 0x86ac951d0b94e08bn,
  'java.lang.Float': 0xdaedc9a2db3cf0ecn,
  'java.lang.Long': 0x3b8be490cc8f23dfn,
}

function category(name: string, requiredTags: CategoryRow['requiredTags']): CategoryRow {
  return {
    id: name,
    name,
    requiredTags,
    sortOrder: 0,
    seed: false,
  }
}

function specimen(partial: Partial<SpecimenRow> & { speciesId: number }): SpecimenRow {
  return {
    id: `s-${partial.speciesId}`,
    form: null,
    shiny: false,
    shadowStatus: 'none',
    costume: null,
    background: null,
    gender: null,
    hundo: false,
    nundo: false,
    extraTags: [],
    imageId: 'img',
    createdAt: 1,
    ...partial,
  }
}

const categories = [
  category('Basic', []),
  category('XXL', ['xxl']),
  category('Hundo', ['hundo']),
  category('Alolan', ['alolan']),
  category('Gender', ['gender']),
  category('Alternate forme', ['alternate-forme']),
  category('Max CP', ['max-cp']),
]

const alolanIds = [...GO_FORM_SPECIES_IDS.alolan]
const basicLow = [...GO_RELEASED_IDS].filter((id) => id >= 1 && id <= 300)
const genderIds = [...GO_FORM_SPECIES_IDS.gender]

describe('PGSData feed matching', () => {
  it('maps numbered and special feed names onto app categories', () => {
    expect(matchFeedCategory('Basic 001', categories)?.name).toBe('Basic')
    expect(matchFeedCategory('Max CP 301', categories)?.name).toBe('Max CP')
    expect(matchFeedCategory('Alternate Form', categories)?.name).toBe('Alternate forme')
    expect(matchFeedCategory('Male', categories)?.name).toBe('Gender')
    expect(matchFeedCategory('Female', categories)?.name).toBe('Gender')
    expect(matchFeedCategory('Focus', categories)).toBeNull()
    expect(normalizeFeedLabel('Alternate Forme')).toBe('alternate form')
  })

  it('splits numbered feeds using sibling ranges', () => {
    const feeds = [{ name: 'Basic 001' }, { name: 'Basic 301' }, { name: 'Basic 601' }, { name: 'Basic 901' }]
    expect(feedDexRange('Basic 001', feeds)).toEqual({ min: 1, max: 300 })
    expect(feedDexRange('Basic 301', feeds)).toEqual({ min: 301, max: 600 })
    expect(feedDexRange('Basic 901', feeds)).toEqual({ min: 901, max: Number.POSITIVE_INFINITY })
    expect(feedDexRange('Alolan', feeds)).toBeNull()
  })

  it('removes a pure Basic Bulbasaur only from Basic 001', () => {
    const feeds = [
      { name: 'Focus' },
      { name: 'Basic 001', pokemons: [1, 2, 3] },
      { name: 'Basic 301', pokemons: [301, 302] },
      { name: 'XXL 001', pokemons: [1, 2, 3] },
      { name: 'Hundo 001', pokemons: [1] },
    ]
    const { feeds: next, changes } = syncFeeds(
      feeds,
      [specimen({ speciesId: 1, extraTags: ['basic'] })],
      categories,
    )
    const basic001 = next.find((row) => row.name === 'Basic 001')?.pokemons ?? []
    expect(basic001).not.toContain(1)
    expect(basic001).toContain(2)
    expect(basic001).toContain(3)
    expect(basic001).toContain(4)
    expect(next.find((row) => row.name === 'Basic 301')?.pokemons).not.toContain(1)
    expect(next.find((row) => row.name === 'XXL 001')?.pokemons).toContain(1)
    expect(next.find((row) => row.name === 'Hundo 001')?.pokemons).toContain(1)
    expect(changes.find((row) => row.name === 'Basic 001')?.removed).toEqual([1])
  })

  it('adds a missing Basic species that is not yet pure', () => {
    const feeds = [
      { name: 'Basic 001', pokemons: [2, 3] },
      { name: 'Basic 301', pokemons: [301] },
    ]
    const { feeds: next, changes } = syncFeeds(feeds, [], categories)
    const basic001 = next.find((row) => row.name === 'Basic 001')?.pokemons ?? []
    expect(basic001).toContain(1)
    expect(basic001).toEqual([...new Set([...[2, 3], ...basicLow.filter((id) => id !== 2 && id !== 3)])])
    expect(changes.find((row) => row.name === 'Basic 001')?.added).toContain(1)
    expect(next.find((row) => row.name === 'Basic 301')?.pokemons).not.toContain(1)
  })

  it('does not treat a pure Shadow as Basic', () => {
    const feeds = [{ name: 'Basic 001', pokemons: [1, 2] }]
    const { feeds: next } = syncFeeds(
      feeds,
      [specimen({ speciesId: 1, shadowStatus: 'shadow' })],
      categories,
    )
    expect(next[0].pokemons).toContain(1)
  })

  it('removes XXL and Hundo from their own feeds', () => {
    const feeds = [
      { name: 'XXL 001', pokemons: [1, 4] },
      { name: 'Hundo 001', pokemons: [1, 25] },
    ]
    const { feeds: next } = syncFeeds(
      feeds,
      [
        specimen({ speciesId: 1, extraTags: ['xxl'] }),
        specimen({ speciesId: 25, hundo: true }),
      ],
      categories,
    )
    expect(next[0].pokemons).not.toContain(1)
    expect(next[0].pokemons).toContain(4)
    expect(next[1].pokemons).not.toContain(25)
    expect(next[1].pokemons).toContain(1)
  })

  it('splits Gender pures into Male and Female feeds and restores the other', () => {
    const feeds = [
      { name: 'Male', pokemons: [25, 133] },
      { name: 'Female', pokemons: [25, 133] },
    ]
    const { feeds: next } = syncFeeds(
      feeds,
      [
        specimen({ speciesId: 25, extraTags: ['gender'], gender: 'Male' }),
        specimen({
          speciesId: 215,
          extraTags: ['gender', 'hisuian'],
          gender: 'Hisuian Female',
        }),
      ],
      categories,
    )
    expect(next[0].pokemons).not.toContain(25)
    expect(next[0].pokemons).toContain(133)
    expect(next[0].pokemons).toContain(215)
    expect(next[1].pokemons).toContain(25)
    expect(next[1].pokemons).not.toContain(215)
    expect(next[1].pokemons).toEqual(expect.arrayContaining(genderIds.filter((id) => id !== 215)))
  })

  it('restores Alolan IDs that the app still needs', () => {
    const feeds = [{ name: 'Alolan', pokemons: [20, 26] }]
    const { feeds: next, changes } = syncFeeds(feeds, [], categories)
    expect(next[0].pokemons).toEqual([20, 26, ...alolanIds.filter((id) => id !== 20 && id !== 26)])
    expect(changes[0].added).toEqual(alolanIds.filter((id) => id !== 20 && id !== 26))
  })

  it('repacks a dat file after two-way sync', () => {
    const feeds = [
      { name: 'Basic 001', pokemons: [1, 2], size: 0 },
      { name: 'Alolan', pokemons: [19, 26], form: 1 },
    ]
    const map: HashMapPayload = {
      loadFactor: 0.75,
      threshold: 12,
      buckets: 16,
      order: ['hlfeeds', 'count'],
      entries: {
        hlfeeds: { type: 'string', value: JSON.stringify(feeds) },
        count: { type: 'int', value: 2 },
      },
      suids: DEFAULT_SUIDS,
    }
    const result = syncPgsData(
      packJavaHashMap(map),
      [
        specimen({ speciesId: 1, extraTags: ['basic'] }),
        specimen({ speciesId: 19, extraTags: ['alolan'] }),
      ],
      categories,
    )
    expect(result.removed).toBeGreaterThan(0)
    expect(result.added).toBeGreaterThan(0)
    expect(result.feeds.find((row) => row.name === 'Basic 001')?.pokemons).not.toContain(1)
    expect(result.feeds.find((row) => row.name === 'Alolan')?.pokemons).not.toContain(19)
    expect(result.feeds.find((row) => row.name === 'Alolan')?.pokemons).toContain(26)
    expect(result.feeds.find((row) => row.name === 'Alolan')?.pokemons).toContain(20)
  })
})
