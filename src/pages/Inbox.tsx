import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '../components/BottomSheet'
import { SearchField } from '../components/SearchField'
import { TagChip } from '../components/TagChip'
import { TrackChip } from '../components/TrackChip'
import { iconForForm, toneForForm } from '../data/navIcons'
import { COMMON_FORMS, searchSpecies, SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { RestoreGalleryButton } from '../components/RestoreGalleryButton'
import {
  discardInbox,
  importPendingShares,
  ingestFile,
  saveSpecimenFromInbox,
} from '../lib/collection'
import { db, type InboxRow } from '../lib/db'
import { useToast } from '../lib/toast'
import {
  specimenTags,
  TAG_IDS,
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
})

export function InboxPage() {
  const { showToast } = useToast()
  const items = useLiveQuery(() => db.inbox.orderBy('createdAt').reverse().toArray(), []) ?? []
  const [active, setActive] = useState<InboxRow | null>(null)

  useEffect(() => {
    importPendingShares().catch(() => {
      showToast('Could not import a shared screenshot')
    })
  }, [showToast])

  async function onFiles(list: FileList | null) {
    if (!list) return
    for (const file of [...list]) {
      if (!file.type.startsWith('image/')) {
        showToast('That file is not an image')
        continue
      }
      try {
        await ingestFile(file)
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not add screenshot')
      }
    }
  }

  return (
    <section>
      <h1 className="page-title" data-tone="inbox">
        Inbox
      </h1>
      <p className="page-sub">Share a screenshot from your phone, then tag it here.</p>
      <div className="row-actions" style={{ marginBottom: '1rem' }}>
        <label className="btn btn-primary" style={{ display: 'inline-grid', placeItems: 'center' }}>
          Add screenshots
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void onFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <RestoreGalleryButton />
      </div>
      {items.length === 0 ? (
        <p className="empty-state">Nothing waiting. Catch something, screenshot it, share it here.</p>
      ) : (
        <div className={styles.list} style={{ marginTop: '1rem' }}>
          {items.map((item) => (
            <InboxItem
              key={item.id}
              item={item}
              onTag={() => setActive(item)}
              onDiscard={() => {
                void discardInbox(item.id).catch(() => showToast('Could not discard'))
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
        }}
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
  onError,
}: {
  item: InboxRow | null
  onClose: () => void
  onSaved: (duplicate: boolean, cloudError?: string) => void
  onError: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [fields, setFields] = useState<SpecimenFields>(emptyFields)
  const [busy, setBusy] = useState(false)
  const tags = specimenTags(fields)
  const matches = useMemo(() => searchSpecies(query).slice(0, 12), [query])
  const selected = fields.speciesId ? SPECIES_BY_ID.get(fields.speciesId) : undefined

  useEffect(() => {
    setQuery('')
    setFields(emptyFields())
  }, [item?.id])

  async function save() {
    if (!item) return
    if (!fields.speciesId) {
      onError('Pick a species first')
      return
    }
    setBusy(true)
    try {
      const result = await saveSpecimenFromInbox(item.id, {
        ...fields,
        costume: fields.costume === null ? null : fields.costume.trim() || '',
        background: fields.background === null ? null : fields.background.trim() || '',
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
      <div className={styles.speciesList}>
        {matches.map((species) => (
          <button
            key={species.id}
            type="button"
            data-on={fields.speciesId === species.id ? 'true' : 'false'}
            onClick={() => setFields((f) => ({ ...f, speciesId: species.id }))}
          >
            #{String(species.id).padStart(4, '0')} {species.name}
          </button>
        ))}
      </div>
      <div className="field">
        <span>Form</span>
        <div className="chip-row">
          <TrackChip
            icon={iconForForm(null)}
            tone={toneForForm(null)}
            label="Default"
            active={!fields.form}
            onClick={() => setFields((f) => ({ ...f, form: null }))}
          />
          {COMMON_FORMS.map((form) => (
            <TrackChip
              key={form}
              icon={iconForForm(form)}
              tone={toneForForm(form)}
              label={form}
              active={fields.form === form}
              onClick={() => setFields((f) => ({ ...f, form }))}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <span>Tags</span>
        <div className="chip-row">
          {TAG_IDS.map((tag) => (
            <TagChip
              key={tag}
              tag={tag}
              selected={tags.includes(tag)}
              onClick={() => setFields((f) => toggleTag(f, tag))}
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
      <p className="page-sub">
        Living cover stays green only for a default look (no tags). Extra tags can still fill other
        dex tracks.
      </p>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save specimen'}
      </button>
    </BottomSheet>
  )
}
