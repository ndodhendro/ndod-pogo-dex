import { useEffect, useRef } from 'react'
import { hasOpenFilePicker, pickScreenshotFiles } from '../lib/filePicker'
import styles from './FilePickerButton.module.css'

const GHOST_CLICK_MS = 500
const FOCUS_GRACE_MS = 250

type Props = {
  label: string
  className?: string
  disabled?: boolean
  accept?: string
  multiple?: boolean
  /** Open in Pictures (and remember Screenshots after the first pick) when the OS allows it. */
  preferScreenshotsFolder?: boolean
  onFiles: (files: File[]) => void
}

export function FilePickerButton({
  label,
  className,
  disabled,
  accept = 'image/*',
  multiple = true,
  preferScreenshotsFolder = false,
  onFiles,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pickingRef = useRef(false)
  const openedAtRef = useRef(0)
  const ignoreUntilRef = useRef(0)

  function endPicking() {
    pickingRef.current = false
    ignoreUntilRef.current = Date.now() + GHOST_CLICK_MS
  }

  useEffect(() => {
    const input = inputRef.current
    const onCancel = () => endPicking()
    input?.addEventListener('cancel', onCancel)

    const onFocus = () => {
      if (!pickingRef.current) return
      if (Date.now() - openedAtRef.current < FOCUS_GRACE_MS) return
      endPicking()
    }

    window.addEventListener('focus', onFocus)
    return () => {
      input?.removeEventListener('cancel', onCancel)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  async function pickFromPictures() {
    try {
      const files = await pickScreenshotFiles(multiple)
      if (files.length > 0) onFiles(files)
    } finally {
      endPicking()
    }
  }

  function openPicker() {
    if (disabled) return
    if (Date.now() < ignoreUntilRef.current) return
    openedAtRef.current = Date.now()
    pickingRef.current = true
    if (preferScreenshotsFolder && hasOpenFilePicker(window)) {
      void pickFromPictures()
      return
    }
    inputRef.current?.click()
  }

  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={openPicker}>
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className={styles.input}
        tabIndex={-1}
        onChange={(event) => {
          const files = event.target.files ? Array.from(event.target.files) : []
          endPicking()
          event.target.value = ''
          if (files.length > 0) onFiles(files)
        }}
      />
    </>
  )
}
