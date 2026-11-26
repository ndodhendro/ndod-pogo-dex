import { describe, expect, it } from 'vitest'
import type { SpecimenFields } from './tags'
import {
  applyVisibleGalleryOrder,
  galleryCardPurity,
  galleryDefaultRank,
  galleryGroup,
  galleryOrderPatch,
  galleryItemShift,
  galleryTargetIndex,
  mergeGalleryDraft,
  moveVisibleGalleryId,
  sortGallerySpecimens,
  splitGalleryGroups,
} from './galleryOrder'

const categories = [
  { requiredTags: [] as const, sortOrder: 0 },
  { requiredTags: ['shiny'] as const, sortOrder: 1 },
  { requiredTags: ['shadow'] as const, sortOrder: 2 },
  { requiredTags: ['hundo'] as const, sortOrder: 6 },
]

const spec = (
  id: string,
  over: Partial<SpecimenFields> & { gallerySort?: number } = {},
): SpecimenFields & { id: string; gallerySort?: number } => ({
  id,
  speciesId: 1,
  form: null,
  shiny: false,
  shadowStatus: 'none',
  costume: null,
  background: null,
  hundo: false,
  nundo: false,
  hokido: false,
  ...over,
})

describe('galleryDefaultRank', () => {
  it('uses the green category sortOrder', () => {
    expect(galleryDefaultRank(spec('basic'), categories)).toEqual([0])
    expect(galleryDefaultRank(spec('shiny', { shiny: true }), categories)).toEqual([1])
    expect(galleryDefaultRank(spec('shadow', { shadowStatus: 'shadow' }), categories)).toEqual([2])
  })

  it('places an unmatched combo after its earliest matching tag and before later singles', () => {
    expect(
      galleryDefaultRank(spec('combo', { shiny: true, shadowStatus: 'shadow' }), categories),
    ).toEqual([1, 2])
  })

  it('uses a combo category when one exists', () => {
    const withCombo = [...categories, { requiredTags: ['shiny', 'shadow'] as const, sortOrder: 8 }]
    expect(
      galleryDefaultRank(spec('combo', { shiny: true, shadowStatus: 'shadow' }), withCombo),
    ).toEqual([8])
  })

  it('does not rank a not-pure catch as a green cover', () => {
    const withCombo = [...categories, { requiredTags: ['shiny', 'shadow'] as const, sortOrder: 8 }]
    expect(
      galleryDefaultRank(spec('combo', { shiny: true, shadowStatus: 'shadow' }), withCombo),
    ).toEqual([8])
    expect(
      galleryDefaultRank(spec('combo', { shiny: true, shadowStatus: 'shadow', notPure: true }), withCombo),
    ).toEqual([1, 2, 8])
  })
})

describe('sortGallerySpecimens', () => {
  it('follows Settings tag order, not createdAt', () => {
    expect(
      sortGallerySpecimens(
        [
          spec('shadow', { shadowStatus: 'shadow' }),
          spec('basic'),
          spec('shiny', { shiny: true }),
        ],
        categories,
      ).map((row) => row.id),
    ).toEqual(['basic', 'shiny', 'shadow'])
  })

  it('sits a combo between its matching singles when no combo track exists', () => {
    expect(
      sortGallerySpecimens(
        [
          spec('shadow', { shadowStatus: 'shadow' }),
          spec('combo', { shiny: true, shadowStatus: 'shadow' }),
          spec('shiny', { shiny: true }),
          spec('basic'),
        ],
        categories,
      ).map((row) => row.id),
    ).toEqual(['basic', 'shiny', 'combo', 'shadow'])
  })

  it('puts a dedicated combo track where Settings placed it', () => {
    const withCombo = [...categories, { requiredTags: ['shiny', 'shadow'] as const, sortOrder: 8 }]
    expect(
      sortGallerySpecimens(
        [
          spec('combo', { shiny: true, shadowStatus: 'shadow' }),
          spec('shadow', { shadowStatus: 'shadow' }),
          spec('basic'),
        ],
        withCombo,
      ).map((row) => row.id),
    ).toEqual(['basic', 'shadow', 'combo'])
  })

  it('keeps a manual gallerySort after uncustomized cards', () => {
    expect(
      sortGallerySpecimens(
        [
          spec('b', { shiny: true, gallerySort: 1 }),
          spec('a', { gallerySort: 0 }),
          spec('fresh', { shadowStatus: 'shadow' }),
        ],
        categories,
      ).map((row) => row.id),
    ).toEqual(['fresh', 'a', 'b'])
  })

  it('groups by the Transfer species label before the current tag order', () => {
    expect(
      sortGallerySpecimens(
        [
          spec('shadow-hat', { costume: 'Party Hat', shadowStatus: 'shadow' }),
          spec('shiny', { shiny: true }),
          spec('female', { extraTags: ['gender'], gender: 'Female' }),
          spec('hat', { costume: 'Party Hat' }),
          spec('basic'),
        ],
        categories,
      ).map((row) => row.id),
    ).toEqual(['basic', 'shiny', 'female', 'hat', 'shadow-hat'])
  })
})

