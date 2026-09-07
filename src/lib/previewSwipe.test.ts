import { describe, expect, it } from 'vitest'
import {
  listNeighbor,
  previewCarouselSettleX,
  previewCloseSettleY,
  previewSwipeAxis,
  previewSwipeCommit,
  previewSwipeOffset,
  PREVIEW_SWIPE_COMMIT,
  PREVIEW_SWIPE_LOCK,
} from './previewSwipe'

describe('previewSwipeAxis', () => {
  it('stays unlocked until the finger clears the lock distance', () => {
    expect(previewSwipeAxis(PREVIEW_SWIPE_LOCK - 1, 0)).toBeNull()
    expect(previewSwipeAxis(0, PREVIEW_SWIPE_LOCK - 1)).toBeNull()
  })

  it('locks to the dominant axis', () => {
    expect(previewSwipeAxis(40, 8)).toBe('x')
    expect(previewSwipeAxis(-8, -40)).toBe('y')
  })
})

describe('previewSwipeOffset', () => {
  it('follows a left swipe toward the next image', () => {
    expect(previewSwipeOffset('x', -50, 4, true, true)).toEqual({ x: -50, y: 0 })
  })

  it('rubber-bands at the ends', () => {
    expect(previewSwipeOffset('x', -50, 0, true, false).x).toBeCloseTo(-9)
    expect(previewSwipeOffset('x', 50, 0, false, true).x).toBeCloseTo(9)
  })

  it('follows an upward or downward close', () => {
    expect(previewSwipeOffset('y', 0, -40, true, true)).toEqual({ x: 0, y: -40 })
    expect(previewSwipeOffset('y', 0, 40, true, true)).toEqual({ x: 0, y: 40 })
  })
})

describe('previewSwipeCommit', () => {
  it('treats a left swipe as next and a right swipe as previous', () => {
    expect(previewSwipeCommit('x', -PREVIEW_SWIPE_COMMIT, 0, true, true)).toBe('next')
    expect(previewSwipeCommit('x', PREVIEW_SWIPE_COMMIT, 0, true, true)).toBe('prev')
  })

  it('closes on an upward or downward swipe', () => {
    expect(previewSwipeCommit('y', 0, -PREVIEW_SWIPE_COMMIT, true, true)).toBe('close-up')
    expect(previewSwipeCommit('y', 0, PREVIEW_SWIPE_COMMIT, true, true)).toBe('close-down')
  })

  it('does not step past the ends', () => {
    expect(previewSwipeCommit('x', -PREVIEW_SWIPE_COMMIT, 0, true, false)).toBeNull()
    expect(previewSwipeCommit('x', PREVIEW_SWIPE_COMMIT, 0, false, true)).toBeNull()
  })
})

describe('listNeighbor', () => {
  it('returns the previous and next items', () => {
    expect(listNeighbor(['a', 'b', 'c'], 1, -1)).toBe('a')
    expect(listNeighbor(['a', 'b', 'c'], 1, 1)).toBe('c')
  })

  it('is empty at the ends or when the index is missing', () => {
    expect(listNeighbor(['a'], 0, 1)).toBeUndefined()
    expect(listNeighbor(['a'], -1, 1)).toBeUndefined()
  })
})

describe('previewCarouselSettleX', () => {
  it('finishes a left swipe by sliding one viewport to the next photo', () => {
    expect(previewCarouselSettleX('next', 320)).toBe(-320)
    expect(previewCarouselSettleX('next', 320, 12)).toBe(-332)
  })

  it('finishes a right swipe by sliding one viewport to the previous photo', () => {
    expect(previewCarouselSettleX('prev', 320)).toBe(320)
    expect(previewCarouselSettleX('prev', 320, 12)).toBe(332)
  })

  it('does not settle a close or a cancelled drag', () => {
    expect(previewCarouselSettleX('close-up', 320)).toBeNull()
    expect(previewCarouselSettleX('close-down', 320)).toBeNull()
    expect(previewCarouselSettleX(null, 320)).toBeNull()
  })
})

describe('previewCloseSettleY', () => {
  it('slides the sheet off the top or bottom of the viewport', () => {
    expect(previewCloseSettleY('close-up', 800)).toBe(-800)
    expect(previewCloseSettleY('close-down', 800)).toBe(800)
  })

  it('ignores carousel actions', () => {
    expect(previewCloseSettleY('next', 800)).toBeNull()
    expect(previewCloseSettleY(null, 800)).toBeNull()
  })
})
