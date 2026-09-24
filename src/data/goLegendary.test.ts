import { describe, expect, it } from 'vitest'
import { GO_LEGENDARY_IDS, isGoLegendary, nundoExcludesSpecies } from './goLegendary'

describe('GO legendary list', () => {
  it('matches PokeAPI is_legendary and leaves mythicals out', () => {
    expect(GO_LEGENDARY_IDS.size).toBe(71)
    expect(isGoLegendary(150)).toBe(true)
    expect(isGoLegendary(144)).toBe(true)
    expect(isGoLegendary(905)).toBe(true)
    expect(isGoLegendary(1024)).toBe(true)
    expect(isGoLegendary(1)).toBe(false)
    expect(isGoLegendary(151)).toBe(false)
    expect(isGoLegendary(808)).toBe(false)
    expect(isGoLegendary(793)).toBe(false)
  })

  it('keeps Galarian birds on Nundo and drops raid legendaries', () => {
    expect(nundoExcludesSpecies(150)).toBe(true)
    expect(nundoExcludesSpecies(249)).toBe(true)
    expect(nundoExcludesSpecies(384)).toBe(true)
    expect(nundoExcludesSpecies(144)).toBe(false)
    expect(nundoExcludesSpecies(145)).toBe(false)
    expect(nundoExcludesSpecies(146)).toBe(false)
    expect(nundoExcludesSpecies(25)).toBe(false)
    expect(nundoExcludesSpecies(151)).toBe(false)
  })
})
