import { describe, expect, it } from 'vitest'
import { coverPurity, pickCoverAfterDelete, speciesInCategory, shouldAutoReplaceCover } from './covers'
import { hasAllRequired, isExactMatch, specimenTags, visualKey } from './tags'

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
