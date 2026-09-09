import { describe, expect, it } from 'vitest'
import {
  applyRosterSlot,
  canEnableLimitedTag,
  countFilledSlots,
  defaultSlotMode,
  fieldsAllowedOnLimitedTags,
  limitedRosterWarning,
  nationalDexSlots,
  searchSlots,
  slotDisplayName,
  slotsForSelectedTags,
  slotsForTrack,
  specimenFillsSlot,
  usesRosterVariantField,
  type TagCatalog,
  type TagRosterEntry,
} from './roster'
import type { SpecimenFields } from './tags'

const specimen = (over: Partial<SpecimenFields> = {}): SpecimenFields => ({
  speciesId: 1,
  form: null,
  shiny: false,
  shadowStatus: 'none',
  costume: null,
  background: null,
  hundo: false,
  nundo: false,
  extraTags: [],
  ...over,
})

const dynamax: TagCatalog = { tag: 'dynamax', limitPokedex: true, slotMode: 'species' }
const costume: TagCatalog = { tag: 'costume', limitPokedex: true, slotMode: 'variant' }
const shiny: TagCatalog = { tag: 'shiny', limitPokedex: false, slotMode: 'species' }

const roster: TagRosterEntry[] = [
  { tag: 'dynamax', speciesId: 25, variant: '' },
  { tag: 'dynamax', speciesId: 6, variant: '' },
  { tag: 'costume', speciesId: 1, variant: 'Party Hat' },
  { tag: 'costume', speciesId: 1, variant: 'Halloween Cape' },
  { tag: 'costume', speciesId: 1, variant: 'Sandals' },
  { tag: 'costume', speciesId: 25, variant: 'Party Hat' },
]

describe('defaultSlotMode', () => {
  it('uses variant slots for costume, background, and alternate forme', () => {
    expect(defaultSlotMode('costume')).toBe('variant')
    expect(defaultSlotMode('background')).toBe('variant')
    expect(defaultSlotMode('alternate-forme')).toBe('variant')
    expect(defaultSlotMode('dynamax')).toBe('species')
    expect(defaultSlotMode('shiny')).toBe('species')
  })
})

describe('slotsForTrack', () => {
  it('keeps the national dex when Limit is off', () => {
    const slots = slotsForTrack(['shiny'], [shiny], [])
    expect(slots).toHaveLength(nationalDexSlots().length)
    expect(slots[0]).toMatchObject({ speciesId: 1, variant: '', name: 'Bulbasaur' })
  })

  it('lists only released Dynamax species', () => {
    expect(slotsForTrack(['dynamax'], [dynamax], roster).map((slot) => slot.speciesId)).toEqual([6, 25])
  })

  it('lists one Costume slot per released variant', () => {
    const slots = slotsForTrack(['costume'], [costume], roster)
    expect(slots.map((slot) => slot.name)).toEqual([
      'Bulbasaur Halloween Cape',
      'Bulbasaur Party Hat',
      'Bulbasaur Sandals',
      'Pikachu Party Hat',
    ])
  })

  it('intersects species Limit with variant Limit', () => {
    const slots = slotsForTrack(['dynamax', 'costume'], [dynamax, costume], roster)
    expect(slots.map((slot) => slot.name)).toEqual(['Pikachu Party Hat'])
  })
})

