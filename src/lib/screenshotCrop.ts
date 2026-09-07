export const SCREENSHOT_WIDTH = 738
export const SCREENSHOT_FULL_HEIGHT = 1600
export const SCREENSHOT_CROP_TOP = 0

export type CropRect = {
  x: number
  y: number
  width: number
  height: number
}

export function clampCropBottom(value: number, fallback = 710): number {
  if (!Number.isFinite(value)) return fallback
  return Math.round(Math.min(SCREENSHOT_FULL_HEIGHT, Math.max(1, value)))
}

export function parseCropBottom(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return clampCropBottom(n, fallback)
}

/** Paint-space crop bottom for a stored (often already cropped) bitmap. */
export function cropBottomFromBitmap(width: number, height: number): number {
  if (width < 1) return clampCropBottom(height)
  return clampCropBottom(Math.round(height * (SCREENSHOT_WIDTH / width)))
}

/**
 * Map a Paint crop (y=0 … cropBottom) on the 738×1600 file onto this bitmap.
 * Already-cropped strips (height ≤ crop bottom) are left alone.
 */
export function screenshotCropRect(
  width: number,
  height: number,
  cropBottom: number,
): CropRect | null {
  if (width < 1 || height < 1) return null
  const bottom = clampCropBottom(cropBottom)
  const scale = width / SCREENSHOT_WIDTH
  const y = Math.round(SCREENSHOT_CROP_TOP * scale)
  const yEnd = Math.round(bottom * scale)
  if (yEnd <= y || height < yEnd) return null
  if (y === 0 && yEnd >= height) return null
  return { x: 0, y, width, height: yEnd - y }
}
