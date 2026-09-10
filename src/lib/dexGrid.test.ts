import { describe, expect, it } from 'vitest'
import { GENERATIONS } from '../data/generations'
import {
  buildDexVirtualRows,
  countFilledSpecies,
  stackDexProgressLayers,
  DEX_GEN_HEADER_HEIGHT,
  DEX_GEN_SECTION_GAP,
  dexAnimatedCardRowHeight,
  dexCompletionPercent,
  dexGenHeaderHeight,
  dexGridLayout,
  dexOpenAmount,
  formatDexCompletionPercent,
  hiddenDexGenerations,
  interpolateOpenAmount,
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

  it('sizes rows to the open track crop, not the tallest catalog crop', () => {
    const basic = dexGridLayout(360, 710)
    const gigantamax = dexGridLayout(360, 1055)
    expect(basic.columns).toBe(3)
    expect(basic.rowHeight).toBeLessThan(gigantamax.rowHeight)
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

describe('stackDexProgressLayers', () => {
  it('puts the highest fill behind the lower fills', () => {
    expect(stackDexProgressLayers({ seen: 80, caught: 50, pure: 20 }, 100).map((layer) => layer.kind)).toEqual([
      'seen',
      'caught',
      'pure',
    ])
  })

  it('orders by value, not by kind name', () => {
    expect(stackDexProgressLayers({ seen: 10, caught: 40, pure: 90 }, 100).map((layer) => layer.kind)).toEqual([
      'pure',
      'caught',
      'seen',
    ])
  })

  it('keeps Seen at the back when fills tie', () => {
    expect(stackDexProgressLayers({ seen: 40, caught: 40, pure: 10 }, 100).map((layer) => layer.kind)).toEqual([
      'seen',
      'caught',
      'pure',
    ])
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

  it('records row index and count for slide clipping', () => {
    const rows = buildDexVirtualRows(groups, 3, new Set())
    const cards = rows.filter((row) => row.kind === 'cards')
    expect(cards).toMatchObject([
      { generationId: kanto.id, rowIndex: 0, rowCount: 2 },
      { generationId: kanto.id, rowIndex: 1, rowCount: 2 },
      { generationId: johto.id, rowIndex: 0, rowCount: 1 },
    ])
  })

  it('omits card rows below the slide clip', () => {
    const rows = buildDexVirtualRows(groups, 3, new Set(), {
      amounts: new Map([[kanto.id, 0.4]]),
      rowHeight: 100,
    })
    expect(
      rows.filter((row) => row.kind === 'cards' && row.generationId === kanto.id),
    ).toMatchObject([{ rowIndex: 0, rowCount: 2 }])
  })

  it('sizes follow-up headers with a section gap', () => {
    expect(dexGenHeaderHeight(true)).toBe(DEX_GEN_HEADER_HEIGHT)
    expect(dexGenHeaderHeight(false)).toBe(DEX_GEN_HEADER_HEIGHT + DEX_GEN_SECTION_GAP)
  })
})

describe('dex section slide', () => {
  it('treats a missing amount as open unless that generation is collapsed', () => {
    expect(dexOpenAmount(1, new Set(), new Map())).toBe(1)
    expect(dexOpenAmount(1, new Set([1]), new Map())).toBe(0)
    expect(dexOpenAmount(1, new Set([1]), new Map([[1, 0.4]]))).toBe(0.4)
  })

  it('keeps collapsing generations in the list until the slide finishes', () => {
    expect(hiddenDexGenerations(new Set([1, 2]), new Map([[1, 0.2]]))).toEqual(new Set([2]))
    expect(hiddenDexGenerations(new Set([1]), new Map())).toEqual(new Set([1]))
  })

  it('clips card rows from the bottom of the generation', () => {
    expect(dexAnimatedCardRowHeight(0, 4, 100, 1)).toBe(100)
    expect(dexAnimatedCardRowHeight(3, 4, 100, 0)).toBe(0)
    expect(dexAnimatedCardRowHeight(0, 4, 100, 0.5)).toBe(100)
    expect(dexAnimatedCardRowHeight(1, 4, 100, 0.5)).toBe(100)
    expect(dexAnimatedCardRowHeight(2, 4, 100, 0.5)).toBe(0)
    expect(dexAnimatedCardRowHeight(1, 4, 100, 0.4)).toBe(60)
  })

  it('eases the open amount toward the target', () => {
    expect(interpolateOpenAmount(1, 0, 0)).toBe(1)
    expect(interpolateOpenAmount(1, 0, 1)).toBe(0)
    expect(interpolateOpenAmount(0, 1, 0.5)).toBeGreaterThan(0.5)
  })
})
