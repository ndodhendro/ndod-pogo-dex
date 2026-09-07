import { describe, expect, it } from 'vitest'
import { cropHeightForTags, MAX_TAG_CROP_HEIGHT, SEED_TAG_CROPS } from './tagCrops'

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
    expect(cropHeightForTags(['lucky', 'xxs'], heights)).toBe(930)
  })
})
