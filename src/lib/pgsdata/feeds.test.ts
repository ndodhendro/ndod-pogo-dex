import { describe, expect, it } from 'vitest'
import { GO_FORM_SPECIES_IDS } from '../../data/goFormReleased'
import { GO_RELEASED_IDS } from '../../data/goReleased'
import type { CategoryRow, SpecimenRow } from '../db'
import { packJavaHashMap, type HashMapPayload } from './javaHashMap'
import {
  chunkSpeciesIds,
  feedStem,
  formatRoman,
  matchFeedCategory,
  normalizeFeedLabel,
  numberedFeedName,
  parseRoman,
  rebuildFeeds,
} from './feeds'
import { fillPgsFeeds, openPgsData, packPgsData } from './sync'

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

const alolanIds = [...GO_FORM_SPECIES_IDS.alolan].sort((a, b) => a - b)
const basicIds = [...GO_RELEASED_IDS].sort((a, b) => a - b)
const genderIds = [...GO_FORM_SPECIES_IDS.gender].sort((a, b) => a - b)

describe('Roman feed names', () => {
  it('parses and formats numerals', () => {
    expect(formatRoman(1)).toBe('I')
    expect(formatRoman(2)).toBe('II')
    expect(formatRoman(4)).toBe('IV')
    expect(formatRoman(9)).toBe('IX')
    expect(parseRoman('iii')).toBe(3)
    expect(parseRoman('IIII')).toBeNull()
    expect(parseRoman('CP')).toBeNull()
  })

  it('strips a roman or dex suffix for the stem', () => {
    expect(feedStem('Basic I')).toBe('Basic')
    expect(feedStem('Basic II')).toBe('Basic')
    expect(feedStem('Max CP')).toBe('Max CP')
    expect(feedStem('Basic 001')).toBe('Basic')
    expect(feedStem('Basic 1008')).toBe('Basic')
    expect(feedStem('Alolan')).toBe('Alolan')
  })

  it('names a feed from the lowest pokedex id in its pokemon list', () => {
    expect(numberedFeedName('Basic', [4, 1, 25])).toBe('Basic 001')
    expect(numberedFeedName('Alolan', [19, 103])).toBe('Alolan 019')
    expect(numberedFeedName('Basic', [1008])).toBe('Basic 1008')
    expect(numberedFeedName('Basic', [])).toBe('Basic 000')
    expect(feedStem(numberedFeedName('Max CP', [151]))).toBe('Max CP')
  })
})

