export type WellKnownDirectory =
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos'

export type FileSystemFileHandleLike = {
  getFile: () => Promise<File>
}

export type OpenFilePickerOptions = {
  multiple?: boolean
  id?: string
  startIn?: WellKnownDirectory | FileSystemFileHandleLike
  types?: { description?: string; accept: Record<string, string[]> }[]
}

/** Must stay ≤32 characters (File System Access). */
export const SCREENSHOT_PICKER_ID = 'pogo-screenshots'

const IMAGE_TYPES = [
  {
    description: 'Screenshots',
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif'],
    },
  },
]

let lastScreenshotHandle: FileSystemFileHandleLike | undefined

type PickerWindow = Window & {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandleLike[]>
}

export function hasOpenFilePicker(
  win: Window = window,
): win is Window & {
  showOpenFilePicker: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandleLike[]>
} {
  return typeof (win as PickerWindow).showOpenFilePicker === 'function'
}

export function screenshotOpenOptions(multiple: boolean): OpenFilePickerOptions {
  return {
    id: SCREENSHOT_PICKER_ID,
    startIn: lastScreenshotHandle ?? 'pictures',
    multiple,
    types: IMAGE_TYPES,
  }
}

export function rememberScreenshotHandle(handle: FileSystemFileHandleLike) {
  lastScreenshotHandle = handle
}

export function resetScreenshotPickerHandle() {
  lastScreenshotHandle = undefined
}

function isAbortError(err: unknown) {
  return err instanceof DOMException
    ? err.name === 'AbortError'
    : err instanceof Error && err.name === 'AbortError'
}

/** Native picker starting in Pictures / last Screenshots folder. Empty array = cancelled. */
export async function pickScreenshotFiles(multiple: boolean): Promise<File[]> {
  if (!hasOpenFilePicker(window)) {
    throw new Error('File picker API unavailable')
  }
  try {
    const handles = await window.showOpenFilePicker(screenshotOpenOptions(multiple))
    if (handles[0]) rememberScreenshotHandle(handles[0])
    return Promise.all(handles.map((handle) => handle.getFile()))
  } catch (err) {
    if (isAbortError(err)) return []
    throw err
  }
}
