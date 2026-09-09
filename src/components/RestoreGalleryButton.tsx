import { useState } from 'react'
import { FilePickerButton } from './FilePickerButton'
import { restoreFromCloud, restoreFromGallery, type RestoreProgress } from '../lib/restore'
import { useToast } from '../lib/toast'

function progressLabel(progress: RestoreProgress) {
  if (progress.phase === 'loading') return 'Loading cloud metadata…'
  if (progress.phase === 'hashing') {
    return `Hashing photos ${progress.current} / ${progress.total}`
  }
  if (progress.phase === 'downloading') {
    return `Downloading ${progress.current} / ${progress.total}`
  }
  return `Restoring ${progress.current} / ${progress.total}`
}

export function RestoreCloudButton() {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<RestoreProgress | null>(null)

  async function onRestore() {
    if (busy) return
    setBusy(true)
    setProgress({ phase: 'loading', current: 0, total: 1 })
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
    <div>
      <button type="button" className="btn" disabled={busy} onClick={() => void onRestore()}>
        <span aria-hidden="true">☁️</span>
        {busy ? 'Restoring…' : 'Restore from cloud'}
      </button>
      {progress ? <p className="page-sub">{progressLabel(progress)}</p> : null}
    </div>
  )
}

export function RestoreGalleryButton() {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<RestoreProgress | null>(null)

  async function onFiles(list: File[]) {
    if (list.length === 0) return
    setBusy(true)
    setProgress({ phase: 'loading', current: 0, total: 1 })
    try {
      const result = await restoreFromGallery([...list], setProgress)
      const parts = [`Restored ${result.restored}`]
      if (result.alreadyLocal) parts.push(`${result.alreadyLocal} already on this device`)
      if (result.inbox) parts.push(`${result.inbox} sent to Transfer (no cloud match)`)
      if (result.cloudWithoutPhoto) {
        parts.push(`${result.cloudWithoutPhoto} cloud specimens had no matching photo`)
      }
      showToast(parts.join('. ') + '.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not restore')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div>
      <FilePickerButton
        className="btn"
        icon="🖼️"
        label={busy ? 'Restoring…' : 'Restore from gallery'}
        disabled={busy}
        onFiles={(list) => void onFiles(list)}
      />
      {progress ? <p className="page-sub">{progressLabel(progress)}</p> : null}
    </div>
  )
}
