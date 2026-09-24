import { describe, expect, it } from 'vitest'
import {
  applyRosterSlot,
  canEnableLimitedTag,
  catalogForTag,
  countFilledSlots,
  countReleasedSlots,
  defaultLimitPokedex,
  defaultSlotMode,
  extraCartesianSlots,
  slotModeLockedToSpecies,
  slotModeLockedToVariant,
  fieldsAllowedOnLimitedTags,
  limitedRosterWarning,
  nationalDexSlots,
  exactFileNameDexSpecimen,
  searchDexSlots,
  searchSlots,
  searchVariantNames,
  slotsForEvolutionLine,
  uniqueSearchSpeciesId,
  slotDisplayName,
  specimenSlotBoxLabel,
  specimenSlotDisplayName,
  specimenSlotName,
  slotsForSelectedTags,
  slotsForTrack,
  specimenFillsSlot,
  trackIsLimited,
  uniqueVariantNamesForTag,
  usesRosterVariantField,
  variantFieldComesFromSlot,
  type TagCatalog,
  type TagRosterEntry,
} from './roster'
import { GO_BACKGROUND, GO_COSTUME, GO_FORM_SPECIES_IDS, GO_MEGA } from '../data/goFormReleased'
import { nundoExcludesSpecies } from '../data/goLegendary'
import { GO_LUCKY_IDS, GO_RELEASED_IDS } from '../data/goReleased'
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
  hokido: false,
  extraTags: [],
  ...over,
})

const dynamax: TagCatalog = { tag: 'dynamax', limitPokedex: true, slotMode: 'species' }
const costume: TagCatalog = { tag: 'costume', limitPokedex: true, slotMode: 'variant' }
const shiny: TagCatalog = { tag: 'shiny', limitPokedex: false, slotMode: 'species' }
const basic: TagCatalog = { tag: 'basic', limitPokedex: true, slotMode: 'species' }

const roster: TagRosterEntry[] = [
  { tag: 'dynamax', speciesId: 25, variant: '' },
  { tag: 'dynamax', speciesId: 6, variant: '' },
  { tag: 'costume', speciesId: 1, variant: 'Party Hat' },
  { tag: 'costume', speciesId: 1, variant: 'Halloween Cape' },
  { tag: 'costume', speciesId: 1, variant: 'Sandals' },
  { tag: 'costume', speciesId: 25, variant: 'Party Hat' },
  { tag: 'basic', speciesId: 1, variant: '' },
  { tag: 'basic', speciesId: 25, variant: '' },
]

describe('defaultSlotMode', () => {
  it('uses variant slots for costume, background, alternate forme, gender, and mega', () => {
    expect(defaultSlotMode('costume')).toBe('variant')
    expect(defaultSlotMode('background')).toBe('variant')
    expect(defaultSlotMode('alternate-forme')).toBe('variant')
    expect(defaultSlotMode('dynamax')).toBe('species')
    expect(defaultSlotMode('shiny')).toBe('species')
    expect(defaultSlotMode('paldean')).toBe('species')
    expect(defaultSlotMode('alolan')).toBe('species')
    expect(defaultSlotMode('gigantamax')).toBe('species')
    expect(defaultSlotMode('gender')).toBe('variant')
    expect(defaultSlotMode('mega')).toBe('variant')
    expect(slotModeLockedToSpecies('gigantamax')).toBe(true)
    expect(slotModeLockedToSpecies('shiny')).toBe(true)
    expect(slotModeLockedToSpecies('dynamax')).toBe(true)
    expect(slotModeLockedToSpecies('shadow')).toBe(true)
    expect(slotModeLockedToSpecies('purified')).toBe(true)
    expect(slotModeLockedToSpecies('lucky')).toBe(true)
    expect(defaultSlotMode('shadow')).toBe('species')
    expect(defaultSlotMode('purified')).toBe('species')
    expect(defaultSlotMode('lucky')).toBe('species')
    expect(slotModeLockedToVariant('gender')).toBe(true)
    expect(slotModeLockedToVariant('mega')).toBe(true)
    expect(slotModeLockedToVariant('costume')).toBe(true)
    expect(slotModeLockedToVariant('background')).toBe(true)
  })
})

describe('defaultLimitPokedex', () => {
  it('limits own-list tags and leaves Basic-followers on the Basic list', () => {
    expect(defaultLimitPokedex('basic')).toBe(true)
    expect(defaultLimitPokedex('shiny')).toBe(true)
    expect(defaultLimitPokedex('hundo')).toBe(false)
    expect(defaultLimitPokedex('best-buddy')).toBe(false)
    expect(defaultLimitPokedex('xxl')).toBe(false)
  })
})

