export const TOAST_SWIPE_LOCK = 12
export const TOAST_SWIPE_COMMIT = 40
export const TOAST_DURATION_MS = 3000
export const TOAST_ANIM_MS = 240

/** Follows an upward flick; rubber-bands a downward pull. */
export function toastDragY(dy: number): number {
  if (dy >= 0) return dy * 0.18
  return dy
}

export function toastShouldClose(dy: number): boolean {
  return dy <= -TOAST_SWIPE_COMMIT
}

export function toastCloseY(toastHeight: number, currentY = 0): number {
  return Math.min(currentY, -(Math.max(toastHeight, 1) + 16))
}
