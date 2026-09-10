import { describe, expect, it } from 'vitest'
import { coverMutationsAfterEdit, coverPurity, pickCoverAfterDelete, speciesInCategory, shouldAutoReplaceCover } from './covers'
import { hasAllRequired, isExactMatch, specimenTags, visualKey, type SpecimenFields, type TagId } from './tags'

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

  it('treats a silhouette as a different look from a catch', () => {
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
    expect(visualKey({ ...base, silhouette: true })).not.toBe(visualKey(base))
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
    expect(visualKey({ ...base, extraTags: ['gender'], gender: 'Male' })).not.toBe(
      visualKey({ ...base, extraTags: ['gender'], gender: 'Female' }),
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
    expect(
      pickCoverAfterDelete(
        ['shadow'],
        [
          { id: 'sil', tags: shadowPure, createdAt: 3, silhouette: true },
          { id: 'catch', tags: shadowPure, createdAt: 1 },
        ],
      ),
    ).toBe('catch')
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

  it('marks a silhouette gray even when the tags are exact', () => {
    expect(coverPurity(shadowPure, ['shadow'], true)).toBe('gray')
    expect(coverPurity([], [], true)).toBe('gray')
  })

  it('auto-replaces a silhouette cover with the first exact catch', () => {
    expect(shouldAutoReplaceCover(['shadow'], shadowPure, shadowPure, { currentSilhouette: true })).toBe(true)
  })

  it('does not let a silhouette replace a green cover', () => {
    expect(
      shouldAutoReplaceCover(['shadow'], shadowPure, shadowPure, { incomingSilhouette: true }),
    ).toBe(false)
  })

  it('treats extra gender as green on any non-Gender category', () => {
    expect(coverPurity(['gender'], [])).toBe('green')
    expect(coverPurity(['basic'], [])).toBe('green')
    expect(coverPurity(['basic', 'gender'], [])).toBe('green')
    expect(coverPurity(['shadow', 'gender'], ['shadow'])).toBe('green')
    expect(coverPurity(['shadow', 'hundo', 'gender'], ['shadow', 'hundo'])).toBe('green')
    expect(coverPurity(['hisuian', 'gender'], ['hisuian'], false, 215)).toBe('green')
    expect(coverPurity(['hisuian', 'gender'], ['hisuian'], false, 58)).toBe('green')
    expect(coverPurity(['shadow', 'shiny', 'gender'], ['shadow'])).toBe('gray')
  })

  it('keeps Gender green only for gender or gender+basic, except Hisuian Sneasel', () => {
    expect(coverPurity(['gender'], ['gender'], false, 3, 'Male')).toBe('green')
    expect(coverPurity(['gender', 'basic'], ['gender'], false, 3, 'Female')).toBe('green')
    expect(coverPurity(['gender', 'hisuian'], ['gender'], false, 3, 'Male')).toBe('gray')
    expect(coverPurity(['gender', 'shiny'], ['gender'])).toBe('gray')
    expect(coverPurity(['gender'], ['gender'], false, 215, 'Male')).toBe('green')
    expect(coverPurity(['gender', 'basic'], ['gender'], false, 215, 'Female')).toBe('green')
    expect(coverPurity(['gender', 'hisuian'], ['gender'], false, 215, 'Male')).toBe('gray')
    expect(coverPurity(['gender'], ['gender'], false, 215, 'Hisuian Male')).toBe('gray')
    expect(coverPurity(['gender', 'basic'], ['gender'], false, 215, 'Hisuian Female')).toBe('gray')
    expect(coverPurity(['gender', 'hisuian'], ['gender'], false, 215, 'Hisuian Male')).toBe('green')
    expect(coverPurity(['gender', 'hisuian', 'shiny'], ['gender'], false, 215, 'Hisuian Male')).toBe(
      'gray',
    )
    expect(
      coverPurity(['gender', 'hisuian'], ['gender'], true, 215, 'Hisuian Male'),
    ).toBe('gray')
    expect(
      shouldAutoReplaceCover(['gender'], ['gender'], ['gender', 'hisuian'], {
        speciesId: 215,
        currentGender: 'Hisuian Male',
        incomingGender: 'Hisuian Male',
      }),
    ).toBe(true)
    expect(
      shouldAutoReplaceCover(['gender'], ['gender'], ['gender', 'hisuian'], {
        speciesId: 215,
        currentGender: 'Male',
        incomingGender: 'Male',
      }),
    ).toBe(false)
    expect(
      pickCoverAfterDelete(
        ['gender'],
        [
          { id: 'only', tags: ['gender'], createdAt: 3, gender: 'Hisuian Male' },
          { id: 'pair', tags: ['gender', 'hisuian'], createdAt: 1, gender: 'Hisuian Male' },
        ],
        215,
      ),
    ).toBe('pair')
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
    ).toEqual([{ op: 'put', categoryId: 'shadow', speciesId: 1, variant: '', specimenId: 'incoming' }])
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
    ).toEqual([{ op: 'put', categoryId: 'shadow', speciesId: 1, variant: '', specimenId: 'other' }])
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
    ).toEqual([{ op: 'delete', categoryId: 'shadow', speciesId: 1, variant: '' }])
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
      { op: 'put', categoryId: 'shadow', speciesId: 1, variant: '', specimenId: 'other' },
      { op: 'put', categoryId: 'shadow', speciesId: 25, variant: '', specimenId: 'cover' },
    ])
  })

  it('replaces a silhouette cover when a later exact catch is saved', () => {
    const sil = spec({ id: 'sil', shadowStatus: 'shadow', silhouette: true })
    const incoming = spec({ id: 'incoming', shadowStatus: 'shadow', createdAt: 2 })
    expect(
      coverMutationsAfterEdit(
        incoming,
        incoming,
        [shadowCat],
        [{ categoryId: 'shadow', speciesId: 1, specimenId: 'sil' }],
        [sil, incoming],
      ),
    ).toEqual([{ op: 'put', categoryId: 'shadow', speciesId: 1, variant: '', specimenId: 'incoming' }])
  })

  it('auto-replaces a gray Hisuian Sneasel Gender cover with gender+hisuian', () => {
    const genderCat = { id: 'gender', requiredTags: ['gender'] as TagId[] }
    const catalogs = [{ tag: 'gender' as TagId, limitPokedex: true, slotMode: 'variant' as const }]
    const gray = spec({
      id: 'gray',
      speciesId: 215,
      extraTags: ['gender'],
      gender: 'Hisuian Male',
    })
    const incoming = spec({
      id: 'incoming',
      speciesId: 215,
      extraTags: ['gender', 'hisuian'],
      gender: 'Hisuian Male',
      createdAt: 2,
    })
    expect(
      coverMutationsAfterEdit(
        incoming,
        incoming,
        [genderCat],
        [{ categoryId: 'gender', speciesId: 215, variant: 'Hisuian Male', specimenId: 'gray' }],
        [gray, incoming],
        catalogs,
      ),
    ).toEqual([
      {
        op: 'put',
        categoryId: 'gender',
        speciesId: 215,
        variant: 'Hisuian Male',
        specimenId: 'incoming',
      },
    ])
  })
})
