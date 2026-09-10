import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryForTag, SEEN_ICON, specimenTagChoices } from '../data/navIcons'
import { cropHeightForTags } from '../data/tagCrops'
import { SPECIES_BY_ID } from '../data/species'
import { useImageUrl } from '../hooks/useImageUrl'
import { useTagCropHeights } from '../hooks/useCropSettings'
import { updateSpecimen } from '../lib/collection'
import { db, type SpecimenRow } from '../lib/db'
import { cropBottomFromBlob, SCREENSHOT_WIDTH } from '../lib/images'
import {
  applyRosterSlot,
  limitedRosterWarning,
  normalizeVariant,
  searchSlots,
  slotBoxLabel,
  slotDisplayName,
  slotsForSelectedTags,
  slotVariantForTrack,
  variantFieldComesFromSlot,
  type TagCatalog,
} from '../lib/roster'
import { parseCropBottom } from '../lib/screenshotCrop'
import { useToast } from '../lib/toast'
import {
  cropTagsFromFields,
  fieldsFromSpecimen,
  labelForTag,
  normalizeOptionalName,
  specimenSaveWarning,
  specimenTags,
  toggleTag,
  type SpecimenFields,
  type TagId,
} from '../lib/tags'
import { BottomSheet } from './BottomSheet'
import { SearchField } from './SearchField'
import { TagChip } from './TagChip'
import styles from './TagSheet.module.css'

const emptyFields = (): SpecimenFields => ({
  speciesId: 0,
  form: null,
  shiny: false,
  shadowStatus: 'none',
  costume: null,
  background: null,
  gender: null,
  hundo: false,
  nundo: false,
  extraTags: ['basic'],
  silhouette: false,
})

