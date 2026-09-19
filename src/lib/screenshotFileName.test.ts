import { describe, expect, it } from 'vitest'
import {
  restoredScreenshotFileName,
  sameLookFilenamesCopied,
  screenshotFileName,
} from './screenshotFileName'

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

describe('restoredScreenshotFileName', () => {
  it('prefers the gallery filename over a stored name', () => {
    expect(
      restoredScreenshotFileName(
        new File(['x'], 'Screenshot_20260916-103000.png', { type: 'image/png' }),
        'old.jpg',
      ),
    ).toBe('Screenshot_20260916-103000.png')
  })

  it('uses the stored basename when the blob has no name', () => {
    expect(
      restoredScreenshotFileName(new Blob(['x'], { type: 'image/png' }), 'pika.webp'),
    ).toBe('pika.webp')
  })
})

describe('sameLookFilenamesCopied', () => {
  const oldName = 'current.png'
  const newName = 'incoming.png'

  it('is false until at least one filename is copied', () => {
    expect(sameLookFilenamesCopied({ current: false, next: false }, oldName, newName)).toBe(false)
  })

  it('is true after either filename is copied', () => {
    expect(sameLookFilenamesCopied({ current: true, next: false }, oldName, newName)).toBe(true)
    expect(sameLookFilenamesCopied({ current: false, next: true }, oldName, newName)).toBe(true)
    expect(sameLookFilenamesCopied({ current: true, next: true }, oldName, newName)).toBe(true)
  })

  it('requires the only copyable filename when the other side has none', () => {
    expect(sameLookFilenamesCopied({ current: false, next: false }, null, newName)).toBe(false)
    expect(sameLookFilenamesCopied({ current: false, next: true }, null, newName)).toBe(true)
    expect(sameLookFilenamesCopied({ current: false, next: false }, oldName, '')).toBe(false)
    expect(sameLookFilenamesCopied({ current: true, next: false }, oldName, '')).toBe(true)
  })

  it('is true when neither side has a filename to copy', () => {
    expect(sameLookFilenamesCopied({ current: false, next: false }, null, '')).toBe(true)
  })
})
