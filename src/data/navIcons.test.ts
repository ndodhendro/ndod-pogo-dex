import { describe, expect, it } from 'vitest'
import { iconForCategory, iconForForm, toneForCategory, toneForForm } from './navIcons'

describe('nav icons', () => {
  it('maps seed category names', () => {
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

  it('maps semantic tones for categories and forms', () => {
    expect(toneForCategory({ name: 'Living', requiredTags: [] })).toBe('living')
    expect(toneForCategory({ name: 'Shadow Hundo', requiredTags: ['shadow', 'hundo'] })).toBe(
      'shadow',
    )
    expect(toneForForm(null)).toBe('default')
    expect(toneForForm('Paldean')).toBe('paldean')
  })
})
