import { describe, expect, it } from 'vitest'
import { countFilledSpecies, dexCompletionPercent, dexGridLayout, formatDexCompletionPercent } from './dexGrid'
import type { SpecimenFields } from './tags'

describe('dexGridLayout', () => {
  it('does not collapse rows when the host width is 0 or missing', () => {
    const collapsed = dexGridLayout(0)
    expect(collapsed.columns).toBe(3)
    expect(collapsed.cardWidth).toBeGreaterThan(100)
    expect(collapsed.rowHeight).toBeGreaterThan(150)
    expect(dexGridLayout(-20)).toEqual(collapsed)
  })

  it('keeps three columns on a typical phone width', () => {
    const layout = dexGridLayout(360)
    expect(layout.columns).toBe(3)
    expect(layout.rowHeight).toBeGreaterThan(layout.cardWidth)
  })

  it('adds columns on a wide host', () => {
    expect(dexGridLayout(800).columns).toBeGreaterThan(3)
    expect(dexGridLayout(800).columns).toBeLessThanOrEqual(6)
  })
})

describe('dexCompletionPercent', () => {
  it('formats two decimal places against the catalog size', () => {
    expect(formatDexCompletionPercent(0, 1025)).toBe('0.00%')
    expect(formatDexCompletionPercent(1, 1025)).toBe('0.10%')
    expect(formatDexCompletionPercent(12, 1025)).toBe('1.17%')
    expect(formatDexCompletionPercent(1025, 1025)).toBe('100.00%')
  })

  it('is empty when the catalog is missing', () => {
    expect(dexCompletionPercent(4, 0)).toBe(0)
    expect(formatDexCompletionPercent(4, 0)).toBe('0.00%')
  })
})

const specimen = (over: Partial<SpecimenFields>): SpecimenFields => ({
  speciesId: 1,
  form: null,
  shiny: false,
  shadowStatus: 'none',
  costume: null,
  background: null,
  hundo: false,
  nundo: false,
  ...over,
})

describe('countFilledSpecies', () => {
  it('counts a species once per track', () => {
    const rows = [
      specimen({ speciesId: 1 }),
      specimen({ speciesId: 1, shiny: true }),
      specimen({ speciesId: 4, shiny: true }),
    ]
    expect(countFilledSpecies(rows, [])).toBe(2)
    expect(countFilledSpecies(rows, ['shiny'])).toBe(2)
    expect(countFilledSpecies(rows, ['shadow'])).toBe(0)
  })
})
