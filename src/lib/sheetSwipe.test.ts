import { describe, expect, it } from 'vitest'
import {
  sheetBackdropDim,
  sheetCloseY,
  sheetDragY,
  sheetShouldClose,
  SHEET_SWIPE_COMMIT,
} from './sheetSwipe'

describe('sheetDragY', () => {
  it('follows a downward pull', () => {
    expect(sheetDragY(40)).toBe(40)
  })

  it('rubber-bands an upward pull', () => {
    expect(sheetDragY(-40)).toBeCloseTo(-7.2)
  })
})

describe('sheetShouldClose', () => {
  it('stays open before the commit distance', () => {
    expect(sheetShouldClose(SHEET_SWIPE_COMMIT - 1)).toBe(false)
  })

  it('closes after a downward flick', () => {
    expect(sheetShouldClose(SHEET_SWIPE_COMMIT)).toBe(true)
  })
})

describe('sheetCloseY', () => {
  it('slides the sheet fully off-screen', () => {
    expect(sheetCloseY(420)).toBe(420)
    expect(sheetCloseY(0)).toBe(1)
  })
})

describe('sheetBackdropDim', () => {
  it('fades the dim as the sheet is dragged down', () => {
    expect(sheetBackdropDim(0, 400)).toBe(1)
    expect(sheetBackdropDim(200, 400)).toBe(0.5)
    expect(sheetBackdropDim(400, 400)).toBe(0)
  })
})
