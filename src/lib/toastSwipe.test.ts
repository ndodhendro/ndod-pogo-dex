import { describe, expect, it } from 'vitest'
import { toastCloseY, toastDragY, toastShouldClose, TOAST_SWIPE_COMMIT } from './toastSwipe'

describe('toastDragY', () => {
  it('follows an upward flick', () => {
    expect(toastDragY(-40)).toBe(-40)
  })

  it('rubber-bands a downward pull', () => {
    expect(toastDragY(40)).toBeCloseTo(7.2)
  })
})

describe('toastShouldClose', () => {
  it('stays open before the commit distance', () => {
    expect(toastShouldClose(-(TOAST_SWIPE_COMMIT - 1))).toBe(false)
  })

  it('closes after an upward flick', () => {
    expect(toastShouldClose(-TOAST_SWIPE_COMMIT)).toBe(true)
  })
})

describe('toastCloseY', () => {
  it('slides the toast fully off-screen', () => {
    expect(toastCloseY(48)).toBe(-64)
    expect(toastCloseY(0)).toBe(-17)
  })

  it('keeps going if the finger already passed the off-screen point', () => {
    expect(toastCloseY(48, -200)).toBe(-200)
  })
})