describe('applyVisibleGalleryOrder', () => {
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('reorders only the visible subset', () => {
    expect(applyVisibleGalleryOrder(rows, ['c', 'b']).map((row) => row.id)).toEqual(['a', 'c', 'b', 'd'])
  })

  it('reorders the full list when every card is visible', () => {
    expect(applyVisibleGalleryOrder(rows, ['d', 'c', 'b', 'a']).map((row) => row.id)).toEqual([
      'd',
      'c',
      'b',
      'a',
    ])
  })

  it('rejects ids that are not in the list', () => {
    expect(() => applyVisibleGalleryOrder(rows, ['a', 'x'])).toThrow('Gallery list is out of date')
  })
})

describe('galleryOrderPatch', () => {
  it('assigns gallerySort from the given list', () => {
    expect(galleryOrderPatch(['a', 'b', 'c'], ['c', 'a', 'b'])).toEqual([
      { id: 'c', gallerySort: 0 },
      { id: 'a', gallerySort: 1 },
      { id: 'b', gallerySort: 2 },
    ])
  })

  it('rejects a partial or unknown list', () => {
    expect(() => galleryOrderPatch(['a', 'b'], ['a'])).toThrow('Gallery list is out of date')
    expect(() => galleryOrderPatch(['a', 'b'], ['a', 'x'])).toThrow('Gallery list is out of date')
  })
})

describe('mergeGalleryDraft', () => {
  it('puts new live ids first and drops deleted ids', () => {
    expect(mergeGalleryDraft(['b', 'a', 'gone'], ['fresh', 'a', 'b'])).toEqual(['fresh', 'b', 'a'])
  })
})

