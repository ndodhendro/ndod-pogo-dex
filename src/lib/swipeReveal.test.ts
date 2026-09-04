import { describe, expect, it } from 'vitest'
import { clampSwipe, snapSwipeOpen, swipeOffsetFromDelta, SWIPE_WIDTH } from './swipeReveal'

describe('swipe reveal', () => {
  it('clamps between 0 and the action width', () => {
    expect(clampSwipe(-12)).toBe(0)
    expect(clampSwipe(SWIPE_WIDTH + 20)).toBe(SWIPE_WIDTH)
    expect(clampSwipe(40)).toBe(40)
  })

  it('treats a left drag as opening the trash action', () => {
    expect(swipeOffsetFromDelta(0, -40)).toBe(40)
    expect(swipeOffsetFromDelta(0, 20)).toBe(0)
    expect(swipeOffsetFromDelta(SWIPE_WIDTH, 30)).toBe(SWIPE_WIDTH - 30)
  })

  it('snaps open past the midpoint', () => {
    expect(snapSwipeOpen(20)).toBe(false)
    expect(snapSwipeOpen(SWIPE_WIDTH * 0.45)).toBe(true)
    expect(snapSwipeOpen(SWIPE_WIDTH)).toBe(true)
  })
})
