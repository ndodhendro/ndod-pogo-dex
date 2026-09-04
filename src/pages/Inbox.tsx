import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { FilePickerButton } from '../components/FilePickerButton'
import { SearchField } from '../components/SearchField'
import { TagChip } from '../components/TagChip'
import { specimenTagChoices } from '../data/navIcons'
import { searchSpecies, SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import {
  discardInbox,
  importPendingShares,
  ingestFile,
  saveSpecimenFromInbox,
} from '../lib/collection'
import { db, type InboxRow } from '../lib/db'
import { isProbablyImageFile } from '../lib/images'
import { useToast } from '../lib/toast'
import {
  normalizeOptionalName,
  specimenSaveWarning,
  specimenTags,
  toggleTag,
  type SpecimenFields,
} from '../lib/tags'
import styles from './Inbox.module.css'

const emptyFields = (): SpecimenFields => ({
  speciesId: 0,
  form: null,
  shiny: false,
  shadowStatus: 'none',
  costume: null,
  background: null,
  hundo: false,
  nundo: false,
  extraTags: [],
})

export function InboxPage() {
  const { showToast } = useToast()
  const items = useLiveQuery(() => db.inbox.orderBy('createdAt').reverse().toArray(), []) ?? []
  const [active, setActive] = useState<InboxRow | null>(null)
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

  return (
    <section>
      <h1 className="page-title" data-tone="inbox">
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
              onDiscard={() => {
                void discardInbox(item.id)
                  .then(() => showToast('Screenshot discarded', 'success'))
                  .catch((err) =>
                    showToast(err instanceof Error ? err.message : 'Could not discard'),
                  )
              }}
            />
          ))}
        </div>
      )}
      <TagSheet
        item={active}
        onClose={() => setActive(null)}
        onSaved={(duplicate, cloudError) => {
          setActive(null)
          if (duplicate) showToast('Same look already in the collection', 'warning')
          if (cloudError) showToast(cloudError, 'warning')
          else if (!duplicate) showToast('Specimen saved', 'success')
        }}
        onWarning={(message) => showToast(message, 'warning')}
        onError={(message) => showToast(message)}
      />
    </section>
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
        <button type="button" className="btn" onClick={onDiscard}>
          Discard
        </button>
      </div>
    </div>
  )
}

function TagSheet({
  item,
  onClose,
  onSaved,
  onWarning,
  onError,
}: {
  item: InboxRow | null
  onClose: () => void
  onSaved: (duplicate: boolean, cloudError?: string) => void
  onWarning: (message: string) => void
  onError: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [fields, setFields] = useState<SpecimenFields>(emptyFields)
  const [busy, setBusy] = useState(false)
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const tagChoices = useMemo(() => specimenTagChoices(categories), [categories])
  const tags = specimenTags(fields)
  const matches = useMemo(() => {
    if (!query.trim()) return []
    return searchSpecies(query).slice(0, 12)
  }, [query])
  const selected = fields.speciesId ? SPECIES_BY_ID.get(fields.speciesId) : undefined

  useEffect(() => {
    setQuery('')
    setFields(emptyFields())
  }, [item?.id])

  async function save() {
    if (!item) return
    const warning = specimenSaveWarning(fields)
    if (warning) {
      onWarning(warning)
      return
    }
    setBusy(true)
    try {
      const result = await saveSpecimenFromInbox(item.id, {
        ...fields,
        costume: normalizeOptionalName(fields.costume),
        background: normalizeOptionalName(fields.background),
      })
      onSaved(result.duplicate, result.cloudError)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={Boolean(item)} title="Tag screenshot" onClose={onClose}>
      <SearchField value={query} onChange={setQuery} placeholder="Species name or number" />
      {selected ? <p className="page-sub">Selected: {selected.name}</p> : null}
      {matches.length > 0 ? (
        <div className={styles.speciesList}>
          {matches.map((species) => (
            <button
              key={species.id}
              type="button"
              data-on={fields.speciesId === species.id ? 'true' : 'false'}
              onClick={() => {
                setFields((f) => ({ ...f, speciesId: species.id }))
                setQuery('')
              }}
            >
              #{String(species.id).padStart(4, '0')} {species.name}
            </button>
          ))}
        </div>
      ) : null}
      <div className="field">
        <span>Tags</span>
        <div className="chip-row">
          {tagChoices.map((choice) => (
            <TagChip
              key={choice.tag}
              tag={choice.tag}
              selected={tags.includes(choice.tag)}
              icon={choice.icon}
              label={choice.label}
              labelColor={choice.labelColor}
              onClick={() => setFields((f) => toggleTag(f, choice.tag))}
            />
          ))}
        </div>
      </div>
      {fields.costume !== null ? (
        <label className="field">
          <span>Costume name</span>
          <input
            value={fields.costume}
            onChange={(e) => setFields((f) => ({ ...f, costume: e.target.value }))}
            placeholder="Holiday hat"
          />
        </label>
      ) : null}
      {fields.background !== null ? (
        <label className="field">
          <span>Background</span>
          <input
            value={fields.background}
            onChange={(e) => setFields((f) => ({ ...f, background: e.target.value }))}
            placeholder="Tokyo"
          />
        </label>
      ) : null}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save specimen'}
      </button>
    </BottomSheet>
  )
}