describe('moveVisibleGalleryId', () => {
  it('inserts a dragged card at a target index', () => {
    expect(moveVisibleGalleryId(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
    expect(moveVisibleGalleryId(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
  })
})

describe('galleryTargetIndex', () => {
  const slots = [
    { left: 0, top: 0, width: 100, height: 100 },
    { left: 120, top: 0, width: 100, height: 100 },
    { left: 0, top: 120, width: 100, height: 100 },
  ]

  it('picks the closest slot center', () => {
    expect(galleryTargetIndex(slots, 10, 10)).toBe(0)
    expect(galleryTargetIndex(slots, 170, 40)).toBe(1)
    expect(galleryTargetIndex(slots, 40, 170)).toBe(2)
  })
})

const userTags = [
  { requiredTags: [] as const, sortOrder: 0 },
  { requiredTags: ['mega'] as const, sortOrder: 1 },
  { requiredTags: ['background'] as const, sortOrder: 14 },
  { requiredTags: ['gender'] as const, sortOrder: 8 },
  { requiredTags: ['shiny'] as const, sortOrder: 9 },
  { requiredTags: ['shadow'] as const, sortOrder: 12 },
  { requiredTags: ['hisuian'] as const, sortOrder: 5 },
  { requiredTags: ['paldean'] as const, sortOrder: 6 },
  { requiredTags: ['alternate-forme'] as const, sortOrder: 7 },
]

describe('gallery sections', () => {
  it('keeps a pure tag set, and the special pure cases, in Exact', () => {
    expect(galleryGroup(spec('plain'), userTags)).toBe('exact')
    expect(galleryGroup(spec('shiny', { shiny: true }), userTags)).toBe('exact')
    expect(galleryGroup(spec('shadow', { shadowStatus: 'shadow' }), userTags)).toBe('exact')
    expect(
      galleryGroup(spec('basic-gender', { extraTags: ['basic', 'gender'], gender: 'Female' }), userTags),
    ).toBe('exact')
    expect(
      galleryGroup(spec('shadow-gender', { shadowStatus: 'shadow', extraTags: ['gender'], gender: 'Male' }), userTags),
    ).toBe('exact')
    expect(
      galleryGroup(
        spec('sneasel', {
          speciesId: 215,
          extraTags: ['gender', 'hisuian'],
          gender: 'Hisuian Male',
        }),
        userTags,
      ),
    ).toBe('exact')
    expect(
      galleryGroup(spec('tauros', { speciesId: 128, extraTags: ['paldean', 'alternate-forme'] }), userTags),
    ).toBe('exact')
  })

  it('puts tag sets that cannot be pure in Mixed', () => {
    expect(galleryGroup(spec('shadow-shiny', { shiny: true, shadowStatus: 'shadow' }), userTags)).toBe('mixed')
    expect(
      galleryGroup(spec('mega-bg', { extraTags: ['mega'], background: 'Tokyo' }), userTags),
    ).toBe('mixed')
    expect(
      galleryGroup(spec('wooper', { speciesId: 194, extraTags: ['paldean', 'alternate-forme'] }), userTags),
    ).toBe('mixed')
  })

  it('keeps Seen and Not Pure in Exact, with a gray border', () => {
    const shiny = spec('shiny', { shiny: true, silhouette: true })
    expect(galleryGroup(shiny, userTags)).toBe('exact')
    expect(galleryCardPurity(shiny, userTags)).toBe('gray')
    const marked = spec('marked', { shadowStatus: 'shadow', notPure: true })
    expect(galleryGroup(marked, userTags)).toBe('exact')
    expect(galleryCardPurity(marked, userTags)).toBe('gray')
    expect(galleryCardPurity(spec('pure', { shiny: true }), userTags)).toBe('green')
    expect(galleryCardPurity(spec('mix', { shiny: true, shadowStatus: 'shadow' }), userTags)).toBe('mixed')
  })

  it('keeps the current gallery order inside each section', () => {
    const rows = [
      spec('shiny', { shiny: true }),
      spec('mix', { shiny: true, shadowStatus: 'shadow' }),
      spec('shadow', { shadowStatus: 'shadow' }),
      spec('mega', { extraTags: ['mega'], background: 'Tokyo' }),
      spec('basic'),
    ]
    const split = splitGalleryGroups(rows, userTags)
    expect(split.exact.map((row) => row.id)).toEqual(['shiny', 'shadow', 'basic'])
    expect(split.mixed.map((row) => row.id)).toEqual(['mix', 'mega'])
  })
})

describe('galleryItemShift', () => {
  const slots = [
    { left: 0, top: 0 },
    { left: 80, top: 0 },
    { left: 0, top: 120 },
  ]

  it('moves a card from its origin slot to the target slot', () => {
    expect(galleryItemShift(0, 2, slots)).toEqual({ x: 0, y: 120 })
    expect(galleryItemShift(2, 1, slots)).toEqual({ x: 80, y: -120 })
    expect(galleryItemShift(1, 1, slots)).toEqual({ x: 0, y: 0 })
  })
})
