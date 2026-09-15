import { SCREENSHOT_WIDTH, type CropRect } from './screenshotCrop'

/** Paint-space nameplate: y=650…710, full width. */
const NAMEPLATE_TOP = 650
const NAMEPLATE_BOTTOM = 710
const UPSCALE = 3

export function nameplateRect(width: number, height: number): CropRect | null {
  if (width < 1 || height < 1) return null
  const scale = width / SCREENSHOT_WIDTH
  const y = Math.max(0, Math.round(NAMEPLATE_TOP * scale))
  const yEnd = Math.round(NAMEPLATE_BOTTOM * scale)
  const cropHeight = Math.min(height, yEnd) - y
  if (width < 8 || cropHeight < 8) return null
  return { x: 0, y, width, height: cropHeight }
}

async function nameplateCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob)
  try {
    const rect = nameplateRect(bitmap.width, bitmap.height)
    if (!rect) throw new Error('Could not read a name')
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, rect.width * UPSCALE)
    canvas.height = Math.max(1, rect.height * UPSCALE)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      bitmap,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    return canvas
  } finally {
    bitmap.close()
  }
}

function ocrBase(): string {
  return `${import.meta.env.BASE_URL}ocr`.replace(/\/$/, '')
}

let workerPromise: Promise<import('tesseract.js').Worker> | null = null

async function ocrWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const mod = await import('tesseract.js')
      const createWorker = mod.createWorker
      const base = ocrBase()
      const worker = await createWorker('eng', 1, {
        workerPath: `${base}/worker.min.js`,
        corePath: `${base}/tesseract-core-simd-lstm.wasm.js`,
        langPath: base,
        workerBlobURL: true,
        gzip: true,
      })
      await worker.setParameters({
        preserve_interword_spaces: '1',
      })
      return worker
    })()
    workerPromise.catch(() => {
      workerPromise = null
    })
  }
  return workerPromise
}

/** Read English text from the Pokemon GO nameplate on a screenshot blob. */
export async function readPokemonName(blob: Blob): Promise<string> {
  const canvas = await nameplateCanvas(blob)
  try {
    const worker = await ocrWorker()
    const { data } = await worker.recognize(canvas)
    return (data.text ?? '').trim()
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Could not read a name')
  }
}
