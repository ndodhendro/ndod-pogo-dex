import { useState } from 'react'
import { FilePickerButton } from './FilePickerButton'
import { restoreFromCloud, restoreFromGallery } from '../lib/restore'
import {
  formatRestoreProgressPercent,
  restoreBusyLabel,
  restoreProgressLabel,
  type RestoreProgress,
} from '../lib/restoreProgress'
import { useToast } from '../lib/toast'
import { yieldUi } from '../lib/yieldUi'
import styles from './RestoreGalleryButton.module.css'

function RestoreStatus({
  progress,
  idle,
}: {
  progress: RestoreProgress | null
  idle?: string
}) {
  if (!progress && !idle) return null
  return (
    <>
      {progress ? (
        <div className={styles.meterRow}>
          {progress.total > 0 ? (
            <progress
              className={styles.meter}
              value={progress.current}
              max={progress.total}
            />
          ) : (
            <progress className={styles.meter} />
          )}
          <span className={styles.percent} data-tone="settings" aria-hidden="true">
            {formatRestoreProgressPercent(progress)}
          </span>
        </div>
      ) : null}
      <p className={`page-sub ${styles.status}`} role="status" aria-live="polite">
        {progress ? restoreProgressLabel(progress) : idle}
      </p>
    </>
  )
}

export function RestoreCloudButton() {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<RestoreProgress | null>(null)

  async function onRestore() {
    if (busy) return
    setBusy(true)
    setProgress({ phase: 'loading', current: 0, total: 1 })
    await yieldUi()
    try {
      const result = await restoreFromCloud(setProgress)
      const parts = [`Restored ${result.restored}`]
      if (result.alreadyLocal) parts.push(`${result.alreadyLocal} already on this device`)
      if (result.cloudWithoutPhoto) {
        parts.push(`${result.cloudWithoutPhoto} still need a gallery photo`)
      }
      if (result.failed) {
        const detail = result.downloadError ? ` (${result.downloadError})` : ''
        parts.push(`${result.failed} failed to download${detail}`)
      }
      showToast(parts.join('. ') + '.', result.failed ? 'warning' : 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not restore')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className={styles.block} aria-busy={busy}>
      <button type="button" className="btn" disabled={busy} onClick={() => void onRestore()}>
        <span aria-hidden="true">☁️</span>
        {progress ? restoreBusyLabel(progress) : 'Restore from cloud'}
      </button>
      <RestoreStatus progress={progress} />
    </div>
  )
}

export function RestoreGalleryButton() {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<RestoreProgress | null>(null)

  function onPicking() {
    setProgress({ phase: 'picking', current: 0, total: 0 })
  }

  function onCancel() {
    setBusy(false)
    setProgress(null)
  }

  function onFolderProgress(next: { current: number; total: number }) {
    setBusy(true)
    setProgress({ phase: 'reading', current: next.current, total: next.total })
  }

  async function onFiles(list: File[]) {
    if (list.length === 0) {
      onCancel()
      return
    }
    setBusy(true)
    setProgress({ phase: 'hashing', current: 0, total: list.length })
    await yieldUi()
    try {
      const result = await restoreFromGallery([...list], setProgress)
      const parts: string[] = []
      if (result.restored) parts.push(`Restored ${result.restored}`)
      if (result.alreadyLocal) parts.push(`${result.alreadyLocal} already on this device`)
      if (result.inbox) parts.push(`${result.inbox} sent to Transfer (no cloud match)`)
      if (result.cloudWithoutPhoto) {
        parts.push(`${result.cloudWithoutPhoto} cloud specimens had no matching photo`)
      }
      if (result.failed) {
        const detail = result.downloadError ? ` (${result.downloadError})` : ''
        parts.push(`${result.failed} failed${detail}`)
      }
      if (parts.length === 0) parts.push('Nothing to restore')
      showToast(parts.join('. ') + '.', result.failed ? 'warning' : 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not restore')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div className={styles.block} aria-busy={busy}>
      <FilePickerButton
        className="btn"
        icon="🖼️"
        label={progress ? restoreBusyLabel(progress) : 'Restore from gallery'}
        disabled={busy}
        directory
        onPicking={onPicking}
        onCancel={onCancel}
        onFolderProgress={onFolderProgress}
        onFiles={onFiles}
        onError={(err) => showToast(err.message)}
      />
      <RestoreStatus
        progress={progress}
        idle="Pick the Screenshots folder. Photos without a cloud match go to Transfer. Keep this page open until restore finishes."
      />
    </div>
  )
}