describe('slotsForTrack', () => {
  it('keeps the national dex when Basic Limit is off', () => {
    const slots = slotsForTrack(
      [],
      [{ tag: 'basic', limitPokedex: false, slotMode: 'species' }],
      [],
    )
    expect(slots).toHaveLength(nationalDexSlots().length)
    expect(slots[0]).toMatchObject({ speciesId: 1, variant: '', name: 'Bulbasaur' })
  })

  it('lists wiki Dynamax species without a stored roster', () => {
    expect(slotsForTrack(['dynamax'], [dynamax], []).map((slot) => slot.speciesId)).toEqual([
      ...GO_FORM_SPECIES_IDS.dynamax,
    ])
  })

  it('lists wiki Shadow species without a stored roster', () => {
    const shadow: TagCatalog = { tag: 'shadow', limitPokedex: true, slotMode: 'variant' }
    const slots = slotsForTrack(['shadow'], [shadow], [])
    expect(catalogForTag([shadow], 'shadow').slotMode).toBe('species')
    expect(slots.map((slot) => slot.speciesId)).toEqual([...GO_FORM_SPECIES_IDS.shadow])
    expect(slots.every((slot) => slot.variant === '')).toBe(true)
    expect(countReleasedSlots(['shadow'], [shadow], [])).toBe(GO_FORM_SPECIES_IDS.shadow.size)
  })

  it('lists Purified from the same Shadow species list', () => {
    const purified: TagCatalog = { tag: 'purified', limitPokedex: true, slotMode: 'variant' }
    const slots = slotsForTrack(['purified'], [purified], [])
    expect(catalogForTag([purified], 'purified').slotMode).toBe('species')
    expect(slots.map((slot) => slot.speciesId)).toEqual([...GO_FORM_SPECIES_IDS.shadow])
    expect(slots.every((slot) => slot.variant === '')).toBe(true)
    expect(countReleasedSlots(['purified'], [purified], [])).toBe(GO_FORM_SPECIES_IDS.shadow.size)
  })

  it('lists Lucky from the released list minus Untradable species', () => {
    const lucky: TagCatalog = { tag: 'lucky', limitPokedex: true, slotMode: 'variant' }
    const slots = slotsForTrack(['lucky'], [lucky], [])
    expect(catalogForTag([lucky], 'lucky').slotMode).toBe('species')
    expect(slots.map((slot) => slot.speciesId)).toEqual([...GO_LUCKY_IDS])
    expect(slots.every((slot) => slot.variant === '')).toBe(true)
    expect(countReleasedSlots(['lucky'], [lucky], [])).toBe(GO_LUCKY_IDS.size)
    expect(slots.some((slot) => slot.speciesId === 808)).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 151)).toBe(false)
  })

  it('lists wiki Event Pokémon costumes without a stored roster', () => {
    const slots = slotsForTrack(['costume'], [costume], [])
    expect(catalogForTag([costume], 'costume').slotMode).toBe('variant')
    expect(slots).toHaveLength(GO_COSTUME.length)
    expect(slots.some((slot) => slot.speciesId === 1 && slot.variant === 'Halloween')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 1 && slot.variant === 'Party hat')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 25 && slot.variant === 'Party hat')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 4 && /friede/i.test(slot.variant))).toBe(false)
    expect(countReleasedSlots(['costume'], [costume], [])).toBe(GO_COSTUME.length)
  })

  it('keeps extra costume names that are not on the wiki list', () => {
    const slots = slotsForTrack(['costume'], [costume], roster)
    expect(slots.some((slot) => slot.speciesId === 1 && slot.variant === 'Halloween Cape')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 1 && slot.variant === 'Sandals')).toBe(true)
    expect(countReleasedSlots(['costume'], [costume], roster)).toBe(GO_COSTUME.length + 2)
  })

  it('lists wiki Backgrounds without a stored roster', () => {
    const background: TagCatalog = { tag: 'background', limitPokedex: true, slotMode: 'species' }
    const slots = slotsForTrack(['background'], [background], [])
    expect(catalogForTag([background], 'background').slotMode).toBe('variant')
    expect(slots).toHaveLength(GO_BACKGROUND.length)
    expect(slots.some((slot) => slot.speciesId === 382 && slot.variant === 'Las Vegas, US')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 3 && slot.variant === 'Mega Evolve')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 719 && slot.variant === 'Mega Evolve')).toBe(true)
    expect(
      slots.some((slot) => slot.speciesId === 793 && slot.variant === 'Pokémon GO Fest 2024: Wormhole'),
    ).toBe(true)
    expect(slots.some((slot) => /busan fireworks/i.test(slot.variant))).toBe(false)
    expect(countReleasedSlots(['background'], [background], [])).toBe(GO_BACKGROUND.length)
  })

  it('intersects species Limit with variant Limit', () => {
    const slots = slotsForTrack(['dynamax', 'costume'], [dynamax, costume], roster)
    const wiki = GO_COSTUME.filter((row) => GO_FORM_SPECIES_IDS.dynamax.has(row.speciesId))
    expect(slots.some((slot) => slot.speciesId === 1 && slot.variant === 'Halloween')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 1 && slot.variant === 'Halloween Cape')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 25 && /party hat/i.test(slot.variant))).toBe(true)
    expect(slots.every((slot) => GO_FORM_SPECIES_IDS.dynamax.has(slot.speciesId))).toBe(true)
    expect(slots.length).toBe(wiki.length + 2)
  })

  it('combines Mega and Gender variants instead of requiring the same name', () => {
    const mega: TagCatalog = { tag: 'mega', limitPokedex: true, slotMode: 'variant' }
    const gender: TagCatalog = { tag: 'gender', limitPokedex: true, slotMode: 'variant' }
    const shinyTrack: TagCatalog = { tag: 'shiny', limitPokedex: true, slotMode: 'species' }
    const slots = slotsForSelectedTags(['mega', 'shiny', 'gender'], [mega, gender, shinyTrack], [])
    expect(slots.filter((slot) => slot.speciesId === 3).map((slot) => slot.variant)).toEqual([
      'Mega Female',
      'Mega Male',
    ])
    expect(slots.some((slot) => slot.name === 'Venusaur Mega Male')).toBe(true)
    expect(slots.some((slot) => slot.name === 'Venusaur Mega Female')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 6)).toBe(false)
    expect(
      slotsForSelectedTags(['gender', 'mega'], [mega, gender], [])
        .filter((slot) => slot.speciesId === 3)
        .map((slot) => slot.variant),
    ).toEqual(['Mega Female', 'Mega Male'])
    const picked = applyRosterSlot(
      specimen({ shiny: true, extraTags: ['mega', 'gender'], gender: '' }),
      slots.find((slot) => slot.speciesId === 3 && slot.variant === 'Mega Male')!,
      ['shiny', 'mega', 'gender'],
      [mega, gender, shinyTrack],
    )
    expect(picked).toMatchObject({
      speciesId: 3,
      form: 'Mega',
      gender: 'Male',
      shiny: true,
      extraTags: ['mega', 'gender'],
    })
    expect(
      specimenFillsSlot(
        picked,
        ['shiny', 'mega', 'gender'],
        { speciesId: 3, variant: 'Mega Male', name: 'Venusaur Mega Male' },
        [mega, gender, shinyTrack],
      ),
    ).toBe(true)
  })

  it('combines Gender and Costume into Kurta Male / Kurta Female slots', () => {
    const gender: TagCatalog = { tag: 'gender', limitPokedex: true, slotMode: 'variant' }
    const slots = slotsForSelectedTags(['gender', 'costume'], [gender, costume], [])
    const kurta = slots.filter((slot) => slot.speciesId === 25 && /kurta/i.test(slot.variant))
    expect(kurta.map((slot) => slot.variant)).toEqual(['Kurta Female', 'Kurta Male'])
    expect(kurta.some((slot) => slot.name === 'Pikachu Kurta Male')).toBe(true)
    expect(kurta.some((slot) => slot.name === 'Pikachu Kurta Female')).toBe(true)
    expect(variantFieldComesFromSlot('costume', ['gender', 'costume'], [gender, costume], slots)).toBe(
      true,
    )
    const male = kurta.find((slot) => slot.variant === 'Kurta Male')!
    expect(
      applyRosterSlot(specimen({ extraTags: ['gender'], gender: '', costume: '' }), male, ['gender', 'costume'], [
        gender,
        costume,
      ]),
    ).toMatchObject({
      speciesId: 25,
      gender: 'Male',
      costume: 'Kurta',
      extraTags: ['gender'],
    })
  })

  it('combines Alternate forme and Costume into Pumpkaboo size Halloween Party slots', () => {
    const forme: TagCatalog = { tag: 'alternate-forme', limitPokedex: true, slotMode: 'variant' }
    const slots = slotsForTrack(['alternate-forme', 'costume'], [forme, costume], [])
    const pumpkaboo = slots.filter((slot) => slot.speciesId === 710)
    expect(pumpkaboo.map((slot) => slot.variant).sort()).toEqual([
      'Jumbo Variety Halloween Party',
      'Large Variety Halloween Party',
      'Small Variety Halloween Party',
    ])
    expect(slots.some((slot) => slot.name === 'Pumpkaboo Large Variety Halloween Party')).toBe(true)
    expect(slots.some((slot) => slot.name === 'Pumpkaboo Jumbo Variety Halloween Party')).toBe(true)
    expect(pumpkaboo.some((slot) => /halloween jumbo variety/i.test(slot.variant))).toBe(false)
    const large = pumpkaboo.find((slot) => slot.variant === 'Large Variety Halloween Party')!
    expect(
      applyRosterSlot(
        specimen({ extraTags: ['alternate-forme'], form: '', costume: '' }),
        large,
        ['alternate-forme', 'costume'],
        [forme, costume],
      ),
    ).toMatchObject({
      speciesId: 710,
      form: 'Large Variety',
      costume: 'Halloween Party',
      extraTags: ['alternate-forme'],
    })
  })

  it('lets a roster extra add a missing Gender + Costume combo', () => {
    const gender: TagCatalog = { tag: 'gender', limitPokedex: true, slotMode: 'variant' }
    const extra: TagRosterEntry[] = [{ tag: 'costume', speciesId: 25, variant: 'Festival Shirt' }]
    const added = extraCartesianSlots(['gender', 'costume'], [gender, costume], extra)
    expect(added.map((slot) => slot.variant).sort()).toEqual([
      'Festival Shirt Female',
      'Festival Shirt Male',
    ])
    expect(added.some((slot) => slot.name === 'Pikachu Festival Shirt Male')).toBe(true)
  })

  it('pairs a size-in-costume extra only with that Pumpkaboo forme', () => {
    const forme: TagCatalog = { tag: 'alternate-forme', limitPokedex: true, slotMode: 'variant' }
    const extra: TagRosterEntry[] = [
      { tag: 'costume', speciesId: 710, variant: 'Candy Large Variety' },
    ]
    const added = extraCartesianSlots(['alternate-forme', 'costume'], [forme, costume], extra)
    expect(added.map((slot) => slot.variant)).toEqual(['Large Variety Candy'])
    expect(added.some((slot) => /jumbo/i.test(slot.variant))).toBe(false)
  })

  it('combines Mega and Background variants for overlapping species', () => {
    const mega: TagCatalog = { tag: 'mega', limitPokedex: true, slotMode: 'variant' }
    const background: TagCatalog = { tag: 'background', limitPokedex: true, slotMode: 'variant' }
    const slots = slotsForSelectedTags(['mega', 'background'], [mega, background], [])
    const venusaur = slots.filter((slot) => slot.speciesId === 3)
    expect(venusaur).toHaveLength(3)
    expect(venusaur.some((slot) => slot.variant.includes('Mega Evolution'))).toBe(true)
    expect(venusaur.some((slot) => slot.variant.includes('Mega Evolve'))).toBe(true)
    expect(venusaur.some((slot) => slot.variant.includes('Max Finale'))).toBe(true)
    expect(slots.every((slot) => GO_MEGA.some((row) => row.speciesId === slot.speciesId))).toBe(true)
    expect(slots.every((slot) => GO_BACKGROUND.some((row) => row.speciesId === slot.speciesId))).toBe(
      true,
    )
    expect(variantFieldComesFromSlot('background', ['mega', 'background'], [mega, background], slots)).toBe(
      true,
    )
    const maxFinale = venusaur.find((slot) => slot.variant.includes('Max Finale'))
    expect(maxFinale).toBeTruthy()
    expect(
      applyRosterSlot(
        specimen({ extraTags: ['mega'], background: '' }),
        maxFinale!,
        ['mega', 'background'],
        [mega, background],
      ),
    ).toMatchObject({
      speciesId: 3,
      form: 'Mega',
      background: 'Pokémon GO Fest 2025: Max Finale',
      extraTags: ['mega'],
    })
  })
})