function rosterVariantNames(
  roster: readonly { tag: string; speciesId: number; variant: string }[],
  tag: TagId,
  speciesId: number,
) {
  const names = new Set<string>()
  for (const row of roster) {
    if (row.tag !== tag) continue
    if (speciesId && row.speciesId !== speciesId) continue
    const name = normalizeVariant(row.variant)
    if (name) names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

function selectedSlotLabel(
  fields: SpecimenFields,
  tags: TagId[],
  catalogs: readonly TagCatalog[],
) {
  const species = fields.speciesId ? SPECIES_BY_ID.get(fields.speciesId) : undefined
  if (!species) return ''
  const variant = slotVariantForTrack(fields, tags, catalogs)
  return slotBoxLabel({
    speciesId: species.id,
    variant,
    name: slotDisplayName(species.id, variant),
  })
}

type SheetTab = 'tags' | 'crop'

type TagSheetProps = {
  open: boolean
  title: string
  resetKey: string
  imageId?: string
  initialFields?: SpecimenFields
  saveLabel: string
  tone: string
  nested?: boolean
  onClose: () => void
  onSave: (fields: SpecimenFields, cropBottom: number) => Promise<void>
  onWarning: (message: string) => void
  onError: (message: string) => void
}

export function TagSheet({
  open,
  title,
  resetKey,
  imageId,
  initialFields,
  saveLabel,
  tone,
  nested = false,
  onClose,
  onSave,
  onWarning,
  onError,
}: TagSheetProps) {
  const [tab, setTab] = useState<SheetTab>('tags')
  const [query, setQuery] = useState('')
  const [fields, setFields] = useState<SpecimenFields>(emptyFields)
  const [busy, setBusy] = useState(false)
  const [heightDraft, setHeightDraft] = useState('710')
  const [storedCrop, setStoredCrop] = useState<number | null>(null)
  const openedKey = useRef<string | null>(null)
  const keepStoredCrop = useRef(true)
  const initialFieldsRef = useRef(initialFields)
  initialFieldsRef.current = initialFields
  const previewUrl = useImageUrl(imageId, 'original')
  const heightMap = useTagCropHeights()
  const categories = useLiveQuery(() => db.categories.orderBy('sortOrder').toArray(), []) ?? []
  const catalogs = useLiveQuery(() => db.tagCatalogs.toArray(), []) ?? []
  const roster = useLiveQuery(() => db.tagRoster.toArray(), []) ?? []
  const tagChoices = useMemo(() => specimenTagChoices(categories), [categories])
  const tags = specimenTags(fields)
  const suggestedHeight = cropHeightForTags(cropTagsFromFields(fields), heightMap)
  const cropBottom = parseCropBottom(heightDraft, suggestedHeight)
  const selectedLabel = selectedSlotLabel(fields, tags, catalogs)
  const availableSlots = useMemo(
    () => slotsForSelectedTags(tags, catalogs, roster),
    [tags, catalogs, roster],
  )
  const costumeFromSlot = variantFieldComesFromSlot('costume', tags, catalogs, availableSlots)
  const backgroundFromSlot = variantFieldComesFromSlot(
    'background',
    tags,
    catalogs,
    availableSlots,
  )
  const costumeNames = useMemo(
    () => rosterVariantNames(roster, 'costume', fields.speciesId),
    [roster, fields.speciesId],
  )
  const backgroundNames = useMemo(
    () => rosterVariantNames(roster, 'background', fields.speciesId),
    [roster, fields.speciesId],
  )
  const matches = useMemo(() => {
    if (!query.trim() || query === selectedLabel) return []
    return searchSlots(availableSlots, query).slice(0, 12)
  }, [query, selectedLabel, availableSlots])
  useEffect(() => {
    if (!open) {
      openedKey.current = null
      keepStoredCrop.current = true
      setStoredCrop(null)
      return
    }
    setTab('tags')
    setBusy(false)
    keepStoredCrop.current = true
    const seed = initialFieldsRef.current
    const next = seed ? fieldsFromSpecimen(seed) : emptyFields()
    setFields(next)
    const species = next.speciesId ? SPECIES_BY_ID.get(next.speciesId) : undefined
    setQuery(species ? selectedSlotLabel(next, specimenTags(next), []) : '')
  }, [open, resetKey])

  useEffect(() => {
    if (!open || !imageId || !initialFieldsRef.current) {
      setStoredCrop(null)
      return
    }
    let cancelled = false
    db.images
      .get(imageId)
      .then((row) => (row?.original ? cropBottomFromBlob(row.original) : null))
      .then((value) => {
        if (!cancelled) setStoredCrop(value)
      })
      .catch(() => {
        if (!cancelled) setStoredCrop(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, resetKey, imageId])

  useEffect(() => {
    if (!open) return
    if (openedKey.current !== resetKey) {
      openedKey.current = resetKey
      keepStoredCrop.current = true
      setHeightDraft(String(storedCrop ?? suggestedHeight))
      return
    }
    if (keepStoredCrop.current && storedCrop != null) {
      keepStoredCrop.current = false
      setHeightDraft(String(storedCrop))
      return
    }
    keepStoredCrop.current = false
    setHeightDraft(String(suggestedHeight))
  }, [open, resetKey, suggestedHeight, storedCrop])

  async function save() {
    let warning = specimenSaveWarning(fields)
    if (
      warning === 'Enter a costume name' &&
      variantFieldComesFromSlot('costume', tags, catalogs, availableSlots)
    ) {
      warning = 'Pick a released costume'
    } else if (
      warning === 'Enter a background name' &&
      variantFieldComesFromSlot('background', tags, catalogs, availableSlots)
    ) {
      warning = 'Pick a released background'
    } else if (warning === 'Pick a gender variant') {
      warning = 'Pick a released gender variant'
    }
    if (!warning) {
      warning = limitedRosterWarning(fields, catalogs, roster, (tag) =>
        categoryForTag(categories, tag)?.name ?? labelForTag(tag),
      )
    }
    if (warning) {
      onWarning(warning)
      return
    }
    setBusy(true)
    try {
      await onSave(
        {
          ...fields,
          costume: normalizeOptionalName(fields.costume),
          background: normalizeOptionalName(fields.background),
          gender: fields.gender != null ? normalizeOptionalName(fields.gender) : null,
        },
        cropBottom,
      )
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} title={title} nested={nested} showClose={false} onClose={onClose}>
      <div className={styles.tabs} role="tablist" aria-label={title} data-tone={tone}>
        <button
          type="button"
          role="tab"
          data-tone={tone}
          data-on={tab === 'tags' ? 'true' : 'false'}
          aria-selected={tab === 'tags'}
          onClick={() => setTab('tags')}
        >
          <span aria-hidden="true">🏷️</span>
          Tags
        </button>
        <button
          type="button"
          role="tab"
          data-tone={tone}
          data-on={tab === 'crop' ? 'true' : 'false'}
          aria-selected={tab === 'crop'}
          onClick={() => setTab('crop')}
        >
          <span aria-hidden="true">✂️</span>
          Crop
        </button>
      </div>
      {tab === 'tags' ? (
        <>
          {previewUrl ? (
            <div className={styles.shotPreview}>
              <img src={previewUrl} alt="" />
            </div>
          ) : null}
          <SearchField
            value={query}
            onChange={(value) => {
              setQuery(value)
              setFields((f) => {
                if (!f.speciesId) return f
                if (value === selectedSlotLabel(f, specimenTags(f), catalogs)) return f
                return { ...f, speciesId: 0 }
              })
            }}
            placeholder="Species name or number"
          />
          {matches.length > 0 ? (
            <div className={styles.speciesList}>
              {matches.map((slot) => {
                const label = slotBoxLabel(slot)
                return (
                  <button
                    key={`${slot.speciesId}:${slot.variant}`}
                    type="button"
                    data-on={query === label ? 'true' : 'false'}
                    onClick={() => {
                      setFields((f) => applyRosterSlot(f, slot, specimenTags(f), catalogs))
                      setQuery(label)
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          ) : null}
          <div className="field">
            <span>Tags</span>
            <div className="chip-row">
              {tagChoices.map((choice) => (
                <TagChip
                  key={choice.tag ?? 'empty-look'}
                  tag={choice.tag ?? 'living'}
                  selected={choice.tag != null && tags.includes(choice.tag)}
                  icon={choice.icon}
                  label={choice.label}
                  labelColor={choice.labelColor}
                  onClick={() => {
                    if (choice.tag == null) return
                    setFields({ ...toggleTag(fields, choice.tag), speciesId: 0 })
                    setQuery('')
                  }}
                />
              ))}
            </div>
          </div>
          {fields.costume !== null && !costumeFromSlot ? (
            <label className="field">
              <span>Costume name</span>
              <input
                value={fields.costume}
                list="tag-costume-names"
                onChange={(e) => {
                  const costume = e.target.value
                  setFields((current) => {
                    const next = { ...current, costume }
                    const label = selectedSlotLabel(next, specimenTags(next), catalogs)
                    if (label) setQuery(label)
                    return next
                  })
                }}
                placeholder="Party Hat"
              />
              {costumeNames.length > 0 ? (
                <datalist id="tag-costume-names">
                  {costumeNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              ) : null}
            </label>
          ) : null}
          {fields.background !== null && !backgroundFromSlot ? (
            <label className="field">
              <span>Background</span>
              <input
                value={fields.background}
                list="tag-background-names"
                onChange={(e) => {
                  const background = e.target.value
                  setFields((current) => {
                    const next = { ...current, background }
                    const label = selectedSlotLabel(next, specimenTags(next), catalogs)
                    if (label) setQuery(label)
                    return next
                  })
                }}
                placeholder="Tokyo"
              />
              {backgroundNames.length > 0 ? (
                <datalist id="tag-background-names">
                  {backgroundNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              ) : null}
            </label>
          ) : null}
          <label className={styles.checkRow}>
            <span className={styles.checkCopy}>
              <span aria-hidden="true">{SEEN_ICON}</span>
              Seen
            </span>
            <input
              type="checkbox"
              checked={Boolean(fields.silhouette)}
              onChange={(e) => setFields((f) => ({ ...f, silhouette: e.target.checked }))}
            />
          </label>
        </>
      ) : (
        <>
          {previewUrl ? (
            <div
              className={styles.cropPreview}
              style={{ aspectRatio: `${SCREENSHOT_WIDTH} / ${cropBottom}` }}
            >
              <img src={previewUrl} alt="" />
            </div>
          ) : null}
          <label className="field">
            <span>Height</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1600}
              value={heightDraft}
              onChange={(e) => setHeightDraft(e.target.value)}
              onBlur={() => setHeightDraft(String(cropBottom))}
            />
          </label>
          <p className="page-sub">
            Follows the tallest selected tag. Changing this number crops this screenshot only.
          </p>
        </>
      )}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : saveLabel}
      </button>
    </BottomSheet>
  )
}

export function SpecimenTagSheet({
  specimen,
  onClose,
  onSaved,
}: {
  specimen: SpecimenRow | null
  onClose: () => void
  onSaved: (specimen: SpecimenRow) => void
}) {
  const { showToast } = useToast()
  return (
    <TagSheet
      open={Boolean(specimen)}
      title="Edit tags"
      resetKey={specimen?.id ?? ''}
      imageId={specimen?.imageId}
      initialFields={specimen ?? undefined}
      saveLabel="Save tags"
      tone="living"
      nested
      onClose={onClose}
      onSave={async (fields, cropBottom) => {
        if (!specimen) return
        const result = await updateSpecimen(specimen.id, fields, cropBottom)
        if (result.duplicate) showToast('Same look already in the collection', 'warning')
        if (result.cloudError) showToast(result.cloudError, 'warning')
        else if (!result.duplicate) showToast('Tags saved', 'success')
        onSaved(result.specimen)
      }}
      onWarning={(message) => showToast(message, 'warning')}
      onError={(message) => showToast(message)}
    />
  )
}
