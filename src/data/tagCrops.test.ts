import { describe, expect, it } from 'vitest'
import {
  cropHeightForSpecimen,
  cropHeightForTags,
  LUCKY_CROP_EXTRA,
  MAX_TAG_CROP_HEIGHT,
  SEED_COMBO_CROPS,
  SEED_TAG_CROPS,
  SEEN_CROP_HEIGHT,
} from './tagCrops'

const heights = Object.fromEntries(SEED_TAG_CROPS.map((row) => [row.tag, row.height]))

describe('SEED_TAG_CROPS', () => {
  it('locks the collector crop bottoms', () => {
    expect(heights.basic).toBe(710)
    expect(heights.mega).toBe(1055)
    expect(heights.gigantamax).toBe(1055)
    expect(heights.dynamax).toBe(1055)
    expect(heights.lucky).toBe(748)
    expect(heights.xxs).toBe(930)
    expect(heights.xxl).toBe(930)
    expect(MAX_TAG_CROP_HEIGHT).toBe(1055)
    expect(LUCKY_CROP_EXTRA).toBe(38)
    expect(SEED_COMBO_CROPS.find((row) => row.tag === 'lucky+mega')?.height).toBe(1093)
    expect(SEED_COMBO_CROPS.find((row) => row.tag === 'lucky+gigantamax')?.height).toBe(1093)
    expect(SEED_COMBO_CROPS.find((row) => row.tag === 'lucky+dynamax')?.height).toBe(1093)
    expect(SEED_COMBO_CROPS.find((row) => row.tag === 'lucky+xxs')?.height).toBe(968)
    expect(SEED_COMBO_CROPS.find((row) => row.tag === 'lucky+xxl')?.height).toBe(968)
  })
})

describe('cropHeightForTags', () => {
  it('uses the Basic height when no tag is selected', () => {
    expect(cropHeightForTags([], heights)).toBe(710)
  })

  it('uses that tag’s stored height', () => {
    expect(cropHeightForTags(['lucky'], heights)).toBe(748)
    expect(cropHeightForTags(['mega'], heights)).toBe(1055)
  })

  it('uses the tallest height when several tags are on', () => {
    expect(cropHeightForTags(['shiny', 'mega', 'hundo'], heights)).toBe(1055)
    expect(cropHeightForTags(['xxs', 'hundo'], heights)).toBe(930)
  })

  it('uses a taller crop for Lucky size combinations', () => {
    expect(cropHeightForTags(['lucky', 'mega'], heights)).toBe(1093)
    expect(cropHeightForTags(['lucky', 'gigantamax', 'shiny'], heights)).toBe(1093)
    expect(cropHeightForTags(['dynamax', 'lucky', 'hundo'], heights)).toBe(1093)
    expect(cropHeightForTags(['lucky', 'xxs'], heights)).toBe(968)
    expect(cropHeightForTags(['xxl', 'lucky', 'costume'], heights)).toBe(968)
    expect(cropHeightForTags(['lucky', 'mega', 'xxs'], heights)).toBe(1093)
  })

  it('lets a stored Lucky combination replace its member tags', () => {
    expect(cropHeightForTags(['lucky', 'mega'], { ...heights, 'lucky+mega': 1120 })).toBe(1120)
    expect(cropHeightForTags(['lucky', 'xxl'], { ...heights, 'lucky+xxl': 950 })).toBe(950)
  })
})

describe('cropHeightForSpecimen', () => {
  it('locks Seen to 710 even when taller tags are on', () => {
    expect(SEEN_CROP_HEIGHT).toBe(710)
    expect(cropHeightForSpecimen(['mega'], heights, true)).toBe(710)
    expect(cropHeightForSpecimen(['lucky', 'xxs'], heights, true)).toBe(710)
    expect(cropHeightForSpecimen(['shiny', 'mega', 'hundo'], heights, true)).toBe(710)
  })

  it('still follows the tallest tag when Seen is off', () => {
    expect(cropHeightForSpecimen(['mega'], heights, false)).toBe(1055)
    expect(cropHeightForSpecimen(['lucky', 'gigantamax'], heights, false)).toBe(1093)
  })
})