describe('countReleasedSlots', () => {
  it('counts zero own-list slots until that roster is filled', () => {
    expect(countReleasedSlots(['friendship'], [], [])).toBe(0)
  })

  it('counts released Dynamax species', () => {
    expect(countReleasedSlots(['dynamax'], [dynamax], [])).toBe(GO_FORM_SPECIES_IDS.dynamax.size)
  })

  it('counts one Costume slot per released variant', () => {
    expect(countReleasedSlots(['costume'], [costume], [])).toBe(GO_COSTUME.length)
    expect(countReleasedSlots(['costume'], [costume], roster)).toBe(GO_COSTUME.length + 2)
  })
})

describe('countFilledSlots', () => {
  it('counts unique species on unlimited tracks', () => {
    const rows = [specimen(), specimen({ speciesId: 1, shiny: true }), specimen({ speciesId: 4, shiny: true })]
    expect(countFilledSlots(rows, [], [], [])).toMatchObject({ seen: 2, caught: 2, pure: 1, filled: 2 })
    expect(countFilledSlots(rows, [], [], []).total).toBe(GO_RELEASED_IDS.size)
  })

  it('counts costume variants separately', () => {
    const rows = [
      specimen({ costume: 'Party Hat' }),
      specimen({ costume: 'Sandals' }),
      specimen({ costume: 'Party Hat', shiny: true }),
    ]
    expect(countFilledSlots(rows, ['costume'], [costume], roster)).toEqual({
      seen: 2,
      caught: 2,
      pure: 2,
      filled: 2,
      total: GO_COSTUME.length + 2,
    })
  })

  it('does not count a silhouette toward caught or pure', () => {
    const rows = [
      specimen({ silhouette: true }),
      specimen({ speciesId: 4, shiny: true, silhouette: true }),
      specimen({ speciesId: 7 }),
    ]
    expect(countFilledSlots(rows, [], [], [])).toMatchObject({ seen: 3, caught: 1, pure: 1, filled: 1 })
    expect(
      countFilledSlots(
        [specimen({ costume: 'Party Hat', silhouette: true })],
        ['costume'],
        [costume],
        roster,
      ),
    ).toMatchObject({ seen: 1, caught: 0, pure: 0, filled: 0 })
  })

  it('counts a not-pure catch as seen and caught, not pure', () => {
    expect(countFilledSlots([specimen({ notPure: true })], [], [], [])).toMatchObject({
      seen: 1,
      caught: 1,
      pure: 0,
      filled: 1,
    })
  })

  it('still counts a slot that also has a catch', () => {
    const rows = [specimen({ silhouette: true }), specimen()]
    expect(countFilledSlots(rows, [], [], [])).toMatchObject({ seen: 1, caught: 1, pure: 1, filled: 1 })
  })

  it('can limit progress to one generation range', () => {
    const rows = [
      specimen({ speciesId: 1 }),
      specimen({ speciesId: 4, shiny: true }),
      specimen({ speciesId: 152 }),
    ]
    expect(countFilledSlots(rows, [], [], [], { start: 1, end: 151 })).toMatchObject({
      seen: 2,
      caught: 2,
      pure: 1,
    })
    expect(countFilledSlots(rows, [], [], [], { start: 1, end: 151 }).total).toBeLessThan(
      countFilledSlots(rows, [], [], []).total,
    )
    expect(countFilledSlots(rows, [], [], [], { start: 152, end: 251 })).toMatchObject({
      seen: 1,
      caught: 1,
      pure: 1,
    })
  })

  it('counts extra-tag catches as seen and caught, not pure', () => {
    const rows = [specimen({ costume: 'Party Hat', shiny: true }), specimen({ costume: 'Sandals' })]
    expect(countFilledSlots(rows, ['costume'], [costume], roster)).toMatchObject({
      seen: 2,
      caught: 2,
      pure: 1,
      filled: 2,
    })
  })

  it('counts Paldean Tauros with an Alternate forme breed as pure', () => {
    const paldean: TagCatalog = { tag: 'paldean', limitPokedex: true, slotMode: 'species' }
    const combat = specimen({
      speciesId: 128,
      form: 'Combat Breed',
      extraTags: ['paldean', 'alternate-forme'],
    })
    const shinyCombat = specimen({
      speciesId: 128,
      form: 'Blaze Breed',
      shiny: true,
      extraTags: ['paldean', 'alternate-forme'],
    })
    const wooper = specimen({ speciesId: 194, extraTags: ['paldean'] })
    expect(countFilledSlots([combat, wooper], ['paldean'], [paldean], [])).toMatchObject({
      seen: 2,
      caught: 2,
      pure: 2,
      filled: 2,
    })
    expect(countFilledSlots([shinyCombat], ['paldean'], [paldean], [])).toMatchObject({
      seen: 1,
      caught: 1,
      pure: 0,
      filled: 1,
    })
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
    expect(canEnableLimitedTag(specimen({ speciesId: 1 }), 'dynamax', [dynamax], [])).toBe(true)
    expect(canEnableLimitedTag(specimen({ speciesId: 25 }), 'dynamax', [dynamax], [])).toBe(true)
    expect(canEnableLimitedTag(specimen({ speciesId: 13 }), 'dynamax', [dynamax], [])).toBe(false)
    expect(limitedRosterWarning(specimen({ speciesId: 13, extraTags: ['dynamax'] }), [dynamax], [])).toBe(
      'Not in the Dynamax Pokédex',
    )
    expect(limitedRosterWarning(specimen({ speciesId: 143, extraTags: ['dynamax'] }), [dynamax], [])).toBe(
      'Not in the Dynamax Pokédex',
    )
  })

  it('blocks a species that is not released for Shadow', () => {
    const shadow: TagCatalog = { tag: 'shadow', limitPokedex: true, slotMode: 'species' }
    expect(
      canEnableLimitedTag(specimen({ speciesId: 1, shadowStatus: 'shadow' }), 'shadow', [shadow], []),
    ).toBe(true)
    expect(
      canEnableLimitedTag(specimen({ speciesId: 25, shadowStatus: 'shadow' }), 'shadow', [shadow], []),
    ).toBe(false)
    expect(limitedRosterWarning(specimen({ speciesId: 1, shadowStatus: 'shadow' }), [shadow], [])).toBe('')
    expect(limitedRosterWarning(specimen({ speciesId: 25, shadowStatus: 'shadow' }), [shadow], [])).toBe(
      'Not in the Shadow Pokédex',
    )
  })

  it('blocks a species that is not released for Purified', () => {
    const purified: TagCatalog = { tag: 'purified', limitPokedex: true, slotMode: 'species' }
    expect(
      canEnableLimitedTag(specimen({ speciesId: 1, shadowStatus: 'purified' }), 'purified', [purified], []),
    ).toBe(true)
    expect(
      canEnableLimitedTag(specimen({ speciesId: 25, shadowStatus: 'purified' }), 'purified', [purified], []),
    ).toBe(false)
    expect(
      limitedRosterWarning(specimen({ speciesId: 1, shadowStatus: 'purified' }), [purified], []),
    ).toBe('')
    expect(
      limitedRosterWarning(specimen({ speciesId: 25, shadowStatus: 'purified' }), [purified], []),
    ).toBe('Not in the Purified Pokédex')
  })

  it('blocks an Untradable species on Lucky', () => {
    const lucky: TagCatalog = { tag: 'lucky', limitPokedex: true, slotMode: 'species' }
    expect(canEnableLimitedTag(specimen({ speciesId: 1, extraTags: ['lucky'] }), 'lucky', [lucky], [])).toBe(
      true,
    )
    expect(
      canEnableLimitedTag(specimen({ speciesId: 151, extraTags: ['lucky'] }), 'lucky', [lucky], []),
    ).toBe(false)
    expect(limitedRosterWarning(specimen({ speciesId: 1, extraTags: ['lucky'] }), [lucky], [])).toBe('')
    expect(limitedRosterWarning(specimen({ speciesId: 151, extraTags: ['lucky'] }), [lucky], [])).toBe(
      'Not in the Lucky Pokédex',
    )
    expect(limitedRosterWarning(specimen({ speciesId: 808, extraTags: ['lucky'] }), [lucky], [])).toBe('')
  })

  it('blocks a costume that is not on the Event Pokémon list', () => {
    expect(canEnableLimitedTag(specimen({ speciesId: 1, costume: 'Halloween' }), 'costume', [costume], [])).toBe(
      true,
    )
    expect(
      canEnableLimitedTag(specimen({ speciesId: 4, costume: "Friede's goggles" }), 'costume', [costume], []),
    ).toBe(false)
    expect(limitedRosterWarning(specimen({ speciesId: 1, costume: 'Halloween' }), [costume], [])).toBe('')
    expect(
      limitedRosterWarning(specimen({ speciesId: 4, costume: "Friede's goggles" }), [costume], []),
    ).toBe('Not in the Costume Pokédex')
  })

  it('blocks a background that is not on the wiki list', () => {
    const background: TagCatalog = { tag: 'background', limitPokedex: true, slotMode: 'variant' }
    expect(
      canEnableLimitedTag(
        specimen({ speciesId: 382, background: 'Las Vegas, US' }),
        'background',
        [background],
        [],
      ),
    ).toBe(true)
    expect(
      canEnableLimitedTag(
        specimen({ speciesId: 1, background: 'Las Vegas, US' }),
        'background',
        [background],
        [],
      ),
    ).toBe(false)
    expect(
      limitedRosterWarning(specimen({ speciesId: 382, background: 'Las Vegas, US' }), [background], []),
    ).toBe('')
    expect(
      limitedRosterWarning(specimen({ speciesId: 1, background: 'Las Vegas, US' }), [background], []),
    ).toBe('Not in the Background Pokédex')
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
    const party = searchSlots(slots, 'party').map((slot) => slot.name)
    expect(party.some((name) => name.toLowerCase() === 'bulbasaur party hat')).toBe(true)
    expect(party.some((name) => name.toLowerCase() === 'pikachu party hat')).toBe(true)
    expect(party.length).toBeGreaterThan(2)
    expect(searchSlots(slots, '0001').every((slot) => slot.speciesId === 1)).toBe(true)
    expect(searchSlots(slots, '0001').length).toBeGreaterThanOrEqual(3)
  })
})

