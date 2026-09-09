import { describe, expect, it } from 'vitest'
import { SPECIES } from './species'
import {
  GENERATIONS,
  generationForSpeciesId,
  groupByGeneration,
} from './generations'

describe('generationForSpeciesId', () => {
  it('maps National Dex boundaries', () => {
    expect(generationForSpeciesId(1)?.name).toBe('Kanto')
    expect(generationForSpeciesId(151)?.name).toBe('Kanto')
    expect(generationForSpeciesId(152)?.name).toBe('Johto')
    expect(generationForSpeciesId(809)?.name).toBe('Alola')
    expect(generationForSpeciesId(810)?.name).toBe('Galar')
    expect(generationForSpeciesId(905)?.name).toBe('Galar')
    expect(generationForSpeciesId(906)?.name).toBe('Paldea')
    expect(generationForSpeciesId(1025)?.name).toBe('Paldea')
  })

  it('ignores invalid ids', () => {
    expect(generationForSpeciesId(0)).toBeUndefined()
    expect(generationForSpeciesId(1.5)).toBeUndefined()
    expect(generationForSpeciesId(1026)).toBeUndefined()
  })
})

describe('GENERATIONS', () => {
  it('covers the catalog without gaps or overlap', () => {
    const ids = SPECIES.map((species) => species.id)
    expect(ids[0]).toBe(1)
    expect(ids.at(-1)).toBe(1025)
    expect(new Set(ids).size).toBe(SPECIES.length)

    for (const species of SPECIES) {
      const generation = generationForSpeciesId(species.id)
      expect(generation, `species ${species.id}`).toBeDefined()
    }

    const counts = groupByGeneration(SPECIES.map((species) => ({ speciesId: species.id })))
    expect(counts.map((group) => [group.generation.name, group.items.length])).toEqual([
      ['Kanto', 151],
      ['Johto', 100],
      ['Hoenn', 135],
      ['Sinnoh', 107],
      ['Unova', 156],
      ['Kalos', 72],
      ['Alola', 88],
      ['Galar', 96],
      ['Paldea', 120],
    ])
    expect(counts.reduce((sum, group) => sum + group.items.length, 0)).toBe(1025)
  })

  it('gives each generation a distinct label color', () => {
    const colors = GENERATIONS.map((generation) => generation.color)
    expect(new Set(colors).size).toBe(GENERATIONS.length)
  })
})
