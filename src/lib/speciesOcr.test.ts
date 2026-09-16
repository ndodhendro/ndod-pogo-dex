import { describe, expect, it } from 'vitest'
import {
  applyOcrGenderSpecies,
  genderSlotsForSpecies,
  isGenderDexSpecies,
  matchSpeciesFromOcr,
  normalizeOcrName,
  ocrMatchesGenderSpecies,
  ocrNameCandidates,
} from './speciesOcr'
import { slotsForSelectedTags } from './roster'
import type { DexSlotDef } from './roster'
import type { SpecimenFields } from './tags'

function slot(speciesId: number, name: string, variant = ''): DexSlotDef {
  return { speciesId, variant, name }
}

const basicSlots = [
  slot(1, 'Bulbasaur'),
  slot(25, 'Pikachu'),
  slot(26, 'Raichu'),
  slot(95, 'Onix'),
  slot(122, 'Mr. Mime'),
  slot(208, 'Steelix'),
  slot(250, 'Ho-Oh'),
  slot(485, 'Heatran'),
  slot(29, 'Nidoran ♀'),
  slot(32, 'Nidoran ♂'),
]

const genderSlots = [
  slot(25, 'Pikachu Male', 'Male'),
  slot(25, 'Pikachu Female', 'Female'),
  slot(215, 'Sneasel Male', 'Male'),
  slot(215, 'Sneasel Female', 'Female'),
  slot(215, 'Sneasel Hisuian Male', 'Hisuian Male'),
  slot(215, 'Sneasel Hisuian Female', 'Hisuian Female'),
]

const fields = (): SpecimenFields => ({
  speciesId: 0,
  form: null,
  shiny: false,
  shadowStatus: 'none',
  costume: null,
  background: null,
  gender: null,
  hundo: false,
  nundo: false,
  extraTags: ['basic'],
})

describe('normalizeOcrName', () => {
  it('strips GO chrome and maps gender marks', () => {
    expect(normalizeOcrName('Pikachu ♂')).toBe('pikachu m')
    expect(normalizeOcrName("Farfetch'd")).toBe('farfetchd')
    expect(normalizeOcrName('Ho-Oh')).toBe('ho oh')
    expect(normalizeOcrName('Flabébé')).toBe('flabebe')
    expect(normalizeOcrName('Alolan Raichu')).toBe('raichu')
    expect(normalizeOcrName('Nidoran ♀')).toBe('nidoran f')
  })
})

describe('ocrNameCandidates', () => {
  it('keeps the species line and drops CP / HP noise', () => {
    expect(ocrNameCandidates('CP 3840\nPikachu ♂\nHP 120 / 120')).toContain('pikachu m')
    expect(ocrNameCandidates('CP 3840\nPikachu ♂\nHP 120 / 120')).not.toContain('cp 3840')
  })
})

