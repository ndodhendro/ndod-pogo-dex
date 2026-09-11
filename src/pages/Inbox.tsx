import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { FilePickerButton } from '../components/FilePickerButton'
import { TagSheet } from '../components/TagSheet'
import { AppFooter } from '../components/AppFooter'
import { TAB_ICONS } from '../data/navIcons'
import { SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import {
  discardInbox,
  importPendingShares,
  ingestFile,
  replaceSpecimenFromInbox,
  saveSpecimenFromInbox,
} from '../lib/collection'
import { db, type InboxRow, type SpecimenRow } from '../lib/db'
import { isProbablyImageFile } from '../lib/images'
import { useToast } from '../lib/toast'
import type { SpecimenFields } from '../lib/tags'
import styles from './Inbox.module.css'

type PendingDuplicate = {
  item: InboxRow
  existing: SpecimenRow
  fields: SpecimenFields
  cropBottom: number
}

export function InboxPage() {
  const { showToast } = useToast()
  const items = useLiveQuery(() => db.inbox.orderBy('createdAt').reverse().toArray(), []) ?? []
  const [active, setActive] = useState<InboxRow | null>(null)
  const [pendingDiscard, setPendingDiscard] = useState<InboxRow | null>(null)
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null)
  const [discardBusy, setDiscardBusy] = useState(false)
  const [duplicateBusy, setDuplicateBusy] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    importPendingShares().catch(() => {
      showToast('Could not import a shared screenshot')
    })
  }, [showToast])

  async function onFiles(list: File[]) {
    if (list.length === 0) return
    setAdding(true)
    let added = 0
    try {
      for (const file of list) {
        if (!isProbablyImageFile(file)) {
          showToast('That file is not an image')
          continue
        }
        try {
          await ingestFile(file)
          added += 1
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not add screenshot')
        }
      }
      if (added === 1) showToast('Screenshot added', 'success')
      else if (added > 1) showToast(`${added} screenshots added`, 'success')
    } finally {
      setAdding(false)
    }
  }

  async function confirmDiscard() {
    const item = pendingDiscard
    if (!item || discardBusy) return
    setDiscardBusy(true)
    try {
      await discardInbox(item.id)
      if (active?.id === item.id) setActive(null)
      setPendingDiscard(null)
      showToast('Screenshot discarded', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not discard')
    } finally {
      setDiscardBusy(false)
    }
  }

  async function confirmDuplicateReplace() {
    const pending = pendingDuplicate
    if (!pending || duplicateBusy) return
    setDuplicateBusy(true)
    try {
      const result = await replaceSpecimenFromInbox(
        pending.item.id,
        pending.existing.id,
        pending.fields,
        pending.cropBottom,
      )
      setPendingDuplicate(null)
      setActive(null)
      if (result.cloudError) showToast(result.cloudError, 'warning')
      else showToast('Screenshot replaced', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not replace')
    } finally {
      setDuplicateBusy(false)
    }
  }

  async function confirmDuplicateDiscard() {
    const pending = pendingDuplicate
    if (!pending || duplicateBusy) return
    setDuplicateBusy(true)
    try {
      await discardInbox(pending.item.id)
      setPendingDuplicate(null)
      setActive(null)
      showToast('Screenshot discarded', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not discard')
    } finally {
      setDuplicateBusy(false)
    }
  }

  const duplicateSpecies = pendingDuplicate
    ? SPECIES_BY_ID.get(pendingDuplicate.existing.speciesId)?.name
    : undefined

  return (
    <section className={styles.page}>
      <h1 className="page-title" data-tone="inbox">
        <span className="page-title-icon" aria-hidden="true">
          {TAB_ICONS.inbox}
        </span>
        Transfer
      </h1>
      <div className="row-actions" style={{ marginBottom: '1rem' }}>
        <FilePickerButton
          className="btn btn-primary"
          label={adding ? 'Adding…' : 'Add screenshots'}
          disabled={adding}
          preferScreenshotsFolder
          onFiles={(list) => void onFiles(list)}
        />
      </div>
      {items.length === 0 ? (
        <p className="empty-state">Nothing waiting. Catch something, screenshot it, transfer it here.</p>
      ) : (
        <div className={styles.list} style={{ marginTop: '1rem' }}>
          {items.map((item) => (
            <InboxItem
              key={item.id}
              item={item}
              onTag={() => setActive(item)}
              onDiscard={() => setPendingDiscard(item)}
            />
          ))}
        </div>
      )}
      <AppFooter />
      <TagSheet
        open={Boolean(active)}
        title="Tag screenshot"
        resetKey={active?.id ?? ''}
        imageId={active?.imageId}
        saveLabel="Save specimen"
        tone="inbox"
        onClose={() => setActive(null)}
        onSave={async (fields, cropBottom) => {
          if (!active) return
          const result = await saveSpecimenFromInbox(active.id, fields, cropBottom)
          if (result.duplicate && result.existing && !result.sameScreenshot) {
            setPendingDuplicate({
              item: active,
              existing: result.existing,
              fields,
              cropBottom,
            })
            setActive(null)
            return
          }
          setActive(null)
          if (result.sameScreenshot && result.duplicate) {
            showToast('Screenshot already in the collection', 'warning')
          }
          if (result.cloudError) showToast(result.cloudError, 'warning')
          else if (!result.duplicate) showToast('Specimen saved', 'success')
        }}
        onWarning={(message) => showToast(message, 'warning')}
        onError={(message) => showToast(message)}
      />
      <BottomSheet
        open={Boolean(pendingDuplicate)}
        title="Same look"
        showClose={false}
        onClose={() => {
          if (duplicateBusy) return
          setPendingDuplicate(null)
        }}
      >
        <p className={`page-sub ${styles.confirmCopy}`}>
          {duplicateSpecies
            ? `${duplicateSpecies} with this look is already in your collection. Replace the current screenshot or discard the new one.`
            : 'This look is already in your collection. Replace the current screenshot or discard the new one.'}
        </p>
        {pendingDuplicate ? (
          <div className={styles.compare}>
            <DuplicateShot imageId={pendingDuplicate.existing.imageId} label="Current" />
            <DuplicateShot imageId={pendingDuplicate.item.imageId} label="New" tone="inbox" />
          </div>
        ) : null}
        <div className={`row-actions ${styles.compareActions}`}>
          <button
            type="button"
            className="btn btn-danger"
            disabled={duplicateBusy}
            onClick={() => void confirmDuplicateDiscard()}
          >
            <span aria-hidden="true">🗑️</span>
            {duplicateBusy ? 'Working…' : 'Discard'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={duplicateBusy}
            onClick={() => void confirmDuplicateReplace()}
          >
            <span aria-hidden="true">🔁</span>
            {duplicateBusy ? 'Working…' : 'Replace'}
          </button>
        </div>
      </BottomSheet>
      <BottomSheet
        open={Boolean(pendingDiscard)}
        title="Discard screenshot"
        showClose={false}
        onClose={() => {
          if (discardBusy) return
          setPendingDiscard(null)
        }}
      >
        <p className={`page-sub ${styles.confirmCopy}`}>
          Discard this screenshot? It will leave Transfer and will not be saved to your collection.
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="btn"
            disabled={discardBusy}
            onClick={() => setPendingDiscard(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={discardBusy}
            onClick={() => void confirmDiscard()}
          >
            {discardBusy ? 'Discarding…' : 'Discard'}
          </button>
        </div>
      </BottomSheet>
    </section>
  )
}

function DuplicateShot({
  imageId,
  label,
  tone,
}: {
  imageId: string
  label: string
  tone?: string
}) {
  const url = useImageUrl(imageId, 'medium')
  return (
    <figure className={styles.shot}>
      <figcaption className={styles.shotLabel} data-tone={tone}>
        {label}
      </figcaption>
      <div className={styles.shotFrame}>
        {url ? <img src={url} alt={label} /> : <span />}
      </div>
    </figure>
  )
}

function InboxItem({
  item,
  onTag,
  onDiscard,
}: {
  item: InboxRow
  onTag: () => void
  onDiscard: () => void
}) {
  const url = useImageUrl(item.imageId, 'thumb')
  return (
    <div className={styles.item}>
      {url ? <img src={url} alt="" /> : <span />}
      <div>
        <strong data-tone="inbox">Untagged</strong>
        <p className="page-sub" style={{ margin: 0 }}>
          {new Date(item.createdAt).toLocaleString()}
        </p>
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-primary" onClick={onTag}>
          Tag
        </button>
        <button type="button" className="btn btn-danger" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  )
}
