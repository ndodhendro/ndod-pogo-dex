import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { FilePickerButton } from '../components/FilePickerButton'
import { TagSheet } from '../components/TagSheet'
import { TagChip } from '../components/TagChip'
import { AppFooter } from '../components/AppFooter'
import {
  categoryForTag,
  lookForTag,
  SEEN_ICON,
  sortSpecimenTags,
  TAB_ICONS,
} from '../data/navIcons'
import { SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import {
  discardInbox,
  importPendingShares,
  ingestFile,
  replaceSpecimenFromInbox,
  saveSpecimenFromInbox,
} from '../lib/collection'
import { db, type CategoryRow, type InboxRow, type SpecimenRow, type TransferLogRow } from '../lib/db'
import {
  DEX_PROGRESS_KINDS,
  specimenProgressFlags,
  type DexProgressKind,
} from '../lib/dexGrid'
import { isProbablyImageFile } from '../lib/images'
import { useToast } from '../lib/toast'
import {
  pruneTransferLogs,
  sortTransferLogs,
  specimenFromTransferLog,
  transferLogHasSnapshot,
  TRANSFER_LOG_ACTIONS,
  TRANSFER_LOG_LIMIT,
} from '../lib/transferLogs'
import { labelForTag, specimenTags, type SpecimenFields, type TagId } from '../lib/tags'
import styles from './Inbox.module.css'

const PROGRESS_META: Record<DexProgressKind, { icon: string; label: string }> = {
  seen: { icon: SEEN_ICON, label: 'Seen' },
  caught: { icon: '🎯', label: 'Caught' },
  pure: { icon: '🟢', label: 'Pure' },
}

type TransferView = 'untagged' | 'logs'

type PendingDuplicate = {
  item: InboxRow
  existing: SpecimenRow
  fields: SpecimenFields
  cropBottom: number
}

export function InboxPage() {
  const { showToast } = useToast()
  const items = useLiveQuery(() => db.inbox.orderBy('createdAt').reverse().toArray(), []) ?? []
  const logRows = useLiveQuery(() => db.transferLogs.toArray(), []) ?? []
  const specimens = useLiveQuery(() => db.specimens.toArray(), []) ?? []
  const categories =
    useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const logs = useMemo(() => {
    const byId = new Map(specimens.map((row) => [row.id, row]))
    return sortTransferLogs(logRows)
      .slice(0, TRANSFER_LOG_LIMIT)
      .flatMap((log) => {
      const live = byId.get(log.specimenId)
      if (!transferLogHasSnapshot(log) && !live) return []
      return [{ log, specimen: specimenFromTransferLog(log, live), live }]
    })
  }, [logRows, specimens])
  const [active, setActive] = useState<InboxRow | null>(null)
  const [pendingDiscard, setPendingDiscard] = useState<InboxRow | null>(null)
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null)
  const [discardBusy, setDiscardBusy] = useState(false)
  const [duplicateBusy, setDuplicateBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState<TransferView>('untagged')
  const showingLogs = view === 'logs'

  useEffect(() => {
    importPendingShares().catch(() => {
      showToast('Could not import a shared screenshot')
    })
  }, [showToast])

  useEffect(() => {
    void pruneTransferLogs()
  }, [])

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
          {showingLogs ? '📋' : TAB_ICONS.inbox}
        </span>
        {showingLogs ? 'Logs' : 'Untagged Screenshots'}
      </h1>
      <div className={`row-actions ${styles.toolbar}`}>
        <FilePickerButton
          className="btn btn-primary"
          label={adding ? 'Adding…' : 'Add screenshots'}
          disabled={adding}
          preferScreenshotsFolder
          onFiles={(list) => void onFiles(list)}
        />
        <button
          type="button"
          className={`btn ${styles.toolBtn}`}
          data-tone="inbox"
          data-on={showingLogs ? 'false' : 'true'}
          aria-pressed={!showingLogs}
          onClick={() => setView('untagged')}
        >
          <span aria-hidden="true">{TAB_ICONS.inbox}</span>
          Untagged Screenshots
        </button>
        <button
          type="button"
          className={`btn ${styles.toolBtn}`}
          data-tone="inbox"
          data-on={showingLogs ? 'true' : 'false'}
          aria-pressed={showingLogs}
          onClick={() => setView('logs')}
        >
          <span aria-hidden="true">📋</span>
          Logs
        </button>
      </div>
      {showingLogs ? (
        <section className={styles.logs} aria-label="Logs">
          {logs.length === 0 ? (
            <p className="empty-state">No logs yet.</p>
          ) : (
            <div className={styles.logList}>
              {logs.map(({ log, specimen, live }) => (
                <TransferLogItem
                  key={log.id}
                  log={log}
                  specimen={specimen}
                  liveImageId={live?.imageId}
                  categories={categories}
                />
              ))}
            </div>
          )}
        </section>
      ) : items.length === 0 ? (
        <p className="empty-state">Nothing waiting. Catch something, screenshot it, transfer it here.</p>
      ) : (
        <div className={styles.list}>
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
        <div className="confirm-actions">
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
        <div className="confirm-actions">
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

function transferTagLabel(tag: TagId, specimen: SpecimenFields, categories: CategoryRow[]) {
  const named = categoryForTag(categories, tag)?.name
  if (tag === 'costume') return specimen.costume || named || labelForTag(tag)
  if (tag === 'background') return specimen.background || named || labelForTag(tag)
  return named || labelForTag(tag)
}

function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

function TransferLogItem({
  log,
  specimen,
  liveImageId,
  categories,
}: {
  log: TransferLogRow
  specimen: SpecimenFields & { id: string; imageId: string }
  liveImageId?: string
  categories: CategoryRow[]
}) {
  const liveUrl = useImageUrl(liveImageId, 'thumb')
  const blobUrl = useBlobUrl(log.thumb)
  const url = liveUrl ?? blobUrl
  const species = SPECIES_BY_ID.get(specimen.speciesId)
  const tags = sortSpecimenTags(specimenTags(specimen), categories)
  const progress = specimenProgressFlags(specimen, categories)
  const action = TRANSFER_LOG_ACTIONS[log.action ?? 'save']
  return (
    <article className={`group ${styles.log}`}>
      <div className={styles.logShot}>
        {url ? <img src={url} alt="" /> : <span />}
      </div>
      <div className={styles.logMeta}>
        <p className={styles.logAction} data-action={log.action ?? 'save'}>
          <span aria-hidden="true">{action.icon}</span>
          {action.label}
        </p>
        <p className={styles.logId}>#{String(specimen.speciesId).padStart(4, '0')}</p>
        <p className={styles.logName}>{species?.name ?? 'Unknown'}</p>
        <div className={styles.logStatus}>
          {DEX_PROGRESS_KINDS.filter((kind) => progress[kind]).map((kind) => {
            const meta = PROGRESS_META[kind]
            return (
              <p key={kind} className={styles.logKind} data-kind={kind} data-on="true">
                <span aria-hidden="true">{meta.icon}</span>
                {meta.label}
              </p>
            )
          })}
        </div>
        {tags.length > 0 ? (
          <div className={styles.logTags}>
            {tags.map((tag) => {
              const look = lookForTag(tag, categories)
              return (
                <TagChip
                  key={tag}
                  tag={tag}
                  selected
                  size="sm"
                  icon={look.emoji}
                  label={transferTagLabel(tag, specimen, categories)}
                  labelColor={look.labelColor}
                />
              )
            })}
          </div>
        ) : null}
      </div>
    </article>
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
