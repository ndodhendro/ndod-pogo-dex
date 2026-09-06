import { describe, expect, it } from 'vitest'
import { isProbablyImageFile, thumbSizeFor } from './images'

function file(name: string, type: string) {
  return new File(['x'], name, { type })
}

describe('thumbSizeFor', () => {
  it('keeps the 738×1600 aspect at 3× display width', () => {
    expect(thumbSizeFor(738, 1600)).toEqual({ width: 384, height: 833 })
  })
})

describe('isProbablyImageFile', () => {
  it('accepts image MIME types', () => {
    expect(isProbablyImageFile(file('shot.png', 'image/png'))).toBe(true)
    expect(isProbablyImageFile(file('shot.jpg', 'image/jpeg'))).toBe(true)
  })

  it('accepts empty or generic types from the Android gallery picker', () => {
    expect(isProbablyImageFile(file('1000001234', ''))).toBe(true)
    expect(isProbablyImageFile(file('shot.jpg', 'application/octet-stream'))).toBe(true)
  })

  it('rejects non-image types', () => {
    expect(isProbablyImageFile(file('note.txt', 'text/plain'))).toBe(false)
    expect(isProbablyImageFile(file('clip.mp4', 'video/mp4'))).toBe(false)
  })
})
