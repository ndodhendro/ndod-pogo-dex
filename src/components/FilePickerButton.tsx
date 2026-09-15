import { useEffect, useRef, type ChangeEvent } from 'react'
import {
  hasDirectoryPicker,
  hasOpenFilePicker,
  pickScreenshotFiles,
  pickScreenshotFolder,
  type FolderReadProgress,
} from '../lib/filePicker'
import styles from './FilePickerButton.module.css'

const GHOST_CLICK_MS = 500
const FOCUS_GRACE_MS = 250

type Props = {
  label: string
  icon?: string
  className?: string
  disabled?: boolean
  accept?: string
  multiple?: boolean
  /** Open in Pictures (and remember Screenshots after the first pick) when the OS allows it. */
  preferScreenshotsFolder?: boolean
  /** Pick a folder of screenshots. Better for restoring hundreds of photos. */
  directory?: boolean
  onFiles: (files: File[]) => void | Promise<void>
  onError?: (err: Error) => void
  onPicking?: () => void
  onCancel?: () => void
  onFolderProgress?: (progress: FolderReadProgress) => void
}

export function FilePickerButton({
  label,
  icon,
  className,
  disabled,
  accept = 'image/*',
  multiple = true,
  preferScreenshotsFolder = false,
  directory = false,
  onFiles,
  onError,
  onPicking,
  onCancel,
  onFolderProgress,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pickingRef = useRef(false)
  const openedAtRef = useRef(0)
  const ignoreUntilRef = useRef(0)
  const callbacksRef = useRef({ onPicking, onCancel, onFolderProgress, onFiles, onError })
  callbacksRef.current = { onPicking, onCancel, onFolderProgress, onFiles, onError }

  function endPicking() {
    pickingRef.current = false
    ignoreUntilRef.current = Date.now() + GHOST_CLICK_MS
  }

  function reportError(err: unknown) {
    callbacksRef.current.onError?.(
      err instanceof Error ? err : new Error('Could not open photos'),
    )
  }

  useEffect(() => {
    const input = inputRef.current
    if (directory) {
      input?.setAttribute('webkitdirectory', 'true')
      input?.setAttribute('directory', 'true')
    } else {
      input?.removeAttribute('webkitdirectory')
      input?.removeAttribute('directory')
    }

    const onInputCancel = () => {
      endPicking()
      callbacksRef.current.onCancel?.()
    }
    input?.addEventListener('cancel', onInputCancel)

    const onFocus = () => {
      if (!pickingRef.current) return
      if (Date.now() - openedAtRef.current < FOCUS_GRACE_MS) return
      if (directory && !hasDirectoryPicker(window)) {
        callbacksRef.current.onFolderProgress?.({ current: 0, total: 0 })
      }
      endPicking()
    }

    window.addEventListener('focus', onFocus)
    return () => {
      input?.removeEventListener('cancel', onInputCancel)
      window.removeEventListener('focus', onFocus)
    }
  }, [directory])

  async function deliverFiles(files: File[]) {
    if (files.length === 0) {
      callbacksRef.current.onCancel?.()
      return
    }
    await callbacksRef.current.onFiles(files)
  }

  async function pickFromPictures() {
    try {
      await deliverFiles(await pickScreenshotFiles(multiple))
    } catch (err) {
      reportError(err)
    } finally {
      endPicking()
    }
  }

  async function pickFromFolder() {
    try {
      await deliverFiles(await pickScreenshotFolder(callbacksRef.current.onFolderProgress))
    } catch (err) {
      callbacksRef.current.onCancel?.()
      reportError(err)
    } finally {
      endPicking()
    }
  }

  function openPicker() {
    if (disabled) return
    if (Date.now() < ignoreUntilRef.current) return
    openedAtRef.current = Date.now()
    pickingRef.current = true
    callbacksRef.current.onPicking?.()
    if (directory && hasDirectoryPicker(window)) {
      void pickFromFolder()
      return
    }
    if (!directory && preferScreenshotsFolder && hasOpenFilePicker(window)) {
      void pickFromPictures()
      return
    }
    inputRef.current?.click()
  }

  async function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const files = input.files ? Array.from(input.files) : []
    endPicking()
    try {
      await deliverFiles(files)
    } catch (err) {
      reportError(err)
    } finally {
      // Clearing too early detaches gallery File blobs (Android / large picks).
      input.value = ''
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={openPicker}>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={directory ? undefined : accept}
        multiple={directory || multiple}
        className={styles.input}
        tabIndex={-1}
        onChange={(event) => void onInputChange(event)}
      />
    </>
  )
}
