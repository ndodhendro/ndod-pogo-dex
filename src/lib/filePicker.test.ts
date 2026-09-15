import { describe, expect, it } from 'vitest'
import {
  imageFilesFromDirectory,
  resetScreenshotPickerHandle,
  RESTORE_FOLDER_PICKER_ID,
  SCREENSHOT_PICKER_ID,
  rememberScreenshotHandle,
  screenshotFolderOptions,
  screenshotOpenOptions,
  type FolderReadProgress,
} from './filePicker'

describe('screenshotOpenOptions', () => {
  it('starts in Pictures so Screenshots is one folder away', () => {
    resetScreenshotPickerHandle()
    const options = screenshotOpenOptions(true)
    expect(options.startIn).toBe('pictures')
    expect(options.id).toBe(SCREENSHOT_PICKER_ID)
    expect(options.id && options.id.length).toBeLessThanOrEqual(32)
    expect(options.multiple).toBe(true)
  })

  it('reopens in the folder of the last picked screenshot', () => {
    const handle = { getFile: async () => new File(['x'], 'shot.png') }
    rememberScreenshotHandle(handle)
    expect(screenshotOpenOptions(false).startIn).toBe(handle)
    resetScreenshotPickerHandle()
  })
})

describe('screenshotFolderOptions', () => {
  it('starts in Pictures and fits the File System Access id limit', () => {
    const options = screenshotFolderOptions()
    expect(options.startIn).toBe('pictures')
    expect(options.mode).toBe('read')
    expect(options.id).toBe(RESTORE_FOLDER_PICKER_ID)
    expect(RESTORE_FOLDER_PICKER_ID.length).toBeLessThanOrEqual(32)
  })
})

describe('imageFilesFromDirectory', () => {
  it('skips folders, reports listing then read progress, and returns files', async () => {
    const shot = new File(['png'], 'shot.png', { type: 'image/png' })
    const extra = new File(['jpg'], 'extra.jpg', { type: 'image/jpeg' })
    const dir = {
      values: async function* () {
        yield { kind: 'directory', name: 'albums' }
        yield { kind: 'file', name: shot.name, getFile: async () => shot }
        yield { kind: 'file', name: extra.name, getFile: async () => extra }
      },
    } as unknown as FileSystemDirectoryHandle
    const ticks: FolderReadProgress[] = []
    const files = await imageFilesFromDirectory(dir, (progress) => ticks.push(progress))
    expect(files).toEqual([shot, extra])
    expect(ticks[0]).toEqual({ current: 0, total: 0 })
    expect(ticks).toContainEqual({ current: 2, total: 0 })
    expect(ticks).toContainEqual({ current: 0, total: 2 })
    expect(ticks.at(-1)).toEqual({ current: 2, total: 2 })
  })
})