describe('searchDexSlots', () => {
  const slots = slotsForTrack(['costume'], [costume], roster)
  const partyHat = {
    ...specimen({ speciesId: 25, costume: 'Party Hat' }),
    fileName: 'IMG_1234.PNG',
  }
  const shinyPikachu = {
    ...specimen({ speciesId: 25, shiny: true }),
    fileName: 'IMG_9999.png',
  }

  it('still matches species names when no filename hits', () => {
    const names = searchDexSlots(slots, 'party', [partyHat], ['costume'], [costume]).map(
      (slot) => slot.name,
    )
    expect(names.some((name) => name.toLowerCase() === 'pikachu party hat')).toBe(true)
  })

  it('keeps a slot whose screenshot filename matches', () => {
    const hits = searchDexSlots(slots, 'img_1234', [partyHat], ['costume'], [costume])
    expect(hits).toEqual([expect.objectContaining({ speciesId: 25, variant: 'Party Hat' })])
  })

  it('ignores a filename that does not fill the current track', () => {
    expect(searchDexSlots(slots, 'img_9999', [shinyPikachu], ['costume'], [costume])).toEqual([])
  })

  it('does not leak a filename hit onto other variants of the same species', () => {
    const hits = searchDexSlots(slots, 'img_1234', [partyHat], ['costume'], [costume])
    expect(hits.every((slot) => slot.variant === 'Party Hat')).toBe(true)
  })
})

