const THUMB = 128

export const SCREENSHOT_CROP_TOP = 55
export const SCREENSHOT_CROP_BOTTOM = 1010
export const SCREENSHOT_CROP_HEIGHT = SCREENSHOT_CROP_BOTTOM - SCREENSHOT_CROP_TOP

export type CropRect = {
  x: number
  y: number
  width: number
  height: number
}

/** Full-width slice: y=55 through y=1010 → 955px tall (e.g. 738×1600 → 738×955). */
export function screenshotCropRect(width: number, height: number): CropRect | null {
  if (width < 1 || height < 1) return null
  const y = Math.max(0, Math.min(SCREENSHOT_CROP_TOP, height - 1))
  const yEnd = Math.max(y + 1, Math.min(SCREENSHOT_CROP_BOTTOM, height))
  return { x: 0, y, width, height: yEnd - y }
}

/** Gallery / share-target files often have an empty MIME type. Decode decides later. */
export function isProbablyImageFile(file: File): boolean {
  if (!file.type) return true
  if (file.type.startsWith('image/')) return true
  return file.type === 'application/octet-stream'
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => {
        if (!out) reject(new Error('Could not encode image'))
        else resolve(out)
      },
      'image/jpeg',
      quality,
    )
  })
}

/** 1:1 crop. 738×1600 becomes 738×955, not scaled down. */
async function cropScreenshot(blob: Blob): Promise<Blob> {
  const img = await loadImage(blob)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const crop = screenshotCropRect(srcW, srcH)
  if (!crop) return blob
  const canvas = document.createElement('canvas')
  canvas.width = crop.width
  canvas.height = crop.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
  return canvasToJpeg(canvas, 0.92)
}

async function resize(blob: Blob, maxEdge: number, quality: number): Promise<Blob> {
  const img = await loadImage(blob)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH))
  const width = Math.max(1, Math.round(srcW * scale))
  const height = Math.max(1, Math.round(srcH * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, width, height)
  return canvasToJpeg(canvas, quality)
}

export async function makeImageVariants(original: Blob) {
  const cropped = await cropScreenshot(original)
  const thumb = await resize(cropped, THUMB, 0.72)
  return { original, thumb, medium: cropped }
}
