import { describe, expect, it } from 'vitest'
import { galleryVisibleLabels, specimenMatchesGalleryQuery } from './gallerySearch'
import type { SpecimenFields } from './tags'

const categories = [
  { seed: true, name: 'Shiny', requiredTags: ['shiny'] as const },
  { seed: true, name: 'Costume', requiredTags: ['costume'] as const },
  { seed: true, name: 'Background', requiredTags: ['background'] as const },
  { seed: true, name: 'Gender', requiredTags: ['gender'] as const },
]

const spec = (over: Partial<SpecimenFields> & { fileName?: string | null } = {}): SpecimenFields & {
  fileName?: string | null
} => ({
  speciesId: 25,
  form: null,
  shiny: false,
  shadowStatus: 'none',
  costume: null,
  background: null,
  hundo: false,
  nundo: false,
  extraTags: [],
  ...over,
})

describe('galleryVisibleLabels', () => {
  it('includes the card name plus gender, costume, and background text', () => {
    const labels = galleryVisibleLabels(
      spec({
        costume: 'Party Hat',
        extraTags: ['gender'],
        gender: 'Female',
        background: 'Tokyo',
      }),
      categories,
    )
    expect(labels).toEqual(
      expect.arrayContaining(['Pikachu Party Hat Female Tokyo', 'Party Hat', 'Female', 'Tokyo']),
    )
  })
})

describe('specimenMatchesGalleryQuery', () => {
  it('keeps every card when the query is empty', () => {
    expect(specimenMatchesGalleryQuery(spec({ costume: 'Party Hat' }), '  ', categories)).toBe(true)
  })

  it('matches costume, gender, background, and other visible labels', () => {
    const hat = spec({ costume: 'Party Hat' })
    const female = spec({ extraTags: ['gender'], gender: 'Female' })
    const tokyo = spec({ background: 'Tokyo' })
    const shiny = spec({ shiny: true })
    expect(specimenMatchesGalleryQuery(hat, 'party', categories)).toBe(true)
    expect(specimenMatchesGalleryQuery(female, 'female', categories)).toBe(true)
    expect(specimenMatchesGalleryQuery(tokyo, 'tokyo', categories)).toBe(true)
    expect(specimenMatchesGalleryQuery(shiny, 'shiny', categories)).toBe(true)
    expect(specimenMatchesGalleryQuery(hat, 'female', categories)).toBe(false)
    expect(specimenMatchesGalleryQuery(female, 'party', categories)).toBe(false)
  })

  it('matches a visible filename', () => {
    expect(
      specimenMatchesGalleryQuery(spec({ fileName: 'IMG_1234.PNG' }), 'img_1234', categories),
    ).toBe(true)
  })
})
