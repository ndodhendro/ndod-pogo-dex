import { describe, expect, it } from 'vitest'
import {
  categorySaveWarning,
  clearVisualTags,
  fieldsFromSpecimen,
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

  it('lets any tags stack, including GO-impossible pairs', () => {
    const stacked = ['dynamax', 'gigantamax', 'xxs', 'xxl', 'alolan', 'mega'].reduce(
      (fields, tag) => toggleTag(fields, tag),
      toggleTag(toggleTag(toggleTag(toggleTag(base(), 'shadow'), 'purified'), 'hundo'), 'nundo'),
    )
    expect(stacked.shadowStatus).toBe('both')
    expect(stacked.hundo).toBe(true)
    expect(stacked.nundo).toBe(true)
    expect(stacked.form).toBe('Alolan · Mega')
    expect(stacked.extraTags).toEqual(['dynamax', 'gigantamax', 'xxs', 'xxl', 'alolan', 'mega'])
  })

  it('maps form tags onto the form field and keeps every selected form', () => {
    const alolan = toggleTag(base(), 'alolan')
    expect(alolan.form).toBe('Alolan')
    expect(alolan.extraTags).toEqual(['alolan'])
    const galarian = toggleTag(alolan, 'galarian')
    expect(galarian.form).toBe('Alolan · Galarian')
    expect(galarian.extraTags).toEqual(['alolan', 'galarian'])
    expect(toggleTag(galarian, 'galarian').form).toBe('Alolan')
  })

  it('clears every visual tag and keeps the species', () => {
    const tagged = toggleTag({ ...toggleTag(base(), 'shiny'), costume: 'Hat' }, 'alolan')
    expect(clearVisualTags(tagged)).toEqual({
      speciesId: 25,
      form: null,
      shiny: false,
      shadowStatus: 'none',
      costume: null,
      background: null,
      hundo: false,
      nundo: false,
      extraTags: [],
    })
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

describe('fieldsFromSpecimen', () => {
  it('copies the saved tags without sharing extraTags', () => {
    const extraTags = ['lucky']
    const row = { ...base(), shiny: true, extraTags }
    const fields = fieldsFromSpecimen(row)
    extraTags.push('xxl')
    expect(fields.shiny).toBe(true)
    expect(fields.extraTags).toEqual(['lucky'])
  })
})
