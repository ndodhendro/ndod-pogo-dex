import { describe, expect, it } from 'vitest'
import {
  resetScreenshotPickerHandle,
  RESTORE_FOLDER_PICKER_ID,
  SCREENSHOT_PICKER_ID,
  rememberScreenshotHandle,
  screenshotFolderOptions,
  screenshotOpenOptions,
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