describe('PGSData feed matching', () => {
  it('maps numbered and special feed names onto app categories', () => {
    expect(matchFeedCategory('Basic I', categories)?.name).toBe('Basic')
    expect(matchFeedCategory('Max CP II', categories)?.name).toBe('Max CP')
    expect(matchFeedCategory('Alternate Form', categories)?.name).toBe('Alternate forme')
    expect(matchFeedCategory('Male', categories)?.name).toBe('Gender')
    expect(matchFeedCategory('Female III', categories)?.name).toBe('Gender')
    expect(matchFeedCategory('Focus', categories)).toBeNull()
    expect(normalizeFeedLabel('Alternate Forme')).toBe('alternate form')
  })

  it('chunks leftover species by dex number', () => {
    expect(chunkSpeciesIds([4, 1, 2], 2)).toEqual([[4, 1], [2]])
    expect(chunkSpeciesIds([])).toEqual([[]])
  })

  it('rebuilds a matched stem and skips unknown feeds', () => {
    const feeds = [
      { name: 'Focus', pokemons: [99], size: 3 },
      { name: 'Alolan', pokemons: [20], form: 1 },
    ]
    const { feeds: next, stats } = rebuildFeeds(feeds, [], categories)
    expect(next[0]).toEqual({ name: 'Focus', pokemons: [99], size: 3 })
    expect(next[1]).toEqual({
      name: numberedFeedName('Alolan', alolanIds),
      pokemons: alolanIds,
      form: 1,
    })
    expect(stats.skipped).toBe(1)
    expect(stats.rebuilt).toBe(1)
  })

  it('deletes leftover pokemon and fills from species that are not yet pure', () => {
    const feeds = [{ name: 'Alolan I', pokemons: [20, 9999], form: 1 }]
    const { feeds: next } = rebuildFeeds(
      feeds,
      [specimen({ speciesId: 19, extraTags: ['alolan'] })],
      categories,
    )
    expect(next[0].form).toBe(1)
    expect(next[0].pokemons).toEqual(alolanIds.filter((id) => id !== 19))
    expect(next[0].pokemons).not.toContain(9999)
  })

  it('splits overflow onto copied feeds named by each chunk min dex id', () => {
    const feeds = [
      { name: 'Focus' },
      { name: 'Basic I', pokemons: [1], size: 0 },
      { name: 'Alolan', pokemons: [] },
    ]
    const { feeds: next, stats } = rebuildFeeds(feeds, [], categories)
    const basicFeeds = next.filter((row) => String(row.name).startsWith('Basic '))
    const firstChunk = basicIds.slice(0, 300)
    const secondChunk = basicIds.slice(300, 600)
    expect(basicFeeds.length).toBe(Math.ceil(basicIds.length / 300))
    expect(basicFeeds[0]).toEqual({
      name: numberedFeedName('Basic', firstChunk),
      pokemons: firstChunk,
      size: 0,
    })
    expect(basicFeeds[1]?.name).toBe(numberedFeedName('Basic', secondChunk))
    expect(basicFeeds[1]?.pokemons).toEqual(secondChunk)
    expect(basicFeeds[1]?.size).toBe(0)
    expect(basicFeeds[0]?.name).not.toBe(basicFeeds[1]?.name)
    expect(next.findIndex((row) => row.name === numberedFeedName('Basic', secondChunk))).toBe(
      next.findIndex((row) => row.name === numberedFeedName('Basic', firstChunk)) + 1,
    )
    expect(next[0].name).toBe('Focus')
    expect(next.some((row) => row.name === numberedFeedName('Alolan', alolanIds))).toBe(true)
    expect(stats.created).toBeGreaterThan(0)
  })

  it('collapses extra same-stem feeds when fewer chunks are needed', () => {
    const feeds = [
      { name: 'Alolan I', pokemons: [19], size: 2 },
      { name: 'Alolan II', pokemons: [26], size: 9 },
      { name: 'Alolan III', pokemons: [50], size: 9 },
    ]
    const { feeds: next, stats } = rebuildFeeds(feeds, [], categories)
    expect(next).toEqual([
      { name: numberedFeedName('Alolan', alolanIds), pokemons: alolanIds, size: 2 },
    ])
    expect(stats.dropped).toBe(2)
  })

  it('does not treat a pure Shadow as Basic', () => {
    const feeds = [{ name: 'Basic I', pokemons: [1, 2] }]
    const { feeds: next } = rebuildFeeds(
      feeds,
      [specimen({ speciesId: 1, shadowStatus: 'shadow' })],
      categories,
    )
    expect(next[0].pokemons).toContain(1)
  })

  it('removes XXL and Hundo from their own feeds', () => {
    const remainingXxl = basicIds.filter((id) => id !== 1)
    const remainingHundo = basicIds.filter((id) => id !== 25)
    const { feeds: next } = rebuildFeeds(
      [
        { name: 'XXL I', pokemons: [1, 4] },
        { name: 'Hundo I', pokemons: [1, 25] },
      ],
      [
        specimen({ speciesId: 1, extraTags: ['xxl'] }),
        specimen({ speciesId: 25, hundo: true }),
      ],
      categories,
    )
    expect(next.find((row) => row.name === numberedFeedName('XXL', remainingXxl.slice(0, 300)))?.pokemons).toEqual(
      remainingXxl.slice(0, 300),
    )
    expect(
      next.find((row) => row.name === numberedFeedName('Hundo', remainingHundo.slice(0, 300)))?.pokemons,
    ).toEqual(remainingHundo.slice(0, 300))
  })

  function feedIds(feeds: { pokemons?: number[] }[]) {
    return feeds.flatMap((row) => row.pokemons ?? [])
  }

  it('keeps a branch root while a different-dex evolution is still missing', () => {
    const pure = (speciesId: number) => specimen({ speciesId, extraTags: ['basic'] })
    const { feeds: next } = rebuildFeeds(
      [{ name: 'Basic I', pokemons: [] }],
      [
        pure(133),
        pure(43),
        pure(44),
        pure(789),
        pure(790),
        pure(265),
        pure(840),
        pure(841),
        pure(842),
      ],
      categories,
    )
    const ids = feedIds(next)
    expect(ids).toContain(133)
    expect(ids).toContain(134)
    expect(ids).not.toContain(43)
    expect(ids).toContain(44)
    expect(ids).toContain(182)
    expect(ids).not.toContain(789)
    expect(ids).toContain(790)
    expect(ids).toContain(791)
    expect(ids).toContain(265)
    expect(ids).toContain(266)
    expect(ids).toContain(840)
    expect(ids).toContain(1011)
  })

  it('does not keep a branch root for a later linear evolution', () => {
    const pure = (speciesId: number) => specimen({ speciesId, extraTags: ['basic'] })
    const { feeds: next } = rebuildFeeds(
      [{ name: 'Basic I', pokemons: [] }],
      [pure(265), pure(266), pure(268), pure(840), pure(841), pure(842), pure(1011)],
      categories,
    )
    const ids = feedIds(next)
    expect(ids).not.toContain(265)
    expect(ids).toContain(267)
    expect(ids).toContain(269)
    expect(ids).not.toContain(840)
    expect(ids).toContain(1019)
  })

  it('drops the branch root once every direct evolution is pure', () => {
    const rows = [133, 134, 135, 136, 196, 197, 470, 471, 700].map((speciesId) =>
      specimen({ speciesId, extraTags: ['basic'] }),
    )
    const { feeds: next } = rebuildFeeds([{ name: 'Basic I', pokemons: [] }], rows, categories)
    const ids = feedIds(next)
    for (const speciesId of [133, 134, 135, 136, 196, 197, 470, 471, 700]) {
      expect(ids).not.toContain(speciesId)
    }
  })

  it('drops a pure Tyrogue while a Hitmon is still missing', () => {
    const { feeds: next } = rebuildFeeds(
      [{ name: 'Basic I', pokemons: [236, 106] }],
      [specimen({ speciesId: 236, extraTags: ['basic'] })],
      categories,
    )
    const ids = feedIds(next)
    expect(ids).not.toContain(236)
    expect(ids).toContain(106)
    expect(ids).toContain(107)
    expect(ids).toContain(237)
  })

  it('keeps Eevee on the category that still has a missing evolution', () => {
    const { feeds: next } = rebuildFeeds(
      [
        { name: 'Basic I', pokemons: [] },
        { name: 'Shiny I', pokemons: [] },
      ],
      [specimen({ speciesId: 133, shiny: true })],
      [...categories, category('Shiny', ['shiny'])],
    )
    expect(feedIds(next.filter((row) => String(row.name).startsWith('Basic')))).toContain(133)
    const shiny = feedIds(next.filter((row) => String(row.name).startsWith('Shiny')))
    expect(shiny).toContain(133)
    expect(shiny).toContain(134)
  })

  it('splits Gender pures into Male and Female feeds', () => {
    const { feeds: next } = rebuildFeeds(
      [
        { name: 'Male', pokemons: [25, 133] },
        { name: 'Female', pokemons: [25, 133] },
      ],
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
    const maleIds = genderIds.filter((id) => id !== 25)
    expect(next[0].name).toBe(numberedFeedName('Male', maleIds))
    expect(next[0].pokemons).toEqual(maleIds)
    expect(next[1].name).toBe(numberedFeedName('Female', genderIds))
    // Hisuian Female Sneasel is pure, but Female Weavile is still open, so 215 stays.
    expect(next[1].pokemons).toEqual(genderIds)
  })

  it('packs a dat file after filling feeds', () => {
    const feeds = [
      { name: 'Basic I', pokemons: [1, 2], size: 0 },
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
    const opened = openPgsData(packJavaHashMap(map))
    const filled = fillPgsFeeds(
      opened.feeds,
      [
        specimen({ speciesId: 1, extraTags: ['basic'] }),
        specimen({ speciesId: 19, extraTags: ['alolan'] }),
      ],
      categories,
    )
    const packed = packPgsData(opened.payload, filled.feeds)
    const basic = packed.feeds.find((row) => feedStem(String(row.name)) === 'Basic')
    const alolan = packed.feeds.find((row) => feedStem(String(row.name)) === 'Alolan')
    expect(basic?.name).toBe(numberedFeedName('Basic', basic?.pokemons ?? []))
    expect(basic?.pokemons).not.toContain(1)
    expect(alolan?.name).toBe(numberedFeedName('Alolan', alolan?.pokemons ?? []))
    expect(alolan?.pokemons).not.toContain(19)
    expect(alolan?.pokemons).toContain(26)
    expect(alolan?.form).toBe(1)
  })
})
