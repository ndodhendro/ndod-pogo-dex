import { describe, expect, it } from 'vitest'
import {
  resetScreenshotPickerHandle,
  SCREENSHOT_PICKER_ID,
  rememberScreenshotHandle,
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