describe('exactFileNameDexSpecimen', () => {
  const slots = slotsForTrack(['costume'], [costume], roster)
  const partyHat = {
    ...specimen({ speciesId: 25, costume: 'Party Hat' }),
    fileName: 'IMG_1234.PNG',
  }

  it('returns the specimen when the query is the full filename with extension', () => {
    expect(exactFileNameDexSpecimen(slots, 'img_1234.png', [partyHat], ['costume'], [costume])).toBe(
      partyHat,
    )
    expect(
      exactFileNameDexSpecimen(slots, 'C:\\Pictures\\IMG_1234.PNG', [partyHat], ['costume'], [costume]),
    ).toBe(partyHat)
  })

  it('stays closed for a partial filename', () => {
    expect(exactFileNameDexSpecimen(slots, 'img_1234', [partyHat], ['costume'], [costume])).toBeNull()
    expect(exactFileNameDexSpecimen(slots, '1234.png', [partyHat], ['costume'], [costume])).toBeNull()
  })

  it('ignores a full filename that does not fill the current track', () => {
    const shinyPikachu = {
      ...specimen({ speciesId: 25, shiny: true }),
      fileName: 'IMG_9999.png',
    }
    expect(
      exactFileNameDexSpecimen(slots, 'IMG_9999.png', [shinyPikachu], ['costume'], [costume]),
    ).toBeNull()
  })
})

describe('uniqueSearchSpeciesId', () => {
  const slots = slotsForTrack([], [], [])

  it('is only set when the query leaves one species', () => {
    expect(uniqueSearchSpeciesId(slots, 'pikachu')).toBe(25)
    expect(uniqueSearchSpeciesId(slots, '0025')).toBe(25)
    expect(uniqueSearchSpeciesId(slots, 'chu')).toBeNull()
    expect(uniqueSearchSpeciesId(slots, 'nidoran')).toBeNull()
    expect(uniqueSearchSpeciesId(slots, '')).toBeNull()
  })

  it('still counts many looks of the same species as one species', () => {
    const costumes = slotsForTrack(['costume'], [costume], roster)
    expect(uniqueSearchSpeciesId(costumes, 'dapper with')).toBe(25)
    expect(uniqueSearchSpeciesId(costumes, 'pikachu')).toBeNull()
    expect(uniqueSearchSpeciesId(costumes, 'party')).toBeNull()
    expect(uniqueSearchSpeciesId(costumes, 'pikachu visor')).toBeNull()
  })

  it('is set when a filename search leaves one species', () => {
    const costumes = slotsForTrack(['costume'], [costume], roster)
    const partyHat = {
      ...specimen({ speciesId: 25, costume: 'Party Hat' }),
      fileName: 'IMG_1234.PNG',
    }
    expect(uniqueSearchSpeciesId(costumes, 'img_1234', [partyHat], ['costume'], [costume])).toBe(25)
  })
})

describe('slotsForEvolutionLine', () => {
  it('includes previous and next stages in evolutionary order', () => {
    const slots = slotsForTrack([], [], [])
    expect(slotsForEvolutionLine(slots, 25).map((slot) => slot.speciesId)).toEqual([172, 25, 26])
  })
})

describe('usesRosterVariantField', () => {
  it('hides free-text costume when the Costume roster is limited', () => {
    expect(usesRosterVariantField('costume', [costume])).toBe(true)
    expect(usesRosterVariantField('costume', [{ ...costume, limitPokedex: false }])).toBe(true)
  })
})

describe('uniqueVariantNamesForTag', () => {
  it('lists unique Costume names from the wiki list and extra roster rows', () => {
    const names = uniqueVariantNamesForTag('costume', roster)
    expect(names.some((name) => name.toLowerCase() === 'party hat')).toBe(true)
    expect(names).toContain('Halloween Cape')
    expect(names).toContain('Sandals')
    expect(names.filter((name) => name.toLowerCase() === 'party hat')).toHaveLength(1)
  })

  it('lists unique Gender names from the wiki list', () => {
    const names = uniqueVariantNamesForTag('gender', [])
    expect(names).toEqual(expect.arrayContaining(['Female', 'Hisuian Female', 'Hisuian Male', 'Male']))
  })
})

describe('searchVariantNames', () => {
  const names = ['Halloween Cape', 'Party Hat', 'Sandals']

  it('filters existing names as the user types', () => {
    expect(searchVariantNames(names, 'hat')).toEqual(['Party Hat'])
    expect(searchVariantNames(names, 'cape')).toEqual(['Halloween Cape'])
  })

  it('hides suggestions once the typed name matches exactly', () => {
    expect(searchVariantNames(names, 'Party Hat')).toEqual([])
  })

  it('keeps a new typed name with no suggestions', () => {
    expect(searchVariantNames(names, 'Star Crown')).toEqual([])
    expect(searchVariantNames(names, '')).toEqual([])
  })
})

describe('slotDisplayName', () => {
  it('keeps the national number identity and appends the variant', () => {
    expect(slotDisplayName(1, 'Party Hat')).toBe('Bulbasaur Party Hat')
    expect(slotDisplayName(1, '')).toBe('Bulbasaur')
    expect(slotDisplayName(201, '')).toBe('Unown F')
    expect(slotDisplayName(201, 'A')).toBe('Unown A')
    expect(slotDisplayName(849, '')).toBe('Toxtricity Amped Form')
    expect(slotDisplayName(849, 'Low Key Form')).toBe('Toxtricity Low Key Form')
    expect(slotDisplayName(718, '')).toBe('Zygarde 10% Forme')
    expect(slotDisplayName(718, '50% Forme')).toBe('Zygarde 50% Forme')
    expect(slotDisplayName(718, 'Complete Forme')).toBe('Zygarde Complete Forme')
    expect(slotDisplayName(128, '')).toBe('Tauros')
    expect(slotDisplayName(479, 'Fan Rotom')).toBe('Fan Rotom')
    expect(slotDisplayName(720, 'Hoopa Unbound')).toBe('Hoopa Unbound')
    expect(slotDisplayName(646, 'Black Kyurem')).toBe('Black Kyurem')
  })

  it('builds the Transfer species field label from costume, gender, and background', () => {
    expect(specimenSlotBoxLabel(specimen())).toBe('#0001 Bulbasaur')
    expect(specimenSlotBoxLabel(specimen({ costume: 'Party Hat' }))).toBe('#0001 Bulbasaur Party Hat')
    expect(
      specimenSlotBoxLabel(specimen({ extraTags: ['gender'], gender: 'Female' })),
    ).toBe('#0001 Bulbasaur Female')
    expect(specimenSlotBoxLabel(specimen({ background: 'Tokyo' }))).toBe('#0001 Bulbasaur Tokyo')
    expect(
      specimenSlotBoxLabel(
        specimen({ costume: 'Kurta', extraTags: ['gender'], gender: 'Male' }),
      ),
    ).toBe('#0001 Bulbasaur Kurta Male')
    expect(specimenSlotDisplayName(specimen({ costume: 'Party Hat' }))).toBe('Bulbasaur Party Hat')
  })

  it('labels a specimen with its distinctive forme or the Basic default', () => {
    expect(specimenSlotName(849, null)).toBe('Toxtricity Amped Form')
    expect(specimenSlotName(849, 'Low Key Form')).toBe('Toxtricity Low Key Form')
    expect(specimenSlotName(718, null)).toBe('Zygarde 10% Forme')
    expect(specimenSlotName(718, '50% Forme')).toBe('Zygarde 50% Forme')
    expect(specimenSlotName(6, 'Mega X')).toBe('Charizard Mega X')
    expect(specimenSlotName(3, 'Mega')).toBe('Venusaur')
    expect(specimenSlotName(26, 'Alolan')).toBe('Raichu')
    expect(specimenSlotName(201, null)).toBe('Unown F')
    expect(specimenSlotName(201, 'A')).toBe('Unown A')
  })
})

