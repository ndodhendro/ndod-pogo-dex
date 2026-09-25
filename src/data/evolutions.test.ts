import { describe, expect, it } from 'vitest'
import { SPECIES } from './species'
import { compareByEvolutionLine, evolutionLine, evolutionStage, priorEvolutions } from './evolutions'

describe('evolutionLine', () => {
  it('orders Pikachu with its previous and next stages', () => {
    expect(evolutionLine(25)).toEqual([172, 25, 26])
    expect(evolutionLine(172)).toEqual([172, 25, 26])
    expect(evolutionLine(26)).toEqual([172, 25, 26])
  })

  it('keeps branched families on one line, stage then national number', () => {
    expect(evolutionLine(133)).toEqual([133, 134, 135, 136, 196, 197, 470, 471, 700])
    expect(evolutionLine(265)).toEqual([265, 266, 268, 267, 269])
  })

  it('covers every catalog species once', () => {
    const seen = new Set<number>()
    for (const species of SPECIES) {
      const line = evolutionLine(species.id)
      expect(line).toContain(species.id)
      seen.add(species.id)
    }
    expect(seen.size).toBe(SPECIES.length)
  })
})

describe('evolutionStage', () => {
  it('counts depth from the baby or base form', () => {
    expect(evolutionStage(172)).toBe(0)
    expect(evolutionStage(25)).toBe(1)
    expect(evolutionStage(26)).toBe(2)
    expect(evolutionStage(151)).toBe(0)
  })
})

describe('priorEvolutions', () => {
  it('walks every earlier stage of a linear line', () => {
    expect(priorEvolutions(3)).toEqual([1, 2])
    expect(priorEvolutions(25)).toEqual([172])
    expect(priorEvolutions(26)).toEqual([172, 25])
    expect(priorEvolutions(521)).toEqual([519, 520])
  })

  it('returns nothing for the first stage', () => {
    expect(priorEvolutions(133)).toEqual([])
    expect(priorEvolutions(415)).toEqual([])
    expect(priorEvolutions(1)).toEqual([])
  })

  it('follows the branch that actually evolves into the species', () => {
    expect(priorEvolutions(45)).toEqual([43, 44])
    expect(priorEvolutions(186)).toEqual([60, 61])
    expect(priorEvolutions(461)).toEqual([215])
    expect(priorEvolutions(217)).toEqual([216])
    expect(priorEvolutions(267)).toEqual([265, 266])
    expect(priorEvolutions(269)).toEqual([265, 268])
  })
})

describe('compareByEvolutionLine', () => {
  it('sorts Pichu before Pikachu before Raichu', () => {
    const slots = [
      { speciesId: 26, variant: '' },
      { speciesId: 25, variant: '' },
      { speciesId: 172, variant: '' },
    ]
    expect([...slots].sort(compareByEvolutionLine).map((slot) => slot.speciesId)).toEqual([172, 25, 26])
  })

  it('uses variant name as the tie-breaker on the same species', () => {
    const slots = [
      { speciesId: 25, variant: 'Party Hat' },
      { speciesId: 172, variant: 'Santa Hat' },
      { speciesId: 25, variant: 'Adventure Hat' },
    ]
    expect(
      [...slots].sort(compareByEvolutionLine).map((slot) => `${slot.speciesId}:${slot.variant}`),
    ).toEqual(['172:Santa Hat', '25:Adventure Hat', '25:Party Hat'])
  })
})
