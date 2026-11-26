import { describe, expect, it } from 'vitest'
import { galleryColumnCount } from './galleryColumns'

describe('gallery columns', () => {
  it('defaults to five cards per row', () => {
    expect(galleryColumnCount(null)).toBe(5)
    expect(galleryColumnCount('')).toBe(5)
    expect(galleryColumnCount('9')).toBe(5)
  })

  it('keeps a stored count from 2 through 6', () => {
    expect(galleryColumnCount('2')).toBe(2)
    expect(galleryColumnCount('3')).toBe(3)
    expect(galleryColumnCount('4')).toBe(4)
    expect(galleryColumnCount('5')).toBe(5)
    expect(galleryColumnCount('6')).toBe(6)
  })
})
