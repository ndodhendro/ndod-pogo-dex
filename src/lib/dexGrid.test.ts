import { describe, expect, it } from 'vitest'
import { GENERATIONS } from '../data/generations'
import {
  buildDexVirtualRows,
  countFilledSpecies,
  DEX_GEN_HEADER_HEIGHT,
  DEX_GEN_SECTION_GAP,
  dexCompletionPercent,
  dexGenHeaderHeight,
  dexGridLayout,
  formatDexCompletionPercent,
  keepDexSlot,
  pickDexCover,
  specimenMatchesDexFilters,
} from './dexGrid'
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

  it('does not count a silhouette toward progress', () => {
    const rows = [
      specimen({ speciesId: 1, silhouette: true }),
      specimen({ speciesId: 4, shiny: true, silhouette: true }),
      specimen({ speciesId: 7 }),
    ]
    expect(countFilledSpecies(rows, [])).toBe(1)
    expect(countFilledSpecies(rows, ['shiny'])).toBe(0)
  })

  it('still counts a species that also has a catch', () => {
    const rows = [specimen({ speciesId: 1, silhouette: true }), specimen({ speciesId: 1 })]
    expect(countFilledSpecies(rows, [])).toBe(1)
  })
})

describe('pickDexCover', () => {
  const catchRow = { id: 'catch', silhouette: false }
  const silOld = { id: 'sil-old', silhouette: true }
  const silNew = { id: 'sil-new', silhouette: true }

  it('uses the stored cover, else the first specimen', () => {
    expect(pickDexCover([silOld, catchRow], 'catch')).toEqual(catchRow)
    expect(pickDexCover([silOld, catchRow], 'missing')).toEqual(silOld)
  })

  it('prefers a silhouette when that filter is on', () => {
    expect(pickDexCover([catchRow, silOld, silNew], 'catch', true)).toEqual(silOld)
    expect(pickDexCover([catchRow, silOld, silNew], 'sil-new', true)).toEqual(silNew)
    expect(pickDexCover([catchRow], 'catch', true)).toBeUndefined()
  })
})

describe('keepDexSlot', () => {
  it('hides slots without a match when a filter is on', () => {
    expect(keepDexSlot(false, false)).toBe(true)
    expect(keepDexSlot(true, false)).toBe(true)
    expect(keepDexSlot(true, true)).toBe(true)
    expect(keepDexSlot(false, true)).toBe(false)
  })
})

describe('specimenMatchesDexFilters', () => {
  it('requires every picked tag on the same specimen', () => {
    const shinyShadow = specimen({ shiny: true, shadowStatus: 'shadow' })
    expect(specimenMatchesDexFilters(shinyShadow, ['shiny', 'shadow'])).toBe(true)
    expect(specimenMatchesDexFilters(specimen({ shiny: true }), ['shiny', 'shadow'])).toBe(false)
    expect(specimenMatchesDexFilters(shinyShadow, [])).toBe(true)
  })

  it('can require a silhouette as well as tags', () => {
    const shiny = specimen({ shiny: true })
    const shinySil = specimen({ shiny: true, silhouette: true })
    expect(specimenMatchesDexFilters(shiny, ['shiny'], true)).toBe(false)
    expect(specimenMatchesDexFilters(shinySil, ['shiny'], true)).toBe(true)
  })
})

describe('buildDexVirtualRows', () => {
  const kanto = GENERATIONS[0]
  const johto = GENERATIONS[1]
  const groups = [
    { generation: kanto, items: [{ speciesId: 1 }, { speciesId: 2 }, { speciesId: 3 }, { speciesId: 4 }] },
    { generation: johto, items: [{ speciesId: 152 }] },
  ]

  it('inserts a section header before each generation grid', () => {
    const rows = buildDexVirtualRows(groups, 3, new Set())
    expect(rows.map((row) => row.kind)).toEqual(['header', 'cards', 'cards', 'header', 'cards'])
    expect(rows[0]).toMatchObject({ kind: 'header', lead: true, generation: kanto })
    expect(rows[3]).toMatchObject({ kind: 'header', lead: false, generation: johto })
  })

  it('hides card rows when a generation is collapsed', () => {
    const rows = buildDexVirtualRows(groups, 3, new Set([kanto.id]))
    expect(rows.map((row) => row.kind)).toEqual(['header', 'header', 'cards'])
    expect(rows[0]).toMatchObject({ kind: 'header', generation: kanto })
    expect(rows[1]).toMatchObject({ kind: 'header', generation: johto, lead: false })
  })

  it('sizes follow-up headers with a section gap', () => {
    expect(dexGenHeaderHeight(true)).toBe(DEX_GEN_HEADER_HEIGHT)
    expect(dexGenHeaderHeight(false)).toBe(DEX_GEN_HEADER_HEIGHT + DEX_GEN_SECTION_GAP)
  })
})
