export const SHEET_SWIPE_LOCK = 12
export const SHEET_SWIPE_COMMIT = 64
export const SHEET_ANIM_MS = 240

/** Pulling down follows the finger; pulling up rubber-bands. */
export function sheetDragY(dy: number): number {
  if (dy <= 0) return dy * 0.18
  return dy
}

export function sheetShouldClose(dy: number): boolean {
  return dy >= SHEET_SWIPE_COMMIT
}

export function sheetCloseY(sheetHeight: number): number {
  return Math.max(sheetHeight, 1)
}

export function sheetBackdropDim(dragY: number, sheetHeight: number): number {
  if (sheetHeight <= 0) return 1
  return Math.min(1, Math.max(0, 1 - dragY / sheetHeight))
}
