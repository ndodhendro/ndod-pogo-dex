export const PREVIEW_SWIPE_LOCK = 12
export const PREVIEW_SWIPE_COMMIT = 64

export type PreviewSwipeAxis = 'x' | 'y' | null
export type PreviewSwipeAction = 'next' | 'prev' | 'close-up' | 'close-down' | null

export function previewSwipeAxis(dx: number, dy: number, lock = PREVIEW_SWIPE_LOCK): PreviewSwipeAxis {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax < lock && ay < lock) return null
  return ax >= ay ? 'x' : 'y'
}

export function previewSwipeOffset(
  axis: PreviewSwipeAxis,
  dx: number,
  dy: number,
  canPrev: boolean,
  canNext: boolean,
): { x: number; y: number } {
  if (axis === 'x') {
    if ((dx < 0 && !canNext) || (dx > 0 && !canPrev)) {
      return { x: dx * 0.18, y: 0 }
    }
    return { x: dx, y: 0 }
  }
  if (axis === 'y') {
    return { x: 0, y: dy }
  }
  return { x: 0, y: 0 }
}

export function previewSwipeCommit(
  axis: PreviewSwipeAxis,
  dx: number,
  dy: number,
  canPrev: boolean,
  canNext: boolean,
  threshold = PREVIEW_SWIPE_COMMIT,
): PreviewSwipeAction {
  if (axis === 'x') {
    if (dx <= -threshold && canNext) return 'next'
    if (dx >= threshold && canPrev) return 'prev'
    return null
  }
  if (axis === 'y' && Math.abs(dy) >= threshold) return dy < 0 ? 'close-up' : 'close-down'
  return null
}

export function listNeighbor<T>(list: readonly T[], index: number, direction: -1 | 1): T | undefined {
  if (index < 0) return undefined
  return list[index + direction]
}

/** Extra translateX (px) to finish a carousel step after release. Includes gap. */
export function previewCarouselSettleX(
  action: PreviewSwipeAction,
  viewportWidth: number,
  gap = 0,
): number | null {
  const step = Math.abs(viewportWidth) + gap
  if (action === 'next') return -step
  if (action === 'prev') return step
  return null
}

/** Extra translateY (px) to slide the sheet off-screen before unmounting. */
export function previewCloseSettleY(
  action: PreviewSwipeAction,
  viewportHeight: number,
): number | null {
  const distance = Math.abs(viewportHeight)
  if (action === 'close-up') return -distance
  if (action === 'close-down') return distance
  return null
}
