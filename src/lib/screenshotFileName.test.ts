import { describe, expect, it } from 'vitest'
import {
  collectScreenshotFileNameKeys,
  DuplicateScreenshotFileNameError,
  restoredScreenshotFileName,
  sameLookFilenamesCopied,
  screenshotFileName,
  screenshotFileNameIsExact,
  screenshotFileNameIsTaken,
  screenshotFileNameKey,
  screenshotFileNameMatchesQuery,
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

describe('screenshotFileNameKey', () => {
  it('lowercases the basename for matching', () => {
    expect(screenshotFileNameKey('C:\\Pictures\\IMG_0001.PNG')).toBe('img_0001.png')
  })
})

describe('screenshotFileNameMatchesQuery', () => {
  it('matches a basename fragment, ignoring case and path', () => {
    expect(screenshotFileNameMatchesQuery('C:\\Pictures\\IMG_1234.PNG', 'img_1234')).toBe(true)
    expect(screenshotFileNameMatchesQuery('IMG_1234.PNG', '1234')).toBe(true)
    expect(screenshotFileNameMatchesQuery('IMG_1234.PNG', 'other')).toBe(false)
  })

  it('keeps every name when the query is empty', () => {
    expect(screenshotFileNameMatchesQuery('IMG_1234.PNG', '  ')).toBe(true)
    expect(screenshotFileNameMatchesQuery(null, '')).toBe(true)
  })
})

describe('screenshotFileNameIsExact', () => {
  it('matches only the full basename, including extension', () => {
    expect(screenshotFileNameIsExact('C:\\Pictures\\IMG_1234.PNG', 'img_1234.png')).toBe(true)
    expect(screenshotFileNameIsExact('IMG_1234.PNG', 'IMG_1234.PNG')).toBe(true)
    expect(screenshotFileNameIsExact('IMG_1234.PNG', 'img_1234')).toBe(false)
    expect(screenshotFileNameIsExact('IMG_1234.PNG', '1234.png')).toBe(false)
    expect(screenshotFileNameIsExact('IMG_1234.PNG', 'IMG_1234.PNG.jpg')).toBe(false)
  })

  it('rejects a name with no extension', () => {
    expect(screenshotFileNameIsExact('IMG_1234', 'IMG_1234')).toBe(false)
    expect(screenshotFileNameIsExact('IMG_1234.', 'IMG_1234.')).toBe(false)
    expect(screenshotFileNameIsExact(null, 'IMG_1234.PNG')).toBe(false)
  })
})

describe('screenshotFileNameIsTaken', () => {
  it('matches inbox or Pokédex names without the path', () => {
    const taken = collectScreenshotFileNameKeys([
      { fileName: 'shot.png' },
      { fileName: 'C:\\Pictures\\Pikachu.JPG' },
    ])
    expect(screenshotFileNameIsTaken('shot.png', taken)).toBe(true)
    expect(screenshotFileNameIsTaken('pikachu.jpg', taken)).toBe(true)
    expect(screenshotFileNameIsTaken('other.webp', taken)).toBe(false)
  })

  it('ignores blank names', () => {
    const taken = collectScreenshotFileNameKeys([{ fileName: 'shot.png' }, { fileName: null }])
    expect(screenshotFileNameIsTaken(null, taken)).toBe(false)
    expect(screenshotFileNameIsTaken('', taken)).toBe(false)
  })
})

describe('DuplicateScreenshotFileNameError', () => {
  it('keeps the basename that collided', () => {
    const err = new DuplicateScreenshotFileNameError('IMG_0001.png')
    expect(err.fileName).toBe('IMG_0001.png')
    expect(err.message).toBe('Screenshot filename already in the app')
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
