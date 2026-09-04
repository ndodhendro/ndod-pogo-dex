import { describe, expect, it } from 'vitest'
import { firstGrapheme, hexToHsv, hexToRgba, hsvToHex, normalizeHexColor, pickEmojiInput } from './categoryStyle'

describe('category style', () => {
  it('keeps a single emoji grapheme', () => {
    expect(firstGrapheme('🌑✨')).toBe('🌑')
    expect(firstGrapheme(' 📌 ')).toBe('📌')
    expect(firstGrapheme('')).toBe('')
  })

  it('takes the newly typed emoji when the field appends', () => {
    expect(pickEmojiInput('📌', '📌🌑')).toBe('🌑')
    expect(pickEmojiInput('📌', '🎯')).toBe('🎯')
    expect(pickEmojiInput('📌', '')).toBe('')
  })

  it('normalizes 3-digit and 6-digit hex colors', () => {
    expect(normalizeHexColor('#6ee7b7')).toBe('#6ee7b7')
    expect(normalizeHexColor('#ABC')).toBe('#aabbcc')
    expect(normalizeHexColor('red')).toBe(null)
    expect(normalizeHexColor('')).toBe(null)
  })

  it('builds a translucent fill from the font color', () => {
    expect(hexToRgba('#c4b5fd', 0.12)).toBe('rgba(196, 181, 253, 0.12)')
  })

  it('round-trips hex through HSV', () => {
    expect(hsvToHex(hexToHsv('#c4b5fd'))).toBe('#c4b5fd')
    expect(hsvToHex(hexToHsv('#ffffff'))).toBe('#ffffff')
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 })
  })
})
