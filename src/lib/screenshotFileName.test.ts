import { describe, expect, it } from 'vitest'
import { screenshotFileName } from './screenshotFileName'

describe('screenshotFileName', () => {
  it('keeps the basename and extension', () => {
    expect(screenshotFileName('Screenshot_20260916-103000.png')).toBe(
      'Screenshot_20260916-103000.png',
    )
  })

  it('strips a directory path', () => {
    expect(screenshotFileName('C:\\Pictures\\Screenshots\\shot.jpg')).toBe('shot.jpg')
    expect(screenshotFileName('/sdcard/DCIM/Camera/IMG_0001.webp')).toBe('IMG_0001.webp')
  })

  it('reads File.name and ignores unnamed blobs', () => {
    expect(screenshotFileName(new File(['x'], 'pika.png', { type: 'image/png' }))).toBe('pika.png')
    expect(screenshotFileName(new Blob(['x'], { type: 'image/png' }))).toBeNull()
  })

  it('drops blank names', () => {
    expect(screenshotFileName('')).toBeNull()
    expect(screenshotFileName('   ')).toBeNull()
    expect(screenshotFileName(null)).toBeNull()
  })
})
