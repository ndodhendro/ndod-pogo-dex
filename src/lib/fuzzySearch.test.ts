import { describe, expect, it } from 'vitest'
import { searchSpecies } from '../data/species'
import {
  fuzzyMatches,
  fuzzyScore,
  matchesSpeciesSearch,
  rankByFuzzy,
  speciesIdMatchesQuery,
} from './fuzzySearch'

describe('fuzzyMatches', () => {
  it('keeps a match when the query is empty', () => {
    expect(fuzzyMatches('  ', 'Pikachu')).toBe(true)
    expect(fuzzyScore('  ', 'Pikachu')).toBe(0)
  })

  it('matches a case-insensitive substring', () => {
    expect(fuzzyMatches('chu', 'Pikachu')).toBe(true)
    expect(fuzzyMatches('party', 'Pikachu Party Hat')).toBe(true)
    expect(fuzzyMatches('female', 'Pikachu Party Hat')).toBe(false)
  })

  it('ignores punctuation, accents, and gender marks', () => {
    expect(fuzzyMatches('mrmime', 'Mr. Mime')).toBe(true)
    expect(fuzzyMatches('farfetchd', "Farfetch'd")).toBe(true)
    expect(fuzzyMatches('flabebe', 'Flabébé')).toBe(true)
    expect(fuzzyMatches('nidoran', 'Nidoran♀')).toBe(true)
    expect(fuzzyMatches('img1234', 'IMG_1234.PNG')).toBe(true)
  })

  it('matches a typo or a swapped pair of letters', () => {
    expect(fuzzyMatches('charzard', 'Charizard')).toBe(true)
    expect(fuzzyMatches('shniy', 'Shiny')).toBe(true)
    expect(fuzzyMatches('pikacu', 'Pikachu')).toBe(true)
  })

  it('does not treat a short query as a typo', () => {
    expect(fuzzyMatches('sh', 'Shiny')).toBe(true)
    expect(fuzzyMatches('sh', 'Costume')).toBe(false)
    expect(fuzzyMatches('zz', 'Pikachu')).toBe(false)
  })

  it('does not confuse a close species name', () => {
    expect(fuzzyMatches('pikachu', 'Pichu')).toBe(false)
    expect(fuzzyMatches('pikachu', 'Raichu')).toBe(false)
  })

  it('requires every word to match', () => {
    expect(fuzzyMatches('party hat', 'Pikachu Party Hat')).toBe(true)
    expect(fuzzyMatches('star crown', 'Party Hat')).toBe(false)
    expect(fuzzyMatches('star crown', 'Halloween Cape')).toBe(false)
  })
})

describe('speciesIdMatchesQuery', () => {
  it('matches the national number with or without leading zeros', () => {
    expect(speciesIdMatchesQuery(25, '25')).toBe(true)
    expect(speciesIdMatchesQuery(25, '025')).toBe(true)
    expect(speciesIdMatchesQuery(25, '0025')).toBe(true)
    expect(speciesIdMatchesQuery(25, '125')).toBe(false)
    expect(speciesIdMatchesQuery(125, '25')).toBe(false)
    expect(speciesIdMatchesQuery(1, '0001')).toBe(true)
  })

  it('ignores a name query', () => {
    expect(speciesIdMatchesQuery(25, 'pikachu')).toBe(false)
  })
})

describe('matchesSpeciesSearch', () => {
  it('matches a name, a typo, or the national number', () => {
    expect(matchesSpeciesSearch('pika', 25, ['Pikachu'])).toBe(true)
    expect(matchesSpeciesSearch('pikacu', 25, ['Pikachu'])).toBe(true)
    expect(matchesSpeciesSearch('0025', 25, ['Pikachu'])).toBe(true)
    expect(matchesSpeciesSearch('char', 25, ['Pikachu'])).toBe(false)
  })
})

describe('rankByFuzzy', () => {
  it('puts the closest label first and keeps the rest in order', () => {
    const items = ['Shadow', 'Shiny', 'Costume']
    expect(rankByFuzzy(items, 'shniy', (item) => [item])).toEqual(['Shiny', 'Shadow', 'Costume'])
  })
})

describe('searchSpecies', () => {
  it('ranks a typo to the right species', () => {
    expect(searchSpecies('charzard')[0]?.name).toBe('Charizard')
  })

  it('keeps a number search on that species', () => {
    expect(searchSpecies('0025').map((species) => species.id)).toEqual([25])
  })

  it('returns the full list for an empty query', () => {
    expect(searchSpecies('  ')).toBe(searchSpecies(''))
  })
})
