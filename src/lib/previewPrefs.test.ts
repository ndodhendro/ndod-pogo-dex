import { describe, expect, it } from 'vitest'
import { previewAnimationsEnabled } from './previewPrefs'

describe('preview animations pref', () => {
  it('defaults to on when unset', () => {
    expect(previewAnimationsEnabled(null)).toBe(true)
    expect(previewAnimationsEnabled('1')).toBe(true)
  })

  it('turns off only for the stored off flag', () => {
    expect(previewAnimationsEnabled('0')).toBe(false)
  })
})
