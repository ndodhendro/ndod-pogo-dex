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
export const RESTORE_FOLDER_PICKER_ID = 'pogo-restore-folder'

const IMAGE_TYPES = [
  {
    description: 'Screenshots',
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif'],
    },
  },
]

let lastScreenshotHandle: FileSystemFileHandleLike | undefined

type DirectoryPickerOptions = {
  id?: string
  startIn?: WellKnownDirectory
  mode?: 'read' | 'readwrite'
}

type PickerWindow = Window & {
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandleLike[]>
  showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>
}

export function hasOpenFilePicker(
  win: Window = window,
): win is Window & {
  showOpenFilePicker: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandleLike[]>
} {
  return typeof (win as PickerWindow).showOpenFilePicker === 'function'
}

export function hasDirectoryPicker(
  win: Window = window,
): win is Window & {
  showDirectoryPicker: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>
} {
  return typeof (win as PickerWindow).showDirectoryPicker === 'function'
}

export function screenshotFolderOptions(): DirectoryPickerOptions {
  return {
    id: RESTORE_FOLDER_PICKER_ID,
    startIn: 'pictures',
    mode: 'read',
  }
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
    const files: File[] = []
    for (const handle of handles) files.push(await handle.getFile())
    return files
  } catch (err) {
    if (isAbortError(err)) return []
    throw err
  }
}

type DirectoryListingHandle = FileSystemDirectoryHandle & {
  values: () => AsyncIterableIterator<FileSystemHandle>
}

export async function imageFilesFromDirectory(dir: FileSystemDirectoryHandle): Promise<File[]> {
  const files: File[] = []
  for await (const entry of (dir as DirectoryListingHandle).values()) {
    if (entry.kind !== 'file' || !('getFile' in entry)) continue
    files.push(await (entry as FileSystemFileHandle).getFile())
  }
  return files
}

/** Folder picker starting in Pictures. Empty array = cancelled. */
export async function pickScreenshotFolder(): Promise<File[]> {
  if (!hasDirectoryPicker(window)) {
    throw new Error('Folder picker API unavailable')
  }
  try {
    const dir = await window.showDirectoryPicker(screenshotFolderOptions())
    return imageFilesFromDirectory(dir)
  } catch (err) {
    if (isAbortError(err)) return []
    throw err
  }
}