describe('matchSpeciesFromOcr', () => {
  it('auto-picks a unique exact name', () => {
    const result = matchSpeciesFromOcr('Pikachu', basicSlots)
    expect(result.kind).toBe('strong')
    expect(result.slot?.speciesId).toBe(25)
    expect(result.speciesId).toBe(25)
    expect(ocrMatchesGenderSpecies(result)).toBe(true)
  })

  it('does not treat a non-gender species as a gender OCR hit', () => {
    const result = matchSpeciesFromOcr('Bulbasaur', basicSlots)
    expect(result.kind).toBe('strong')
    expect(result.speciesId).toBe(1)
    expect(isGenderDexSpecies(1)).toBe(false)
    expect(ocrMatchesGenderSpecies(result)).toBe(false)
  })

  it('keeps a unique gender species when Male and Female slots are both present', () => {
    const result = matchSpeciesFromOcr('Pikachu', genderSlots)
    expect(result.kind).toBe('weak')
    expect(result.speciesId).toBe(25)
    expect(result.slot).toBeUndefined()
    expect(ocrMatchesGenderSpecies(result)).toBe(true)
    expect(result.suggestions.map((row) => row.variant)).toEqual(['Male', 'Female'])
  })

  it('auto-picks the nearest species when OCR wraps the name in junk', () => {
    const result = matchSpeciesFromOcr(' A Heatran p', basicSlots)
    expect(result.kind).toBe('strong')
    expect(result.slot?.speciesId).toBe(485)
  })

  it('auto-picks a unique one-letter typo on a long name', () => {
    const result = matchSpeciesFromOcr('Bulbasur', basicSlots)
    expect(result.kind).toBe('strong')
    expect(result.slot?.speciesId).toBe(1)
  })

  it('lists close names instead of auto-picking when two species are equally near', () => {
    const result = matchSpeciesFromOcr('Pikchu', basicSlots)
    expect(result.kind).toBe('weak')
    expect(result.slot).toBeUndefined()
    expect(result.suggestions.some((row) => row.speciesId === 25)).toBe(true)
  })

  it('reads a name under CP and a gender mark', () => {
    const result = matchSpeciesFromOcr('CP 2500\nPikachu ♂', basicSlots)
    expect(result.kind).toBe('strong')
    expect(result.slot?.speciesId).toBe(25)
  })

  it('strips a regional prefix and still auto-picks', () => {
    const result = matchSpeciesFromOcr('Alolan Raichu', basicSlots)
    expect(result.kind).toBe('strong')
    expect(result.slot?.speciesId).toBe(26)
  })

  it('matches punctuated English names', () => {
    expect(matchSpeciesFromOcr('Mr. Mime', basicSlots).slot?.speciesId).toBe(122)
    expect(matchSpeciesFromOcr('HOOH', basicSlots).slot?.speciesId).toBe(250)
  })

  it('does not auto-pick Nidoran without a gender mark', () => {
    const result = matchSpeciesFromOcr('Nidoran', basicSlots)
    expect(result.kind).toBe('weak')
    expect(result.suggestions.map((row) => row.speciesId).sort((a, b) => a - b)).toEqual([29, 32])
    expect(result.query.toLowerCase()).toContain('nidoran')
  })

  it('auto-picks Nidoran when OCR keeps the gender mark', () => {
    expect(matchSpeciesFromOcr('Nidoran♀', basicSlots).slot?.speciesId).toBe(29)
    expect(matchSpeciesFromOcr('Nidoran♂', basicSlots).slot?.speciesId).toBe(32)
  })

  it('lists costume slots instead of auto-picking when several match', () => {
    const costumes = [
      slot(25, 'Pikachu Party Hat', 'Party Hat'),
      slot(25, 'Pikachu Halloween', 'Halloween'),
    ]
    const result = matchSpeciesFromOcr('Pikachu', costumes)
    expect(result.kind).toBe('weak')
    expect(result.slot).toBeUndefined()
    expect(result.speciesId).toBe(25)
    expect(result.suggestions).toHaveLength(2)
    expect(result.query).toBe('Pikachu')
  })

  it('does not treat Nidoran without a mark as a unique gender species', () => {
    const result = matchSpeciesFromOcr('Nidoran', basicSlots)
    expect(ocrMatchesGenderSpecies(result)).toBe(false)
    expect(result.speciesId).toBeUndefined()
  })

  it('puts raw OCR in the query when nothing matches', () => {
    const result = matchSpeciesFromOcr('asdfghjkl', basicSlots)
    expect(result.kind).toBe('none')
    expect(result.query).toBe('asdfghjkl')
    expect(result.suggestions).toEqual([])
  })

  it('keeps a short name as a suggestion instead of auto-picking a typo', () => {
    const result = matchSpeciesFromOcr('Onyx', basicSlots)
    expect(result.kind).toBe('weak')
    expect(result.suggestions.some((row) => row.speciesId === 95)).toBe(true)
    expect(result.slot).toBeUndefined()
  })
})

describe('applyOcrGenderSpecies', () => {
  it('turns Gender on, keeps the base species, and leaves Male/Female unpicked', () => {
    const next = applyOcrGenderSpecies(fields(), 25)
    expect(next.speciesId).toBe(25)
    expect(next.extraTags).toEqual(['basic', 'gender'])
    expect(next.gender).toBe('')
  })

  it('resets an already picked variant when OCR runs again', () => {
    const tagged = applyOcrGenderSpecies(
      { ...fields(), speciesId: 25, extraTags: ['basic', 'gender'], gender: 'Male' },
      25,
    )
    expect(tagged.gender).toBe('')
    expect(tagged.extraTags).toEqual(['basic', 'gender'])
  })
})

describe('genderSlotsForSpecies', () => {
  it('returns Male and Female for a dimorphic species', () => {
    expect(genderSlotsForSpecies(genderSlots, 25).map((row) => row.variant)).toEqual([
      'Male',
      'Female',
    ])
  })

  it('returns Hisuian variants with Johto for Sneasel', () => {
    expect(genderSlotsForSpecies(genderSlots, 215).map((row) => row.variant)).toEqual([
      'Male',
      'Female',
      'Hisuian Male',
      'Hisuian Female',
    ])
  })

  it('lists Pikachu Male and Female after Gender is turned on from OCR', () => {
    const next = applyOcrGenderSpecies(fields(), 25)
    const slots = slotsForSelectedTags(next.extraTags ?? [], [], [])
    expect(genderSlotsForSpecies(slots, 25).map((row) => row.name)).toEqual([
      'Pikachu Male',
      'Pikachu Female',
    ])
  })
})
