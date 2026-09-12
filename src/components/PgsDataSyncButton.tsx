import { useState } from 'react'
import { FilePickerButton } from './FilePickerButton'
import { db } from '../lib/db'
import { downloadBytes, syncPgsData } from '../lib/pgsdata/sync'
import { useToast } from '../lib/toast'

export function PgsDataSyncButton() {
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)

  async function onFiles(files: File[]) {
    const file = files[0]
    if (!file || busy) return
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const [specimens, categories, catalogs, roster] = await Promise.all([
        db.specimens.toArray(),
        db.categories.toArray(),
        db.tagCatalogs.toArray(),
        db.tagRoster.toArray(),
      ])
      const result = syncPgsData(bytes, specimens, categories, catalogs, roster)
      downloadBytes('PGSData.dat', result.bytes)
      if (result.removed === 0 && result.added === 0) {
        showToast('Synced PGSData. Feeds already matched. Download started.', 'success')
        return
      }
      const bits = [
        result.removed ? `removed ${result.removed}` : null,
        result.added ? `added ${result.added}` : null,
      ].filter(Boolean)
      showToast(`Synced PGSData: ${bits.join(', ')}. Download started.`, 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not sync PGSData')
    } finally {
      setBusy(false)
    }
  }

  return (
    <FilePickerButton
      className="btn"
      icon="📥"
      label={busy ? 'Syncing…' : 'Sync PGSData'}
      disabled={busy}
      accept=".dat,application/octet-stream"
      multiple={false}
      onFiles={(list) => void onFiles(list)}
    />
  )
}
