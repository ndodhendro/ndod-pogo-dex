import { describe, expect, it } from 'vitest'
import {
  categorySaveWarning,
  specimenSaveWarning,
  toggleRequiredTags,
  toggleTag,
  allocateCategoryTag,
  resolveRequiredTags,
  type SpecimenFields,
} from './tags'

const base = (): SpecimenFields => ({
  speciesId: 25,
  form: null,
  shiny: false,
  shadowStatus: 'none',
  costume: null,
  background: null,
  hundo: false,
  nundo: false,
})

describe('specimenSaveWarning', () => {
  it('asks for a species before save', () => {
    expect(specimenSaveWarning({ ...base(), speciesId: 0 })).toBe('Pick a species first')
  })

  it('asks for costume and background names when those tags are on', () => {
    expect(specimenSaveWarning({ ...base(), costume: '  ' })).toBe('Enter a costume name')
    expect(specimenSaveWarning({ ...base(), background: '' })).toBe('Enter a background name')
  })

  it('is empty when the specimen can be saved', () => {
    expect(specimenSaveWarning(base())).toBe('')
    expect(specimenSaveWarning({ ...base(), costume: 'Holiday hat', background: 'Tokyo' })).toBe('')
  })
})

describe('categorySaveWarning', () => {
  it('requires a name', () => {
    expect(categorySaveWarning('  ')).toBe('Name is required')
    expect(categorySaveWarning('Shadow Hundo')).toBe('')
  })
})

describe('toggleRequiredTags', () => {
  it('adds every tag from a category choice', () => {
    expect(toggleRequiredTags(['shiny'], ['shadow', 'hundo'])).toEqual(['shiny', 'shadow', 'hundo'])
  })

  it('removes the choice tags when all of them are already picked', () => {
    expect(toggleRequiredTags(['shadow', 'hundo', 'shiny'], ['shadow', 'hundo'])).toEqual(['shiny'])
  })
})

describe('toggleTag', () => {
  it('can clear an empty costume or background tag', () => {
    const withCostume = toggleTag(base(), 'costume')
    expect(withCostume.costume).toBe('')
    expect(toggleTag(withCostume, 'costume').costume).toBe(null)
  })

  it('toggles a custom category tag on extraTags', () => {
    const withLucky = toggleTag(base(), 'lucky')
    expect(withLucky.extraTags).toEqual(['lucky'])
    expect(toggleTag(withLucky, 'lucky').extraTags).toEqual([])
  })

  it('maps a form tag onto the form field and keeps only one form', () => {
    const alolan = toggleTag(base(), 'alolan')
    expect(alolan.form).toBe('Alolan')
    expect(alolan.extraTags).toEqual(['alolan'])
    const galarian = toggleTag(alolan, 'galarian')
    expect(galarian.form).toBe('Galarian')
    expect(galarian.extraTags).toEqual(['galarian'])
    expect(toggleTag(galarian, 'galarian').form).toBe(null)
  })
})

describe('resolveRequiredTags', () => {
  it('turns an empty custom category into its own tag', () => {
    expect(resolveRequiredTags([], { name: 'Lucky' })).toEqual(['lucky'])
  })

  it('keeps the Basic seed empty', () => {
    expect(resolveRequiredTags([], { name: 'Basic', seed: true })).toEqual([])
  })

  it('does not invent a combo tag when existing tags are picked', () => {
    expect(resolveRequiredTags(['shadow', 'hundo'], { name: 'Shadow Hundo' })).toEqual([
      'shadow',
      'hundo',
    ])
  })

  it('avoids colliding with built-in or already used tags', () => {
    expect(allocateCategoryTag('Shiny', ['shiny'])).toBe('shiny-2')
    expect(allocateCategoryTag('Lucky', ['lucky'])).toBe('lucky-2')
  })
})
