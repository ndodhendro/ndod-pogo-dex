import { describe, expect, it } from 'vitest'
import { isProbablyImageFile, screenshotCropRect } from './images'

function file(name: string, type: string) {
  return new File(['x'], name, { type })
}

describe('screenshotCropRect', () => {
  it('crops 738×1600 to 738×955 starting at y=55', () => {
    expect(screenshotCropRect(738, 1600)).toEqual({
      x: 0,
      y: 55,
      width: 738,
      height: 955,
    })
  })

  it('keeps full width and a 955px-tall slice on other sizes', () => {
    expect(screenshotCropRect(1080, 2400)).toEqual({
      x: 0,
      y: 55,
      width: 1080,
      height: 955,
    })
  })

  it('clamps to the image when the file is shorter than 1010px', () => {
    expect(screenshotCropRect(1080, 900)).toEqual({
      x: 0,
      y: 55,
      width: 1080,
      height: 845,
    })
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
