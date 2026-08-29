const THUMB = 128
const MEDIUM = 720

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

async function resize(blob: Blob, maxEdge: number, quality: number): Promise<Blob> {
  const img = await loadImage(blob)
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(img, 0, 0, width, height)
  return await new Promise((resolve, reject) => {
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

export async function makeImageVariants(original: Blob) {
  const [thumb, medium] = await Promise.all([
    resize(original, THUMB, 0.72),
    resize(original, MEDIUM, 0.82),
  ])
  return { original, thumb, medium }
}
