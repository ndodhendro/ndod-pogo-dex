import { describe, expect, it } from 'vitest'
import { coverMutationsAfterEdit, coverPurity, pickCoverAfterDelete, speciesInCategory, shouldAutoReplaceCover } from './covers'
import { hasAllRequired, isExactMatch, specimenTags, visualKey, type SpecimenFields } from './tags'

const shadowGray = specimenTags({
  speciesId: 1,
  form: null,
  shiny: true,
  shadowStatus: 'shadow',
  costume: null,
  background: 'Tokyo',
  hundo: false,
  nundo: false,
})

const shadowPure = specimenTags({
  speciesId: 1,
  form: null,
  shiny: false,
  shadowStatus: 'shadow',
  costume: null,
  background: null,
  hundo: false,
  nundo: false,
})

describe('tags', () => {
  it('does not put IV in the visual uniqueness key', () => {
    const base = {
      speciesId: 25,
      form: null,
      shiny: false,
      shadowStatus: 'none' as const,
      costume: null,
      background: null,
      hundo: false,
      nundo: false,
    }
    expect(visualKey({ ...base, hundo: true })).toBe(visualKey(base))
    expect(visualKey({ ...base, nundo: true })).toBe(visualKey(base))
  })

  it('includes custom tags in the visual uniqueness key', () => {
    const base = {
      speciesId: 25,
      form: null,
      shiny: false,
      shadowStatus: 'none' as const,
      costume: null,
      background: null,
      hundo: false,
      nundo: false,
    }
    expect(visualKey({ ...base, extraTags: ['lucky'] })).not.toBe(visualKey(base))
  })

  it('treats costume and background values as part of uniqueness', () => {
    const base = {
      speciesId: 25,
      form: null,
      shiny: false,
      shadowStatus: 'none' as const,
      costume: 'Holiday',
      background: null,
      hundo: false,
      nundo: false,
    }
    expect(visualKey(base)).not.toBe(visualKey({ ...base, costume: 'Party' }))
    expect(visualKey({ ...base, costume: null, background: 'Tokyo' })).not.toBe(
      visualKey({ ...base, costume: null, background: 'Paris' }),
    )
  })

  it('never stores combo tag names', () => {
    expect(shadowGray).toEqual(['shiny', 'shadow', 'background'])
    expect(shadowGray.includes('shadow_shiny_polos' as never)).toBe(false)
  })
})

describe('categories', () => {
  it('counts a species as in Shadow when extras are present', () => {
    expect(hasAllRequired(shadowGray, ['shadow'])).toBe(true)
    expect(speciesInCategory([{ tags: shadowGray }], ['shadow'])).toBe(true)
  })

  it('does not count a pure shadow in Shiny Shadow', () => {
    expect(hasAllRequired(shadowPure, ['shiny', 'shadow'])).toBe(false)
  })

  it('treats Basic (no required tags) as matching every specimen', () => {
    expect(hasAllRequired(shadowGray, [])).toBe(true)
    expect(isExactMatch(shadowGray, [])).toBe(false)
    expect(isExactMatch([], [])).toBe(true)
  })
})

describe('covers', () => {
  it('marks extra-tag covers gray and exact covers green', () => {
    expect(coverPurity(shadowGray, ['shadow'])).toBe('gray')
    expect(coverPurity(shadowPure, ['shadow'])).toBe('green')
    expect(coverPurity(shadowPure, ['shadow', 'hundo'])).toBe(null)
  })

  it('auto-replaces a gray cover with the first exact match', () => {
    expect(shouldAutoReplaceCover(['shadow'], shadowGray, shadowPure)).toBe(true)
  })

  it('does not auto-replace an existing green cover', () => {
    expect(shouldAutoReplaceCover(['shadow'], shadowPure, shadowGray)).toBe(false)
    expect(shouldAutoReplaceCover(['shadow'], shadowPure, shadowPure)).toBe(false)
  })

  it('uses the first in-category specimen as cover when none exists', () => {
    expect(shouldAutoReplaceCover(['shadow'], null, shadowGray)).toBe(true)
  })

  it('picks a remaining green cover after delete, else the newest gray', () => {
    expect(
      pickCoverAfterDelete(
        ['shadow'],
        [
          { id: 'gray-old', tags: shadowGray, createdAt: 1 },
          { id: 'green', tags: shadowPure, createdAt: 2 },
          { id: 'gray-new', tags: shadowGray, createdAt: 3 },
        ],
      ),
    ).toBe('green')
    expect(
      pickCoverAfterDelete(
        ['shadow'],
        [
          { id: 'gray-old', tags: shadowGray, createdAt: 1 },
          { id: 'gray-new', tags: shadowGray, createdAt: 3 },
        ],
      ),
    ).toBe('gray-new')
    expect(pickCoverAfterDelete(['shadow', 'hundo'], [{ id: 'gray-old', tags: shadowGray, createdAt: 1 }])).toBe(
      null,
    )
  })

  it('requires exact [shadow, hundo] for a green Shadow Hundo cover', () => {
    const extra = specimenTags({
      speciesId: 1,
      form: null,
      shiny: true,
      shadowStatus: 'shadow',
      costume: null,
      background: null,
      hundo: true,
      nundo: false,
    })
    const exact = specimenTags({
      speciesId: 1,
      form: null,
      shiny: false,
      shadowStatus: 'shadow',
      costume: null,
      background: null,
      hundo: true,
      nundo: false,
    })
    expect(coverPurity(extra, ['shadow', 'hundo'])).toBe('gray')
    expect(coverPurity(exact, ['shadow', 'hundo'])).toBe('green')
  })
})