describe('slotsForSelectedTags', () => {
  it('uses an own-list roster, not the national dex', () => {
    expect(slotsForSelectedTags(['friendship'], [], roster)).toHaveLength(0)
    expect(slotsForSelectedTags(['dynamax'], [dynamax], roster)).toHaveLength(
      GO_FORM_SPECIES_IDS.dynamax.size,
    )
  })

  it('limits the empty Basic search to the Pokémon GO list', () => {
    const ids = slotsForSelectedTags([], [basic], []).map((slot) => slot.speciesId)
    expect(ids).toHaveLength(GO_RELEASED_IDS.size)
    expect(ids).toContain(1)
    expect(ids).not.toContain(1025)
  })
})

describe('Basic Pokédex limit', () => {
  it('labels Basic Unown as Unown F without an Alternate forme slot', () => {
    const unown = slotsForTrack([], [basic], []).find((slot) => slot.speciesId === 201)
    expect(unown).toMatchObject({ speciesId: 201, variant: '', name: 'Unown F' })
  })

  it('labels Basic default formes that the Alternate forme list omitted', () => {
    const slots = slotsForTrack([], [basic], [])
    expect(slots.find((slot) => slot.speciesId === 849)).toMatchObject({
      variant: '',
      name: 'Toxtricity Amped Form',
    })
    expect(slots.find((slot) => slot.speciesId === 718)).toMatchObject({
      variant: '',
      name: 'Zygarde 10% Forme',
    })
    expect(slots.find((slot) => slot.speciesId === 327)).toMatchObject({
      variant: '',
      name: 'Spinda Pattern 1',
    })
    expect(slots.find((slot) => slot.speciesId === 128)).toMatchObject({
      variant: '',
      name: 'Tauros',
    })
    expect(slots.find((slot) => slot.speciesId === 666)?.name).toBe('Vivillon')
  })

  it('uses the Pokémon GO released list when Limit is on', () => {
    const ids = slotsForTrack([], [basic], []).map((slot) => slot.speciesId)
    expect(ids).toHaveLength(GO_RELEASED_IDS.size)
    expect(ids).toContain(25)
    expect(ids).not.toContain(1025)
    expect(countReleasedSlots([], [basic], [])).toBe(GO_RELEASED_IDS.size)
    expect(trackIsLimited([], [basic])).toBe(true)
    expect(
      trackIsLimited([], [{ tag: 'basic', limitPokedex: false, slotMode: 'species' }]),
    ).toBe(false)
  })

  it('can add a wiki-unreleased species on the Basic roster', () => {
    const extra: TagRosterEntry[] = [{ tag: 'basic', speciesId: 1025, variant: '' }]
    expect(slotsForTrack([], [basic], extra).some((slot) => slot.speciesId === 1025)).toBe(true)
  })

  it('uses the Basic species list for Hundo, Nundo, and size tags', () => {
    expect(slotsForTrack(['hundo'], [basic], []).map((slot) => slot.speciesId)).toHaveLength(
      GO_RELEASED_IDS.size,
    )
    const nundoEligible = [...GO_RELEASED_IDS].filter((id) => !nundoExcludesSpecies(id)).length
    expect(slotsForTrack(['nundo', 'xxl'], [basic], [])).toHaveLength(nundoEligible)
    expect(slotsForTrack(['best-buddy'], [], [])).toHaveLength(GO_RELEASED_IDS.size)
    expect(slotsForTrack(['hokido'], [basic], []).map((slot) => slot.speciesId)).toEqual(
      slotsForTrack([], [basic], []).map((slot) => slot.speciesId),
    )
    expect(trackIsLimited(['max-cp'], [basic])).toBe(true)
  })

  it('omits raid legendaries from Nundo and keeps Galarian birds', () => {
    const ids = slotsForTrack(['nundo'], [basic], []).map((slot) => slot.speciesId)
    const excluded = [...GO_RELEASED_IDS].filter((id) => nundoExcludesSpecies(id))
    expect(ids).toHaveLength(GO_RELEASED_IDS.size - excluded.length)
    expect(excluded.length).toBeGreaterThan(40)
    expect(ids).not.toContain(150)
    expect(ids).not.toContain(249)
    expect(ids).not.toContain(384)
    expect(ids).not.toContain(800)
    expect(ids).not.toContain(888)
    expect(ids).toContain(1)
    expect(ids).toContain(144)
    expect(ids).toContain(145)
    expect(ids).toContain(146)
    expect(ids).toContain(151)
    expect(slotsForTrack(['hundo'], [basic], []).some((slot) => slot.speciesId === 150)).toBe(true)
    expect(canEnableLimitedTag(specimen({ speciesId: 150, nundo: true }), 'nundo', [basic], [])).toBe(
      false,
    )
    expect(canEnableLimitedTag(specimen({ speciesId: 144, nundo: true }), 'nundo', [basic], [])).toBe(
      true,
    )
    expect(canEnableLimitedTag(specimen({ speciesId: 1, nundo: true }), 'nundo', [basic], [])).toBe(true)
    expect(limitedRosterWarning(specimen({ speciesId: 150, nundo: true }), [basic], [])).toBe(
      'Not in the Nundo Pokédex',
    )
    expect(limitedRosterWarning(specimen({ speciesId: 1, nundo: true }), [basic], [])).toBe('')
    const shadow: TagCatalog = { tag: 'shadow', limitPokedex: true, slotMode: 'species' }
    const shadowNundo = slotsForTrack(['shadow', 'nundo'], [shadow, basic], []).map(
      (slot) => slot.speciesId,
    )
    expect(GO_FORM_SPECIES_IDS.shadow.has(150)).toBe(true)
    expect(shadowNundo).not.toContain(150)
    expect(shadowNundo).toContain(1)
  })

  it('omits Pumpkaboo and Gourgeist from XXS because they have no XXS size', () => {
    const ids = slotsForTrack(['xxs'], [basic], []).map((slot) => slot.speciesId)
    expect(ids).not.toContain(710)
    expect(ids).not.toContain(711)
    expect(ids).toHaveLength(GO_RELEASED_IDS.size - 2)
    const xxl = slotsForTrack(['xxl'], [basic], []).map((slot) => slot.speciesId)
    expect(xxl).toContain(710)
    expect(xxl).toContain(711)
    expect(slotsForTrack(['hundo', 'xxs'], [basic], []).some((slot) => slot.speciesId === 710)).toBe(
      false,
    )
    expect(canEnableLimitedTag(specimen({ speciesId: 710, extraTags: ['xxs'] }), 'xxs', [basic], [])).toBe(
      false,
    )
    expect(canEnableLimitedTag(specimen({ speciesId: 1, extraTags: ['xxs'] }), 'xxs', [basic], [])).toBe(
      true,
    )
    expect(limitedRosterWarning(specimen({ speciesId: 711, extraTags: ['xxs'] }), [basic], [])).toBe(
      'Not in the XXS Pokédex',
    )
  })

  it('starts other tags at zero released slots', () => {
    expect(slotsForTrack(['friendship'], [], [])).toEqual([])
    expect(countReleasedSlots(['friendship'], [], [])).toBe(0)
    expect(trackIsLimited(['friendship'], [])).toBe(true)
  })

  it('lists wiki Shiny species even if Limit was stored off', () => {
    const ids = slotsForTrack(['shiny'], [shiny, basic], []).map((slot) => slot.speciesId)
    expect(ids).toEqual([...GO_FORM_SPECIES_IDS.shiny])
    expect(trackIsLimited(['shiny'], [shiny, basic])).toBe(true)
  })

  it('keeps a limited tag roster instead of the Basic list', () => {
    const ids = slotsForTrack(['dynamax'], [dynamax, basic], []).map((slot) => slot.speciesId)
    expect(ids).toEqual([...GO_FORM_SPECIES_IDS.dynamax])
    expect(ids).not.toHaveLength(GO_RELEASED_IDS.size)
  })

  it('blocks a Basic save that is not in Pokémon GO', () => {
    expect(limitedRosterWarning(specimen({ speciesId: 1025 }), [basic], [])).toBe(
      'Not in the Basic Pokédex',
    )
    expect(limitedRosterWarning(specimen({ speciesId: 1 }), [basic], [])).toBe('')
    expect(limitedRosterWarning(specimen({ speciesId: 1, hundo: true }), [basic], [])).toBe('')
    expect(limitedRosterWarning(specimen({ speciesId: 1025, hundo: true }), [basic], [])).toBe(
      'Not in the Basic Pokédex',
    )
  })

  it('blocks a Shiny save that is not in the Pokémon GO Shiny list', () => {
    expect(limitedRosterWarning(specimen({ speciesId: 1, shiny: true }), [], [])).toBe('')
    expect(limitedRosterWarning(specimen({ speciesId: 494, shiny: true }), [], [])).toBe(
      'Not in the Shiny Pokédex',
    )
  })

  it('uses the Pokémon GO regional lists without a stored roster', () => {
    const alolan: TagCatalog = { tag: 'alolan', limitPokedex: true, slotMode: 'species' }
    const ids = slotsForTrack(['alolan'], [alolan], []).map((slot) => slot.speciesId)
    expect(ids).toEqual([...GO_FORM_SPECIES_IDS.alolan])
    expect(canEnableLimitedTag(specimen({ speciesId: 19 }), 'alolan', [alolan], [])).toBe(true)
    expect(canEnableLimitedTag(specimen({ speciesId: 1 }), 'alolan', [alolan], [])).toBe(false)
    expect(
      limitedRosterWarning(specimen({ speciesId: 19, extraTags: ['alolan'] }), [alolan], []),
    ).toBe('')
    expect(
      limitedRosterWarning(specimen({ speciesId: 1, extraTags: ['alolan'] }), [alolan], []),
    ).toBe('Not in the Alolan Pokédex')
  })

  it('uses Male and Female variant slots on Gender, including Hisuian Sneasel', () => {
    const gender: TagCatalog = { tag: 'gender', limitPokedex: true, slotMode: 'species' }
    const slots = slotsForTrack(['gender'], [gender], [])
    expect(catalogForTag([gender], 'gender').slotMode).toBe('variant')
    expect(slots).toHaveLength(204)
    expect(slots.filter((slot) => slot.speciesId === 3).map((slot) => slot.variant)).toEqual([
      'Female',
      'Male',
    ])
    expect(slots.some((slot) => slot.speciesId === 3 && slot.name === 'Venusaur Male')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 3 && slot.name === 'Venusaur Female')).toBe(true)
    expect(
      slots
        .filter((slot) => slot.speciesId === 215)
        .map((slot) => slot.variant)
        .sort(),
    ).toEqual(['Female', 'Hisuian Female', 'Hisuian Male', 'Male'])
    expect(slots.some((slot) => slot.speciesId === 1)).toBe(false)
    expect(slots.some((slot) => slot.speciesId === 876)).toBe(false)
    expect(countReleasedSlots(['gender'], [gender], [])).toBe(204)
    expect(canEnableLimitedTag(specimen({ speciesId: 25 }), 'gender', [gender], [])).toBe(true)
    expect(
      canEnableLimitedTag(
        specimen({ speciesId: 3, gender: 'Male', extraTags: ['gender'] }),
        'gender',
        [gender],
        [],
      ),
    ).toBe(true)
    expect(
      canEnableLimitedTag(
        specimen({ speciesId: 1, gender: 'Male', extraTags: ['gender'] }),
        'gender',
        [gender],
        [],
      ),
    ).toBe(false)
    expect(
      limitedRosterWarning(specimen({ speciesId: 25, extraTags: ['gender'] }), [gender], []),
    ).toBe('')
    expect(
      applyRosterSlot(
        specimen({ extraTags: ['gender'] }),
        { speciesId: 3, variant: 'Female', name: 'Venusaur Female' },
        ['gender'],
        [gender],
      ),
    ).toMatchObject({ speciesId: 3, gender: 'Female', extraTags: ['gender'] })
    expect(usesRosterVariantField('gender', [gender])).toBe(true)
  })

  it('lists wiki Mega Evolutions as variant slots, including Charizard X and Y', () => {
    const mega: TagCatalog = { tag: 'mega', limitPokedex: true, slotMode: 'species' }
    const slots = slotsForTrack(['mega'], [mega], [])
    expect(catalogForTag([mega], 'mega').slotMode).toBe('variant')
    expect(slots).toHaveLength(61)
    expect(slots.filter((slot) => slot.speciesId === 3).map((slot) => slot.variant)).toEqual(['Mega'])
    expect(slots.some((slot) => slot.speciesId === 3 && slot.name === 'Venusaur Mega')).toBe(true)
    expect(
      slots
        .filter((slot) => slot.speciesId === 6)
        .map((slot) => slot.variant)
        .sort(),
    ).toEqual(['Mega X', 'Mega Y'])
    expect(slots.some((slot) => slot.speciesId === 6 && slot.variant === 'Mega')).toBe(false)
    expect(slots.some((slot) => slot.speciesId === 398)).toBe(false)
    expect(slots.some((slot) => slot.speciesId === 609)).toBe(false)
    expect(slots.some((slot) => slot.speciesId === 382 && slot.name === 'Kyogre Mega')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 383 && slot.name === 'Groudon Mega')).toBe(true)
    expect(countReleasedSlots(['mega'], [mega], [])).toBe(61)
    expect(
      canEnableLimitedTag(
        specimen({ speciesId: 6, form: 'Mega X', extraTags: ['mega'] }),
        'mega',
        [mega],
        [],
      ),
    ).toBe(true)
    expect(
      canEnableLimitedTag(
        specimen({ speciesId: 6, form: 'Mega', extraTags: ['mega'] }),
        'mega',
        [mega],
        [],
      ),
    ).toBe(false)
    expect(
      canEnableLimitedTag(
        specimen({ speciesId: 3, form: 'Mega', extraTags: ['mega'] }),
        'mega',
        [mega],
        [],
      ),
    ).toBe(true)
    expect(
      canEnableLimitedTag(
        specimen({ speciesId: 1, form: 'Mega', extraTags: ['mega'] }),
        'mega',
        [mega],
        [],
      ),
    ).toBe(false)
    expect(canEnableLimitedTag(specimen({ speciesId: 1, extraTags: ['mega'] }), 'mega', [mega], [])).toBe(
      true,
    )
    expect(
      applyRosterSlot(
        specimen({ extraTags: ['mega'] }),
        { speciesId: 6, variant: 'Mega Y', name: 'Charizard Mega Y' },
        ['mega'],
        [mega],
      ),
    ).toMatchObject({ speciesId: 6, form: 'Mega Y', extraTags: ['mega'] })
  })

  it('lists wiki Gigantamax as one slot per released species', () => {
    const gigantamax: TagCatalog = { tag: 'gigantamax', limitPokedex: true, slotMode: 'variant' }
    const slots = slotsForTrack(['gigantamax'], [gigantamax], [])
    expect(catalogForTag([gigantamax], 'gigantamax').slotMode).toBe('species')
    expect(slots.map((slot) => slot.speciesId)).toEqual([...GO_FORM_SPECIES_IDS.gigantamax])
    expect(slots).toHaveLength(17)
    expect(slots.every((slot) => slot.variant === '')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 3 && slot.name === 'Venusaur')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 25 && slot.name === 'Pikachu')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 1)).toBe(false)
    expect(slots.some((slot) => slot.speciesId === 892)).toBe(false)
    expect(countReleasedSlots(['gigantamax'], [gigantamax], [])).toBe(17)
    expect(
      canEnableLimitedTag(specimen({ speciesId: 3, extraTags: ['gigantamax'] }), 'gigantamax', [gigantamax], []),
    ).toBe(true)
    expect(
      canEnableLimitedTag(specimen({ speciesId: 1, extraTags: ['gigantamax'] }), 'gigantamax', [gigantamax], []),
    ).toBe(false)
    expect(
      limitedRosterWarning(specimen({ speciesId: 3, extraTags: ['gigantamax'] }), [gigantamax], []),
    ).toBe('')
    expect(
      limitedRosterWarning(specimen({ speciesId: 892, extraTags: ['gigantamax'] }), [gigantamax], []),
    ).toBe('Not in the Gigantamax Pokédex')
  })

  it('lists wiki Shiny as one slot per released species', () => {
    const shinyTrack: TagCatalog = { tag: 'shiny', limitPokedex: true, slotMode: 'variant' }
    const slots = slotsForTrack(['shiny'], [shinyTrack], [])
    expect(catalogForTag([shinyTrack], 'shiny').slotMode).toBe('species')
    expect(slots).toHaveLength(GO_FORM_SPECIES_IDS.shiny.size)
    expect(slots.every((slot) => slot.variant === '')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 1 && slot.name === 'Bulbasaur')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 827 && slot.name === 'Nickit')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 494)).toBe(false)
    expect(slots.some((slot) => slot.speciesId === 840)).toBe(false)
    expect(countReleasedSlots(['shiny'], [shinyTrack], [])).toBe(GO_FORM_SPECIES_IDS.shiny.size)
    expect(canEnableLimitedTag(specimen({ speciesId: 1, shiny: true }), 'shiny', [shinyTrack], [])).toBe(
      true,
    )
    expect(
      canEnableLimitedTag(specimen({ speciesId: 494, shiny: true }), 'shiny', [shinyTrack], []),
    ).toBe(false)
    expect(limitedRosterWarning(specimen({ speciesId: 1, shiny: true }), [shinyTrack], [])).toBe('')
    expect(limitedRosterWarning(specimen({ speciesId: 778, shiny: true }), [shinyTrack], [])).toBe(
      'Not in the Shiny Pokédex',
    )
  })

  it('counts Paldean as one slot per species, not Tauros breeds', () => {
    const paldean: TagCatalog = { tag: 'paldean', limitPokedex: true, slotMode: 'variant' }
    const slots = slotsForTrack(['paldean'], [paldean], [])
    expect(slots.map((slot) => slot.speciesId)).toEqual([128, 194])
    expect(slots.every((slot) => slot.variant === '')).toBe(true)
    expect(catalogForTag([paldean], 'paldean').slotMode).toBe('species')
  })

  it('keeps Hisuian Sliggoo and Goodra out until the wiki marks them released', () => {
    const hisuian: TagCatalog = { tag: 'hisuian', limitPokedex: true, slotMode: 'species' }
    expect(slotsForTrack(['hisuian'], [hisuian], []).map((slot) => slot.speciesId)).not.toContain(705)
    expect(canEnableLimitedTag(specimen({ speciesId: 58 }), 'hisuian', [hisuian], [])).toBe(true)
    expect(canEnableLimitedTag(specimen({ speciesId: 705 }), 'hisuian', [hisuian], [])).toBe(false)
  })

  it('lists wiki extra formes on Alternate forme', () => {
    const forme: TagCatalog = { tag: 'alternate-forme', limitPokedex: true, slotMode: 'variant' }
    const slots = slotsForTrack(['alternate-forme'], [forme], [])
    expect(slots.length).toBeGreaterThan(150)
    expect(slots.some((slot) => slot.speciesId === 201 && slot.variant === 'A')).toBe(true)
    expect(slots.some((slot) => slot.speciesId === 201 && slot.variant === 'F')).toBe(false)
    expect(slots.some((slot) => slot.speciesId === 128 && slot.variant === 'Combat Breed')).toBe(true)
    expect(
      canEnableLimitedTag(
        specimen({ speciesId: 201, form: 'A', extraTags: ['alternate-forme'] }),
        'alternate-forme',
        [forme],
        [],
      ),
    ).toBe(true)
    expect(
      limitedRosterWarning(
        specimen({ speciesId: 201, form: 'F', extraTags: ['alternate-forme'] }),
        [forme],
        [],
      ),
    ).toBe('Not in the Alternate forme Pokédex')
  })

  it('can add a wiki-unreleased regional species on the roster', () => {
    const hisuian: TagCatalog = { tag: 'hisuian', limitPokedex: true, slotMode: 'species' }
    const extra: TagRosterEntry[] = [{ tag: 'hisuian', speciesId: 705, variant: '' }]
    expect(slotsForTrack(['hisuian'], [hisuian], extra).some((slot) => slot.speciesId === 705)).toBe(
      true,
    )
  })
})
