export const SWIPE_WIDTH = 72
export const SWIPE_LOCK = 10
export const SWIPE_OPEN_RATIO = 0.45

export function clampSwipe(offset: number, width = SWIPE_WIDTH) {
  return Math.min(width, Math.max(0, offset))
}

export function swipeOffsetFromDelta(startOffset: number, dx: number, width = SWIPE_WIDTH) {
  return clampSwipe(startOffset - dx, width)
}

export function snapSwipeOpen(offset: number, width = SWIPE_WIDTH) {
  return offset >= width * SWIPE_OPEN_RATIO
}