type CoverSpecimen = SpecimenFields & { id: string; createdAt: number }

function spec(partial: Partial<CoverSpecimen> & Pick<CoverSpecimen, 'id'>): CoverSpecimen {
  return {
    speciesId: 1,
    form: null,
    shiny: false,
    shadowStatus: 'none',
    costume: null,
    background: null,
    hundo: false,
    nundo: false,
    extraTags: [],
    createdAt: 1,
    ...partial,
  }
}

const shadowCat = { id: 'shadow', requiredTags: ['shadow'] as const }
const shinyCat = { id: 'shiny', requiredTags: ['shiny'] as const }

describe('coverMutationsAfterEdit', () => {
  it('replaces a gray cover when the photo is edited to an exact match', () => {
    const gray = spec({ id: 'gray', shiny: true, shadowStatus: 'shadow', background: 'Tokyo' })
    const incoming = spec({ id: 'incoming', shadowStatus: 'shadow', createdAt: 2 })
    expect(
      coverMutationsAfterEdit(
        incoming,
        incoming,
        [shadowCat],
        [{ categoryId: 'shadow', speciesId: 1, specimenId: 'gray' }],
        [gray, incoming],
      ),
    ).toEqual([{ op: 'put', categoryId: 'shadow', speciesId: 1, specimenId: 'incoming' }])
  })

  it('keeps a green cover that gained extra tags', () => {
    const previous = spec({ id: 'cover', shadowStatus: 'shadow' })
    const updated = spec({ id: 'cover', shiny: true, shadowStatus: 'shadow' })
    expect(
      coverMutationsAfterEdit(
        previous,
        updated,
        [shadowCat],
        [{ categoryId: 'shadow', speciesId: 1, specimenId: 'cover' }],
        [updated],
      ),
    ).toEqual([])
  })

  it('picks another in-category photo when the cover loses a required tag', () => {
    const updated = spec({ id: 'cover', shiny: true })
    const other = spec({ id: 'other', shadowStatus: 'shadow', createdAt: 2 })
    expect(
      coverMutationsAfterEdit(
        spec({ id: 'cover', shadowStatus: 'shadow' }),
        updated,
        [shadowCat],
        [{ categoryId: 'shadow', speciesId: 1, specimenId: 'cover' }],
        [updated, other],
      ),
    ).toEqual([{ op: 'put', categoryId: 'shadow', speciesId: 1, specimenId: 'other' }])
  })

  it('deletes the cover when nothing in the species stays in the category', () => {
    const updated = spec({ id: 'cover' })
    expect(
      coverMutationsAfterEdit(
        spec({ id: 'cover', shadowStatus: 'shadow' }),
        updated,
        [shadowCat],
        [{ categoryId: 'shadow', speciesId: 1, specimenId: 'cover' }],
        [updated],
      ),
    ).toEqual([{ op: 'delete', categoryId: 'shadow', speciesId: 1 }])
  })

  it('moves covers to the new species and backfills the old slot', () => {
    const updated = spec({ id: 'cover', speciesId: 25, shadowStatus: 'shadow' })
    const leftover = spec({ id: 'other', shadowStatus: 'shadow', createdAt: 2 })
    expect(
      coverMutationsAfterEdit(
        spec({ id: 'cover', shadowStatus: 'shadow' }),
        updated,
        [shadowCat, shinyCat],
        [{ categoryId: 'shadow', speciesId: 1, specimenId: 'cover' }],
        [updated, leftover],
      ),
    ).toEqual([
      { op: 'put', categoryId: 'shadow', speciesId: 1, specimenId: 'other' },
      { op: 'put', categoryId: 'shadow', speciesId: 25, specimenId: 'cover' },
    ])
  })
})
