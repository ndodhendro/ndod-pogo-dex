import { describe, expect, it } from 'vitest'
import { nameplateRect } from './screenshotOcr'

describe('nameplateRect', () => {
  it('reads Paint y=650…710 at full width on a 738×1600 shot', () => {
    expect(nameplateRect(738, 1600)).toEqual({
      x: 0,
      y: 650,
      width: 738,
      height: 60,
    })
  })

  it('scales the Paint band on a 2× screenshot', () => {
    expect(nameplateRect(1476, 3200)).toEqual({
      x: 0,
      y: 1300,
      width: 1476,
      height: 120,
    })
  })

  it('keeps the same Paint band on an already-cropped 710 card', () => {
    expect(nameplateRect(738, 710)).toEqual({
      x: 0,
      y: 650,
      width: 738,
      height: 60,
    })
  })
})
