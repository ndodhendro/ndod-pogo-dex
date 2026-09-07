import { describe, expect, it } from 'vitest'
import { cropBottomFromBitmap, screenshotCropRect } from './screenshotCrop'

describe('screenshotCropRect', () => {
  it('crops a 738×1600 file from y=0 to the given bottom', () => {
    expect(screenshotCropRect(738, 1600, 710)).toEqual({
      x: 0,
      y: 0,
      width: 738,
      height: 710,
    })
    expect(screenshotCropRect(738, 1600, 1055)).toEqual({
      x: 0,
      y: 0,
      width: 738,
      height: 1055,
    })
  })

  it('scales the Paint rectangle when the file is a larger copy of the same shot', () => {
    expect(screenshotCropRect(1476, 3200, 710)).toEqual({
      x: 0,
      y: 0,
      width: 1476,
      height: 1420,
    })
  })

  it('does not crop a strip that is already that height', () => {
    expect(screenshotCropRect(738, 710, 710)).toBeNull()
    expect(screenshotCropRect(738, 710, 1055)).toBeNull()
  })
})

describe('cropBottomFromBitmap', () => {
  it('maps a 738-wide strip back to Paint height', () => {
    expect(cropBottomFromBitmap(738, 710)).toBe(710)
    expect(cropBottomFromBitmap(738, 1055)).toBe(1055)
  })

  it('scales a larger copy of the same strip', () => {
    expect(cropBottomFromBitmap(1476, 1420)).toBe(710)
  })
})
