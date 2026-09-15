import { describe, expect, it } from 'vitest'
import {
  matchSpeciesFromOcr,
  normalizeOcrName,
  ocrNameCandidates,
} from './speciesOcr'
import type { DexSlotDef } from './roster'

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
    expect(result.suggestions).toHaveLength(2)
    expect(result.query).toBe('Pikachu')
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
