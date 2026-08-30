import { useState } from 'react'
import { restoreFromGallery, type RestoreProgress } from '../lib/restore'
import { useToast } from '../lib/toast'

function progressLabel(progress: RestoreProgress) {
  if (progress.phase === 'loading') return 'Loading cloud metadata…'
  if (progress.phase === 'hashing') {
    return `Hashing photos ${progress.current} / ${progress.total}`
  }
  return `Restoring ${progress.current} / ${progress.total}`
}

export function RestoreGalleryButton() {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<RestoreProgress | null>(null)

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    setBusy(true)
    setProgress({ phase: 'loading', current: 0, total: 1 })
    try {
      const result = await restoreFromGallery([...list], setProgress)
      const parts = [`Restored ${result.restored}`]
      if (result.alreadyLocal) parts.push(`${result.alreadyLocal} already on this device`)
      if (result.inbox) parts.push(`${result.inbox} sent to Inbox (no cloud match)`)
      if (result.cloudWithoutPhoto) {
        parts.push(`${result.cloudWithoutPhoto} cloud specimens had no matching photo`)
      }
      showToast(parts.join('. ') + '.', 'warning')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not restore')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <div>
      <label className="btn" style={{ display: 'inline-grid', placeItems: 'center' }}>
        {busy ? 'Restoring…' : 'Restore from gallery'}
        <input
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={busy}
          onChange={(e) => {
            void onFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
      {progress ? <p className="page-sub">{progressLabel(progress)}</p> : null}
    </div>
  )
}