describe('countFilledSlots', () => {
  it('counts unique species on unlimited tracks', () => {
    const rows = [specimen(), specimen({ speciesId: 1, shiny: true }), specimen({ speciesId: 4, shiny: true })]
    expect(countFilledSlots(rows, [], [], []).filled).toBe(2)
    expect(countFilledSlots(rows, [], [], []).total).toBe(nationalDexSlots().length)
  })

  it('counts costume variants separately', () => {
    const rows = [
      specimen({ costume: 'Party Hat' }),
      specimen({ costume: 'Sandals' }),
      specimen({ costume: 'Party Hat', shiny: true }),
    ]
    expect(countFilledSlots(rows, ['costume'], [costume], roster)).toEqual({ filled: 2, total: 4 })
  })

  it('does not count a silhouette toward progress', () => {
    const rows = [
      specimen({ silhouette: true }),
      specimen({ speciesId: 4, shiny: true, silhouette: true }),
      specimen({ speciesId: 7 }),
    ]
    expect(countFilledSlots(rows, [], [], []).filled).toBe(1)
    expect(
      countFilledSlots(
        [specimen({ costume: 'Party Hat', silhouette: true })],
        ['costume'],
        [costume],
        roster,
      ).filled,
    ).toBe(0)
  })

  it('still counts a slot that also has a catch', () => {
    const rows = [specimen({ silhouette: true }), specimen()]
    expect(countFilledSlots(rows, [], [], []).filled).toBe(1)
  })
})

describe('specimenFillsSlot', () => {
  it('fills a costume slot by variant name, extras allowed', () => {
    const slot = { speciesId: 1, variant: 'Party Hat', name: 'Bulbasaur Party Hat' }
    expect(specimenFillsSlot(specimen({ costume: 'Party Hat', shiny: true }), ['costume'], slot, [costume])).toBe(
      true,
    )
    expect(specimenFillsSlot(specimen({ costume: 'Sandals' }), ['costume'], slot, [costume])).toBe(false)
  })
})

describe('limited roster checks', () => {
  it('blocks a species that is not released for Dynamax', () => {
    expect(canEnableLimitedTag(specimen({ speciesId: 1 }), 'dynamax', [dynamax], roster)).toBe(false)
    expect(canEnableLimitedTag(specimen({ speciesId: 25 }), 'dynamax', [dynamax], roster)).toBe(true)
    expect(limitedRosterWarning(specimen({ speciesId: 1, extraTags: ['dynamax'] }), [dynamax], roster)).toBe(
      'Not in the Dynamax Pokédex',
    )
  })

  it('allows toggling a limited tag before a species is picked', () => {
    expect(canEnableLimitedTag(specimen({ speciesId: 0 }), 'dynamax', [dynamax], roster)).toBe(true)
  })

  it('ignores an empty costume name until a slot is chosen', () => {
    expect(fieldsAllowedOnLimitedTags(specimen({ speciesId: 1, costume: '' }), [costume], roster)).toBe(null)
  })
})

describe('applyRosterSlot', () => {
  it('writes the costume name from the slot', () => {
    const next = applyRosterSlot(
      specimen({ costume: '' }),
      { speciesId: 1, variant: 'Party Hat', name: 'Bulbasaur Party Hat' },
      ['costume'],
      [costume],
    )
    expect(next.speciesId).toBe(1)
    expect(next.costume).toBe('Party Hat')
  })
})

describe('searchSlots', () => {
  it('matches number, species, and variant', () => {
    const slots = slotsForTrack(['costume'], [costume], roster)
    expect(searchSlots(slots, 'party').map((slot) => slot.name)).toEqual([
      'Bulbasaur Party Hat',
      'Pikachu Party Hat',
    ])
    expect(searchSlots(slots, '0001')).toHaveLength(3)
  })
})

describe('usesRosterVariantField', () => {
  it('hides free-text costume when the Costume roster is limited', () => {
    expect(usesRosterVariantField('costume', [costume])).toBe(true)
    expect(usesRosterVariantField('costume', [{ ...costume, limitPokedex: false }])).toBe(false)
  })
})

describe('slotDisplayName', () => {
  it('keeps the national number identity and appends the variant', () => {
    expect(slotDisplayName(1, 'Party Hat')).toBe('Bulbasaur Party Hat')
    expect(slotDisplayName(1, '')).toBe('Bulbasaur')
  })
})

describe('slotsForSelectedTags', () => {
  it('uses the full dex until a limited tag is on', () => {
    expect(slotsForSelectedTags(['shiny'], [shiny, dynamax], roster)).toHaveLength(nationalDexSlots().length)
    expect(slotsForSelectedTags(['dynamax'], [dynamax], roster)).toHaveLength(2)
  })
})
