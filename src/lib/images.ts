const THUMB_DISPLAY_WIDTH = 128
/** Bitmap is 3× CSS size so phone screens (devicePixelRatio ~3) stay sharp. */
const THUMB_BITMAP_WIDTH = THUMB_DISPLAY_WIDTH * 3

/** Native screenshot size for this collector's device. */
export const SCREENSHOT_WIDTH = 738
export const SCREENSHOT_HEIGHT = 1600

/** Gallery / share-target files often have an empty MIME type. Decode decides later. */
export function isProbablyImageFile(file: File): boolean {
  if (!file.type) return true
  if (file.type.startsWith('image/')) return true
  return file.type === 'application/octet-stream'
}

/** Thumb bitmap size. Keeps 738×1600 → 384×833 (displays at ~128px CSS). */
export function thumbSizeFor(
  width: number,
  height: number,
  targetWidth = THUMB_BITMAP_WIDTH,
) {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const scale = targetWidth / w
  return {
    width: targetWidth,
    height: Math.max(1, Math.round(h * scale)),
  }
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

function drawHighQuality(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
) {
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
}

/** Step down by halves before the last draw — one 738→128 blit looks muddy. */
function downsample(img: HTMLImageElement, destW: number, destH: number): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  let source: CanvasImageSource = img
  let w = srcW
  let h = srcH
  while (w / 2 >= destW && h / 2 >= destH) {
    w = Math.max(destW, Math.round(w / 2))
    h = Math.max(destH, Math.round(h / 2))
    const step = document.createElement('canvas')
    step.width = w
    step.height = h
    const ctx = step.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    drawHighQuality(ctx, source, w, h)
    source = step
  }
  const out = document.createElement('canvas')
  out.width = destW
  out.height = destH
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  drawHighQuality(ctx, source, destW, destH)
  return out
}

async function makeThumb(blob: Blob): Promise<Blob> {
  const img = await loadImage(blob)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const { width, height } = thumbSizeFor(srcW, srcH)
  return canvasToJpeg(downsample(img, width, height), 0.86)
}

export async function makeImageVariants(original: Blob) {
  const thumb = await makeThumb(original)
  return { original, thumb, medium: original }
}
