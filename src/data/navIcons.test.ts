import { describe, expect, it } from 'vitest'
import { colorForCategory, iconForCategory, iconForForm, lookForTag, requiredTagChoices, specimenTagChoices, suggestedLook, toneForCategory, toneForForm } from './navIcons'

describe('nav icons', () => {
  it('maps seed category names', () => {
    expect(iconForCategory({ name: 'Basic', requiredTags: [] })).toBe('🌿')
    expect(iconForCategory({ name: 'Pokémon', requiredTags: [] })).toBe('🌿')
    expect(iconForCategory({ name: 'Living', requiredTags: [] })).toBe('🌿')
    expect(iconForCategory({ name: 'Shadow', requiredTags: ['shadow'] })).toBe('🌑')
  })

  it('uses the first required tag for custom categories', () => {
    expect(iconForCategory({ name: 'Shadow Hundo', requiredTags: ['shadow', 'hundo'] })).toBe(
      '🌑',
    )
  })

  it('falls back when a custom category has no tags', () => {
    expect(iconForCategory({ name: 'My Track', requiredTags: [] })).toBe('📌')
  })

  it('maps form chips', () => {
    expect(iconForForm(null)).toBe('⚪')
    expect(iconForForm('Alolan')).toBe('🌺')
  })

  it('uses a stored emoji before tag or name defaults', () => {
    expect(
      iconForCategory({ name: 'Shadow Hundo', requiredTags: ['shadow', 'hundo'], emoji: '🎯' }),
    ).toBe('🎯')
  })

  it('maps semantic tones for categories and forms', () => {
    expect(toneForCategory({ name: 'Basic', requiredTags: [] })).toBe('living')
    expect(toneForCategory({ name: 'Shadow Hundo', requiredTags: ['shadow', 'hundo'] })).toBe(
      'shadow',
    )
    expect(toneForForm(null)).toBe('default')
    expect(toneForForm('Paldean')).toBe('paldean')
  })

  it('uses a stored label color before the tone default', () => {
    expect(colorForCategory({ name: 'Shadow', requiredTags: ['shadow'] })).toBe('#c4b5fd')
    expect(
      colorForCategory({ name: 'Shadow', requiredTags: ['shadow'], labelColor: '#ff8800' }),
    ).toBe('#ff8800')
  })

  it('suggests look from the first required tag', () => {
    expect(suggestedLook([])).toEqual({ emoji: '📌', labelColor: '#6ee7b7' })
    expect(suggestedLook(['shadow', 'hundo'])).toEqual({ emoji: '🌑', labelColor: '#c4b5fd' })
  })

  it('uses the first matching category for a tag, including custom tracks', () => {
    const categories = [
      { seed: false, name: 'Shadow Polos', requiredTags: ['shadow'] as const, emoji: '🎩', labelColor: '#ffffff' },
      { seed: true, name: 'Shadow', requiredTags: ['shadow'] as const, emoji: '😈', labelColor: '#ff8800' },
    ]
    expect(lookForTag('shadow', categories)).toEqual({ emoji: '🎩', labelColor: '#ffffff' })
    expect(lookForTag('hundo', categories)).toEqual({ emoji: '💯', labelColor: '#fcd34d' })
  })

  it('lists only existing categories as required-tag choices', () => {
    const choices = requiredTagChoices([
      { id: 'seed:living', seed: true, name: 'Basic', requiredTags: [] },
      { id: 'seed:shadow', seed: true, name: 'Shadow', requiredTags: ['shadow'], emoji: '🌑', labelColor: '#c4b5fd' },
      { id: 'custom:polos', seed: false, name: 'Shadow Polos', requiredTags: ['shadow'], emoji: '🎩', labelColor: '#ffffff' },
      { id: 'custom:combo', seed: false, name: 'Shiny Hundo', requiredTags: ['shiny', 'hundo'], emoji: '🎯' },
    ])
    expect(choices.map((row) => row.label)).toEqual(['Shadow', 'Shadow Polos', 'Shiny Hundo'])
    expect(choices.find((row) => row.label === 'Shadow Polos')?.icon).toBe('🎩')
    expect(choices.every((row) => !row.key.startsWith('tag:'))).toBe(true)
  })

  it('keeps the category currently being edited so its required tags stay visible', () => {
    const choices = requiredTagChoices([
      { id: 'seed:shiny', seed: true, name: 'Shiny', requiredTags: ['shiny'] },
      { id: 'custom:hundo', seed: false, name: 'Hundo', requiredTags: ['hundo'] },
    ])
    expect(choices.map((row) => row.label)).toEqual(['Shiny', 'Hundo'])
  })

  it('lists a saved custom atomic category like Lucky', () => {
    const choices = requiredTagChoices([
      { id: 'seed:living', seed: true, name: 'Basic', requiredTags: [] },
      { id: 'custom:lucky', seed: false, name: 'Lucky', requiredTags: ['lucky'] },
    ])
    expect(choices.map((row) => row.label)).toEqual(['Lucky'])
  })

  it('builds specimen tag chips from single-tag categories', () => {
    const choices = specimenTagChoices([
      { seed: true, name: 'Basic', requiredTags: [] },
      { seed: true, name: 'Shadow', requiredTags: ['shadow'], emoji: '🌑' },
      { seed: false, name: 'Shadow Polos', requiredTags: ['shadow'], emoji: '🎩' },
      { seed: false, name: 'Shiny Hundo', requiredTags: ['shiny', 'hundo'] },
      { seed: true, name: 'Hundo', requiredTags: ['hundo'], emoji: '💯' },
    ])
    expect(choices.map((row) => row.tag)).toEqual(['shadow', 'hundo'])
    expect(choices[0]).toMatchObject({ label: 'Shadow', icon: '🌑' })
  })
})
