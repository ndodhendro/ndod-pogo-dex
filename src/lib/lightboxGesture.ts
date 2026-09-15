/** Ignore leftover click / compatibility mouse from the gesture that opened the overlay. */
export const LIGHTBOX_CLICK_GUARD_MS = 400

export function shouldCloseOriginalLightbox({
  now,
  openedAt,
  pointerStartedOnLightbox,
  moved,
  guardMs = LIGHTBOX_CLICK_GUARD_MS,
}: {
  now: number
  openedAt: number
  pointerStartedOnLightbox: boolean
  moved: boolean
  guardMs?: number
}): boolean {
  if (!pointerStartedOnLightbox || moved) return false
  return now - openedAt >= guardMs
}
